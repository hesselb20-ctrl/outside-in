import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import tokens from "../../design/tokens.json";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "600"], subsets: ["latin"] });

export const C = tokens.color;
export const S = tokens.scale;
export const SANS = inter.fontFamily;
export const MONO = mono.fontFamily;

export type Level = "high" | "medium" | "low";
export type SignalKey = keyof typeof tokens.color.signal;

export const SIGNALS: { key: SignalKey; title: string; reveals: string }[] = [
  { key: "tech", title: "Tech fingerprint", reveals: "frameworks, hosting, vendors" },
  { key: "pricing", title: "Pricing history", reveals: "plans repriced over time" },
  { key: "careers", title: "Job posts", reveals: "where the company invests" },
  { key: "changelog", title: "Changelog", reveals: "shipping cadence and themes" },
  { key: "dns", title: "DNS and headers", reveals: "mail and SaaS vendors" },
  { key: "reviews", title: "App reviews", reveals: "quality, version by version" },
];

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Eased 0..1 (or a..b) progress between two frames, clamped outside. */
export const tween = (frame: number, from: number, to: number, a = 0, b = 1): number =>
  interpolate(frame, [from, to], [a, b], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

export const typed = (text: string, frame: number, start: number, charsPerSecond = 22, fps = 30): string =>
  text.slice(0, Math.max(0, Math.floor(((frame - start) / fps) * charsPerSecond)));

export const Backdrop: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: C.ink, fontFamily: SANS, color: C.text }}>
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        maskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 78%)",
      }}
    />
    {children}
  </AbsoluteFill>
);

/** Fades a scene in over its first frames and out over its last. */
export const Scene: React.FC<{ children: ReactNode; fade?: number }> = ({ children, fade = 12 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = Math.min(tween(frame, 0, fade), tween(frame, durationInFrames - fade, durationInFrames, 1, 0));
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** The mark: a ring (the company) with an arrow arriving from outside. */
export const Logo: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <circle cx="38" cy="32" r="21" fill="none" stroke={C.text} strokeWidth="5" />
    <circle cx="38" cy="32" r="6" fill={C.accent} />
    <path d="M2 32 H26 M17 23 L26 32 L17 41" fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Wordmark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.35 }}>
    <Logo size={size * 1.4} />
    <span style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.02em" }}>Outside-In</span>
  </div>
);

export const Pill: React.FC<{ level: Level; size?: number; style?: CSSProperties }> = ({ level, size = S.small, style }) => (
  <span
    style={{
      display: "inline-block",
      background: C[level],
      color: C.ink,
      fontWeight: 700,
      fontSize: size,
      padding: `${size * 0.22}px ${size * 0.7}px`,
      borderRadius: 999,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      ...style,
    }}
  >
    {level}
  </span>
);

export const Badge: React.FC<{ id: string; color: string; size?: number }> = ({ id, color, size = S.small }) => (
  <span
    style={{
      fontFamily: MONO,
      fontWeight: 600,
      fontSize: size,
      color,
      border: `2px solid ${color}`,
      borderRadius: 10,
      padding: `${size * 0.1}px ${size * 0.45}px`,
      background: C.panelHi,
    }}
  >
    {id}
  </span>
);

export const Panel: React.FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.panel,
      border: `2px solid ${C.line}`,
      borderRadius: tokens.radius,
      boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
      ...style,
    }}
  >
    {children}
  </div>
);

export interface EvidenceItem {
  id: string;
  signal: SignalKey;
  label: string;
  excerpt: string;
  source: string;
}

export const EvidenceCard: React.FC<{ item: EvidenceItem; width?: number; highlight?: number; style?: CSSProperties }> = ({
  item,
  width = 760,
  highlight = 0,
  style,
}) => {
  const color = C.signal[item.signal];
  return (
    <Panel
      style={{
        width,
        padding: "18px 24px 22px",
        borderColor: highlight > 0 ? color : C.line,
        boxShadow: `0 18px 40px rgba(0,0,0,0.45), 0 0 ${40 * highlight}px ${color}66`,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Badge id={item.id} color={color} />
        <span style={{ fontSize: S.small, fontWeight: 600 }}>{item.label}</span>
        <span style={{ fontSize: 19, color: C.muted, fontFamily: MONO, marginLeft: "auto" }}>{item.source}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: S.small, marginTop: 14, color: C.text, lineHeight: 1.4 }}>{item.excerpt}</div>
    </Panel>
  );
};

export const SceneTitle: React.FC<{ step: string; children: ReactNode }> = ({ step, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 78,
        display: "flex",
        alignItems: "baseline",
        gap: 22,
        opacity: tween(frame, 4, 22),
        transform: `translateY(${tween(frame, 4, 22, 16, 0)}px)`,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: S.h3, color: C.accent, fontWeight: 600 }}>{step}</span>
      <span style={{ fontSize: S.h2, fontWeight: 700, letterSpacing: "-0.02em" }}>{children}</span>
    </div>
  );
};
