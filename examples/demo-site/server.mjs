// Demo server for Outside-In. Zero dependencies.
//
// It serves the website of Tallybird, a company that does not exist, and stands in for the
// three public services the collectors normally talk to, so the whole pipeline can be run
// offline and reproducibly:
//
//   /__wayback/...   a Wayback Machine look-alike (CDX index + archived captures)
//   /__doh           a DNS-over-HTTPS JSON resolver answering from fixtures/dns.json
//   /__appstore/...  the App Store customer-review feed, from fixtures/reviews.json
//
// Everything here is fictional. No real company, person or review is represented.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const PAGES = {
  "/": "public/index.html",
  "/pricing": "public/pricing.html",
  "/careers": "public/careers.html",
  "/changelog": "public/changelog.html",
  "/releases": "public/changelog.html",
  "/feed.xml": "public/feed.xml",
  "/robots.txt": "public/robots.txt",
  "/styles.css": "public/styles.css",
};

const CAPTURES = ["20230614101500", "20240902083000", "20250811140000"];

const TYPES = { html: "text/html; charset=utf-8", xml: "application/rss+xml; charset=utf-8", txt: "text/plain; charset=utf-8", css: "text/css; charset=utf-8" };

// What a plausible production site would send. No Content-Security-Policy on purpose:
// the report should notice that it is missing.
const SITE_HEADERS = {
  server: "Vercel",
  "x-powered-by": "Next.js",
  "x-vercel-id": "fra1::demo-0000000000000-000000000000",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

async function file(relative, origin) {
  const text = await readFile(join(root, relative), "utf8");
  return text.replaceAll("{{ORIGIN}}", origin);
}

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...headers });
  res.end(body);
}

/** Starts the demo server. `seen` collects the user agents of incoming requests, for the tests. */
export function start(port = 4173, seen = []) {
  const server = createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`;
    const url = new URL(req.url, origin);
    seen.push({ path: url.pathname, userAgent: req.headers["user-agent"] ?? "", cookie: req.headers.cookie, authorization: req.headers.authorization });

    try {
      if (req.method !== "GET") return send(res, 405, TYPES.txt, "Method not allowed");

      if (url.pathname === "/__wayback/cdx/search/cdx") {
        const rows = [["timestamp", "original", "statuscode", "digest"]];
        for (const ts of CAPTURES) rows.push([ts, `${origin}/pricing`, "200", `DEMO${ts}`]);
        return send(res, 200, "application/json", JSON.stringify(rows));
      }

      const capture = /^\/__wayback\/web\/(\d{14})(?:id_)?\//.exec(url.pathname);
      if (capture) {
        if (!CAPTURES.includes(capture[1])) return send(res, 404, TYPES.txt, "No such capture");
        return send(res, 200, TYPES.html, await file(`archive/pricing-${capture[1].slice(0, 8)}.html`, origin));
      }

      if (url.pathname === "/__doh") {
        const fixtures = JSON.parse(await file("fixtures/dns.json", origin));
        const name = url.searchParams.get("name") ?? "";
        const type = url.searchParams.get("type") ?? "A";
        const answers = name.startsWith("_dmarc.") ? (type === "TXT" ? fixtures._dmarc : []) : (fixtures[type] ?? []);
        return send(res, 200, "application/dns-json", JSON.stringify({ Status: 0, Answer: answers.map((data) => ({ name, data })) }));
      }

      if (/^\/__appstore\/[a-z]{2}\/rss\/customerreviews\/id=\d+\/sortBy=mostRecent\/json$/.test(url.pathname)) {
        return send(res, 200, "application/json", await file("fixtures/reviews.json", origin));
      }

      if (url.pathname.startsWith("/admin")) {
        return send(res, 401, TYPES.txt, "Sign in required", { "www-authenticate": 'Basic realm="Tallybird admin"' });
      }

      const page = PAGES[url.pathname.replace(/(.)\/$/, "$1")];
      if (!page) return send(res, 404, TYPES.html, "<!doctype html><title>Not found</title><h1>404</h1>", SITE_HEADERS);
      const ext = page.split(".").pop();
      return send(res, 200, TYPES[ext] ?? TYPES.txt, await file(page, origin), SITE_HEADERS);
    } catch (err) {
      return send(res, 500, TYPES.txt, String(err));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4173);
  await start(port);
  console.log(`Tallybird demo site (fictional) on http://localhost:${port}`);
}
