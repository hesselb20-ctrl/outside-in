# Demo site: Tallybird (fictional)

Tallybird does not exist. It is a made-up invoicing company whose website gives Outside-In something realistic to profile without touching a real one.

```bash
npm run demo:serve
```

serves it on `http://localhost:4173`:

| Path | What it is |
| --- | --- |
| `/`, `/pricing`, `/careers`, `/changelog`, `/feed.xml` | The company's public site |
| `/robots.txt` | Disallows `/releases` and `/admin/`, so a run shows a robots.txt skip |
| `/admin` | Answers `401`, to show that login walls are recorded and left alone |
| `/__wayback/...` | Stand-in for the Wayback Machine: a CDX index and three archived pricing captures from `archive/` |
| `/__doh` | Stand-in for a DNS-over-HTTPS resolver, answering from `fixtures/dns.json` |
| `/__appstore/...` | Stand-in for the App Store review feed, from `fixtures/reviews.json` |

The third-party `<script>` tags on the homepage are typed `text/plain`, so opening the site in a browser loads nothing from anyone. The collector only reads the markup.

The review fixture includes an `author` block shaped like the real feed's. Outside-In never reads it, and the tests assert that no reviewer handle reaches the report.

`npm run demo` starts this server, runs the CLI against it and writes [`../report`](../report).
