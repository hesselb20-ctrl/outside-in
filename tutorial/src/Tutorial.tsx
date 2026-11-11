import type { ReactNode } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import {
  Backdrop,
  Badge,
  C,
  EvidenceCard,
  MONO,
  Panel,
  Pill,
  S,
  SIGNALS,
  Scene,
  SceneTitle,
  Wordmark,
  tween,
  typed,
  type EvidenceItem,
  type Level,
} from "./ui";

export const FPS = 30;
/** Scene lengths in frames. Total: 2160 frames = 72 seconds. */
export const SCENES = { question: 240, signals: 420, evidence: 480, confidence: 360, report: 390, install: 270 };
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);

/** Excerpts taken from the example report in /examples/report (fictional demo company). */
const EVIDENCE: EvidenceItem[] = [
  { id: "T2", signal: "tech", label: "Tech fingerprint", source: "response header", excerpt: "x-powered-by: Next.js" },
  { id: "P1", signal: "pricing", label: "Pricing history", source: "capture 2023-06-14", excerpt: "Free $0 · Solo $9/month · Team $29/user/month" },
  { id: "J4", signal: "careers", label: "Job posts", source: "/careers", excerpt: "Enterprise Account Executive — Sales — London" },
  { id: "C3", signal: "changelog", label: "Changelog", source: "/changelog#sso", excerpt: "2026-09-16: SAML single sign-on" },
  { id: "D3", signal: "dns", label: "DNS records", source: "dns: TXT", excerpt: "TXT: stripe-verification=…" },
  { id: "T7", signal: "tech", label: "Tech fingerprint", source: "page source", excerpt: '<script src="https://js.stripe.com/v3/">' },
];

const Cursor: React.FC<{ color?: string }> = ({ color = C.accent }) => {
  const frame = useCurrentFrame();
  return <span style={{ color, opacity: Math.floor(frame / 15) % 2 ? 0.15 : 1 }}>▍</span>;
};

// ------------------------------------------------------------------ 1. The question
const Question: React.FC = () => {
  const frame = useCurrentFrame();
  const headline = "What is this company really doing?";
  const domain = "tallybird.example";
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 90, opacity: tween(frame, 0, 20) }}>
          <Wordmark size={40} />
        </div>
        <div style={{ fontSize: S.display, fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", height: 130 }}>
          {typed(headline, frame, 14, 20)}
          {frame < 100 ? <Cursor /> : null}
        </div>
        <Panel
          style={{
            marginTop: 50,
            padding: "26px 44px",
            borderRadius: 999,
            minWidth: 760,
            opacity: tween(frame, 96, 114),
            transform: `translateY(${tween(frame, 96, 114, 24, 0)}px)`,
            fontFamily: MONO,
            fontSize: S.h2,
          }}
        >
          <span style={{ color: C.muted }}>$ outside-in </span>
          {typed(domain, frame, 118, 16)}
          {frame >= 100 ? <Cursor /> : null}
        </Panel>
        <div
          style={{
            marginTop: 56,
            fontSize: S.h3,
            color: C.muted,
            opacity: tween(frame, 168, 190),
          }}
        >
          Answered from <span style={{ color: C.text, fontWeight: 600 }}>public signals only</span>. Every claim cites its source.
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ------------------------------------------------------------------ 2. Signals flow in
const Signals: React.FC = () => {
  const frame = useCurrentFrame();
  const chipX = 110, chipW = 560, chipH = 100, chipTop = 210, chipGap = 128;
  const gateX = 900, gateY = 320, gateW = 520, gateH = 520;
  const gateMid = gateY + gateH / 2;
  const count = Math.round(tween(frame, 130, 370, 0, 45));
  const rules = ["robots.txt honoured", "rate limit per host", "generic user agent", "no logins, no personal data"];

  return (
    <Scene>
      <SceneTitle step="01">Signals flow in</SceneTitle>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {SIGNALS.map((sig, i) => {
          const y = chipTop + i * chipGap + chipH / 2;
          const appear = tween(frame, 24 + i * 12, 44 + i * 12);
          const x1 = chipX + chipW, x2 = gateX;
          const path = `M${x1} ${y} C ${x1 + 130} ${y}, ${x2 - 130} ${gateMid}, ${x2} ${gateMid}`;
          const color = C.signal[sig.key];
          return (
            <g key={sig.key} opacity={appear}>
              <path d={path} fill="none" stroke={C.line} strokeWidth={3} />
              {[0, 1, 2].map((d) => {
                const p = ((frame - 40 - i * 12) / 60 + d / 3) % 1;
                if (frame < 44 + i * 12 || p < 0) return null;
                // Cubic bezier point at p.
                const q = 1 - p;
                const bx = q * q * q * x1 + 3 * q * q * p * (x1 + 130) + 3 * q * p * p * (x2 - 130) + p * p * p * x2;
                const by = q * q * q * y + 3 * q * q * p * y + 3 * q * p * p * gateMid + p * p * p * gateMid;
                return <circle key={d} cx={bx} cy={by} r={8} fill={color} opacity={Math.sin(p * Math.PI)} />;
              })}
            </g>
          );
        })}
        <path
          d={`M${gateX + gateW} ${gateMid} H 1540`}
          stroke={C.line}
          strokeWidth={3}
          opacity={tween(frame, 110, 130)}
        />
      </svg>

      {SIGNALS.map((sig, i) => {
        const appear = tween(frame, 16 + i * 12, 40 + i * 12);
        return (
          <Panel
            key={sig.key}
            style={{
              position: "absolute",
              left: chipX,
              top: chipTop + i * chipGap,
              width: chipW,
              height: chipH,
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "0 28px",
              opacity: appear,
              transform: `translateX(${(1 - appear) * -60}px)`,
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 9, background: C.signal[sig.key], flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: S.body, fontWeight: 600 }}>{sig.title}</div>
              <div style={{ fontSize: S.small, color: C.muted }}>{sig.reveals}</div>
            </div>
          </Panel>
        );
      })}

      <Panel
        style={{
          position: "absolute",
          left: gateX,
          top: gateY,
          width: gateW,
          height: gateH,
          padding: "32px 34px",
          opacity: tween(frame, 60, 84),
          transform: `scale(${tween(frame, 60, 84, 0.94, 1)})`,
        }}
      >
        <div style={{ fontSize: S.h3, fontWeight: 700 }}>Collectors</div>
        <div style={{ fontSize: S.small, color: C.muted, marginTop: 6, marginBottom: 26 }}>one gate for every request</div>
        {rules.map((rule, i) => {
          const on = tween(frame, 110 + i * 30, 126 + i * 30);
          return (
            <div key={rule} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, opacity: 0.25 + on * 0.75 }}>
              <svg width={36} height={36} viewBox="0 0 36 36">
                <circle cx={18} cy={18} r={16} fill="none" stroke={C.high} strokeWidth={3} opacity={on} />
                <path d="M10 18 l6 6 l11 -13" fill="none" stroke={C.high} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} strokeDashoffset={30 * (1 - on)} />
              </svg>
              <span style={{ fontSize: S.body - 2 }}>{rule}</span>
            </div>
          );
        })}
      </Panel>

      <div style={{ position: "absolute", left: 1540, top: gateMid - 150, width: 330, textAlign: "center", opacity: tween(frame, 120, 140) }}>
        <div style={{ fontSize: 190, fontWeight: 700, letterSpacing: "-0.04em", color: C.accent, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: S.body, color: C.muted, marginTop: 10 }}>pieces of evidence</div>
        <div style={{ fontSize: S.small, color: C.muted, marginTop: 6 }}>from 18 polite requests</div>
      </div>
    </Scene>
  );
};

// ------------------------------------------------------------------ 3. Evidence cards stack up
const EvidenceStack: React.FC = () => {
  const frame = useCurrentFrame();
  const step = 48;
  const linkAt = 320;
  const link = tween(frame, linkAt, linkAt + 30);
  const claimIn = tween(frame, linkAt - 20, linkAt + 10);
  const cardPos = (i: number) => ({ x: 110 + i * 16, y: 210 + i * 112 });

  return (
    <Scene>
      <SceneTitle step="02">Evidence cards stack up</SceneTitle>

      {EVIDENCE.map((item, i) => {
        const start = 20 + i * step;
        const p = tween(frame, start, start + 26);
        const { x, y } = cardPos(i);
        const cited = item.id === "T7" || item.id === "D3";
        return (
          <EvidenceCard
            key={item.id}
            item={item}
            highlight={cited ? link : 0}
            style={{
              position: "absolute",
              left: x,
              top: y,
              opacity: p * (cited ? 1 : 1 - link * 0.45),
              transform: `translate(${(1 - p) * 500}px, ${(1 - p) * -40}px) rotate(${(1 - p) * 5}deg)`,
            }}
          />
        );
      })}

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[4, 5].map((i) => {
          const { x, y } = cardPos(i);
          const x1 = x + 760, y1 = y + 42, x2 = 1110, y2 = 520;
          const d = `M${x1} ${y1} C ${x1 + 120} ${y1}, ${x2 - 140} ${y2}, ${x2} ${y2}`;
          return (
            <path key={i} d={d} fill="none" stroke={C.signal[EVIDENCE[i].signal]} strokeWidth={4} strokeDasharray={600} strokeDashoffset={600 * (1 - link)} />
          );
        })}
      </svg>

      <Panel
        style={{
          position: "absolute",
          left: 1110,
          top: 380,
          width: 700,
          padding: "30px 36px 34px",
          opacity: claimIn,
          transform: `translateY(${(1 - claimIn) * 30}px)`,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: S.small, color: C.accent, fontWeight: 600, letterSpacing: "0.08em" }}>CLAIM</div>
        <div style={{ fontSize: S.h3, fontWeight: 700, lineHeight: 1.25, marginTop: 12 }}>Stripe is in active use for payments.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, opacity: link }}>
          <span style={{ fontSize: S.small, color: C.muted }}>cites</span>
          <Badge id="T7" color={C.signal.tech} />
          <Badge id="D3" color={C.signal.dns} />
        </div>
      </Panel>

      <div
        style={{
          position: "absolute",
          left: 1110,
          top: 720,
          width: 700,
          fontSize: S.body,
          color: C.muted,
          lineHeight: 1.45,
          opacity: tween(frame, linkAt + 40, linkAt + 62),
        }}
      >
        Each card keeps its <span style={{ color: C.text }}>id</span>, <span style={{ color: C.text }}>source</span>, <span style={{ color: C.text }}>excerpt</span> and{" "}
        <span style={{ color: C.text }}>timestamp</span>. A claim with no card behind it is dropped.
      </div>
    </Scene>
  );
};

// ------------------------------------------------------------------ 4. Confidence meter
const Meter: React.FC<{ value: number }> = ({ value }) => {
  const cx = 480, cy = 500, r = 360;
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - from), a2 = Math.PI * (1 - to);
    return `M ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy - r * Math.sin(a2)}`;
  };
  const angle = Math.PI * (1 - value);
  const zones: [number, number, Level][] = [
    [0.0, 0.325, "low"],
    [0.3375, 0.6625, "medium"],
    [0.675, 1.0, "high"],
  ];
  return (
    <svg width={960} height={600} viewBox="0 0 960 600">
      {zones.map(([a, b, level]) => (
        <path key={level} d={arc(a, b)} fill="none" stroke={C[level]} strokeWidth={46} opacity={value >= a - 0.01 && value <= b + 0.01 ? 1 : 0.22} />
      ))}
      {zones.map(([a, b, level]) => {
        const mid = Math.PI * (1 - (a + b) / 2);
        return (
          <text key={level} x={cx + (r + 70) * Math.cos(mid)} y={cy - (r + 70) * Math.sin(mid) + 10} fill={C[level]} fontSize={30} fontWeight={700} textAnchor="middle" fontFamily={MONO}>
            {level.toUpperCase()}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={cx + (r - 60) * Math.cos(angle)} y2={cy - (r - 60) * Math.sin(angle)} stroke={C.text} strokeWidth={10} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={24} fill={C.text} />
    </svg>
  );
};

const Confidence: React.FC = () => {
  const frame = useCurrentFrame();
  // Needle: rest -> medium (one source) -> high (second, independent source) -> low (an inference from one signal).
  const swap = 226;
  let value = tween(frame, 46, 80, 0.04, 0.5);
  if (frame >= 120) value = tween(frame, 120, 156, 0.5, 0.88);
  if (frame >= swap) value = tween(frame, swap + 10, swap + 50, 0.88, 0.15);
  const second = frame >= swap;
  const fadeA = second ? 0 : 1;
  const inB = tween(frame, swap, swap + 20);

  const row = (visible: number, children: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, opacity: visible, transform: `translateX(${(1 - visible) * 40}px)` }}>{children}</div>
  );
  const rule = (text: string, level: Level, on: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30, opacity: on }}>
      <span style={{ fontSize: S.body, color: C.muted }}>{text}</span>
      <span style={{ fontSize: S.body, color: C.muted }}>→</span>
      <Pill level={level} size={S.body - 2} />
    </div>
  );

  return (
    <Scene>
      <SceneTitle step="03">Confidence comes from the evidence</SceneTitle>
      <div style={{ position: "absolute", left: 60, top: 300 }}>
        <Meter value={value} />
      </div>

      <Panel style={{ position: "absolute", left: 1050, top: 290, width: 770, padding: "32px 38px 40px", minHeight: 540 }}>
        <div style={{ fontFamily: MONO, fontSize: S.small, color: C.accent, fontWeight: 600, letterSpacing: "0.08em" }}>CLAIM</div>
        {!second ? (
          <div style={{ opacity: fadeA }}>
            <div style={{ fontSize: S.h3, fontWeight: 700, lineHeight: 1.25, marginTop: 12 }}>Stripe is in active use for payments.</div>
            {row(tween(frame, 36, 56), (
              <>
                <Badge id="T7" color={C.signal.tech} />
                <span style={{ fontSize: S.small, fontFamily: MONO }}>script tag in the page source</span>
              </>
            ))}
            {rule("observed, one source", "medium", tween(frame, 70, 90))}
            {row(tween(frame, 110, 130), (
              <>
                <Badge id="D3" color={C.signal.dns} />
                <span style={{ fontSize: S.small, fontFamily: MONO }}>verification record in DNS</span>
              </>
            ))}
            {rule("observed, two independent sources", "high", tween(frame, 150, 170))}
          </div>
        ) : (
          <div style={{ opacity: inB }}>
            <div style={{ fontSize: S.h3, fontWeight: 700, lineHeight: 1.25, marginTop: 12 }}>The backend likely runs on Go and PostgreSQL.</div>
            {row(tween(frame, swap + 14, swap + 34), (
              <>
                <Badge id="J10" color={C.signal.careers} />
                <span style={{ fontSize: S.small, fontFamily: MONO }}>named in job text only</span>
              </>
            ))}
            {rule("inferred, one signal", "low", tween(frame, swap + 50, swap + 70))}
            <div style={{ fontSize: S.small, color: C.muted, marginTop: 34, lineHeight: 1.45, opacity: tween(frame, swap + 76, swap + 96) }}>
              Unknown: job posts mix current stack, planned migrations and nice-to-haves.
            </div>
          </div>
        )}
      </Panel>
    </Scene>
  );
};

// ------------------------------------------------------------------ 5. The report
const Report: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = tween(frame, 150, 300, 0, -430);
  const fields: { name: string; text: string; at: number }[] = [
    { name: "claim", text: "one sentence you can check", at: 40 },
    { name: "evidence[]", text: "the cards it rests on", at: 90 },
    { name: "confidence", text: "high, medium or low", at: 140 },
    { name: "unknowns", text: "what could not be established", at: 190 },
  ];
  const Cite: React.FC<{ id: string; color: string }> = ({ id, color }) => (
    <span style={{ fontFamily: MONO, color, fontWeight: 600 }}>[{id}]</span>
  );
  const h3: React.CSSProperties = { fontSize: 31, fontWeight: 700, lineHeight: 1.3, marginTop: 34 };
  const li: React.CSSProperties = { fontSize: 24, color: C.text, marginTop: 10, lineHeight: 1.4 };
  const unk: React.CSSProperties = { fontSize: 23, color: C.muted, marginTop: 14, lineHeight: 1.4 };

  return (
    <Scene>
      <SceneTitle step="04">The final report</SceneTitle>
      <Panel
        style={{
          position: "absolute",
          left: 110,
          top: 200,
          width: 1130,
          height: 800,
          overflow: "hidden",
          opacity: tween(frame, 10, 30),
          transform: `translateY(${tween(frame, 10, 30, 40, 0)}px)`,
        }}
      >
        <div style={{ position: "relative", zIndex: 2, height: 58, background: C.panelHi, borderBottom: `2px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 26px", fontFamily: MONO, fontSize: S.small, color: C.muted }}>
          report.md
        </div>
        <div style={{ padding: "8px 44px 40px", transform: `translateY(${scroll}px)` }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 26 }}>Outside-In report: Tallybird</div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 12, lineHeight: 1.45 }}>
            13 findings from 45 pieces of public evidence across 6 signal types. Fictional demo company.
          </div>

          <div style={h3}>1. Stripe is in active use: it appears in the page source and in DNS.</div>
          <div style={{ marginTop: 14 }}><Pill level="high" /></div>
          <div style={li}><Cite id="T7" color={C.signal.tech} /> script tag loading js.stripe.com</div>
          <div style={li}><Cite id="D3" color={C.signal.dns} /> TXT: stripe-verification=…</div>
          <div style={unk}>Unknown: how much of the business runs through Stripe.</div>

          <div style={h3}>4. Public pricing changed 5 times since 2023: Team moved from $29 to $39 per user.</div>
          <div style={{ marginTop: 14 }}><Pill level="high" /></div>
          <div style={li}><Cite id="P1" color={C.signal.pricing} /> Capture 2023-06-14: Free $0 · Solo $9 · Team $29</div>
          <div style={li}><Cite id="P4" color={C.signal.pricing} /> Live page: Solo $15 · Team $39 · Enterprise Custom</div>
          <div style={unk}>Unknown: whether existing customers were grandfathered.</div>

          <div style={h3}>11. The company appears to be moving upmarket.</div>
          <div style={{ marginTop: 14 }}><Pill level="medium" /></div>
          <div style={li}><Cite id="P3" color={C.signal.pricing} /> Enterprise plan added, Free plan dropped</div>
          <div style={li}><Cite id="J4" color={C.signal.careers} /> Enterprise Account Executive role open</div>
          <div style={li}><Cite id="C8" color={C.signal.changelog} /> Enterprise and security is the top changelog theme</div>
          <div style={unk}>Unknown: an interpretation; internal strategy is not public.</div>

          <div style={h3}>12. The backend likely involves Go, PostgreSQL and Kubernetes.</div>
          <div style={{ marginTop: 14 }}><Pill level="low" /></div>
          <div style={li}><Cite id="J10" color={C.signal.careers} /> Technologies named in job text</div>
          <div style={unk}>Unknown: cannot be confirmed from outside.</div>
        </div>
      </Panel>

      <div style={{ position: "absolute", left: 1310, top: 230, width: 520 }}>
        <div style={{ fontSize: S.body, color: C.muted, marginBottom: 14, opacity: tween(frame, 26, 44) }}>Every finding has four fields</div>
        {fields.map((f) => {
          const on = tween(frame, f.at, f.at + 20);
          return (
            <Panel key={f.name} style={{ padding: "22px 28px", marginTop: 22, opacity: on, transform: `translateX(${(1 - on) * 50}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: S.h3, fontWeight: 600, color: f.name === "confidence" ? C.accent : C.text }}>{f.name}</div>
              <div style={{ fontSize: S.small, color: C.muted, marginTop: 6 }}>{f.text}</div>
            </Panel>
          );
        })}
        <div style={{ fontSize: S.small, color: C.muted, marginTop: 30, fontFamily: MONO, opacity: tween(frame, 240, 260) }}>report.md + report.json</div>
      </div>
    </Scene>
  );
};

// ------------------------------------------------------------------ 6. Install
const Install: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    { text: "git clone https://github.com/hesselb20-ctrl/outside-in", at: 20 },
    { text: "cd outside-in && npm install && npm run build", at: 78 },
    { text: "npx outside-in example.com", at: 128 },
  ];
  const cps = 34;
  const out = tween(frame, 172, 190);
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 130, opacity: tween(frame, 0, 18) }}>
          <Wordmark size={56} />
        </div>
        <Panel style={{ marginTop: 54, width: 1420, opacity: tween(frame, 6, 24), overflow: "hidden" }}>
          <div style={{ height: 56, background: C.panelHi, borderBottom: `2px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12, padding: "0 24px" }}>
            {[C.low, C.medium, C.high].map((color) => (
              <div key={color} style={{ width: 18, height: 18, borderRadius: 9, background: color }} />
            ))}
          </div>
          <div style={{ padding: "34px 40px 40px", fontFamily: MONO, fontSize: 34, lineHeight: 1.8, minHeight: 380 }}>
            {lines.map((line, i) => {
              if (frame < line.at) return null;
              const shown = typed(line.text, frame, line.at, cps);
              const typing = shown.length < line.text.length;
              const active = typing || (i === lines.length - 1 && frame < 172) || (lines[i + 1] && frame < lines[i + 1].at);
              return (
                <div key={line.text}>
                  <span style={{ color: C.high }}>$ </span>
                  {shown}
                  {active ? <Cursor /> : null}
                </div>
              );
            })}
            <div style={{ opacity: out, color: C.muted, fontSize: 28, marginTop: 14 }}>
              13 findings (<span style={{ color: C.high }}>8 high</span>, <span style={{ color: C.medium }}>3 medium</span>, <span style={{ color: C.low }}>2 low</span>) from 45 evidence items
            </div>
          </div>
        </Panel>
        <div style={{ marginTop: 50, fontSize: S.h3, fontWeight: 600, opacity: tween(frame, 190, 210) }}>
          Public data only. Every claim cited.
        </div>
        <div style={{ marginTop: 14, fontSize: S.body, color: C.muted, opacity: tween(frame, 200, 220) }}>
          CLI · MCP server · MIT licence
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

export const Tutorial: React.FC = () => {
  let at = 0;
  const seq = (length: number, node: ReactNode, name: string) => {
    const el = (
      <Sequence key={name} name={name} from={at} durationInFrames={length}>
        {node}
      </Sequence>
    );
    at += length;
    return el;
  };
  return (
    <Backdrop>
      {seq(SCENES.question, <Question />, "Question")}
      {seq(SCENES.signals, <Signals />, "Signals")}
      {seq(SCENES.evidence, <EvidenceStack />, "Evidence")}
      {seq(SCENES.confidence, <Confidence />, "Confidence")}
      {seq(SCENES.report, <Report />, "Report")}
      {seq(SCENES.install, <Install />, "Install")}
    </Backdrop>
  );
};
