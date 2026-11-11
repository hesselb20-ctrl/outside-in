import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_HTTP_OPTIONS } from "./http.js";
import { SIGNALS, profile, renderMarkdown, DEFAULT_MODEL, TOOL, type SignalType } from "./lib.js";

const HELP = `outside-in ${TOOL.version}
Build an evidence-backed profile of a company from public signals only.

Usage
  outside-in <domain> [options]

Options
  -o, --out <dir>          Output directory (default: ./outside-in-<domain>)
      --only <signals>     Comma-separated subset of: ${SIGNALS.join(", ")}
      --app-id <id>        Numeric App Store id; enables the reviews collector
      --country <cc>       App Store storefront for reviews (default: us)
      --max-snapshots <n>  Archived pricing captures to compare (default: 5)
      --delay <ms>         Minimum gap between requests to one host (default: ${DEFAULT_HTTP_OPTIONS.minDelayMs})
      --no-llm             Skip the Claude call; write findings with the offline rules
      --model <id>         Claude model for synthesis (default: ${DEFAULT_MODEL})
      --doh <url>          Resolve DNS over HTTPS via this JSON endpoint instead of the system resolver
      --wayback-base <url> Wayback-compatible service (default: https://web.archive.org)
      --appstore-base <url> App Store RSS service (default: https://itunes.apple.com)
      --json               Print report.json to stdout instead of the progress log
  -h, --help               Show this help
  -v, --version            Show the version

Environment
  ANTHROPIC_API_KEY        Enables the Claude synthesis step. Without it the offline rules are used.

Scope
  Unauthenticated GET requests only. robots.txt is honoured, every host is rate-limited,
  nothing behind a login is fetched and no personal data about employees is collected.
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      only: { type: "string" },
      "app-id": { type: "string" },
      country: { type: "string" },
      "max-snapshots": { type: "string" },
      delay: { type: "string" },
      "no-llm": { type: "boolean" },
      model: { type: "string" },
      doh: { type: "string" },
      "wayback-base": { type: "string" },
      "appstore-base": { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  if (values.version) {
    console.log(TOOL.version);
    return 0;
  }
  const domain = positionals[0];
  if (values.help || !domain) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }

  const only = values.only?.split(",").map((s) => s.trim()) as SignalType[] | undefined;
  const unknown = only?.filter((s) => !SIGNALS.includes(s));
  if (unknown?.length) {
    console.error(`Unknown signal(s): ${unknown.join(", ")}. Choose from: ${SIGNALS.join(", ")}.`);
    return 1;
  }
  const number = (value: string | undefined, name: string): number | undefined => {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non-negative number.`);
    return n;
  };

  const log = (line: string) => {
    if (!values.json) console.error(line);
  };
  const delay = number(values.delay, "delay");
  log(`outside-in ${TOOL.version}: profiling ${domain} from public signals`);

  const { report } = await profile(domain, {
    only,
    llm: !values["no-llm"],
    model: values.model,
    appId: values["app-id"],
    country: values.country,
    maxSnapshots: number(values["max-snapshots"], "max-snapshots"),
    doh: values.doh,
    waybackBase: values["wayback-base"],
    appstoreBase: values["appstore-base"],
    http: delay === undefined ? {} : { minDelayMs: delay },
    onProgress: (signal, result) =>
      log(`  ${result.ok ? "ok  " : "skip"} ${signal.padEnd(9)} ${result.evidence.length} evidence item(s)${result.ok ? "" : ` · ${result.unknowns[0] ?? ""}`}`),
  });

  const outDir = resolve(values.out ?? `outside-in-${report.target.replace(/[^a-z0-9.-]/gi, "_")}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(join(outDir, "report.md"), renderMarkdown(report) + "\n");

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const levels = ["high", "medium", "low"].map((l) => `${report.findings.filter((f) => f.confidence === l).length} ${l}`).join(", ");
    log(`  synthesis: ${report.synthesis.mode}${report.synthesis.model ? ` (${report.synthesis.model})` : ""}`);
    if (report.synthesis.note) log(`  note: ${report.synthesis.note}`);
    log(`${report.findings.length} findings (${levels}) from ${report.evidence.length} evidence items`);
    log(`Wrote ${join(outDir, "report.md")} and report.json`);
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  },
);
