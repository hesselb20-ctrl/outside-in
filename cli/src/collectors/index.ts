import type { Context } from "../context.js";
import type { CollectorResult, SignalType } from "../types.js";
import { collectCareers, type CareersData } from "./careers.js";
import { collectChangelog, type ChangelogData } from "./changelog.js";
import { collectDns, type DnsData } from "./dns.js";
import { collectReviews, type ReviewsData } from "./reviews.js";
import { collectTech, type TechData } from "./tech.js";
import { collectPricing, type PricingData } from "./wayback.js";

export interface Collected {
  tech?: CollectorResult<TechData>;
  pricing?: CollectorResult<PricingData>;
  careers?: CollectorResult<CareersData>;
  changelog?: CollectorResult<ChangelogData>;
  dns?: CollectorResult<DnsData>;
  reviews?: CollectorResult<ReviewsData>;
}

export const SIGNALS: SignalType[] = ["tech", "pricing", "careers", "changelog", "dns", "reviews"];

export const COLLECTORS = {
  tech: collectTech,
  pricing: collectPricing,
  careers: collectCareers,
  changelog: collectChangelog,
  dns: collectDns,
  reviews: collectReviews,
} as const;

/**
 * Runs the selected collectors one after another. Sequential on purpose: the per-host
 * rate limit would serialise them anyway, and evidence ids stay stable between runs.
 */
export async function collectAll(
  ctx: Context,
  only: SignalType[] = SIGNALS,
  onProgress?: (signal: SignalType, result: CollectorResult) => void,
): Promise<Collected> {
  const out: Collected = {};
  for (const signal of SIGNALS) {
    if (!only.includes(signal)) continue;
    let result: CollectorResult;
    try {
      result = await COLLECTORS[signal](ctx);
    } catch (err) {
      result = {
        signal,
        ok: false,
        data: null,
        evidence: [],
        unknowns: [`The ${signal} collector failed: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    (out as Record<string, CollectorResult>)[signal] = result;
    onProgress?.(signal, result);
  }
  return out;
}

export { collectCareers, collectChangelog, collectDns, collectPricing, collectReviews, collectTech };
export type { CareersData, ChangelogData, DnsData, PricingData, ReviewsData, TechData };
