#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  COLLECTORS,
  Context,
  PoliteHttp,
  SCOPE_STATEMENT,
  SIGNALS,
  TOOL,
  collectAll,
  parseTarget,
  type CollectOptions,
  type SignalType,
} from "outside-in";
import { z } from "zod";

/**
 * One HTTP client for the whole server process, so the per-host rate limit and the
 * robots.txt cache hold across tool calls, however quickly an agent fires them.
 */
const http = new PoliteHttp({
  minDelayMs: Number(process.env.OUTSIDE_IN_DELAY_MS ?? 1500),
});

const envOptions: Partial<CollectOptions> = {
  waybackBase: process.env.OUTSIDE_IN_WAYBACK_BASE,
  doh: process.env.OUTSIDE_IN_DOH,
  appstoreBase: process.env.OUTSIDE_IN_APPSTORE_BASE,
};

const domain = z.string().min(1).describe("Company domain, for example example.com");

function contextFor(input: string, options: Partial<CollectOptions> = {}): Context {
  return new Context(parseTarget(input), http, { ...envOptions, ...options });
}

function reply(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function failure(err: unknown) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
  };
}

const SUFFIX =
  " Returns { signal, ok, data, evidence[], unknowns[] }; each evidence item has an id, a source URL and an excerpt to cite. " +
  "Public data only: unauthenticated GETs, robots.txt honoured, rate-limited.";

const server = new McpServer({ name: "outside-in", version: TOOL.version });

const annotations = { readOnlyHint: true, openWorldHint: true };

server.registerTool(
  "tech_fingerprint",
  {
    title: "Tech fingerprint",
    description:
      "Detect the frameworks, hosting, CDN, analytics, payment and support tools visible in a company's homepage HTML and response headers." +
      SUFFIX,
    inputSchema: { domain },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.tech(contextFor(args.domain)));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "pricing_history",
  {
    title: "Pricing history",
    description:
      "Compare archived Wayback Machine captures of a company's pricing page with the live page and report plans added, removed or repriced." +
      SUFFIX,
    inputSchema: {
      domain,
      max_snapshots: z.number().int().min(1).max(12).optional().describe("Archived captures to compare (default 5)"),
    },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.pricing(contextFor(args.domain, { maxSnapshots: args.max_snapshots })));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "careers",
  {
    title: "Job posts",
    description:
      "Parse a company's public careers page: open roles by team and the technologies named in job text. Collects roles only, never people." +
      SUFFIX,
    inputSchema: { domain },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.careers(contextFor(args.domain)));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "changelog",
  {
    title: "Changelog and feeds",
    description:
      "Read a company's public changelog, release notes or RSS/Atom feed and report shipping cadence and recurring themes." + SUFFIX,
    inputSchema: { domain },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.changelog(contextFor(args.domain)));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "dns_records",
  {
    title: "Public DNS records",
    description:
      "Read a domain's public MX, TXT, NS, CAA and DMARC records and name the mail, e-mail-sending and SaaS vendors they reveal. Verification tokens are redacted." +
      SUFFIX,
    inputSchema: { domain },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.dns(contextFor(args.domain)));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "app_reviews",
  {
    title: "App Store reviews",
    description:
      "Summarise the most recent public App Store reviews of a company's app: average rating, rating by version and complaint themes. Reviewer identities are never read." +
      SUFFIX,
    inputSchema: {
      domain,
      app_id: z.string().regex(/^\d+$/).describe("Numeric App Store id of the company's app"),
      country: z.string().length(2).optional().describe("Two-letter storefront (default us)"),
    },
    annotations,
  },
  async (args) => {
    try {
      return reply(await COLLECTORS.reviews(contextFor(args.domain, { appId: args.app_id, country: args.country })));
    } catch (err) {
      return failure(err);
    }
  },
);

server.registerTool(
  "collect_all",
  {
    title: "Collect every signal",
    description:
      "Run every collector for a domain and return all evidence in one call, with a single shared numbering of evidence ids. " +
      "Use this when you want to write a full profile; cite evidence ids for every claim you make and state what remains unknown. " +
      SCOPE_STATEMENT,
    inputSchema: {
      domain,
      only: z.array(z.enum(["tech", "pricing", "careers", "changelog", "dns", "reviews"])).optional().describe("Subset of signals to collect"),
      app_id: z.string().regex(/^\d+$/).optional().describe("Numeric App Store id; enables the reviews signal"),
    },
    annotations,
  },
  async (args) => {
    try {
      const ctx = contextFor(args.domain, { appId: args.app_id });
      const collected = await collectAll(ctx, (args.only as SignalType[] | undefined) ?? SIGNALS);
      return reply({ target: ctx.target.host, scope: SCOPE_STATEMENT, collected, evidence: ctx.evidence.items });
    } catch (err) {
      return failure(err);
    }
  },
);

await server.connect(new StdioServerTransport());
