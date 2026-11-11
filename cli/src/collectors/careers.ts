import * as cheerio from "cheerio";
import { describeFailure, squash, type Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export interface Role {
  title: string;
  team: string;
  location?: string;
  posted?: string;
  url?: string;
}

export interface CareersData {
  careersUrl: string | null;
  roles: Role[];
  byTeam: Record<string, number>;
  techMentions: Record<string, number>;
  ats: string | null;
  evidenceIds: { roles: string[]; tech?: string; ats?: string; summary?: string };
}

const TEAMS: [string, RegExp][] = [
  ["Machine learning", /\b(machine learning|ml|ai|data scien|research scientist|llm)\b/i],
  ["Data", /\b(data engineer|analytics|analyst|bi)\b/i],
  ["Security", /\b(security|compliance|grc|trust)\b/i],
  ["Infrastructure", /\b(sre|devops|infrastructure|platform|reliability|cloud)\b/i],
  ["Sales", /\b(sales|account executive|ae|sdr|bdr|solutions? (engineer|consultant)|partnerships?)\b/i],
  ["Engineering", /\b(engineer|developer|frontend|backend|full.?stack|ios|android|qa|architect)\b/i],
  ["Design", /\b(design\w*|ux|ui|researcher)\b/i],
  ["Product", /\b(product manager|product owner|product lead|pm)\b/i],
  ["Customer success", /\b(customer success|support|implementation|onboarding|csm)\b/i],
  ["Marketing", /\b(marketing|content|brand|growth|seo|community|devrel|developer advocate)\b/i],
  ["Finance & legal", /\b(finance|accounting|legal|counsel|controller)\b/i],
  ["People", /\b(people|recruit|talent|hr)\b/i],
];

const TECH_TERMS = [
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "Kotlin", "Swift", "Ruby", "Elixir", "PHP", "C#",
  "React", "Next.js", "Vue", "Node.js", "Django", "Rails", "GraphQL", "gRPC",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "Elasticsearch", "ClickHouse", "Snowflake", "BigQuery", "dbt",
  "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure",
  "PyTorch", "TensorFlow", "LLM", "RAG",
  "SOC 2", "ISO 27001", "HIPAA", "SSO", "SAML",
];

const ATS: [string, RegExp][] = [
  ["Greenhouse", /greenhouse\.io/i],
  ["Lever", /lever\.co/i],
  ["Ashby", /ashbyhq\.com/i],
  ["Workable", /workable\.com/i],
  ["Teamtailor", /teamtailor\.com/i],
  ["Recruitee", /recruitee\.com/i],
  ["Personio", /personio\.(com|de)/i],
  ["BambooHR", /bamboohr\.com/i],
  ["SmartRecruiters", /smartrecruiters\.com/i],
];

export function classifyTeam(title: string): string {
  for (const [team, pattern] of TEAMS) if (pattern.test(title)) return team;
  return "Other";
}

function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.#+-])${escaped}(?![\\w#+-])`, term === "Go" ? "g" : "gi");
}

function locationOf(job: Record<string, unknown>): string | undefined {
  const loc = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
  const address = (loc as { address?: Record<string, unknown> } | undefined)?.address;
  const parts = [address?.addressLocality, address?.addressCountry].filter((p): p is string => typeof p === "string");
  if (parts.length) return parts.join(", ");
  if (job.jobLocationType === "TELECOMMUTE") return "Remote";
  return undefined;
}

export function parseRoles(html: string, pageUrl: string): Role[] {
  const $ = cheerio.load(html);
  const roles = new Map<string, Role>();

  // 1. Structured data. Only job fields are read; hiring-manager or recruiter contacts are ignored by design.
  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(el).text());
    } catch {
      return;
    }
    const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (stack.length) {
      const node = stack.shift() as Record<string, unknown> | null;
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node["@graph"])) stack.push(...(node["@graph"] as unknown[]));
      if (node["@type"] === "ItemList" && Array.isArray(node.itemListElement)) {
        for (const item of node.itemListElement as Record<string, unknown>[]) stack.push(item.item ?? item);
      }
      if (node["@type"] !== "JobPosting" || typeof node.title !== "string") continue;
      const title = squash(node.title, 90);
      roles.set(title.toLowerCase(), {
        title,
        team: classifyTeam(title),
        location: locationOf(node),
        posted: typeof node.datePosted === "string" ? node.datePosted.slice(0, 10) : undefined,
        url: typeof node.url === "string" ? new URL(node.url, pageUrl).toString() : undefined,
      });
    }
  });

  // 2. Plain links that look like individual job pages.
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!/\/(jobs?|careers?|positions?|openings?|roles?)\/[^/?#]+/i.test(href)) return;
    const heading = $(el).find("h2, h3, h4, strong").first().text();
    const title = squash(heading || $(el).text(), 90);
    if (title.length < 4 || /^(apply|view|see|learn more|all jobs)/i.test(title)) return;
    if (roles.has(title.toLowerCase())) return;
    let url: string | undefined;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      url = undefined;
    }
    roles.set(title.toLowerCase(), { title, team: classifyTeam(title), url });
  });

  return [...roles.values()];
}

export async function collectCareers(ctx: Context): Promise<CollectorResult<CareersData>> {
  const before = ctx.evidence.items.length;
  const unknowns: string[] = [];
  const data: CareersData = {
    careersUrl: null,
    roles: [],
    byTeam: {},
    techMentions: {},
    ats: null,
    evidenceIds: { roles: [] },
  };

  const linked = await ctx.homeLinks(/careers?|jobs|join (us|the team)|we'?re hiring|work with us/i);
  const candidates = [...new Set([...linked, ctx.target.origin + "/careers", ctx.target.origin + "/jobs"])].slice(0, 3);

  let page: { url: string; body: string } | null = null;
  for (const url of candidates) {
    const res = await ctx.http.get(url);
    if (res.ok) {
      page = { url: res.url, body: res.body };
      break;
    }
    if (res.skipped) unknowns.push(describeFailure(res, "A careers page candidate"));
  }
  if (!page) {
    unknowns.push("No public careers page was found at the usual locations; the company may list roles only on a third-party board.");
    return { signal: "careers", ok: false, data, evidence: [], unknowns };
  }

  data.careersUrl = page.url;
  data.roles = parseRoles(page.body, page.url);
  for (const role of data.roles) data.byTeam[role.team] = (data.byTeam[role.team] ?? 0) + 1;

  for (const role of data.roles.slice(0, 12)) {
    const parts = [role.title, role.team, role.location, role.posted ? `posted ${role.posted}` : undefined].filter(Boolean);
    data.evidenceIds.roles.push(ctx.evidence.add("careers", role.url ?? page.url, parts.join(" — "), "Open role listed on the careers page").id);
  }
  if (data.roles.length) {
    const split = Object.entries(data.byTeam)
      .sort((a, b) => b[1] - a[1])
      .map(([team, n]) => `${team} ${n}`)
      .join(", ");
    data.evidenceIds.summary = ctx.evidence.add(
      "careers",
      page.url,
      `${data.roles.length} open roles listed. By team: ${split}.`,
      "Count derived from the listings on the careers page",
    ).id;
  }

  const $ = cheerio.load(page.body);
  $("script, style, noscript").remove();
  const text = $("body").text();
  for (const term of TECH_TERMS) {
    const count = text.match(termPattern(term))?.length ?? 0;
    if (count) data.techMentions[term] = count;
  }
  if (Object.keys(data.techMentions).length) {
    const listing = Object.entries(data.techMentions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([term, n]) => `${term} ×${n}`)
      .join(", ");
    data.evidenceIds.tech = ctx.evidence.add("careers", page.url, `Technologies named in job text: ${listing}`, "Keyword count over the careers page text").id;
  }

  for (const [vendor, pattern] of ATS) {
    if (pattern.test(page.body)) {
      data.ats = vendor;
      data.evidenceIds.ats = ctx.evidence.add("careers", page.url, `Careers page links to or embeds ${vendor}`, "Applicant tracking system reference in page HTML").id;
      unknowns.push(`Roles hosted on ${vendor} were not followed; only what the company's own careers page shows is counted.`);
      break;
    }
  }

  if (!data.roles.length) unknowns.push("The careers page exists but no individual roles could be parsed from it.");
  unknowns.push("Job listings show what a company advertises, not its headcount, budget or who works there.");

  return { signal: "careers", ok: true, data, evidence: ctx.evidence.items.slice(before), unknowns };
}
