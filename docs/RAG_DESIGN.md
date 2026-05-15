# Legal-Knowledge RAG Pipeline — Design

> Status: **stub**. Fleshed out during Sprint 6 ([SPRINT_PLAN.md §5](./SPRINT_PLAN.md#sprint-6--rag-pipeline-foundation-legal-source-ingestion--2-weeks)). Wired into the app during Sprint 7.

---

## 1. Purpose

Replace the manually-curated legal JSON in [src/data/](../src/data/) ([disabilityData.json](../src/data/disabilityData.json), [cfr3Regulations.json](../src/data/cfr3Regulations.json), [secondary_conditions_db.json](../src/data/secondary_conditions_db.json)) with a self-refreshing index over the authoritative sources. Goal: every legal answer in the app carries a citation + a fetched-on date, and the index updates weekly with no human review loop.

---

## 2. Sources of truth

| Source | What we ingest | Update cadence | Fetcher |
|---|---|---|---|
| eCFR (Title 38, Parts 3, 4, 19, 20) | Adjudication, rating schedules, appeals | Weekly | `scripts/legal-ingestion/fetch-ecfr.mjs` |
| VA M21-1 manual | Adjudication procedure | Weekly | `scripts/legal-ingestion/fetch-m21-1.mjs` |
| CAVC precedential decisions (rolling 5 years) | Veterans-court precedent | Weekly | `scripts/legal-ingestion/fetch-cavc.mjs` |
| Federal Circuit veteran-law opinions | Higher-court precedent | Weekly | `scripts/legal-ingestion/fetch-fedcir.mjs` |

> _To be confirmed in Sprint 6: exact API endpoints, rate limits, ToS, robots.txt._

---

## 3. Schema (per ingested document)

```jsonc
{
  "source": "ecfr",             // ecfr | m21-1 | cavc | fedcir
  "jurisdiction": "federal",
  "citation": "38 CFR § 4.71a", // canonical citation string
  "title": "Schedule of Ratings — Musculoskeletal System",
  "body": "…",                  // sanitized plain text; HTML/script stripped
  "fetched_at": "2026-05-14T04:00:00Z",
  "source_url": "https://www.ecfr.gov/current/title-38/...",
  "content_hash": "sha256:…"    // for diff detection between runs
}
```

---

## 4. Chunking + embeddings

- Chunk size: ≤512 tokens, 50-token overlap.
- Embedding model: small, browser-loadable (candidates: `bge-small-en-v1.5`, `all-MiniLM-L6-v2`). Final pick in Sprint 6 spike.
- Vectors quantized to Q8 to keep bundle size under target.
- Every chunk preserves its parent citation in metadata.

---

## 5. Output artifact

```
public/legal-index/
└── v0.1.0/
    ├── manifest.json     # version, fetched_at, source_versions, total_chunks
    ├── chunks/           # sharded JSONL: { id, citation, source_url, text, fetched_at }
    └── vectors/          # sharded binary vectors (Q8)
```

- Total bundle target: **≤25 MB** lazy-loaded.
- Versioning: monotonically increasing semver.

---

## 6. Retrieval flow (Sprint 7)

```
user question
   └─► PII scrub (piiScrubber)
         └─► embed query
               └─► top-K cosine search over public/legal-index/v*/vectors
                     └─► return { chunks, citations, fetched_at }
                           └─► dual-LLM split:
                                 retriever-pass (sees chunks) → structured fields
                                 synthesizer-pass (sees only structured fields) → answer
                                       └─► UI: LegalCitation.jsx renders citation + fetched_at + source_url
```

Hard constraint: the synthesizer **never** sees raw retrieved text directly — only structured fields produced by the retriever. This implements the dual-LLM defense from Sprint 3.

---

## 7. Lethal-trifecta posture

The pipeline combines:
1. **Private data** — user's PII embedded in their claim questions.
2. **Untrusted content** — fetched legal text could in principle be poisoned at fetch time (eCFR is official, but defense in depth).
3. **External rendering** — model output reaches the DOM and is read by the veteran.

Mitigations (implemented in Sprint 3 and applied here in Sprint 7):
- PII scrubbed *before* embedding and retrieval — PII must not influence which chunks are retrieved.
- All fetched HTML/markdown stripped of `<script>` / `<style>` / `<iframe>` and inline event handlers during ingestion.
- URLs in body replaced with text-only citations at chunking time; URL allow-list applied at render time.
- Spotlight delimiters wrap any chunk text the retriever LLM sees.
- Dual-LLM split between retriever and synthesizer.
- Append-only audit log (IndexedDB) for every query, retrieved chunk set, and produced answer — replay-able for incident analysis.

---

## 8. Refresh automation (Sprint 7)

- **Workflow:** `.github/workflows/legal-ingestion.yml`
- **Schedule:** weekly cron `0 4 * * 1` UTC.
- **Behavior:** runs `run-all.mjs` → diffs against current `public/legal-index/v*/` → opens PR titled `chore(legal): refresh index → v{x.y.z}` if any change.
- **Failure mode:** any fetcher failure files an issue labeled `legal-ingestion-stale`.
- **PR body:** number of changed CFR sections, new CAVC opinions, top-line summary, link to full diff artifact.

---

## 9. Migration plan for existing static data

Sprint 7 cross-validates [disabilityData.json](../src/data/disabilityData.json), [cfr3Regulations.json](../src/data/cfr3Regulations.json), [secondary_conditions_db.json](../src/data/secondary_conditions_db.json) against the live index. Discrepancies become issues; the static files remain as a UI-friendly index of conditions, but legal *content* is sourced from the RAG layer with `fetched_at` dates surfaced to the user.

---

## 10. Open questions (to resolve in Sprint 6 spike)

- [ ] Final embedding-model pick: latency × accuracy × bundle-size tradeoff.
- [ ] CAVC opinion scraping legality + cadence: scrape or partner with a feed?
- [ ] M21-1 access surface: public download bundle vs portal scraping.
- [ ] Index sharding strategy for the 25 MB bundle target.
- [ ] How the in-browser vector search performs on low-end mobile (perf budget from Sprint 5).
- [ ] Should the audit log be exportable by the veteran (transparency feature)?

---

*Sprint 6 fills the remaining sections. Sprint 7 implements §6 and §8.*
