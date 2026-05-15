# dompurify-noop — intentional no-op DOMPurify replacement

## TL;DR

This stub replaces `dompurify` at build time via a Vite resolve.alias. It exists
because **this project does not need DOMPurify** and pinning to a vulnerable
version would expand the supply-chain attack surface for no benefit.

It is **intentional**, **documented**, and **not a TODO**.

## Why we don't use DOMPurify

1. **No direct callers.** The app does not import `dompurify` anywhere. Only
   `jspdf` lists it as an optional peer dependency, and we don't use the jspdf
   feature path that needs it.

2. **All DOMPurify 3.x versions have published XSS advisories.** Re-introducing
   the package would mean tracking a moving CVE target on a dependency we never
   intended to ship.

3. **We sanitize at the source instead.** Every `dangerouslySetInnerHTML` site
   in the codebase either renders developer-controlled static content (badge
   SVGs from [src/data/badgeData.js](../../src/data/badgeData.js), i18n
   strings, the user-manual markdown) or wraps its inputs in our own
   [sanitize.js](../../src/utils/sanitize.js) helpers (`escapeHtml`,
   `sanitizeUrl`, `safeHtml`). Each site carries a `// nosemgrep:` justification
   comment naming the defense.

4. **CSP enforces the perimeter.** [index.html](../../index.html) ships a strict
   Content-Security-Policy that constrains script/connect/style origins, so even
   if an HTML injection slipped through it could not reach an attacker-controlled
   endpoint.

5. **The trifecta defense lives one layer up.** Untrusted content (OCR text,
   retrieved DKB chunks, user paste) is wrapped in `<untrusted_content>` spotlight
   delimiters by [piiScrubber.js](../../src/utils/piiScrubber.js) before it ever
   reaches an LLM prompt — DOMPurify would not address that risk.

## Defensive helpers we use instead

| Concern | Helper | Location |
|---|---|---|
| Generic XSS escaping | `escapeHtml` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Markdown-lite → safe HTML with allow-listed tags | `safeHtml` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Link href validation | `sanitizeUrl` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Phone href validation | `sanitizePhoneHref` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Blob URL reconstruction (taint break) | `reconstructBlobUrl` / `triggerBlobDownload` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Error message DOM safety | `sanitizeErrorMessage` | [src/utils/sanitize.js](../../src/utils/sanitize.js) |
| Prompt-injection delimiters | `spotlight` / `untrustedSection` | [src/utils/aiSystemPrompts.js](../../src/utils/aiSystemPrompts.js) |

## How the alias is wired

In [vite.config.js](../../vite.config.js):

```js
resolve: {
  alias: {
    dompurify: fileURLToPath(new URL('./packages/dompurify-noop/index.js', import.meta.url))
  }
}
```

When `marked` or `jspdf` does `require('dompurify')` at bundle time, Vite swaps
in [index.js](./index.js) — a stub that returns inputs unchanged. The stub also
exports the API surface DOMPurify consumers expect (`sanitize`, `addHook`,
`isSupported`, `version`) so downstream code can interact with it without
throwing.

## When to revisit this decision

Reconsider DOMPurify if **any** of the following becomes true:

1. The codebase grows a legitimate need to sanitize **untrusted, contributor-
   uncontrolled HTML** (e.g., rendering a third-party API's HTML payload).
2. Every active 3.x version of DOMPurify is free of open advisories for at
   least 90 days.
3. A direct caller adds `dompurify` to its requires (currently only `marked`
   does, via dynamic import).

If revisiting: install the package, remove the alias, audit every site listed
in the helpers table above to ensure callers route through DOMPurify, and add
a regression test that confirms `<script>` blocks are stripped.

---

*Updated: 2026-05-14 · Sprint 3 commit (forthcoming) — [docs/SPRINT_PLAN.md §
Sprint 3](../../docs/SPRINT_PLAN.md).*
