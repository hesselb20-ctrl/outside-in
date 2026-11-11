import type { Evidence, Report } from "./types.js";

const SIGNAL_LABEL: Record<Evidence["signal"], string> = {
  tech: "Tech fingerprint",
  pricing: "Pricing history",
  careers: "Job posts",
  changelog: "Changelog",
  dns: "DNS records",
  reviews: "App reviews",
};

/** Excerpts can contain raw HTML from the page; escape it so Markdown renderers show it instead of dropping it. */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (text: string) => esc(text).replace(/\|/g, "\\|").replace(/\n/g, " ");

function sourceLink(e: Evidence): string {
  return /^https?:/.test(e.source) ? `[source](${e.source})` : `\`${e.source}\``;
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(`# Outside-In report: ${report.target}`, "");
  push(
    `Generated ${report.generatedAt.slice(0, 16).replace("T", " ")} UTC by ${report.tool.name} ${report.tool.version}. ` +
      `Synthesis: ${report.synthesis.mode === "claude" ? `Claude (${report.synthesis.model})` : "offline heuristic rules (no model call)"}.`,
    "",
  );
  if (report.synthesis.note) push(`> ${report.synthesis.note}`, "");
  push(`> ${report.scope}`, "");

  push("## Summary", "", report.summary, "");

  push("## Findings", "");
  report.findings.forEach((f, i) => {
    push(`### ${i + 1}. ${f.claim}`, "");
    push(`**Confidence: ${f.confidence}** · cites ${f.evidence.map((e) => `[${e.id}](#${e.id.toLowerCase()})`).join(", ")}`, "");
    for (const e of f.evidence) push(`- **${e.id}** ${SIGNAL_LABEL[e.signal]}: ${esc(e.excerpt)} (${sourceLink(e)})`);
    push("");
    if (f.unknowns.length) {
      push("Unknowns:", "");
      for (const u of f.unknowns) push(`- ${u}`);
      push("");
    }
  });
  if (!report.findings.length) push("No findings: the collectors returned no usable evidence.", "");

  if (report.unknowns.length) {
    push("## What this report could not establish", "");
    for (const u of report.unknowns) push(`- ${u}`);
    push("");
  }

  push("## Evidence", "");
  push("| Id | Signal | Excerpt | Source | Observed (UTC) |", "| --- | --- | --- | --- | --- |");
  for (const e of report.evidence) {
    push(
      `| <a id="${e.id.toLowerCase()}"></a>${e.id} | ${SIGNAL_LABEL[e.signal]} | ${cell(e.excerpt)} | ${sourceLink(e)} | ${e.observedAt.slice(0, 16).replace("T", " ")} |`,
    );
  }
  push("");

  const fetched = report.collection.requests.filter((r) => r.outcome === "fetched").length;
  const skipped = report.collection.requests.filter((r) => r.outcome !== "fetched");
  push("## Collection log", "");
  push(
    `${report.collection.requests.length} requests attempted, ${fetched} fetched. ` +
      `User agent \`${report.collection.userAgent}\`, at least ${report.collection.minDelayMs} ms between requests to the same host.`,
    "",
  );
  if (skipped.length) {
    push("Not fetched:", "");
    for (const r of skipped) push(`- \`${r.url}\`: ${r.outcome}${r.detail ? ` (${r.detail})` : ""}`);
    push("");
  }

  return lines.join("\n");
}
