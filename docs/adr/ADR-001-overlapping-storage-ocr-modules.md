# ADR-001: Coexistence of overlapping storage and OCR modules

**Status:** Accepted  
**Date:** 2026-06-20  
**Context:** RT-12 architecture audit (ARCH-05)

---

## Context

Two distinct storage modules and two distinct OCR modules have grown up in parallel and share surface area:

### Storage

| Module                           | Purpose                                                                                                      | Key exports                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `src/utils/dataPersistence.js`   | Bunker Backup — JSON snapshot download, hash-based unsaved-changes detection for the manual export flow      | `saveToLocalFile`, `setupBeforeUnloadWarning`, `hasUnsavedChanges`    |
| `src/utils/persistentStorage.js` | The Bunker (OPFS → IDB → FS Access API) — auto-save, milestone saves, file-handle lifecycle, mobile fallback | `initPersistentStorage`, `initUnsavedChangesWarning`, `getSaveStatus` |

Both register a `beforeunload` handler (consolidated in `useBootSequence.js` by RT12-1). Both track "unsaved changes" but against different backing stores and with different semantics.

### OCR

| Module                          | Purpose                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/utils/advancedOCR.js`      | Multi-page Tesseract OCR pipeline — page-by-page rasterization, confidence scoring, large-file OOM guard            |
| `src/utils/documentAnalyzer.js` | LLM-based document analysis — calls `advancedOCR` as a sub-step, orchestrates vision models and text-layer fallback |

`documentAnalyzer` is a consumer of `advancedOCR`, not a replacement; but it also does partial OCR setup internally (pdf.js page rendering) for its vision path, creating semantic overlap.

## Decision

**Do not merge.** Preserve the current two-module split for both storage and OCR.

Rationale:

1. **Different lifecycle owners.** `dataPersistence` is tied to the Bunker Backup export UX; `persistentStorage` is tied to the invisible auto-save system. Merging would couple two user-visible features with opposite failure modes (export errors vs. silent auto-save failures).

2. **Different concurrency models.** OCR via `advancedOCR` is page-serial (Tesseract runs one page at a time with a web worker); `documentAnalyzer`'s vision path uses a different WASM model and can run concurrently. Unifying them would require resolving model-instance contention.

3. **Regression risk outweighs benefit.** Both pairs are exercised by Playwright E2E tests. A merge refactor would require moving or duplicating those tests with no functional benefit to the user.

## Consequences

- Future contributors should treat `dataPersistence` + `persistentStorage` as a two-layer storage system: export layer on top, persistence layer below.
- `documentAnalyzer` is the **entry point** for document analysis; call it, not `advancedOCR`, directly from feature code.
- The dual `beforeunload` registration is intentional and is now explicit in `useBootSequence.js`.
- Revisit this decision if: (a) a third storage module is introduced, or (b) the OCR modules are refactored into a web worker.
