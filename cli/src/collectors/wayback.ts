import * as cheerio from "cheerio";
import { describeFailure, squash, type Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export interface Plan {
  name: string;
  price: string;
  amount: number | null;
}

export interface PricingSnapshot {
  /** ISO date of the capture, or "live" for the page as fetched today. */
  date: string;
  source: string;
  plans: Plan[];
  evidenceId: string;
}

export interface PricingChange {
  from: string;
  to: string;
  kind: "added" | "removed" | "price-change";
  plan: string;
  before?: string;
  after?: string;
  evidenceIds: [string, string];
}

export interface PricingData {
  pricingUrl: string | null;
  snapshots: PricingSnapshot[];
  changes: PricingChange[];
}

const PRICE =
  /(?:[$€£]\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP))(?:\s*(?:\/|per)\s*(?:user|seat|member|editor)?\s*(?:\/|per)?\s*(?:mo(?:nth)?|yr|year|user|seat)\b)?/i;
const WORD_PRICE = /\b(free|custom(?: pricing)?|contact (?:us|sales)|let'?s talk)\b/i;

/** Finds plan cards: a heading whose nearest reasonably small container also holds a price. */
export function extractPlans(html: string): Plan[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer").remove();
  // Block elements carry no whitespace of their own; without this "$9/month" and the next list item fuse.
  $("p, li, div, ul, ol, h1, h2, h3, h4, h5, td, br").after(" ");
  const plans = new Map<string, Plan>();

  $("h2, h3, h4").each((_, el) => {
    const name = squash($(el).text(), 60);
    // Plan names are short labels; longer headings are marketing copy.
    if (!name || name.length < 2 || name.length > 32 || name.split(" ").length > 4) return;
    let container = $(el).parent();
    let text = squash(container.text(), 2000);
    // Walk up at most one level if the heading is wrapped in a header element without the price.
    if (!PRICE.test(text) && !WORD_PRICE.test(text.replace(name, ""))) {
      container = container.parent();
      text = squash(container.text(), 2000);
    }
    if (text.length > 700) return; // The container is the whole page, not a plan card.
    const rest = text.replace(name, " ");
    const priced = PRICE.exec(rest);
    // Words like "free" are only trusted as a price inside a compact card.
    const worded = rest.length <= 320 ? WORD_PRICE.exec(rest) : null;
    const raw = priced?.[0] ?? worded?.[0];
    if (!raw) return;
    const price = squash(raw.replace(/\s+/g, " "), 40);
    const numeric = priced ? Number(priced[0].replace(/[^\d.]/g, "")) : /free/i.test(price) ? 0 : null;
    if (!plans.has(name.toLowerCase())) {
      plans.set(name.toLowerCase(), { name, price, amount: Number.isFinite(numeric) ? numeric : null });
    }
  });
  return [...plans.values()];
}

export function diffPlans(
  a: PricingSnapshot,
  b: PricingSnapshot,
): PricingChange[] {
  const changes: PricingChange[] = [];
  const ids: [string, string] = [a.evidenceId, b.evidenceId];
  const before = new Map(a.plans.map((p) => [p.name.toLowerCase(), p]));
  const after = new Map(b.plans.map((p) => [p.name.toLowerCase(), p]));
  for (const [key, plan] of after) {
    const old = before.get(key);
    if (!old) {
      changes.push({ from: a.date, to: b.date, kind: "added", plan: plan.name, after: plan.price, evidenceIds: ids });
    } else if (old.price.toLowerCase() !== plan.price.toLowerCase()) {
      changes.push({
        from: a.date,
        to: b.date,
        kind: "price-change",
        plan: plan.name,
        before: old.price,
        after: plan.price,
        evidenceIds: ids,
      });
    }
  }
  for (const [key, plan] of before) {
    if (!after.has(key)) {
      changes.push({ from: a.date, to: b.date, kind: "removed", plan: plan.name, before: plan.price, evidenceIds: ids });
    }
  }
  return changes;
}

function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const picked = new Set<number>();
  for (let i = 0; i < max; i++) picked.add(Math.round((i * (items.length - 1)) / (max - 1)));
  return [...picked].sort((x, y) => x - y).map((i) => items[i]!);
}

const tsToDate = (ts: string) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;

export async function collectPricing(ctx: Context): Promise<CollectorResult<PricingData>> {
  const before = ctx.evidence.items.length;
  const unknowns: string[] = [];
  const data: PricingData = { pricingUrl: null, snapshots: [], changes: [] };

  // Prefer a link whose path names pricing; "/#pricing" anchors on the homepage are not a pricing page.
  const linked = (await ctx.homeLinks(/pricing|plans|prices/i)).filter((l) => new URL(l).pathname !== "/");
  const pricingUrl =
    linked.find((l) => /pricing|plans|prices/i.test(new URL(l).pathname)) ?? linked[0] ?? ctx.target.origin + "/pricing";
  data.pricingUrl = pricingUrl;

  // The site's own robots.txt decides whether its pricing page may be read at all, archived copies included.
  if (!(await ctx.http.allowed(pricingUrl))) {
    unknowns.push(`The pricing page (${pricingUrl}) is disallowed by robots.txt, so neither it nor its archived copies were read.`);
    return { signal: "pricing", ok: false, data, evidence: [], unknowns };
  }

  const base = ctx.options.waybackBase.replace(/\/$/, "");
  const target = new URL(pricingUrl);
  const cdxUrl =
    `${base}/cdx/search/cdx?url=${encodeURIComponent(target.host + target.pathname)}` +
    "&output=json&fl=timestamp,original,statuscode,digest&filter=statuscode:200&collapse=digest&limit=400";
  const cdx = await ctx.http.get(cdxUrl, { api: true, accept: "application/json" });

  let captures: { timestamp: string; original: string }[] = [];
  if (cdx.ok) {
    try {
      const rows = JSON.parse(cdx.body || "[]") as string[][];
      captures = rows
        .slice(1)
        .filter((r) => r[0] && r[1])
        .map((r) => ({ timestamp: r[0]!, original: r[1]! }));
    } catch {
      unknowns.push("The archive index returned a response that could not be parsed.");
    }
  } else {
    unknowns.push(describeFailure(cdx, "The Wayback Machine capture index"));
  }

  for (const cap of spread(captures, ctx.options.maxSnapshots)) {
    const source = `${base}/web/${cap.timestamp}id_/${cap.original}`;
    const res = await ctx.http.get(source);
    if (!res.ok) {
      unknowns.push(describeFailure(res, `The ${tsToDate(cap.timestamp)} capture`));
      continue;
    }
    addSnapshot(ctx, data, tsToDate(cap.timestamp), `${base}/web/${cap.timestamp}/${cap.original}`, res.body);
  }

  const live = await ctx.http.get(pricingUrl);
  if (live.ok) addSnapshot(ctx, data, "live", live.url, live.body);
  else unknowns.push(describeFailure(live, "The live pricing page"));

  for (let i = 1; i < data.snapshots.length; i++) {
    data.changes.push(...diffPlans(data.snapshots[i - 1]!, data.snapshots[i]!));
  }

  if (!captures.length && cdx.ok) unknowns.push("The Wayback Machine holds no captures of the pricing page, so no history is available.");
  if (data.snapshots.some((s) => !s.plans.length)) {
    unknowns.push("At least one capture had no recognisable plan cards; prices rendered by JavaScript are not visible to this parser.");
  }
  unknowns.push("List prices only: discounts, negotiated contracts and regional pricing are not public.");

  return {
    signal: "pricing",
    ok: data.snapshots.length > 0,
    data,
    evidence: ctx.evidence.items.slice(before),
    unknowns,
  };
}

function addSnapshot(ctx: Context, data: PricingData, date: string, source: string, html: string): void {
  const plans = extractPlans(html);
  const listing = plans.length ? plans.map((p) => `${p.name} ${p.price}`).join(" · ") : "no plan cards recognised";
  const ev = ctx.evidence.add(
    "pricing",
    source,
    `${date === "live" ? "Live page" : "Capture of " + date}: ${listing}`,
    date === "live" ? "Pricing page as served today" : "Archived copy from the Wayback Machine",
  );
  data.snapshots.push({ date, source, plans, evidenceId: ev.id });
}
