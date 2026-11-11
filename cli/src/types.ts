export type Confidence = "high" | "medium" | "low";

export type SignalType = "tech" | "pricing" | "careers" | "changelog" | "dns" | "reviews";

/** One observed, citable fact. `source` is always a public URL or a dns: URI. */
export interface Evidence {
  id: string;
  signal: SignalType;
  source: string;
  excerpt: string;
  observedAt: string;
  note?: string;
}

export interface CollectorResult<T = unknown> {
  signal: SignalType;
  ok: boolean;
  data: T;
  evidence: Evidence[];
  unknowns: string[];
}

export interface Finding {
  claim: string;
  evidence: Evidence[];
  confidence: Confidence;
  unknowns: string[];
}

export interface RequestLogEntry {
  url: string;
  status: number | null;
  outcome: "fetched" | "skipped-robots" | "error" | "auth-wall";
  detail?: string;
  at: string;
}

export interface Report {
  target: string;
  origin: string;
  generatedAt: string;
  tool: { name: string; version: string };
  synthesis: { mode: "claude" | "heuristic"; model?: string; note?: string };
  summary: string;
  findings: Finding[];
  evidence: Evidence[];
  unknowns: string[];
  collection: {
    userAgent: string;
    minDelayMs: number;
    requests: RequestLogEntry[];
  };
  scope: string;
}

export interface CollectOptions {
  /** Base URL of a Wayback-compatible service. */
  waybackBase: string;
  /** DNS-over-HTTPS JSON endpoint. When unset the system resolver is used. */
  doh?: string;
  /** Base URL of the public App Store RSS service. */
  appstoreBase: string;
  /** Numeric App Store id. The reviews collector only runs when this is set. */
  appId?: string;
  country: string;
  maxSnapshots: number;
}

export const DEFAULT_OPTIONS: CollectOptions = {
  waybackBase: "https://web.archive.org",
  appstoreBase: "https://itunes.apple.com",
  country: "us",
  maxSnapshots: 5,
};

export const TOOL = { name: "outside-in", version: "0.1.0" };

export const SCOPE_STATEMENT =
  "Public signals only. Every request is an unauthenticated GET that honours robots.txt and a per-host rate limit. " +
  "Nothing behind a login is fetched and no personal data about employees is collected; e-mail addresses and phone numbers are redacted from excerpts.";
