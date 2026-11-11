import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { describeFailure, squash, type Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export interface ChangelogEntry {
  title: string;
  date: string | null;
  url: string;
}

export interface ChangelogData {
  sources: string[];
  entries: ChangelogEntry[];
  first: string | null;
  last: string | null;
  medianGapDays: number | null;
  themes: Record<string, number>;
  evidenceIds: { entries: string[]; cadence?: string; themes?: string };
}

const THEMES: [string, RegExp][] = [
  ["AI", /\b(ai|assistant|copilot|llm|gpt|smart|auto-?categor|suggest)/i],
  ["API & integrations", /\b(api|webhook|integration|sdk|zapier|connector|sync)\b/i],
  ["Enterprise & security", /\b(sso|saml|scim|audit log|roles?|permissions?|soc ?2|enterprise|compliance)\b/i],
  ["Billing & payments", /\b(billing|invoice|payment|checkout|subscription|tax|payout)/i],
  ["Mobile", /\b(ios|android|mobile|app store)\b/i],
  ["Performance", /\b(faster|performance|speed|latency)\b/i],
  ["Reporting", /\b(report|dashboard|analytics|export)/i],
];

const toArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const textOf = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : ((v as { "#text"?: string } | undefined)?.["#text"] ?? "");

function isoDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const t = Date.parse(input);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export function parseFeed(xml: string, feedUrl: string): ChangelogEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml) as Record<string, any>;
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  for (const item of toArray<any>(doc.rss?.channel?.item)) {
    entries.push({
      title: squash(textOf(item.title), 120),
      date: isoDate(textOf(item.pubDate) || textOf(item["dc:date"])),
      url: textOf(item.link) || feedUrl,
    });
  }
  for (const entry of toArray<any>(doc.feed?.entry)) {
    const link = toArray<any>(entry.link).find((l) => !l?.["@_rel"] || l["@_rel"] === "alternate");
    entries.push({
      title: squash(textOf(entry.title), 120),
      date: isoDate(textOf(entry.published) || textOf(entry.updated)),
      url: link?.["@_href"] ?? feedUrl,
    });
  }
  return entries.filter((e) => e.title);
}

const DATE_IN_TEXT =
  /\b(\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2},? \d{4}|\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4})\b/i;

export function parseHtmlChangelog(html: string, pageUrl: string): ChangelogEntry[] {
  const $ = cheerio.load(html);
  const entries: ChangelogEntry[] = [];
  $("article, section, li, div").each((_, el) => {
    const block = $(el);
    const heading = block.children("h2, h3").first();
    if (!heading.length) return;
    const time = block.find("time").first();
    const date = isoDate(time.attr("datetime")) ?? isoDate(DATE_IN_TEXT.exec(block.text())?.[0]);
    if (!date) return;
    const title = squash(heading.text().replace(DATE_IN_TEXT, "").replace(/^[\s–—:-]+|[\s–—:-]+$/g, ""), 120);
    if (!title) return;
    const id = block.attr("id") ?? heading.attr("id");
    entries.push({ title, date, url: id ? `${pageUrl}#${id}` : pageUrl });
  });
  return entries;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export async function collectChangelog(ctx: Context): Promise<CollectorResult<ChangelogData>> {
  const before = ctx.evidence.items.length;
  const unknowns: string[] = [];
  const data: ChangelogData = {
    sources: [],
    entries: [],
    first: null,
    last: null,
    medianGapDays: null,
    themes: {},
    evidenceIds: { entries: [] },
  };

  const candidates = new Set<string>();
  const home = await ctx.home();
  if (home.ok) {
    const $ = cheerio.load(home.body);
    $('link[rel="alternate"]').each((_, el) => {
      const type = $(el).attr("type") ?? "";
      const href = $(el).attr("href");
      if (href && /rss|atom/.test(type)) {
        try {
          const abs = new URL(href, home.url);
          if (abs.origin === new URL(home.url).origin) candidates.add(abs.toString());
        } catch {
          /* ignore */
        }
      }
    });
  }
  for (const link of await ctx.homeLinks(/changelog|release notes|what'?s new|product updates/i)) candidates.add(link);
  for (const path of ["/changelog", "/releases", "/feed.xml"]) candidates.add(ctx.target.origin + path);

  const seen = new Map<string, ChangelogEntry>();
  for (const url of [...candidates].slice(0, 6)) {
    const res = await ctx.http.get(url, { accept: "application/rss+xml,application/atom+xml,text/html;q=0.9,*/*;q=0.5" });
    if (!res.ok) {
      if (res.skipped === "robots" || res.skipped === "auth-wall") unknowns.push(describeFailure(res, "A changelog location"));
      continue;
    }
    const looksXml = /^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(res.body.slice(0, 600));
    const entries = looksXml ? parseFeed(res.body, res.url) : parseHtmlChangelog(res.body, res.url);
    if (!entries.length) continue;
    data.sources.push(res.url);
    for (const entry of entries) {
      const key = `${entry.date}|${entry.title.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, entry);
    }
  }

  data.entries = [...seen.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (!data.entries.length) {
    unknowns.push("No public changelog, release notes or feed was found; shipping cadence is unknown.");
    return { signal: "changelog", ok: false, data, evidence: [], unknowns };
  }

  for (const entry of data.entries.slice(0, 6)) {
    data.evidenceIds.entries.push(
      ctx.evidence.add("changelog", entry.url, `${entry.date ?? "undated"}: ${entry.title}`, "Changelog entry").id,
    );
  }

  const dated = data.entries.map((e) => e.date).filter((d): d is string => !!d);
  if (dated.length >= 2) {
    data.last = dated[0]!;
    data.first = dated[dated.length - 1]!;
    const gaps: number[] = [];
    for (let i = 1; i < dated.length; i++) {
      gaps.push(Math.round((Date.parse(dated[i - 1]!) - Date.parse(dated[i]!)) / 86_400_000));
    }
    data.medianGapDays = median(gaps);
    data.evidenceIds.cadence = ctx.evidence.add(
      "changelog",
      data.sources[0]!,
      `${data.entries.length} entries between ${data.first} and ${data.last}; median gap ${data.medianGapDays} days.`,
      "Cadence derived from entry dates",
    ).id;
  }

  for (const entry of data.entries) {
    for (const [theme, pattern] of THEMES) {
      if (pattern.test(entry.title)) data.themes[theme] = (data.themes[theme] ?? 0) + 1;
    }
  }
  if (Object.keys(data.themes).length) {
    const listing = Object.entries(data.themes)
      .sort((a, b) => b[1] - a[1])
      .map(([theme, n]) => `${theme} ×${n}`)
      .join(", ");
    data.evidenceIds.themes = ctx.evidence.add(
      "changelog",
      data.sources[0]!,
      `Themes across ${data.entries.length} entry titles: ${listing}`,
      "Keyword match over entry titles",
    ).id;
  }

  unknowns.push("A changelog shows what a company chose to announce; unannounced work and internal priorities are not visible.");
  return { signal: "changelog", ok: true, data, evidence: ctx.evidence.items.slice(before), unknowns };
}
