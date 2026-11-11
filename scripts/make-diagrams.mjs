// Draws the two README diagrams as hand-built SVG, from the shared design tokens.
// No image APIs, no dependencies: node scripts/make-diagrams.mjs

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const t = JSON.parse(await readFile(join(root, "design/tokens.json"), "utf8"));
const c = t.color;

const SIGNALS = [
  { key: "tech", title: "Tech fingerprint", from: "Homepage HTML and response headers", reveals: "Frameworks, hosting and the vendors a site loads" },
  { key: "pricing", title: "Pricing history", from: "Wayback Machine captures of the pricing page", reveals: "Plans added, dropped or repriced over time" },
  { key: "careers", title: "Job posts", from: "The public careers page", reveals: "Where the company is investing, and its stack" },
  { key: "changelog", title: "Changelog & feeds", from: "Changelog pages, RSS and Atom", reveals: "Shipping cadence and recurring themes" },
  { key: "dns", title: "DNS and headers", from: "MX, TXT, NS, CAA and DMARC records", reveals: "Mail and SaaS vendors, security hygiene" },
  { key: "reviews", title: "App reviews", from: "The public App Store review feed", reveals: "Product quality, version by version" },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (x, y, s, { size = 22, fill = c.text, weight = 400, anchor = "start", family = t.font.sans, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(s)}</text>`;
const rect = (x, y, w, h, { fill = c.panel, stroke = c.line, r = t.radius, sw = 1.5 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

function wrap(s, max) {
  const lines = [];
  let line = "";
  for (const word of s.split(" ")) {
    if ((line + " " + word).trim().length > max) {
      lines.push(line.trim());
      line = word;
    } else line += " " + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Small pictogram per signal, drawn in a 44x44 box at (x, y). */
function icon(key, x, y, color) {
  const s = `stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const g = {
    tech: `<path d="M14 12 L4 22 L14 32 M30 12 L40 22 L30 32 M25 8 L19 36" ${s}/>`,
    pricing: `<path d="M4 34 L14 24 L22 30 L40 10 M30 10 L40 10 L40 20" ${s}/>`,
    careers: `<rect x="5" y="14" width="34" height="22" rx="4" ${s}/><path d="M16 14 V9 H28 V14 M5 24 H39" ${s}/>`,
    changelog: `<path d="M8 10 H36 M8 22 H36 M8 34 H26" ${s}/><circle cx="36" cy="34" r="3" fill="${color}"/>`,
    dns: `<circle cx="22" cy="22" r="17" ${s}/><path d="M5 22 H39 M22 5 C12 14 12 30 22 39 C32 30 32 14 22 5" ${s}/>`,
    reviews: `<path d="M22 5 L27 16 L39 17.5 L30 26 L32.5 38 L22 32 L11.5 38 L14 26 L5 17.5 L17 16 Z" ${s}/>`,
  }[key];
  return `<g transform="translate(${x} ${y})">${g}</g>`;
}

const frame = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
<rect width="${w}" height="${h}" rx="24" fill="${c.ink}"/>
${body}
</svg>
`;

// ---------------------------------------------------------------- signals-map.svg
{
  const W = 1200, pad = 40, gap = 24;
  const cw = (W - pad * 2 - gap * 2) / 3, ch = 286;
  const H = 140 + ch * 2 + gap + pad;
  let body = `<title>The six public signal types and what each reveals</title>`;
  body += text(pad, 70, "Six public signals", { size: 40, weight: 700 });
  body += text(pad, 108, "What each one is read from, and what it reveals", { size: 24, fill: c.muted });
  SIGNALS.forEach((sig, i) => {
    const x = pad + (i % 3) * (cw + gap);
    const y = 140 + Math.floor(i / 3) * (ch + gap);
    const color = c.signal[sig.key];
    body += rect(x, y, cw, ch);
    body += `<rect x="${x}" y="${y + 24}" width="6" height="56" rx="3" fill="${color}"/>`;
    body += icon(sig.key, x + 28, y + 30, color);
    body += text(x + 88, y + 61, sig.title, { size: 25, weight: 700 });
    body += text(x + 28, y + 122, "READ FROM", { size: 15, fill: c.muted, weight: 600, spacing: 1.5 });
    wrap(sig.from, 28).forEach((line, n) => (body += text(x + 28, y + 150 + n * 27, line, { size: 21 })));
    body += text(x + 28, y + 216, "REVEALS", { size: 15, fill: color, weight: 600, spacing: 1.5 });
    wrap(sig.reveals, 28).forEach((line, n) => (body += text(x + 28, y + 244 + n * 27, line, { size: 21 })));
  });
  await writeFile(join(root, "media/signals-map.svg"), frame(W, H, body));
}

// ---------------------------------------------------------------- how-it-works.svg
{
  const W = 1200, H = 560;
  let body = `<title>How Outside-In works: signals, collectors, evidence graph, report</title>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${c.muted}"/></marker></defs>`;
  const cols = [
    { x: 40, w: 250, n: "1", title: "Public signals" },
    { x: 340, w: 250, n: "2", title: "Collectors" },
    { x: 640, w: 250, n: "3", title: "Evidence graph" },
    { x: 940, w: 220, n: "4", title: "Report" },
  ];
  const top = 104, bottom = 520;
  for (const col of cols) {
    body += text(col.x, 56, col.n, { size: 22, fill: c.accent, weight: 700, family: t.font.mono });
    body += text(col.x + 28, 56, col.title, { size: 27, weight: 700 });
    body += rect(col.x, top, col.w, bottom - top);
  }
  for (let i = 0; i < 3; i++) {
    const x1 = cols[i].x + cols[i].w + 6, x2 = cols[i + 1].x - 8;
    body += `<line x1="${x1}" y1="${(top + bottom) / 2}" x2="${x2}" y2="${(top + bottom) / 2}" stroke="${c.muted}" stroke-width="2.5" marker-end="url(#arrow)"/>`;
  }

  // 1. signals
  SIGNALS.forEach((sig, i) => {
    const y = top + 22 + i * 64;
    const color = c.signal[sig.key];
    body += rect(cols[0].x + 16, y, cols[0].w - 32, 50, { fill: c.panelHi, r: 12 });
    body += `<circle cx="${cols[0].x + 40}" cy="${y + 25}" r="7" fill="${color}"/>`;
    body += text(cols[0].x + 60, y + 32, sig.title, { size: 19, weight: 500 });
  });

  // 2. collectors and their guard rails
  const gx = cols[1].x + 22;
  body += text(gx, top + 48, "One module per signal.", { size: 19, weight: 600 });
  body += text(gx, top + 76, "Every request passes", { size: 20, fill: c.muted });
  body += text(gx, top + 102, "the same gate:", { size: 20, fill: c.muted });
  ["robots.txt honoured", "rate limit per host", "generic user agent", "GET only, no logins", "no personal data"].forEach((rule, i) => {
    const y = top + 146 + i * 50;
    body += `<path d="M${gx + 2} ${y - 7} l7 7 l13 -15" stroke="${c.high}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    body += text(gx + 36, y, rule, { size: 20 });
  });

  // 3. evidence graph: evidence nodes on the left linked to claim nodes on the right
  const ex = cols[2].x + 46, kx = cols[2].x + cols[2].w - 62;
  const ev = [
    { id: "T7", y: top + 60, k: "tech" },
    { id: "D3", y: top + 122, k: "dns" },
    { id: "P1", y: top + 196, k: "pricing" },
    { id: "P4", y: top + 258, k: "pricing" },
    { id: "J4", y: top + 320, k: "careers" },
    { id: "J10", y: top + 382, k: "careers" },
  ];
  const claims = [
    { y: top + 91, from: [0, 1], level: "high" },
    { y: top + 258, from: [2, 3, 4], level: "medium" },
    { y: top + 382, from: [5], level: "low" },
  ];
  for (const claim of claims) {
    for (const i of claim.from) {
      body += `<line x1="${ex + 24}" y1="${ev[i].y}" x2="${kx - 30}" y2="${claim.y}" stroke="${c.line}" stroke-width="2.5"/>`;
    }
  }
  for (const e of ev) {
    body += `<circle cx="${ex}" cy="${e.y}" r="24" fill="${c.panelHi}" stroke="${c.signal[e.k]}" stroke-width="2.5"/>`;
    body += text(ex, e.y + 6, e.id, { size: 17, weight: 600, anchor: "middle", family: t.font.mono });
  }
  for (const claim of claims) {
    body += `<rect x="${kx - 30}" y="${claim.y - 22}" width="92" height="44" rx="22" fill="${c[claim.level]}"/>`;
    body += text(kx + 16, claim.y + 7, claim.level, { size: 19, weight: 700, anchor: "middle", fill: c.ink });
  }

  // 4. report
  const rx = cols[3].x + 20, rw = cols[3].w - 40;
  body += text(rx, top + 46, "report.md", { size: 20, weight: 600, family: t.font.mono });
  body += text(rx, top + 74, "report.json", { size: 20, weight: 600, family: t.font.mono });
  ["claim", "evidence[]", "confidence", "unknowns"].forEach((field, i) => {
    const y = top + 108 + i * 68;
    body += rect(rx, y, rw, 54, { fill: c.panelHi, r: 12 });
    body += text(rx + 16, y + 34, field, { size: 20, family: t.font.mono, fill: i === 2 ? c.accent : c.text });
  });
  body += text(rx, bottom - 16, "Every claim cites its source", { size: 15, fill: c.muted });

  await writeFile(join(root, "media/how-it-works.svg"), frame(W, H, body));
}

console.log("Wrote media/how-it-works.svg and media/signals-map.svg");
