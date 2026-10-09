# ADR-003: dkbIndexedDB loads the web-optimized DKB file only

**Status:** Accepted  
**Date:** 2026-09-24  
**Context:** Housekeeping sprint — lint tooling wiring surfaced this while auditing `src/`.

---

## Context

`public/data/diamond_knowledge_full.json` is a ~136 MB dataset (130,508 entries) tracked in Git LFS. `.gitattributes` has no `filter=lfs` rule for it, so the repository holds the raw ~134-byte LFS pointer text as the file's actual git-tracked content, not the resolved binary. On Render, that pointer text is what gets served — with a 200 status, since it's a perfectly valid (if tiny) static file from the server's point of view.

`src/utils/dkbIndexedDB.js` used to try `FULL_DKB_URL` (`/data/diamond_knowledge_full.json`) first on every desktop page load and on every manual "download" tap on mobile, catching the inevitable JSON-parse failure (the pointer text isn't valid entry data) and falling back to `WEB_DKB_URL` (`/data/diamond_knowledge.json`, ~8 MB, 7,988 entries). That fallback worked, but every visit paid for a doomed fetch-and-fail-to-parse round trip first, and the code carried permanent try/catch plumbing for a request that could never succeed in production. If LFS were ever configured correctly, the same code path would instead genuinely ship 136 MB to every browser — unacceptable for a client-side fetch that every desktop visit triggers automatically.

## Decision

`dkbIndexedDB.js` now fetches `WEB_DKB_URL` directly. `FULL_DKB_URL` and the full→web fallback (`_fetchDKBEntries`) are removed. `downloadFullDKB()` / `smartLoadDKB()` keep their names for API stability (`KnowledgeBaseStatus.jsx` and existing tests import them), but they only ever produce the web-optimized dataset now.

`isFullDKBCached()`'s threshold moved from `FULL_DATABASE_COUNT * 0.9` (117,457 — now permanently unreachable, since nothing fetches that many entries anymore) to `WEB_DATABASE_COUNT * 0.9` (~7,189). Without that change, the cache-hit fast path in `smartLoadDKB()` would never fire again and every page load would silently re-download and re-parse the same ~8 MB file. The lowered threshold still correctly recognizes a genuine full cache a pre-fix build may have left in a returning user's IndexedDB (its `entryCount` trivially clears the new, lower bar too).

`diamond_knowledge_full.json` itself is **not deleted** from the repo — only the runtime reference is removed. `KnowledgeBaseStatus.jsx`'s `isWebOptimized` computations (three call sites) were updated from a hardcoded `false` to `entryCount < FULL_DATABASE_COUNT`, for the same reason as the cache threshold: after this fix, a fresh download can never be the "full" 130,508-entry set, so hardcoding `false` there would have started incorrectly claiming users have the full database when they only have the web-optimized one. The comparison-based version still correctly reports `false` for the pre-fix-legacy-full-cache edge case.

## Consequences

- Every desktop/mobile DKB load or download now does exactly one fetch, against the same file, every time. No more silent fetch-and-fail-to-parse against the LFS pointer.
- `FULL_DATABASE_COUNT` (130,508) stays exported from `dkbIndexedDB.js` — it's still meaningful as "size of the complete external corpus" for UI display (`KnowledgeBaseStatus.jsx`'s "X of Y entries" messaging) and for recognizing a legacy full cache. It no longer drives any fetch behavior.
- `KnowledgeBaseStatus.jsx`'s copy (e.g. "the larger database downloads to your device for future use") is not rewritten by this change — that's product-copy territory, not a mechanical fix, and is flagged separately rather than changed unilaterally. The messaging is only slightly stale now (no larger database is ever downloaded going forward); it isn't functionally wrong, since the boolean state driving which copy renders was corrected.
- `src/data/states/*.json` and `src/data/stateAwards/*.json` — audited separately while wiring cspell — have their own, unrelated data-quality issue (truncated `id` slugs in ~12+ entries) that surfaced during that same sprint; noted for a follow-up, not touched here.
- If the full dataset should ever become genuinely servable (e.g. real LFS resolution on Render, or a CDN-hosted copy), revisit this ADR — the removed fallback plumbing is a reasonable starting point but was written for a permanent-failure case, not a real two-tier load strategy.
