import { AbsoluteFill } from "remotion";
import { Backdrop, Badge, C, EvidenceCard, Logo, MONO, Panel, Pill, S, type EvidenceItem } from "./ui";

const CARDS: EvidenceItem[] = [
  { id: "P1", signal: "pricing", label: "Pricing history", source: "capture 2023-06-14", excerpt: "Free $0 · Solo $9/month · Team $29/user/month" },
  { id: "D3", signal: "dns", label: "DNS records", source: "dns: TXT", excerpt: "TXT: stripe-verification=…" },
  { id: "T7", signal: "tech", label: "Tech fingerprint", source: "page source", excerpt: '<script src="https://js.stripe.com/v3/">' },
];

/** README banner, 1600x640. */
export const Hero: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 80px" }}>
      <div style={{ width: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Logo size={120} />
          <span style={{ fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em" }}>Outside-In</span>
        </div>
        <div style={{ fontSize: 46, fontWeight: 600, lineHeight: 1.2, marginTop: 40, letterSpacing: "-0.01em" }}>
          What is this company <span style={{ color: C.accent }}>really</span> doing?
        </div>
        <div style={{ fontSize: 31, color: C.muted, lineHeight: 1.4, marginTop: 22 }}>
          Evidence-backed company profiles from public signals only. Every claim cites its source.
        </div>
      </div>

      <div style={{ position: "relative", flex: 1, height: 520, marginLeft: 50 }}>
        {CARDS.map((item, i) => (
          <EvidenceCard
            key={item.id}
            item={item}
            width={650}
            highlight={i > 0 ? 0.5 : 0}
            style={{ position: "absolute", left: i * 24, top: 16 + i * 116, transform: `rotate(${[-2, 1, -0.6][i]}deg)` }}
          />
        ))}
        <Panel style={{ position: "absolute", left: 60, top: 372, width: 630, padding: "20px 26px 24px", borderColor: C.high }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: MONO, fontSize: 20, color: C.accent, fontWeight: 600, letterSpacing: "0.08em" }}>CLAIM</span>
            <Pill level="high" size={20} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ fontSize: 31, fontWeight: 700, marginTop: 10 }}>Stripe is in active use for payments.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <span style={{ fontSize: 22, color: C.muted }}>cites</span>
            <Badge id="T7" color={C.signal.tech} />
            <Badge id="D3" color={C.signal.dns} />
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  </Backdrop>
);

const Cite: React.FC<{ id: string; color: string; children: React.ReactNode; source: string }> = ({ id, color, children, source }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 16 }}>
    <Badge id={id} color={color} size={24} />
    <span style={{ fontSize: 27, flex: 1, lineHeight: 1.35 }}>{children}</span>
    <span style={{ fontFamily: MONO, fontSize: 21, color: C.muted, textDecoration: "underline", textDecorationColor: C.line }}>{source}</span>
  </div>
);

const Unknowns: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ marginTop: 22, paddingLeft: 22, borderLeft: `4px solid ${C.line}` }}>
    <div style={{ fontFamily: MONO, fontSize: 20, color: C.muted, fontWeight: 600, letterSpacing: "0.08em" }}>UNKNOWNS</div>
    {items.map((u) => (
      <div key={u} style={{ fontSize: 25, color: C.muted, marginTop: 8, lineHeight: 1.35 }}>{u}</div>
    ))}
  </div>
);

/** Styled rendering of two findings from /examples/report/report.md, 1600x1070. */
export const ReportExample: React.FC = () => (
  <Backdrop>
    <AbsoluteFill style={{ padding: 56 }}>
      <Panel style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 64, background: C.panelHi, borderBottom: `2px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 30px", gap: 16 }}>
          <Logo size={34} />
          <span style={{ fontFamily: MONO, fontSize: 24, color: C.muted }}>examples/report/report.md</span>
          <span style={{ fontSize: 22, color: C.muted, marginLeft: "auto" }}>fictional demo company</span>
        </div>
        <div style={{ padding: "34px 50px" }}>
          <div style={{ fontSize: 30, color: C.muted, fontWeight: 600 }}>Findings</div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginTop: 20 }}>
            <div style={{ fontSize: 37, fontWeight: 700, lineHeight: 1.25, flex: 1, letterSpacing: "-0.01em" }}>
              1. Stripe is in active use: it appears both in the site's page source and in the domain's DNS records.
            </div>
            <Pill level="high" size={26} style={{ marginTop: 6 }} />
          </div>
          <Cite id="T7" color={C.signal.tech} source="localhost:4173/">
            <span style={{ fontFamily: MONO, fontSize: 24 }}>{'<script src="https://js.stripe.com/v3/">'}</span>
          </Cite>
          <Cite id="D3" color={C.signal.dns} source="dns: TXT">
            <span style={{ fontFamily: MONO, fontSize: 24 }}>TXT: stripe-verification=…</span>
          </Cite>
          <Unknowns items={["How much of the business runs through Stripe, and on which plan, is not public."]} />

          <div style={{ height: 2, background: C.line, margin: "36px 0 30px" }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
            <div style={{ fontSize: 37, fontWeight: 700, lineHeight: 1.25, flex: 1, letterSpacing: "-0.01em" }}>
              11. The company appears to be moving upmarket: it added an Enterprise plan and dropped its Free plan.
            </div>
            <Pill level="medium" size={26} style={{ marginTop: 6 }} />
          </div>
          <Cite id="P3" color={C.signal.pricing} source="archive capture 2025-08-11">
            Solo $12/month · Team $39/user/month · Enterprise Custom
          </Cite>
          <Cite id="J4" color={C.signal.careers} source="/careers">
            Enterprise Account Executive, Sales, London
          </Cite>
          <Cite id="C8" color={C.signal.changelog} source="/feed.xml">
            Changelog themes: Enterprise &amp; security ×4
          </Cite>
          <Unknowns
            items={[
              "An interpretation of public signals; the company's internal strategy is unknown.",
              "Revenue mix by customer size is not public.",
            ]}
          />
        </div>
      </Panel>
    </AbsoluteFill>
  </Backdrop>
);

export const HERO_SIZE = { width: 1600, height: 640 };
export const REPORT_SIZE = { width: 1600, height: 1070 };
export const _S = S;
