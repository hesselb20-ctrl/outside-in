import { describeFailure, squash, type Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export interface Technology {
  name: string;
  category: string;
  evidenceIds: string[];
}

export interface TechData {
  url: string;
  technologies: Technology[];
  securityHeaders: { present: string[]; missing: string[] };
}

interface Signature {
  name: string;
  category: string;
  header?: [name: string, pattern: RegExp];
  html?: RegExp;
}

const SIGNATURES: Signature[] = [
  { name: "Next.js", category: "framework", html: /\/_next\/static\/|__NEXT_DATA__/ },
  { name: "Next.js", category: "framework", header: ["x-powered-by", /next\.js/i] },
  { name: "Nuxt", category: "framework", html: /\/_nuxt\/|__NUXT__/ },
  { name: "React", category: "framework", html: /data-reactroot|react(?:-dom)?(?:\.production)?(?:\.min)?\.js/ },
  { name: "Vue", category: "framework", html: /data-v-app|vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/ },
  { name: "Angular", category: "framework", html: /ng-version="/ },
  { name: "SvelteKit", category: "framework", html: /\/_app\/immutable\// },
  { name: "Gatsby", category: "framework", html: /id="___gatsby"|\/page-data\// },
  { name: "Astro", category: "framework", html: /<astro-island|\/_astro\// },
  { name: "Express", category: "framework", header: ["x-powered-by", /express/i] },
  { name: "WordPress", category: "cms", html: /\/wp-content\/|\/wp-includes\// },
  { name: "Webflow", category: "cms", html: /data-wf-site=|webflow\.js/ },
  { name: "Shopify", category: "commerce", html: /cdn\.shopify\.com/ },
  { name: "Framer", category: "cms", html: /framerusercontent\.com/ },
  { name: "Ghost", category: "cms", html: /<meta[^>]+name="generator"[^>]+content="Ghost/i },
  { name: "Cloudflare", category: "cdn", header: ["server", /cloudflare/i] },
  { name: "Cloudflare", category: "cdn", header: ["cf-ray", /./] },
  { name: "Vercel", category: "hosting", header: ["x-vercel-id", /./] },
  { name: "Vercel", category: "hosting", header: ["server", /vercel/i] },
  { name: "Netlify", category: "hosting", header: ["x-nf-request-id", /./] },
  { name: "Fastly", category: "cdn", header: ["x-served-by", /cache-/i] },
  { name: "Amazon CloudFront", category: "cdn", header: ["x-amz-cf-id", /./] },
  { name: "Amazon CloudFront", category: "cdn", header: ["via", /cloudfront/i] },
  { name: "Fly.io", category: "hosting", header: ["fly-request-id", /./] },
  { name: "Heroku", category: "hosting", header: ["via", /vegur/i] },
  { name: "GitHub Pages", category: "hosting", header: ["server", /github\.com/i] },
  { name: "nginx", category: "server", header: ["server", /nginx/i] },
  { name: "Google Tag Manager", category: "analytics", html: /googletagmanager\.com/ },
  { name: "Google Analytics", category: "analytics", html: /google-analytics\.com|gtag\(/ },
  { name: "Segment", category: "analytics", html: /cdn\.segment\.com/ },
  { name: "Plausible", category: "analytics", html: /plausible\.io\/js/ },
  { name: "PostHog", category: "analytics", html: /posthog\.com|posthog\.init/ },
  { name: "Mixpanel", category: "analytics", html: /cdn\.mxpnl\.com|mixpanel\.init/ },
  { name: "Amplitude", category: "analytics", html: /cdn\.amplitude\.com/ },
  { name: "Hotjar", category: "analytics", html: /static\.hotjar\.com/ },
  { name: "Stripe", category: "payments", html: /js\.stripe\.com/ },
  { name: "Paddle", category: "payments", html: /cdn\.paddle\.com/ },
  { name: "Chargebee", category: "payments", html: /js\.chargebee\.com/ },
  { name: "Intercom", category: "support", html: /widget\.intercom\.io|intercomSettings/ },
  { name: "Zendesk", category: "support", html: /static\.zdassets\.com/ },
  { name: "HubSpot", category: "marketing", html: /js\.hs-scripts\.com|js\.hsforms\.net/ },
  { name: "Drift", category: "support", html: /js\.driftt\.com/ },
  { name: "Crisp", category: "support", html: /client\.crisp\.chat/ },
  { name: "Sentry", category: "monitoring", html: /browser\.sentry-cdn\.com|sentry\.io\/api/ },
  { name: "Datadog RUM", category: "monitoring", html: /datadoghq-browser-agent|datadog-rum/ },
  { name: "LaunchDarkly", category: "feature-flags", html: /launchdarkly/i },
  { name: "Auth0", category: "auth", html: /cdn\.auth0\.com/ },
  { name: "Clerk", category: "auth", html: /clerk\.[a-z0-9.-]+\/npm\/@clerk|data-clerk-/ },
  { name: "Algolia", category: "search", html: /algolia(?:net)?\.(?:com|net)|algoliasearch/ },
];

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
];

function around(body: string, index: number, length: number): string {
  const start = Math.max(0, body.lastIndexOf("<", index));
  const end = body.indexOf(">", index + length);
  const tag = body.slice(start, end === -1 ? index + length + 60 : end + 1);
  return squash(tag.length > 400 ? body.slice(Math.max(0, index - 40), index + length + 60) : tag, 180);
}

export async function collectTech(ctx: Context): Promise<CollectorResult<TechData>> {
  const home = await ctx.home();
  const data: TechData = { url: home.url, technologies: [], securityHeaders: { present: [], missing: [] } };
  if (!home.ok) {
    return { signal: "tech", ok: false, data, evidence: [], unknowns: [describeFailure(home, "The homepage")] };
  }

  const before = ctx.evidence.items.length;
  const byName = new Map<string, Technology>();

  for (const sig of SIGNATURES) {
    let excerpt: string | null = null;
    let note = "";
    if (sig.header) {
      const [name, pattern] = sig.header;
      const value = home.headers[name];
      if (value !== undefined && pattern.test(value)) {
        // Request identifiers are opaque; the header's presence is the signal.
        const shown = /id$|ray$/.test(name) ? "(present)" : value;
        excerpt = `${name}: ${shown}`;
        note = "HTTP response header";
      }
    } else if (sig.html) {
      const match = sig.html.exec(home.body);
      if (match) {
        excerpt = around(home.body, match.index, match[0].length);
        note = "Homepage HTML";
      }
    }
    if (!excerpt) continue;
    const ev = ctx.evidence.add("tech", home.url, excerpt, `${note} indicating ${sig.name}`);
    const existing = byName.get(sig.name);
    if (existing) existing.evidenceIds.push(ev.id);
    else byName.set(sig.name, { name: sig.name, category: sig.category, evidenceIds: [ev.id] });
  }

  data.technologies = [...byName.values()];
  for (const header of SECURITY_HEADERS) {
    (home.headers[header] !== undefined ? data.securityHeaders.present : data.securityHeaders.missing).push(header);
  }
  ctx.evidence.add(
    "tech",
    home.url,
    `Security headers present: ${data.securityHeaders.present.join(", ") || "none"}. Not sent: ${
      data.securityHeaders.missing.join(", ") || "none"
    }.`,
    "HTTP response headers of the homepage",
  );

  const unknowns = [
    "Only the homepage was fingerprinted; the logged-in product may run on a different stack.",
    "Server-side languages, databases and internal services are not visible from outside.",
  ];
  return { signal: "tech", ok: true, data, evidence: ctx.evidence.items.slice(before), unknowns };
}
