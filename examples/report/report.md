# Outside-In report: localhost:4173

Generated 2026-11-11 21:32 UTC by outside-in 0.1.0. Synthesis: offline heuristic rules (no model call).

> Public signals only. Every request is an unauthenticated GET that honours robots.txt and a per-host rate limit. Nothing behind a login is fetched and no personal data about employees is collected; e-mail addresses and phone numbers are redacted from excerpts.

## Summary

13 findings about localhost:4173, drawn from 45 pieces of public evidence across 6 signal types (confidence: 8 high, 3 medium, 2 low). Every claim below cites the evidence it rests on and lists what could not be established.

## Findings

### 1. Stripe is in active use (payments; domain verified): it appears both in the site's page source and in the domain's DNS records.

**Confidence: high** · cites [T7](#t7), [D3](#d3)

- **T7** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="https://js.stripe.com/v3/"&gt; ([source](http://localhost:4173/))
- **D3** DNS records: TXT: stripe-verification=… (`dns:localhost?type=TXT`)

Unknowns:

- How much of the business runs through Stripe, and on which plan, is not public.

### 2. The domain is configured for Google Workspace (receives mail), SendGrid (transactional e-mail), Zendesk (support e-mail), Atlassian (domain verified), Google Search Console (domain verified) and Cloudflare (hosts DNS).

**Confidence: high** · cites [D1](#d1), [D2](#d2), [D4](#d4), [D5](#d5), [D6](#d6)

- **D1** DNS records: MX: 1 aspmx.l.google.com.; 5 alt1.aspmx.l.google.com. (`dns:localhost?type=MX`)
- **D2** DNS records: SPF: v=spf1 include:_spf.google.com include:sendgrid.net include:mail.zendesk.com ~all (`dns:localhost?type=TXT`)
- **D4** DNS records: TXT: atlassian-domain-verification=… (`dns:localhost?type=TXT`)
- **D5** DNS records: TXT: google-site-verification=… (`dns:localhost?type=TXT`)
- **D6** DNS records: NS: ada.ns.cloudflare.com., bob.ns.cloudflare.com. (`dns:localhost?type=NS`)

Unknowns:

- A verification record can outlive the trial or contract that created it.

### 3. Baseline security hygiene: the domain publishes a DMARC policy of "quarantine", and the homepage omits content-security-policy.

**Confidence: high** · cites [D8](#d8), [T10](#t10)

- **D8** DNS records: DMARC: v=DMARC1; p=quarantine; rua=mailto:[email redacted] (`dns:_dmarc.localhost?type=TXT`)
- **T10** Tech fingerprint: Security headers present: strict-transport-security, x-frame-options, x-content-type-options, referrer-policy. Not sent: content-security-policy. ([source](http://localhost:4173/))

Unknowns:

- Headers and DNS policy say nothing about application security or internal controls.

### 4. Public pricing changed 5 times across 4 captures since 2023-06-14: Solo moved from $9/month to $12/month by 2024-09-02; Team moved from $29/user/month to $39/user/month by 2025-08-11; an Enterprise plan (Custom) appeared by 2025-08-11; the Free plan ($0) was gone by 2025-08-11; Solo moved from $12/month to $15/month by today.

**Confidence: high** · cites [P1](#p1), [P2](#p2), [P3](#p3), [P4](#p4)

- **P1** Pricing history: Capture of 2023-06-14: Free $0 · Solo $9/month · Team $29/user/month ([source](http://localhost:4173/__wayback/web/20230614101500/http://localhost:4173/pricing))
- **P2** Pricing history: Capture of 2024-09-02: Free $0 · Solo $12/month · Team $29/user/month ([source](http://localhost:4173/__wayback/web/20240902083000/http://localhost:4173/pricing))
- **P3** Pricing history: Capture of 2025-08-11: Solo $12/month · Team $39/user/month · Enterprise Custom ([source](http://localhost:4173/__wayback/web/20250811140000/http://localhost:4173/pricing))
- **P4** Pricing history: Live page: Solo $15/month · Team $39/user/month · Enterprise Custom ([source](http://localhost:4173/pricing))

Unknowns:

- The exact date of each change lies somewhere between two captures.
- Whether existing customers were grandfathered is not public.

### 5. 8 open roles are advertised, concentrated in Engineering (2), Sales (2) and Machine learning (1).

**Confidence: high** · cites [J9](#j9), [J1](#j1), [J2](#j2), [J3](#j3), [J4](#j4), [J5](#j5)

- **J9** Job posts: 8 open roles listed. By team: Engineering 2, Sales 2, Machine learning 1, Infrastructure 1, Security 1, Design 1. ([source](http://localhost:4173/careers))
- **J1** Job posts: Senior Backend Engineer — Engineering — Amsterdam — posted 2026-10-20 ([source](http://localhost:4173/careers#senior-backend-engineer))
- **J2** Job posts: Staff Frontend Engineer — Engineering — Remote — posted 2026-10-02 ([source](http://localhost:4173/careers#staff-frontend-engineer))
- **J3** Job posts: Machine Learning Engineer, Document Understanding — Machine learning — Amsterdam — posted 2026-09-18 ([source](http://localhost:4173/careers#machine-learning-engineer-document-understanding))
- **J4** Job posts: Site Reliability Engineer — Infrastructure — Remote — posted 2026-09-30 ([source](http://localhost:4173/careers#site-reliability-engineer))
- **J5** Job posts: Enterprise Account Executive — Sales — London — posted 2026-10-28 ([source](http://localhost:4173/careers#enterprise-account-executive))

Unknowns:

- Open roles are not headcount: backfills, evergreen postings and unlisted hires are indistinguishable from outside.

### 6. Job text names React and Next.js, matching what the site itself runs.

**Confidence: high** · cites [J10](#j10), [T3](#t3), [T1](#t1), [T2](#t2)

- **J10** Job posts: Technologies named in job text: Kubernetes ×2, AWS ×2, TypeScript ×1, Python ×1, Go ×1, React ×1, Next.js ×1, PostgreSQL ×1, Kafka ×1, Terraform ×1, PyTorch ×1, SOC 2 ×1, ISO 27001 ×1, SSO ×1 ([source](http://localhost:4173/careers))
- **T3** Tech fingerprint: &lt;div id="__next" data-reactroot=""&gt; ([source](http://localhost:4173/))
- **T1** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="/_next/static/chunks/main-4f2a91.js"&gt; ([source](http://localhost:4173/))
- **T2** Tech fingerprint: x-powered-by: Next.js ([source](http://localhost:4173/))

### 7. The company announces product updates roughly every 21 days (10 entries from 2026-04-22 to 2026-10-28); the most frequent themes are Enterprise & security, Reporting and API & integrations.

**Confidence: high** · cites [C7](#c7), [C8](#c8), [C1](#c1), [C2](#c2), [C3](#c3), [C4](#c4)

- **C7** Changelog: 10 entries between 2026-04-22 and 2026-10-28; median gap 21 days. ([source](http://localhost:4173/feed.xml))
- **C8** Changelog: Themes across 10 entry titles: Enterprise &amp; security ×4, Reporting ×2, API &amp; integrations ×2, Billing &amp; payments ×2, AI ×1, Mobile ×1, Performance ×1 ([source](http://localhost:4173/feed.xml))
- **C1** Changelog: 2026-10-28: SCIM provisioning for Enterprise ([source](http://localhost:4173/changelog#scim))
- **C2** Changelog: 2026-10-07: Audit log export ([source](http://localhost:4173/changelog#audit-log))
- **C3** Changelog: 2026-09-16: SAML single sign-on on Team and Enterprise ([source](http://localhost:4173/changelog#sso))
- **C4** Changelog: 2026-08-26: AI auto-categorisation of expenses ([source](http://localhost:4173/changelog#ai-sorting))

Unknowns:

- Announced releases undercount actual shipping; fixes and internal work are rarely listed.

### 8. The 12 most recent App Store reviews average 3.2/5, with 42% at 1-2 stars; the commonest complaints concern sync, speed and crashes.

**Confidence: high** · cites [R1](#r1), [R2](#r2), [R3](#r3), [R4](#r4), [R5](#r5)

- **R1** App reviews: 12 most recent reviews: average 3.2/5, 42% rated 1-2 stars. By version: v3.1: 4.6 (5), v3.2: 2.1 (7). ([source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json))
- **R2** App reviews: Themes in reviews rated 3 stars or lower: sync ×3, speed ×3, crashes ×1, missing features ×1, price ×1, support ×1 ([source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json))
- **R3** App reviews: 1★ (v3.2) "Crashes on open": The app crashes every time I open a draft. Had to go back to the website. ([source](http://localhost:4173/__appstore/us/app/id1234567890))
- **R4** App reviews: 1★ (v3.2) "Price went up and it got worse": Paying more for Solo and the app is slow and keeps logging me out. Support gave no response. ([source](http://localhost:4173/__appstore/us/app/id1234567890))
- **R5** App reviews: 5★ (v3.1) "Great app": Sending an invoice from my phone takes ten seconds. ([source](http://localhost:4173/__appstore/us/app/id1234567890))

Unknowns:

- This is a recent sample from one storefront, not the lifetime rating.

### 9. The public website is built with Next.js and React and is served through Vercel.

**Confidence: medium** · cites [T1](#t1), [T2](#t2), [T3](#t3), [T4](#t4), [T5](#t5)

- **T1** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="/_next/static/chunks/main-4f2a91.js"&gt; ([source](http://localhost:4173/))
- **T2** Tech fingerprint: x-powered-by: Next.js ([source](http://localhost:4173/))
- **T3** Tech fingerprint: &lt;div id="__next" data-reactroot=""&gt; ([source](http://localhost:4173/))
- **T4** Tech fingerprint: x-vercel-id: (present) ([source](http://localhost:4173/))
- **T5** Tech fingerprint: server: Vercel ([source](http://localhost:4173/))

Unknowns:

- Whether the logged-in product shares this stack is not visible from the marketing site.

### 10. The site loads third-party tools for analytics (Segment), support (Intercom) and monitoring (Sentry).

**Confidence: medium** · cites [T6](#t6), [T8](#t8), [T9](#t9)

- **T6** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="https://cdn.segment.com/analytics.js/v1/DEMO/analytics.min.js"&gt; ([source](http://localhost:4173/))
- **T8** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="https://widget.intercom.io/widget/demo"&gt; ([source](http://localhost:4173/))
- **T9** Tech fingerprint: &lt;script type="text/plain" data-demo-inert src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"&gt; ([source](http://localhost:4173/))

Unknowns:

- A script tag proves a tool is loaded, not that it is the system of record.

### 11. The company appears to be moving upmarket: it added an Enterprise plan and it dropped its Free plan, and it is hiring for enterprise-facing roles and has been shipping enterprise and security features.

**Confidence: medium** · cites [P2](#p2), [P3](#p3), [J5](#j5), [J6](#j6), [J7](#j7), [C8](#c8)

- **P2** Pricing history: Capture of 2024-09-02: Free $0 · Solo $12/month · Team $29/user/month ([source](http://localhost:4173/__wayback/web/20240902083000/http://localhost:4173/pricing))
- **P3** Pricing history: Capture of 2025-08-11: Solo $12/month · Team $39/user/month · Enterprise Custom ([source](http://localhost:4173/__wayback/web/20250811140000/http://localhost:4173/pricing))
- **J5** Job posts: Enterprise Account Executive — Sales — London — posted 2026-10-28 ([source](http://localhost:4173/careers#enterprise-account-executive))
- **J6** Job posts: Solutions Consultant — Sales — London — posted 2026-10-14 ([source](http://localhost:4173/careers#solutions-consultant))
- **J7** Job posts: Security and Compliance Lead — Security — Amsterdam — posted 2026-08-27 ([source](http://localhost:4173/careers#security-and-compliance-lead))
- **C8** Changelog: Themes across 10 entry titles: Enterprise &amp; security ×4, Reporting ×2, API &amp; integrations ×2, Billing &amp; payments ×2, AI ×1, Mobile ×1, Performance ×1 ([source](http://localhost:4173/feed.xml))

Unknowns:

- This is an interpretation of public signals; the company has not been asked and its internal strategy is unknown.
- Revenue mix by customer size is not public.

### 12. The backend likely involves TypeScript, Python, Go, PostgreSQL, Kafka, Kubernetes, Terraform and AWS: these are named in job text but cannot be confirmed from outside.

**Confidence: low** · cites [J10](#j10)

- **J10** Job posts: Technologies named in job text: Kubernetes ×2, AWS ×2, TypeScript ×1, Python ×1, Go ×1, React ×1, Next.js ×1, PostgreSQL ×1, Kafka ×1, Terraform ×1, PyTorch ×1, SOC 2 ×1, ISO 27001 ×1, SSO ×1 ([source](http://localhost:4173/careers))

Unknowns:

- Job posts mix current stack, planned migrations and nice-to-haves.
- No server-side technology can be verified without access the tool does not seek.

### 13. Version 3.2 of the app may have introduced a regression: its reviews average 2.1 against 4.6 for version 3.1.

**Confidence: low** · cites [R1](#r1), [R2](#r2)

- **R1** App reviews: 12 most recent reviews: average 3.2/5, 42% rated 1-2 stars. By version: v3.1: 4.6 (5), v3.2: 2.1 (7). ([source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json))
- **R2** App reviews: Themes in reviews rated 3 stars or lower: sync ×3, speed ×3, crashes ×1, missing features ×1, price ×1, support ×1 ([source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json))

Unknowns:

- Small per-version samples; a rating dip can also follow a pricing or policy change rather than a bug.

## Evidence

| Id | Signal | Excerpt | Source | Observed (UTC) |
| --- | --- | --- | --- | --- |
| <a id="t1"></a>T1 | Tech fingerprint | &lt;script type="text/plain" data-demo-inert src="/_next/static/chunks/main-4f2a91.js"&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t2"></a>T2 | Tech fingerprint | x-powered-by: Next.js | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t3"></a>T3 | Tech fingerprint | &lt;div id="__next" data-reactroot=""&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t4"></a>T4 | Tech fingerprint | x-vercel-id: (present) | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t5"></a>T5 | Tech fingerprint | server: Vercel | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t6"></a>T6 | Tech fingerprint | &lt;script type="text/plain" data-demo-inert src="https://cdn.segment.com/analytics.js/v1/DEMO/analytics.min.js"&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t7"></a>T7 | Tech fingerprint | &lt;script type="text/plain" data-demo-inert src="https://js.stripe.com/v3/"&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t8"></a>T8 | Tech fingerprint | &lt;script type="text/plain" data-demo-inert src="https://widget.intercom.io/widget/demo"&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t9"></a>T9 | Tech fingerprint | &lt;script type="text/plain" data-demo-inert src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"&gt; | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="t10"></a>T10 | Tech fingerprint | Security headers present: strict-transport-security, x-frame-options, x-content-type-options, referrer-policy. Not sent: content-security-policy. | [source](http://localhost:4173/) | 2026-11-11 21:32 |
| <a id="p1"></a>P1 | Pricing history | Capture of 2023-06-14: Free $0 · Solo $9/month · Team $29/user/month | [source](http://localhost:4173/__wayback/web/20230614101500/http://localhost:4173/pricing) | 2026-11-11 21:32 |
| <a id="p2"></a>P2 | Pricing history | Capture of 2024-09-02: Free $0 · Solo $12/month · Team $29/user/month | [source](http://localhost:4173/__wayback/web/20240902083000/http://localhost:4173/pricing) | 2026-11-11 21:32 |
| <a id="p3"></a>P3 | Pricing history | Capture of 2025-08-11: Solo $12/month · Team $39/user/month · Enterprise Custom | [source](http://localhost:4173/__wayback/web/20250811140000/http://localhost:4173/pricing) | 2026-11-11 21:32 |
| <a id="p4"></a>P4 | Pricing history | Live page: Solo $15/month · Team $39/user/month · Enterprise Custom | [source](http://localhost:4173/pricing) | 2026-11-11 21:32 |
| <a id="j1"></a>J1 | Job posts | Senior Backend Engineer — Engineering — Amsterdam — posted 2026-10-20 | [source](http://localhost:4173/careers#senior-backend-engineer) | 2026-11-11 21:32 |
| <a id="j2"></a>J2 | Job posts | Staff Frontend Engineer — Engineering — Remote — posted 2026-10-02 | [source](http://localhost:4173/careers#staff-frontend-engineer) | 2026-11-11 21:32 |
| <a id="j3"></a>J3 | Job posts | Machine Learning Engineer, Document Understanding — Machine learning — Amsterdam — posted 2026-09-18 | [source](http://localhost:4173/careers#machine-learning-engineer-document-understanding) | 2026-11-11 21:32 |
| <a id="j4"></a>J4 | Job posts | Site Reliability Engineer — Infrastructure — Remote — posted 2026-09-30 | [source](http://localhost:4173/careers#site-reliability-engineer) | 2026-11-11 21:32 |
| <a id="j5"></a>J5 | Job posts | Enterprise Account Executive — Sales — London — posted 2026-10-28 | [source](http://localhost:4173/careers#enterprise-account-executive) | 2026-11-11 21:32 |
| <a id="j6"></a>J6 | Job posts | Solutions Consultant — Sales — London — posted 2026-10-14 | [source](http://localhost:4173/careers#solutions-consultant) | 2026-11-11 21:32 |
| <a id="j7"></a>J7 | Job posts | Security and Compliance Lead — Security — Amsterdam — posted 2026-08-27 | [source](http://localhost:4173/careers#security-and-compliance-lead) | 2026-11-11 21:32 |
| <a id="j8"></a>J8 | Job posts | Product Designer — Design — Remote — posted 2026-09-09 | [source](http://localhost:4173/careers#product-designer) | 2026-11-11 21:32 |
| <a id="j9"></a>J9 | Job posts | 8 open roles listed. By team: Engineering 2, Sales 2, Machine learning 1, Infrastructure 1, Security 1, Design 1. | [source](http://localhost:4173/careers) | 2026-11-11 21:32 |
| <a id="j10"></a>J10 | Job posts | Technologies named in job text: Kubernetes ×2, AWS ×2, TypeScript ×1, Python ×1, Go ×1, React ×1, Next.js ×1, PostgreSQL ×1, Kafka ×1, Terraform ×1, PyTorch ×1, SOC 2 ×1, ISO 27001 ×1, SSO ×1 | [source](http://localhost:4173/careers) | 2026-11-11 21:32 |
| <a id="c1"></a>C1 | Changelog | 2026-10-28: SCIM provisioning for Enterprise | [source](http://localhost:4173/changelog#scim) | 2026-11-11 21:32 |
| <a id="c2"></a>C2 | Changelog | 2026-10-07: Audit log export | [source](http://localhost:4173/changelog#audit-log) | 2026-11-11 21:32 |
| <a id="c3"></a>C3 | Changelog | 2026-09-16: SAML single sign-on on Team and Enterprise | [source](http://localhost:4173/changelog#sso) | 2026-11-11 21:32 |
| <a id="c4"></a>C4 | Changelog | 2026-08-26: AI auto-categorisation of expenses | [source](http://localhost:4173/changelog#ai-sorting) | 2026-11-11 21:32 |
| <a id="c5"></a>C5 | Changelog | 2026-08-05: Public API v2 and webhooks | [source](http://localhost:4173/changelog#api-v2) | 2026-11-11 21:32 |
| <a id="c6"></a>C6 | Changelog | 2026-07-15: iOS app 3.2 with offline invoices | [source](http://localhost:4173/changelog#ios-3-2) | 2026-11-11 21:32 |
| <a id="c7"></a>C7 | Changelog | 10 entries between 2026-04-22 and 2026-10-28; median gap 21 days. | [source](http://localhost:4173/feed.xml) | 2026-11-11 21:32 |
| <a id="c8"></a>C8 | Changelog | Themes across 10 entry titles: Enterprise &amp; security ×4, Reporting ×2, API &amp; integrations ×2, Billing &amp; payments ×2, AI ×1, Mobile ×1, Performance ×1 | [source](http://localhost:4173/feed.xml) | 2026-11-11 21:32 |
| <a id="d1"></a>D1 | DNS records | MX: 1 aspmx.l.google.com.; 5 alt1.aspmx.l.google.com. | `dns:localhost?type=MX` | 2026-11-11 21:32 |
| <a id="d2"></a>D2 | DNS records | SPF: v=spf1 include:_spf.google.com include:sendgrid.net include:mail.zendesk.com ~all | `dns:localhost?type=TXT` | 2026-11-11 21:32 |
| <a id="d3"></a>D3 | DNS records | TXT: stripe-verification=… | `dns:localhost?type=TXT` | 2026-11-11 21:32 |
| <a id="d4"></a>D4 | DNS records | TXT: atlassian-domain-verification=… | `dns:localhost?type=TXT` | 2026-11-11 21:32 |
| <a id="d5"></a>D5 | DNS records | TXT: google-site-verification=… | `dns:localhost?type=TXT` | 2026-11-11 21:32 |
| <a id="d6"></a>D6 | DNS records | NS: ada.ns.cloudflare.com., bob.ns.cloudflare.com. | `dns:localhost?type=NS` | 2026-11-11 21:32 |
| <a id="d7"></a>D7 | DNS records | CAA: 0 issue "letsencrypt.org" | `dns:localhost?type=CAA` | 2026-11-11 21:32 |
| <a id="d8"></a>D8 | DNS records | DMARC: v=DMARC1; p=quarantine; rua=mailto:[email redacted] | `dns:_dmarc.localhost?type=TXT` | 2026-11-11 21:32 |
| <a id="r1"></a>R1 | App reviews | 12 most recent reviews: average 3.2/5, 42% rated 1-2 stars. By version: v3.1: 4.6 (5), v3.2: 2.1 (7). | [source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json) | 2026-11-11 21:32 |
| <a id="r2"></a>R2 | App reviews | Themes in reviews rated 3 stars or lower: sync ×3, speed ×3, crashes ×1, missing features ×1, price ×1, support ×1 | [source](http://localhost:4173/__appstore/us/rss/customerreviews/id=1234567890/sortBy=mostRecent/json) | 2026-11-11 21:32 |
| <a id="r3"></a>R3 | App reviews | 1★ (v3.2) "Crashes on open": The app crashes every time I open a draft. Had to go back to the website. | [source](http://localhost:4173/__appstore/us/app/id1234567890) | 2026-11-11 21:32 |
| <a id="r4"></a>R4 | App reviews | 1★ (v3.2) "Price went up and it got worse": Paying more for Solo and the app is slow and keeps logging me out. Support gave no response. | [source](http://localhost:4173/__appstore/us/app/id1234567890) | 2026-11-11 21:32 |
| <a id="r5"></a>R5 | App reviews | 5★ (v3.1) "Great app": Sending an invoice from my phone takes ten seconds. | [source](http://localhost:4173/__appstore/us/app/id1234567890) | 2026-11-11 21:32 |

## Collection log

19 requests attempted, 18 fetched. User agent `outside-in/0.1 (public-signals research tool)`, at least 250 ms between requests to the same host.

Not fetched:

- `http://localhost:4173/releases`: skipped-robots (disallowed by robots.txt)

