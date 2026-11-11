import Anthropic from "@anthropic-ai/sdk";
import type { Collected } from "./collectors/index.js";
import type { Confidence, Evidence, Finding } from "./types.js";

export const DEFAULT_MODEL = "claude-fable-5-2";

export interface Synthesis {
  mode: "claude" | "heuristic";
  model?: string;
  note?: string;
  summary: string;
  findings: Finding[];
}

interface Draft {
  claim: string;
  evidenceIds: string[];
  /** "observed" restates what a source shows; "inferred" interprets it. */
  kind: "observed" | "inferred";
  unknowns: string[];
}

const ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

/**
 * Confidence is a function of the evidence, not of how sure the prose sounds:
 *   observed + two or more distinct sources -> high
 *   observed + one source                   -> medium
 *   inferred + two or more signal types     -> medium
 *   inferred + one signal type              -> low
 */
export function grade(evidence: Evidence[], kind: Draft["kind"]): Confidence {
  const sources = new Set(evidence.map((e) => e.source)).size;
  const signals = new Set(evidence.map((e) => e.signal)).size;
  if (kind === "observed") return sources >= 2 ? "high" : "medium";
  return signals >= 2 ? "medium" : "low";
}

const an = (word: string): string => (/^[aeiou]/i.test(word) ? "an" : "a");

const list = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

function finalize(drafts: Draft[], all: Evidence[]): Finding[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  return drafts
    .map((d) => {
      const evidence = [...new Set(d.evidenceIds)].map((id) => byId.get(id)).filter((e): e is Evidence => !!e);
      return { claim: d.claim, evidence, confidence: grade(evidence, d.kind), unknowns: d.unknowns };
    })
    .filter((f) => f.evidence.length > 0) // A claim without a source is not a finding.
    .sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence]);
}

/** Deterministic, offline synthesis. Used when no Claude credentials are available or --no-llm is passed. */
export function synthesizeHeuristic(target: string, c: Collected, all: Evidence[]): Synthesis {
  const drafts: Draft[] = [];
  const tech = c.tech?.ok ? c.tech.data : null;
  const dns = c.dns?.ok ? c.dns.data : null;
  const pricing = c.pricing?.ok ? c.pricing.data : null;
  const careers = c.careers?.ok ? c.careers.data : null;
  const changelog = c.changelog?.ok ? c.changelog.data : null;
  const reviews = c.reviews?.ok ? c.reviews.data : null;

  const techByName = new Map((tech?.technologies ?? []).map((t) => [t.name, t]));
  const dnsByName = new Map((dns?.vendors ?? []).map((v) => [v.name, v]));
  const corroborated = new Set<string>();

  if (tech) {
    const built = tech.technologies.filter((t) => ["framework", "cms", "commerce"].includes(t.category));
    const served = tech.technologies.filter((t) => ["hosting", "cdn", "server"].includes(t.category));
    if (built.length || served.length) {
      const parts: string[] = [];
      if (built.length) parts.push(`is built with ${list(built.map((t) => t.name))}`);
      if (served.length) parts.push(`is served through ${list(served.map((t) => t.name))}`);
      drafts.push({
        claim: `The public website ${parts.join(" and ")}.`,
        evidenceIds: [...built, ...served].flatMap((t) => t.evidenceIds),
        kind: "observed",
        unknowns: ["Whether the logged-in product shares this stack is not visible from the marketing site."],
      });
    }
  }

  // Vendors seen by two independent collectors.
  for (const [name, t] of techByName) {
    const v = dnsByName.get(name);
    if (!v) continue;
    corroborated.add(name);
    drafts.push({
      claim: `${name} is in active use (${t.category}; ${v.role}): it appears both in the site's page source and in the domain's DNS records.`,
      evidenceIds: [...t.evidenceIds, ...v.evidenceIds],
      kind: "observed",
      unknowns: [`How much of the business runs through ${name}, and on which plan, is not public.`],
    });
  }

  if (tech) {
    const tools = tech.technologies.filter(
      (t) => !["framework", "cms", "commerce", "hosting", "cdn", "server"].includes(t.category) && !corroborated.has(t.name),
    );
    if (tools.length) {
      const grouped = new Map<string, string[]>();
      for (const t of tools) grouped.set(t.category, [...(grouped.get(t.category) ?? []), t.name]);
      drafts.push({
        claim: `The site loads third-party tools for ${list([...grouped].map(([cat, names]) => `${cat} (${names.join(", ")})`))}.`,
        evidenceIds: tools.flatMap((t) => t.evidenceIds),
        kind: "observed",
        unknowns: ["A script tag proves a tool is loaded, not that it is the system of record."],
      });
    }
  }

  if (dns) {
    const only = dns.vendors.filter((v) => !corroborated.has(v.name));
    if (only.length) {
      drafts.push({
        claim: `The domain is configured for ${list(only.map((v) => `${v.name} (${v.role})`))}.`,
        evidenceIds: only.flatMap((v) => v.evidenceIds),
        kind: "observed",
        unknowns: ["A verification record can outlive the trial or contract that created it."],
      });
    }
  }

  if (tech && dns) {
    const dmarcEv = all.find((e) => e.signal === "dns" && e.source.includes("_dmarc"));
    const headersEv = all.find((e) => e.signal === "tech" && e.excerpt.startsWith("Security headers"));
    const policy = /p=(\w+)/i.exec(dns.dmarc ?? "")?.[1]?.toLowerCase();
    if (dmarcEv && headersEv) {
      const mail = policy ? `publishes a DMARC policy of "${policy}"` : "publishes no DMARC policy";
      const missing = tech.securityHeaders.missing;
      const web = missing.length
        ? `the homepage omits ${list(missing)}`
        : "the homepage sends all five baseline security headers checked";
      drafts.push({
        claim: `Baseline security hygiene: the domain ${mail}, and ${web}.`,
        evidenceIds: [dmarcEv.id, headersEv.id],
        kind: "observed",
        unknowns: ["Headers and DNS policy say nothing about application security or internal controls."],
      });
    }
  }

  if (pricing && pricing.snapshots.length) {
    const first = pricing.snapshots[0]!;
    const last = pricing.snapshots[pricing.snapshots.length - 1]!;
    if (pricing.changes.length) {
      const phrases = pricing.changes.slice(0, 5).map((ch) => {
        const when = ch.to === "live" ? "by today" : `by ${ch.to}`;
        if (ch.kind === "price-change") return `${ch.plan} moved from ${ch.before} to ${ch.after} ${when}`;
        if (ch.kind === "added") return `${an(ch.plan)} ${ch.plan} plan (${ch.after}) appeared ${when}`;
        return `the ${ch.plan} plan (${ch.before}) was gone ${when}`;
      });
      drafts.push({
        claim: `Public pricing changed ${pricing.changes.length} time${pricing.changes.length === 1 ? "" : "s"} across ${pricing.snapshots.length} captures since ${first.date}: ${phrases.join("; ")}.`,
        evidenceIds: pricing.snapshots.map((s) => s.evidenceId),
        kind: "observed",
        unknowns: [
          "The exact date of each change lies somewhere between two captures.",
          "Whether existing customers were grandfathered is not public.",
        ],
      });
    } else {
      drafts.push({
        claim:
          pricing.snapshots.length > 1
            ? `List prices are unchanged across ${pricing.snapshots.length} captures since ${first.date}: ${last.plans.map((p) => `${p.name} ${p.price}`).join(", ")}.`
            : `Current list prices: ${last.plans.map((p) => `${p.name} ${p.price}`).join(", ") || "none recognised"}.`,
        evidenceIds: pricing.snapshots.map((s) => s.evidenceId),
        kind: "observed",
        unknowns: ["Without archived captures there is no pricing history to compare against."],
      });
    }

    const upmarket = pricing.changes.filter(
      (ch) =>
        (ch.kind === "added" && /enterprise|business|scale|corporate/i.test(ch.plan)) ||
        (ch.kind === "removed" && /free|hobby|starter/i.test(ch.plan)),
    );
    if (upmarket.length) {
      const ids = upmarket.flatMap((ch) => ch.evidenceIds);
      const support: string[] = [];
      const enterpriseRoles = (careers?.roles ?? []).filter((r) => /enterprise|solutions|account executive|security|compliance/i.test(r.title));
      if (careers && enterpriseRoles.length) {
        support.push("is hiring for enterprise-facing roles");
        ids.push(...careers.evidenceIds.roles.filter((id) => all.some((e) => e.id === id && enterpriseRoles.some((r) => e.excerpt.startsWith(r.title)))));
      }
      if (changelog?.themes["Enterprise & security"] && changelog.evidenceIds.themes) {
        support.push("has been shipping enterprise and security features");
        ids.push(changelog.evidenceIds.themes);
      }
      drafts.push({
        claim: `The company appears to be moving upmarket: ${list(upmarket.map((ch) => (ch.kind === "added" ? `it added ${an(ch.plan)} ${ch.plan} plan` : `it dropped its ${ch.plan} plan`)))}${support.length ? `, and it ${list(support)}` : ""}.`,
        evidenceIds: ids,
        kind: "inferred",
        unknowns: [
          "This is an interpretation of public signals; the company has not been asked and its internal strategy is unknown.",
          "Revenue mix by customer size is not public.",
        ],
      });
    }
  }

  if (careers && careers.roles.length) {
    const top = Object.entries(careers.byTeam).sort((a, b) => b[1] - a[1]).slice(0, 3);
    drafts.push({
      claim: `${careers.roles.length} open roles are advertised, concentrated in ${list(top.map(([team, n]) => `${team} (${n})`))}.`,
      evidenceIds: [careers.evidenceIds.summary, ...careers.evidenceIds.roles.slice(0, 5)].filter((id): id is string => !!id),
      kind: "observed",
      unknowns: ["Open roles are not headcount: backfills, evergreen postings and unlisted hires are indistinguishable from outside."],
    });

    const mentioned = Object.keys(careers.techMentions);
    const confirmed = mentioned.filter((m) => techByName.has(m));
    if (confirmed.length && careers.evidenceIds.tech) {
      drafts.push({
        claim: `Job text names ${list(confirmed)}, matching what the site itself runs.`,
        evidenceIds: [careers.evidenceIds.tech, ...confirmed.flatMap((m) => techByName.get(m)!.evidenceIds)],
        kind: "observed",
        unknowns: [],
      });
    }
    const hidden = mentioned.filter((m) => !techByName.has(m)).slice(0, 8);
    if (hidden.length && careers.evidenceIds.tech) {
      drafts.push({
        claim: `The backend likely involves ${list(hidden)}: these are named in job text but cannot be confirmed from outside.`,
        evidenceIds: [careers.evidenceIds.tech],
        kind: "inferred",
        unknowns: [
          "Job posts mix current stack, planned migrations and nice-to-haves.",
          "No server-side technology can be verified without access the tool does not seek.",
        ],
      });
    }
  }

  if (changelog && changelog.entries.length) {
    const themes = Object.entries(changelog.themes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    const cadence =
      changelog.medianGapDays !== null
        ? `roughly every ${changelog.medianGapDays} days (${changelog.entries.length} entries from ${changelog.first} to ${changelog.last})`
        : `${changelog.entries.length} entries`;
    drafts.push({
      claim: `The company announces product updates ${cadence}${themes.length ? `; the most frequent theme${themes.length === 1 ? " is" : "s are"} ${list(themes)}` : ""}.`,
      evidenceIds: [changelog.evidenceIds.cadence, changelog.evidenceIds.themes, ...changelog.evidenceIds.entries.slice(0, 4)].filter(
        (id): id is string => !!id,
      ),
      kind: "observed",
      unknowns: ["Announced releases undercount actual shipping; fixes and internal work are rarely listed."],
    });
  }

  if (reviews && reviews.count && reviews.evidenceIds.summary) {
    const complaints = Object.entries(reviews.complaints).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    drafts.push({
      claim: `The ${reviews.count} most recent App Store reviews average ${reviews.average}/5, with ${reviews.lowShare}% at 1-2 stars${complaints.length ? `; the commonest complaints concern ${list(complaints)}` : ""}.`,
      evidenceIds: [reviews.evidenceIds.summary, reviews.evidenceIds.complaints, ...reviews.evidenceIds.samples].filter((id): id is string => !!id),
      kind: "observed",
      unknowns: ["This is a recent sample from one storefront, not the lifetime rating."],
    });

    const versions = Object.entries(reviews.byVersion).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
    const [latest, previous] = versions;
    if (latest && previous && latest[1].count >= 3 && previous[1].average - latest[1].average >= 0.8) {
      drafts.push({
        claim: `Version ${latest[0]} of the app may have introduced a regression: its reviews average ${latest[1].average} against ${previous[1].average} for version ${previous[0]}.`,
        evidenceIds: [reviews.evidenceIds.summary, reviews.evidenceIds.complaints].filter((id): id is string => !!id),
        kind: "inferred",
        unknowns: ["Small per-version samples; a rating dip can also follow a pricing or policy change rather than a bug."],
      });
    }
  }

  const findings = finalize(drafts, all);
  return { mode: "heuristic", summary: summarize(target, findings, all), findings };
}

function summarize(target: string, findings: Finding[], all: Evidence[]): string {
  const signals = new Set(all.map((e) => e.signal)).size;
  const counts = (["high", "medium", "low"] as Confidence[])
    .map((level) => [level, findings.filter((f) => f.confidence === level).length] as const)
    .filter(([, n]) => n)
    .map(([level, n]) => `${n} ${level}`)
    .join(", ");
  return (
    `${findings.length} findings about ${target}, drawn from ${all.length} pieces of public evidence across ${signals} signal type${signals === 1 ? "" : "s"} ` +
    `(confidence: ${counts || "n/a"}). Every claim below cites the evidence it rests on and lists what could not be established.`
  );
}

const SYSTEM_PROMPT = `You are the synthesis step of Outside-In, a tool that profiles a company strictly from public signals.

You receive evidence items collected by code: each has an id, a signal type (tech, pricing, careers, changelog, dns, reviews), a source URL and an excerpt. You also receive the structured data each collector derived.

Write the findings an analyst would want: what the company is evidently doing, shipping, charging, hiring for and running on. The reader will act on these, so the standard is that every claim can be checked by following its citations.

Rules that keep the report trustworthy:
- Every finding cites one or more evidence ids from the input. Never cite an id that is not in the input and never state anything the cited evidence does not support.
- Separate observation from interpretation. Use "high" only when two or more independent sources show the claim directly, "medium" for a single direct observation or an inference backed by two signal types, and "low" for an inference from one signal. When unsure, pick the lower level.
- "unknowns" lists what this evidence cannot establish about the claim. Be specific; an empty list is acceptable only for a purely factual observation.
- Combine signals where they corroborate each other (a vendor seen in both page source and DNS; a pricing change that lines up with hiring). Those cross-signal findings are the most valuable.
- No personal data. Do not name or describe individual employees, reviewers or recruiters, even if an excerpt seems to contain one.
- Do not speculate about anything non-public: revenue, funding, customers, security weaknesses or internal plans.

Return 5 to 12 findings, most confident first, and a summary of two or three sentences.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          evidence_ids: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          unknowns: { type: "array", items: { type: "string" } },
        },
        required: ["claim", "evidence_ids", "confidence", "unknowns"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
} as const;

interface ModelOutput {
  summary: string;
  findings: { claim: string; evidence_ids: string[]; confidence: Confidence; unknowns: string[] }[];
}

/** Synthesis by Claude. The model proposes; the code then verifies every citation and caps over-confident grades. */
export async function synthesizeWithClaude(
  target: string,
  c: Collected,
  all: Evidence[],
  model = DEFAULT_MODEL,
): Promise<Synthesis> {
  const client = new Anthropic();
  const payload = {
    target,
    evidence: all.map(({ id, signal, source, excerpt, note }) => ({ id, signal, source, excerpt, note })),
    collectors: Object.fromEntries(
      Object.entries(c).map(([signal, result]) => [signal, { ok: result.ok, data: result.data, unknowns: result.unknowns }]),
    ),
  };

  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // If a safety classifier declines the request, the API re-runs it on a fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined to synthesise this evidence.");
  if (response.stop_reason === "max_tokens") throw new Error("The synthesis was cut off before it finished.");
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The model returned no text.");
  const output = JSON.parse(text.text) as ModelOutput;

  const byId = new Map(all.map((e) => [e.id, e]));
  let dropped = 0;
  const findings: Finding[] = [];
  for (const f of output.findings) {
    const evidence = [...new Set(f.evidence_ids)].map((id) => byId.get(id)).filter((e): e is Evidence => !!e);
    if (!evidence.length) {
      dropped++;
      continue;
    }
    // Ceiling from the evidence itself: one source can never carry a "high".
    const ceiling = grade(evidence, "observed");
    const confidence = ORDER[f.confidence] < ORDER[ceiling] ? ceiling : f.confidence;
    findings.push({ claim: f.claim, evidence, confidence, unknowns: f.unknowns });
  }
  findings.sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence]);

  return {
    mode: "claude",
    model: response.model,
    ...(dropped ? { note: `${dropped} finding(s) were dropped because they cited no valid evidence id.` } : {}),
    summary: output.summary,
    findings,
  };
}
