import { Resolver } from "node:dns/promises";
import type { Context } from "../context.js";
import type { CollectorResult } from "../types.js";

export type RecordType = "A" | "AAAA" | "MX" | "TXT" | "NS" | "CAA";

export interface Vendor {
  name: string;
  role: string;
  evidenceIds: string[];
}

export interface DnsData {
  hostname: string;
  resolver: string;
  records: Partial<Record<RecordType, string[]>>;
  dmarc: string | null;
  vendors: Vendor[];
}

const MX_VENDORS: [RegExp, string][] = [
  [/google(mail)?\.com\.?$/i, "Google Workspace"],
  [/outlook\.com\.?$|protection\.outlook/i, "Microsoft 365"],
  [/zoho\./i, "Zoho Mail"],
  [/protonmail\.ch\.?$/i, "Proton Mail"],
  [/messagingengine\.com\.?$/i, "Fastmail"],
  [/mimecast/i, "Mimecast"],
  [/pphosted\.com\.?$/i, "Proofpoint"],
];

const SPF_VENDORS: [RegExp, string, string][] = [
  [/_spf\.google\.com/i, "Google Workspace", "sends mail"],
  [/spf\.protection\.outlook\.com/i, "Microsoft 365", "sends mail"],
  [/sendgrid\.net/i, "SendGrid", "transactional e-mail"],
  [/mailgun\.org/i, "Mailgun", "transactional e-mail"],
  [/amazonses\.com/i, "Amazon SES", "transactional e-mail"],
  [/mtasv\.net/i, "Postmark", "transactional e-mail"],
  [/servers\.mcsv\.net/i, "Mailchimp", "marketing e-mail"],
  [/hubspotemail\.net/i, "HubSpot", "marketing e-mail"],
  [/_spf\.salesforce\.com/i, "Salesforce", "CRM e-mail"],
  [/mail\.zendesk\.com/i, "Zendesk", "support e-mail"],
  [/helpscoutemail\.com/i, "Help Scout", "support e-mail"],
  [/intercom/i, "Intercom", "support e-mail"],
];

const TXT_VENDORS: [RegExp, string, string][] = [
  [/^google-site-verification=/i, "Google Search Console", "domain verified"],
  [/^MS=/, "Microsoft 365", "domain verified"],
  [/^atlassian-domain-verification=/i, "Atlassian", "domain verified"],
  [/^stripe-verification=/i, "Stripe", "domain verified"],
  [/^facebook-domain-verification=/i, "Meta Business", "domain verified"],
  [/^apple-domain-verification=/i, "Apple", "domain verified"],
  [/^docusign=/i, "DocuSign", "domain verified"],
  [/^slack-domain-verification=/i, "Slack", "domain verified"],
  [/^notion-domain-verification=/i, "Notion", "domain verified"],
  [/^zoom-domain-verification=/i, "Zoom", "domain verified"],
  [/^openai-domain-verification=/i, "OpenAI", "domain verified"],
  [/^anthropic-domain-verification/i, "Anthropic", "domain verified"],
  [/^hubspot-developer-verification=/i, "HubSpot", "domain verified"],
  [/^onetrust-domain-verification=/i, "OneTrust", "domain verified"],
];

const NS_VENDORS: [RegExp, string][] = [
  [/cloudflare\.com\.?$/i, "Cloudflare"],
  [/awsdns/i, "Amazon Route 53"],
  [/googledomains\.com\.?$|ns-cloud-/i, "Google Cloud DNS"],
  [/azure-dns/i, "Azure DNS"],
  [/nsone\.net\.?$/i, "NS1"],
  [/dnsimple/i, "DNSimple"],
  [/digitalocean\.com\.?$/i, "DigitalOcean"],
  [/vercel-dns\.com\.?$/i, "Vercel"],
];

type Lookup = (name: string, type: RecordType) => Promise<string[]>;

function systemLookup(): Lookup {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  return async (name, type) => {
    try {
      switch (type) {
        case "A":
          return await resolver.resolve4(name);
        case "AAAA":
          return await resolver.resolve6(name);
        case "MX":
          return (await resolver.resolveMx(name)).sort((a, b) => a.priority - b.priority).map((r) => `${r.priority} ${r.exchange}`);
        case "TXT":
          return (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""));
        case "NS":
          return await resolver.resolveNs(name);
        case "CAA":
          return (await resolver.resolveCaa(name)).map((r) => `${r.critical} issue "${r.issue ?? r.issuewild ?? r.iodef ?? ""}"`);
      }
    } catch {
      return [];
    }
  };
}

function dohLookup(ctx: Context, endpoint: string): Lookup {
  return async (name, type) => {
    const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}name=${encodeURIComponent(name)}&type=${type}`;
    const res = await ctx.http.get(url, { api: true, accept: "application/dns-json" });
    if (!res.ok) return [];
    try {
      const json = JSON.parse(res.body) as { Answer?: { data: string }[] };
      // TXT data arrives as one or more quoted chunks; other record types arrive bare.
      return (json.Answer ?? []).map((a) => (type === "TXT" ? a.data.replace(/^"|"$/g, "").replace(/" "/g, "") : a.data));
    } catch {
      return [];
    }
  };
}

/** Verification records carry an opaque token. The vendor is the signal; the token is not ours to republish. */
function redactToken(txt: string): string {
  const eq = txt.indexOf("=");
  if (/^v=(spf1|DMARC1)/i.test(txt) || eq === -1) return txt;
  return txt.slice(0, eq + 1) + "…";
}

export async function collectDns(ctx: Context): Promise<CollectorResult<DnsData>> {
  const before = ctx.evidence.items.length;
  const hostname = ctx.target.hostname.replace(/^www\./, "");
  const lookup = ctx.options.doh ? dohLookup(ctx, ctx.options.doh) : systemLookup();
  const data: DnsData = {
    hostname,
    resolver: ctx.options.doh ? `DNS-over-HTTPS (${new URL(ctx.options.doh).host})` : "system resolver",
    records: {},
    dmarc: null,
    vendors: [],
  };
  const src = (name: string, type: string) => `dns:${name}?type=${type}`;
  const vendors = new Map<string, Vendor>();
  const credit = (name: string, role: string, evidenceId: string) => {
    const v = vendors.get(name);
    if (v) v.evidenceIds.push(evidenceId);
    else vendors.set(name, { name, role, evidenceIds: [evidenceId] });
  };

  for (const type of ["A", "AAAA", "MX", "TXT", "NS", "CAA"] as RecordType[]) {
    data.records[type] = await lookup(hostname, type);
  }
  data.dmarc = (await lookup(`_dmarc.${hostname}`, "TXT")).find((t) => /^v=DMARC1/i.test(t)) ?? null;

  const mx = data.records.MX ?? [];
  if (mx.length) {
    const ev = ctx.evidence.add("dns", src(hostname, "MX"), `MX: ${mx.join("; ")}`, "Mail exchanger records");
    for (const [pattern, vendor] of MX_VENDORS) {
      if (mx.some((r) => pattern.test(r.split(" ").pop() ?? ""))) credit(vendor, "receives mail", ev.id);
    }
  }

  for (const txt of data.records.TXT ?? []) {
    if (/^v=spf1/i.test(txt)) {
      const ev = ctx.evidence.add("dns", src(hostname, "TXT"), `SPF: ${txt}`, "Sender policy record");
      for (const [pattern, vendor, role] of SPF_VENDORS) if (pattern.test(txt)) credit(vendor, role, ev.id);
      continue;
    }
    for (const [pattern, vendor, role] of TXT_VENDORS) {
      if (!pattern.test(txt)) continue;
      const ev = ctx.evidence.add("dns", src(hostname, "TXT"), `TXT: ${redactToken(txt)}`, `Domain verification record for ${vendor}`);
      credit(vendor, role, ev.id);
    }
  }

  const ns = data.records.NS ?? [];
  if (ns.length) {
    const ev = ctx.evidence.add("dns", src(hostname, "NS"), `NS: ${ns.join(", ")}`, "Authoritative name servers");
    for (const [pattern, vendor] of NS_VENDORS) if (ns.some((r) => pattern.test(r))) credit(vendor, "hosts DNS", ev.id);
  }

  const caa = data.records.CAA ?? [];
  if (caa.length) ctx.evidence.add("dns", src(hostname, "CAA"), `CAA: ${caa.join("; ")}`, "Certificate authorities allowed to issue for the domain");

  ctx.evidence.add(
    "dns",
    src(`_dmarc.${hostname}`, "TXT"),
    data.dmarc ? `DMARC: ${data.dmarc}` : "No DMARC record published",
    "E-mail authentication policy",
  );

  data.vendors = [...vendors.values()];
  const found = Object.values(data.records).some((r) => r && r.length);
  const unknowns = found
    ? [
        "DNS shows which vendors a domain is configured for, not how heavily they are used or whether a trial was abandoned.",
        "Subdomains were not enumerated; only the apex domain's records were read.",
      ]
    : [`No DNS records were returned for ${hostname}.`];

  return { signal: "dns", ok: found, data, evidence: ctx.evidence.items.slice(before), unknowns };
}
