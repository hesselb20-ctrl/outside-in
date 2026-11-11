import { describeFailure, type Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export interface Review {
  rating: number;
  title: string;
  text: string;
  version: string | null;
  date: string | null;
}

export interface ReviewsData {
  appId: string | null;
  count: number;
  average: number | null;
  lowShare: number | null;
  byVersion: Record<string, { count: number; average: number }>;
  complaints: Record<string, number>;
  evidenceIds: { summary?: string; complaints?: string; samples: string[] };
}

const COMPLAINTS: [string, RegExp][] = [
  ["crashes", /\b(crash|freez|force clos|won'?t open)/i],
  ["sync", /\b(sync|not updating|out of date|duplicat)/i],
  ["login", /\b(log ?in|sign ?in|password|locked out|2fa)/i],
  ["price", /\b(price|expensive|subscription|paywall|charged)/i],
  ["speed", /\b(slow|lag|loading|takes forever)/i],
  ["support", /\b(support|no response|customer service)/i],
  ["missing features", /\b(missing|wish|please add|no way to|can'?t)/i],
];

const label = (v: unknown): string => ((v as { label?: string } | undefined)?.label ?? "").trim();

export async function collectReviews(ctx: Context): Promise<CollectorResult<ReviewsData>> {
  const before = ctx.evidence.items.length;
  const data: ReviewsData = {
    appId: ctx.options.appId ?? null,
    count: 0,
    average: null,
    lowShare: null,
    byVersion: {},
    complaints: {},
    evidenceIds: { samples: [] },
  };
  if (!ctx.options.appId) {
    return {
      signal: "reviews",
      ok: false,
      data,
      evidence: [],
      unknowns: ["No App Store id was supplied (--app-id), so app reviews were not collected."],
    };
  }
  if (!/^\d+$/.test(ctx.options.appId)) {
    return { signal: "reviews", ok: false, data, evidence: [], unknowns: ["The App Store id must be numeric."] };
  }

  const base = ctx.options.appstoreBase.replace(/\/$/, "");
  const country = ctx.options.country.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "us";
  const url = `${base}/${country}/rss/customerreviews/id=${ctx.options.appId}/sortBy=mostRecent/json`;
  const res = await ctx.http.get(url, { api: true, accept: "application/json" });
  if (!res.ok) {
    return { signal: "reviews", ok: false, data, evidence: [], unknowns: [describeFailure(res, "The App Store review feed")] };
  }

  let reviews: Review[] = [];
  try {
    const json = JSON.parse(res.body) as { feed?: { entry?: unknown } };
    const entries = json.feed?.entry;
    const list = (Array.isArray(entries) ? entries : entries ? [entries] : []) as Record<string, unknown>[];
    // The reviewer's name and profile link are deliberately never read.
    reviews = list
      .filter((e) => e["im:rating"])
      .map((e) => ({
        rating: Number(label(e["im:rating"])),
        title: label(e.title),
        text: label(e.content),
        version: label(e["im:version"]) || null,
        date: label(e.updated).slice(0, 10) || null,
      }))
      .filter((r) => r.rating >= 1 && r.rating <= 5);
  } catch {
    return { signal: "reviews", ok: false, data, evidence: [], unknowns: ["The App Store review feed could not be parsed."] };
  }
  if (!reviews.length) {
    return { signal: "reviews", ok: false, data, evidence: [], unknowns: ["The App Store review feed is empty for this app and storefront."] };
  }

  const round = (n: number) => Math.round(n * 10) / 10;
  data.count = reviews.length;
  data.average = round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
  data.lowShare = Math.round((reviews.filter((r) => r.rating <= 2).length / reviews.length) * 100);

  const versions = new Map<string, number[]>();
  for (const r of reviews) if (r.version) versions.set(r.version, [...(versions.get(r.version) ?? []), r.rating]);
  for (const [version, ratings] of versions) {
    data.byVersion[version] = { count: ratings.length, average: round(ratings.reduce((s, n) => s + n, 0) / ratings.length) };
  }
  for (const r of reviews.filter((x) => x.rating <= 3)) {
    for (const [theme, pattern] of COMPLAINTS) {
      if (pattern.test(`${r.title} ${r.text}`)) data.complaints[theme] = (data.complaints[theme] ?? 0) + 1;
    }
  }

  const page = `${base}/${country}/app/id${ctx.options.appId}`;
  const versionLine = Object.entries(data.byVersion)
    .map(([v, s]) => `v${v}: ${s.average} (${s.count})`)
    .join(", ");
  data.evidenceIds.summary = ctx.evidence.add(
    "reviews",
    url,
    `${data.count} most recent reviews: average ${data.average}/5, ${data.lowShare}% rated 1-2 stars. By version: ${versionLine || "n/a"}.`,
    "Aggregate over the public review feed",
  ).id;
  if (Object.keys(data.complaints).length) {
    const listing = Object.entries(data.complaints)
      .sort((a, b) => b[1] - a[1])
      .map(([theme, n]) => `${theme} ×${n}`)
      .join(", ");
    data.evidenceIds.complaints = ctx.evidence.add(
      "reviews",
      url,
      `Themes in reviews rated 3 stars or lower: ${listing}`,
      "Keyword match over review text",
    ).id;
  }
  const samples = [...reviews].sort((a, b) => a.rating - b.rating);
  for (const r of [...samples.slice(0, 2), ...samples.slice(-1)]) {
    data.evidenceIds.samples.push(
      ctx.evidence.add(
        "reviews",
        page,
        `${r.rating}★ ${r.version ? `(v${r.version}) ` : ""}"${r.title}": ${r.text}`,
        "Public review, reviewer identity omitted",
      ).id,
    );
  }

  return {
    signal: "reviews",
    ok: true,
    data,
    evidence: ctx.evidence.items.slice(before),
    unknowns: [
      `Only the ${data.count} most recent reviews from the "${country}" storefront were read; this is not the app's lifetime rating.`,
      "Reviewers self-select; reviews over-represent strong opinions.",
    ],
  };
}
