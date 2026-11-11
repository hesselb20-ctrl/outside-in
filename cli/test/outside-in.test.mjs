import assert from "node:assert/strict";
import { test } from "node:test";
import { start } from "../../examples/demo-site/server.mjs";
import {
  crawlDelaySeconds,
  grade,
  isAllowed,
  parseRobots,
  PoliteHttp,
  profile,
  redactPersonal,
  renderMarkdown,
} from "../dist/lib.js";
import { diffPlans, extractPlans } from "../dist/collectors/wayback.js";

test("robots.txt: longest match wins, wildcards and crawl-delay are honoured", () => {
  const robots = parseRobots(`
    User-agent: *
    Disallow: /private/
    Allow: /private/press
    Disallow: /*.pdf$
    Crawl-delay: 4

    User-agent: outside-in
    Disallow: /careers
  `);
  assert.equal(isAllowed(robots, "somebot", "/private/data"), false);
  assert.equal(isAllowed(robots, "somebot", "/private/press/2026"), true);
  assert.equal(isAllowed(robots, "somebot", "/files/deck.pdf"), false);
  assert.equal(isAllowed(robots, "somebot", "/files/deck.pdf?x=1"), true);
  assert.equal(crawlDelaySeconds(robots, "somebot"), 4);
  // A group that names us replaces the wildcard group entirely.
  assert.equal(isAllowed(robots, "outside-in", "/careers"), false);
  assert.equal(isAllowed(robots, "outside-in", "/private/data"), true);
});

test("pricing: plan cards are extracted and diffed", () => {
  const card = (name, price) => `<div class="plan"><h3>${name}</h3><p>${price}</p><ul><li>Feature</li></ul></div>`;
  const before = extractPlans(`<main>${card("Solo", "$9<span>/month</span>")}${card("Free", "$0")}</main>`);
  const after = extractPlans(`<main>${card("Solo", "$12<span>/month</span>")}${card("Enterprise", "Custom")}</main>`);
  assert.deepEqual(before.map((p) => p.price), ["$9/month", "$0"]);
  const changes = diffPlans(
    { date: "2024-01-01", source: "a", plans: before, evidenceId: "P1" },
    { date: "live", source: "b", plans: after, evidenceId: "P2" },
  );
  assert.deepEqual(changes.map((c) => `${c.kind}:${c.plan}`).sort(), ["added:Enterprise", "price-change:Solo", "removed:Free"]);
});

test("personal contact details are redacted from excerpts", () => {
  const out = redactPersonal("Write to jane.doe@example.com or call +31 20 123 4567 before 2026-10-28 from 203.0.113.10");
  assert.ok(!out.includes("jane.doe"));
  assert.ok(!out.includes("123 4567"));
  assert.ok(out.includes("2026-10-28"));
  assert.ok(out.includes("203.0.113.10"));
});

test("confidence is derived from the evidence, not the wording", () => {
  const e = (id, signal, source) => ({ id, signal, source, excerpt: "", observedAt: "" });
  assert.equal(grade([e("T1", "tech", "a")], "observed"), "medium");
  assert.equal(grade([e("T1", "tech", "a"), e("D1", "dns", "b")], "observed"), "high");
  assert.equal(grade([e("J1", "careers", "a"), e("J2", "careers", "b")], "inferred"), "low");
  assert.equal(grade([e("P1", "pricing", "a"), e("J1", "careers", "b")], "inferred"), "medium");
});

test("rate limit: two requests to one host are spaced by the minimum delay", async () => {
  const server = await start(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const http = new PoliteHttp({ minDelayMs: 300 });
    await http.get(`${base}/`); // also fetches robots.txt
    const t0 = Date.now();
    await http.get(`${base}/pricing`);
    assert.ok(Date.now() - t0 >= 280, "second request should wait for the delay");
  } finally {
    server.close();
  }
});

test("end to end against the fictional demo site", async () => {
  const seen = [];
  const server = await start(0, seen);
  const base = `http://localhost:${server.address().port}`;
  try {
    const { report } = await profile(base, {
      llm: false,
      waybackBase: `${base}/__wayback`,
      doh: `${base}/__doh`,
      appstoreBase: `${base}/__appstore`,
      appId: "1234567890",
      http: { minDelayMs: 20 },
    });

    // Every finding cites evidence that exists, has a confidence level and an unknowns list.
    const ids = new Set(report.evidence.map((e) => e.id));
    assert.ok(report.findings.length >= 8);
    for (const f of report.findings) {
      assert.ok(f.evidence.length > 0, `finding without evidence: ${f.claim}`);
      assert.ok(f.evidence.every((e) => ids.has(e.id) && e.source));
      assert.ok(["high", "medium", "low"].includes(f.confidence));
      assert.ok(Array.isArray(f.unknowns));
    }
    assert.ok(new Set(report.evidence.map((e) => e.signal)).size === 6, "all six signal types produce evidence");

    // Cross-signal corroboration and pricing history are found.
    assert.ok(report.findings.some((f) => /Stripe/.test(f.claim) && f.confidence === "high"));
    assert.ok(report.findings.some((f) => /Team moved from \$29\/user\/month to \$39\/user\/month/.test(f.claim)));

    // robots.txt: the disallowed path was never requested and the skip is logged.
    assert.ok(!seen.some((r) => r.path.startsWith("/releases")));
    assert.ok(report.collection.requests.some((r) => r.url.endsWith("/releases") && r.outcome === "skipped-robots"));

    // Generic user agent, no credentials, ever.
    assert.ok(seen.length > 10);
    for (const r of seen) {
      assert.match(r.userAgent, /^outside-in\/[\d.]+ \(public-signals research tool\)$/);
      assert.equal(r.cookie, undefined);
      assert.equal(r.authorization, undefined);
    }

    // No personal data: reviewer handles and e-mail addresses never reach the report.
    const json = JSON.stringify(report);
    assert.ok(!json.includes("demo-reviewer"));
    assert.ok(!/[\w.-]+@tallybird\.example/.test(json));
    // Verification tokens are not republished.
    assert.ok(!json.includes("demo0000"));

    const md = renderMarkdown(report);
    assert.ok(md.includes("## Findings") && md.includes("## Evidence") && md.includes("## Collection log"));
    assert.ok(!/<script/.test(md), "raw HTML in excerpts is escaped");
  } finally {
    server.close();
  }
});

test("a login wall is recorded as out of scope, not worked around", async () => {
  const server = await start(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const http = new PoliteHttp({ minDelayMs: 10 });
    const robots = await http.get(`${base}/admin/users`);
    assert.equal(robots.skipped, "robots"); // disallowed first
    const res = await http.get(`${base}/admin`); // not covered by "Disallow: /admin/"
    assert.equal(res.skipped, "auth-wall");
    assert.equal(res.body, "");
  } finally {
    server.close();
  }
});
