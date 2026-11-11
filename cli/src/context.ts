import * as cheerio from "cheerio";
import { PoliteHttp, type HttpResult } from "./http.js";
import { DEFAULT_OPTIONS, type CollectOptions, type Evidence, type SignalType } from "./types.js";

const PREFIX: Record<SignalType, string> = {
  tech: "T",
  pricing: "P",
  careers: "J",
  changelog: "C",
  dns: "D",
  reviews: "R",
};

/** Removes e-mail addresses and phone numbers so excerpts never carry personal contact details. */
export function redactPersonal(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/(?<![\w.])\+?\d[\d ().-]{8,}\d(?![\w.])/g, (m) =>
      m.replace(/\D/g, "").length >= 9 && !/^\d{4}-\d{2}-\d{2}/.test(m) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(m)
        ? "[phone redacted]"
        : m,
    );
}

export function squash(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

export class EvidenceStore {
  readonly items: Evidence[] = [];
  private counters = new Map<SignalType, number>();

  add(signal: SignalType, source: string, excerpt: string, note?: string): Evidence {
    const n = (this.counters.get(signal) ?? 0) + 1;
    this.counters.set(signal, n);
    const item: Evidence = {
      id: PREFIX[signal] + n,
      signal,
      source,
      excerpt: squash(redactPersonal(excerpt)),
      observedAt: new Date().toISOString(),
      ...(note ? { note } : {}),
    };
    this.items.push(item);
    return item;
  }
}

export interface Target {
  /** Host as given by the user, including a port if there was one. */
  host: string;
  /** Bare hostname used for DNS lookups. */
  hostname: string;
  origin: string;
}

export function parseTarget(input: string): Target {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("No domain given.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
  const u = new URL(withScheme);
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  const scheme = /^http:\/\//i.test(trimmed) || (local && !/^https:\/\//i.test(trimmed)) ? "http:" : "https:";
  return { host: u.host, hostname: u.hostname, origin: `${scheme}//${u.host}` };
}

export class Context {
  readonly evidence = new EvidenceStore();
  readonly options: CollectOptions;
  private homePromise?: Promise<HttpResult>;

  constructor(
    readonly target: Target,
    readonly http: PoliteHttp,
    options: Partial<CollectOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...stripUndefined(options) };
  }

  /** The homepage is needed by several collectors; fetch it once. */
  home(): Promise<HttpResult> {
    this.homePromise ??= this.http.get(this.target.origin + "/");
    return this.homePromise;
  }

  /** Same-origin links on the homepage whose text or href matches the pattern. */
  async homeLinks(pattern: RegExp): Promise<string[]> {
    const home = await this.home();
    if (!home.ok) return [];
    const $ = cheerio.load(home.body);
    const found = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const text = $(el).text();
      if (!pattern.test(href) && !pattern.test(text)) return;
      try {
        const abs = new URL(href, home.url);
        if (abs.origin === new URL(home.url).origin) {
          abs.hash = "";
          found.add(abs.toString());
        }
      } catch {
        /* ignore malformed hrefs */
      }
    });
    return [...found];
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function describeFailure(res: HttpResult, what: string): string {
  if (res.skipped === "robots") return `${what} was not fetched because robots.txt disallows it (${res.url}).`;
  if (res.skipped === "auth-wall")
    return `${what} requires authentication (${res.url}); content behind a login is out of scope.`;
  if (res.skipped === "error")
    return `${what} could not be fetched (${res.url}): ${res.detail ?? "network error"}.`;
  return `${what} returned HTTP ${res.status} (${res.url}).`;
}
