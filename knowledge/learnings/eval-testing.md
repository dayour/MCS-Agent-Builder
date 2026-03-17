# Evaluation & Testing Learnings

Lessons learned about eval methods, thresholds, test design, Direct Line API usage. Consulted during `/mcs-research` Phase C, `/mcs-eval` Step 2, and `/mcs-fix` Step 2.

<!--
Entry format:
### [Title] {#id} — [Date]
**Context:** [Customer/project, what was being built]
**Tried:** [Initial approach]
**Result:** [What happened]
**Better approach:** [What worked or was recommended]
**Confirmed:** [N] build(s) | Last confirmed: [YYYY-MM-DD]
**Related cache:** [cache file(s) if applicable]
**Tags:** #tag1 #tag2

ID format: et-NNN (eval-testing)
-->

### Direct Line does NOT support Integrated auth — use Playwright Test Chat {#et-001} — 2026-02-21
**Context:** Daily Briefing agent (MCP tools needing user auth) + CDW Legal HR Policy Advisor (Integrated auth for SharePoint knowledge)
**Tried:** Direct Line API eval (Tier 1) via `tools/direct-line-test.js` with Token Endpoint auto-token
**Result:** Every test fails with `IntegratedAuthenticationNotSupportedInChannel`. Direct Line cannot pass user auth context. Applies to ALL agents with `authenticationMode: Integrated` — not just MCP tools. Also affects agents whose SharePoint knowledge sources require user identity for search. Disabling auth (authenticationmode: 0) makes Direct Line work but knowledge search returns empty/irrelevant results because the user context is missing.
**Better approach:** Use Playwright Test Chat (Tier 2) for ALL agents with Integrated auth. Test Chat runs in the authenticated MCS UI context. Direct Line only works for agents with `authenticationMode: None` that don't need user identity for knowledge retrieval.
**Confirmed:** 2 build(s) | Last confirmed: 2026-02-26
**Related cache:** security-auth.md, eval-methods.md, channels.md
**Tags:** #direct-line #sso #mcp #authentication #playwright #eval

### Preview eval stubs give customers early acceptance criteria {#et-003} — 2026-03-17
**Context:** Eval-driven build — generating eval stubs during fast preview so customers see acceptance criteria before deep research
**Tried:** Previously generated evals only after deep research (Phase C) — customer never saw or reviewed them before build
**Result:** Testing was manual chat back-and-forth. No customer-confirmed acceptance criteria until after build.
**Better approach:** Generate ~15-25 eval stubs deterministically during fast preview from capabilities + boundaries data. Show in dashboard for customer review/editing. Customer-edited stubs are immutable during deep research (`source: "user-edited"`). Preview stubs can be enriched with research detail (`source: "research-enriched"`). This gives ~60-70% of final test suite before deep research even starts.
**Confirmed:** 0 build(s) | Last confirmed: 2026-03-17
**Related cache:** eval-methods.md
**Tags:** #eval-stubs #preview #golden-sets #customer-review #eval-driven-build

### Direct Line httpRequest needs Content-Length header {#et-002} — 2026-02-21
**Context:** Daily Briefing agent — direct-line-test.js runner sending messages
**Tried:** Node.js http.request with req.write(body) — uses chunked transfer encoding by default
**Result:** Direct Line API returns 400 `MissingProperty: Invalid or missing activities in HTTP body`. Curl with same payload works fine.
**Better approach:** Set explicit `Content-Length: Buffer.byteLength(bodyStr)` header in the httpRequest function. Fix applied to `tools/direct-line-test.js`.
**Confirmed:** 1 build(s) | Last confirmed: 2026-02-21
**Related cache:** eval-methods.md
**Tags:** #direct-line #content-length #node-js #http #bug-fix
