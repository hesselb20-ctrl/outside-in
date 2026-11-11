import { collectAll, SIGNALS, type Collected } from "./collectors/index.js";
import { Context, parseTarget } from "./context.js";
import { PoliteHttp, type HttpOptions } from "./http.js";
import { DEFAULT_MODEL, synthesizeHeuristic, synthesizeWithClaude, type Synthesis } from "./synthesize.js";
import { SCOPE_STATEMENT, TOOL, type CollectOptions, type CollectorResult, type Report, type SignalType } from "./types.js";

export * from "./types.js";
export * from "./collectors/index.js";
export { Context, EvidenceStore, parseTarget, redactPersonal } from "./context.js";
export { PoliteHttp, DEFAULT_HTTP_OPTIONS, DEFAULT_USER_AGENT, type HttpOptions } from "./http.js";
export { parseRobots, isAllowed, crawlDelaySeconds } from "./robots.js";
export { renderMarkdown } from "./report.js";
export { DEFAULT_MODEL, grade, synthesizeHeuristic, synthesizeWithClaude } from "./synthesize.js";

export interface ProfileOptions extends Partial<CollectOptions> {
  http?: Partial<HttpOptions>;
  only?: SignalType[];
  /** Set to false to skip the Claude call and use the offline rules. */
  llm?: boolean;
  model?: string;
  onProgress?: (signal: SignalType, result: CollectorResult) => void;
}

function hasClaudeCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

/** Collect every public signal for a domain and synthesise the report. */
export async function profile(domain: string, options: ProfileOptions = {}): Promise<{ report: Report; collected: Collected }> {
  const target = parseTarget(domain);
  const http = new PoliteHttp(options.http);
  const ctx = new Context(target, http, options);
  const collected = await collectAll(ctx, options.only ?? SIGNALS, options.onProgress);
  const evidence = ctx.evidence.items;

  let synthesis: Synthesis;
  if (options.llm === false) {
    synthesis = synthesizeHeuristic(target.host, collected, evidence);
  } else if (!hasClaudeCredentials()) {
    synthesis = {
      ...synthesizeHeuristic(target.host, collected, evidence),
      note: "No Claude credentials were found (ANTHROPIC_API_KEY), so the findings were written by the offline rules instead of the model.",
    };
  } else {
    try {
      synthesis = await synthesizeWithClaude(target.host, collected, evidence, options.model ?? DEFAULT_MODEL);
    } catch (err) {
      synthesis = {
        ...synthesizeHeuristic(target.host, collected, evidence),
        note: `The Claude synthesis failed (${err instanceof Error ? err.message : String(err)}); the findings were written by the offline rules instead.`,
      };
    }
  }

  const unknowns = Object.values(collected)
    .filter((r) => !r.ok)
    .flatMap((r) => r.unknowns);

  const report: Report = {
    target: target.host,
    origin: target.origin,
    generatedAt: new Date().toISOString(),
    tool: TOOL,
    synthesis: {
      mode: synthesis.mode,
      ...(synthesis.model ? { model: synthesis.model } : {}),
      ...(synthesis.note ? { note: synthesis.note } : {}),
    },
    summary: synthesis.summary,
    findings: synthesis.findings,
    evidence,
    unknowns,
    collection: { userAgent: http.options.userAgent, minDelayMs: http.options.minDelayMs, requests: http.log },
    scope: SCOPE_STATEMENT,
  };
  return { report, collected };
}
