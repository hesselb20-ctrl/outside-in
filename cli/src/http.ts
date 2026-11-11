import { ALLOW_ALL, DISALLOW_ALL, crawlDelaySeconds, isAllowed, parseRobots, type Robots } from "./robots.js";
import type { RequestLogEntry } from "./types.js";

export const USER_AGENT_TOKEN = "outside-in";
/** Generic on purpose: identifies the tool, never the person running it. */
export const DEFAULT_USER_AGENT = "outside-in/0.1 (public-signals research tool)";

export interface HttpOptions {
  userAgent: string;
  /** Minimum gap between two requests to the same host. */
  minDelayMs: number;
  timeoutMs: number;
  maxBytes: number;
  /** Upper bound for a robots.txt Crawl-delay we are willing to wait for. */
  maxCrawlDelayMs: number;
}

export const DEFAULT_HTTP_OPTIONS: HttpOptions = {
  userAgent: DEFAULT_USER_AGENT,
  minDelayMs: 1500,
  timeoutMs: 15000,
  maxBytes: 2_000_000,
  maxCrawlDelayMs: 30000,
};

export interface HttpResult {
  ok: boolean;
  status: number | null;
  url: string;
  headers: Record<string, string>;
  body: string;
  skipped?: "robots" | "auth-wall" | "error";
  detail?: string;
}

export interface GetOptions {
  /**
   * A documented public JSON API (Wayback CDX, DNS-over-HTTPS, App Store RSS) rather than a crawlable page.
   * API calls are still rate-limited and identified, but robots.txt, which governs crawling of pages, is not consulted.
   */
  api?: boolean;
  accept?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The only door to the network. Every request made by a collector goes through here, so
 * robots.txt, the rate limit and the user agent cannot be forgotten by an individual collector.
 */
export class PoliteHttp {
  readonly options: HttpOptions;
  readonly log: RequestLogEntry[] = [];
  private robotsCache = new Map<string, Promise<Robots>>();
  private hostQueue = new Map<string, Promise<void>>();
  private hostNextAt = new Map<string, number>();

  constructor(options: Partial<HttpOptions> = {}) {
    this.options = { ...DEFAULT_HTTP_OPTIONS, ...options };
  }

  /** True when robots.txt of the URL's origin permits this user agent to fetch it. */
  async allowed(url: string): Promise<boolean> {
    const u = new URL(url);
    const robots = await this.robotsFor(u.origin);
    return isAllowed(robots, USER_AGENT_TOKEN, u.pathname + u.search);
  }

  async get(url: string, opts: GetOptions = {}): Promise<HttpResult> {
    let current = url;
    let backedOff = false;
    for (let hop = 0; hop < 6; hop++) {
      const u = new URL(current);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return this.record(current, null, "error", "unsupported protocol");
      }
      if (u.username || u.password) {
        return this.record(current, null, "error", "refusing URL with embedded credentials");
      }
      if (!opts.api && !(await this.allowed(current))) {
        return this.record(current, null, "skipped-robots", "disallowed by robots.txt");
      }

      let res: Response;
      try {
        res = await this.throttled(u, () => this.rawFetch(current, opts.accept));
      } catch (err) {
        return this.record(current, null, "error", err instanceof Error ? err.message : String(err));
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        await res.body?.cancel();
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      if ((res.status === 429 || res.status === 503) && !backedOff) {
        // The server asked us to slow down: wait as told (bounded) and try exactly once more.
        await res.body?.cancel();
        backedOff = true;
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000, this.options.maxCrawlDelayMs);
        this.log.push({ url: current, status: res.status, outcome: "error", detail: `asked to slow down; retrying once after ${waitMs} ms`, at: new Date().toISOString() });
        await sleep(waitMs);
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 407) {
        await res.body?.cancel();
        // Never retried with credentials: content behind a login is out of scope.
        return this.record(current, res.status, "auth-wall", "authentication required; out of scope");
      }

      const body = await this.readLimited(res);
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        // Cookie values can carry session identifiers; keep the fact, drop the value.
        headers[key] = key === "set-cookie" ? "[redacted]" : value;
      });
      this.log.push({ url: current, status: res.status, outcome: "fetched", at: new Date().toISOString() });
      return { ok: res.status >= 200 && res.status < 300, status: res.status, url: current, headers, body };
    }
    return this.record(current, null, "error", "too many redirects");
  }

  private record(
    url: string,
    status: number | null,
    outcome: RequestLogEntry["outcome"],
    detail: string,
  ): HttpResult {
    this.log.push({ url, status, outcome, detail, at: new Date().toISOString() });
    const skipped = outcome === "skipped-robots" ? "robots" : outcome === "auth-wall" ? "auth-wall" : "error";
    return { ok: false, status, url, headers: {}, body: "", skipped, detail };
  }

  private rawFetch(url: string, accept?: string): Promise<Response> {
    return fetch(url, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: {
        "user-agent": this.options.userAgent,
        accept: accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
  }

  private async readLimited(res: Response): Promise<string> {
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < this.options.maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    if (total >= this.options.maxBytes) await reader.cancel();
    return Buffer.concat(chunks).subarray(0, this.options.maxBytes).toString("utf8");
  }

  /** Serialises requests per host and enforces the larger of our delay and the site's Crawl-delay. */
  private throttled<T>(u: URL, fn: () => Promise<T>): Promise<T> {
    const host = u.host;
    const previous = this.hostQueue.get(host) ?? Promise.resolve();
    const run = previous.then(async () => {
      const wait = (this.hostNextAt.get(host) ?? 0) - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        this.hostNextAt.set(host, Date.now() + (await this.delayFor(u)));
      }
    });
    this.hostQueue.set(
      host,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private async delayFor(u: URL): Promise<number> {
    if (u.pathname === "/robots.txt") return this.options.minDelayMs;
    const cached = this.robotsCache.get(u.origin);
    if (!cached) return this.options.minDelayMs;
    const crawlDelay = crawlDelaySeconds(await cached, USER_AGENT_TOKEN);
    const fromRobots = crawlDelay === undefined ? 0 : Math.min(crawlDelay * 1000, this.options.maxCrawlDelayMs);
    return Math.max(this.options.minDelayMs, fromRobots);
  }

  private robotsFor(origin: string): Promise<Robots> {
    let pending = this.robotsCache.get(origin);
    if (!pending) {
      pending = this.fetchRobots(origin);
      this.robotsCache.set(origin, pending);
    }
    return pending;
  }

  private async fetchRobots(origin: string): Promise<Robots> {
    const url = origin + "/robots.txt";
    try {
      const res = await this.throttled(new URL(url), () => this.rawFetch(url, "text/plain,*/*;q=0.5"));
      this.log.push({ url, status: res.status, outcome: "fetched", at: new Date().toISOString() });
      if (res.status >= 200 && res.status < 300) return parseRobots(await this.readLimited(res));
      await res.body?.cancel();
      // RFC 9309: a missing robots.txt (4xx) means no restrictions; a failing server (5xx) means assume disallow.
      return res.status >= 400 && res.status < 500 ? ALLOW_ALL : DISALLOW_ALL;
    } catch (err) {
      this.log.push({
        url,
        status: null,
        outcome: "error",
        detail:
          "robots.txt unreachable, treating origin as disallowed: " +
          (err instanceof Error ? err.message : String(err)),
        at: new Date().toISOString(),
      });
      return DISALLOW_ALL;
    }
  }
}
