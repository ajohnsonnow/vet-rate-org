# Legal-Knowledge RAG Pipeline — Design

> Status: **shipped** (S18–S25). Fleshed out during Sprint 6, deployed across Sprints 18–25 with structure-aware chunking, hybrid BM25+dense retrieval, and production evaluation gates. See [docs/SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md) for sprint-by-sprint detail and [docs/RAG_EVAL.md](./RAG_EVAL.md) for current baseline metrics.

---

## 1. Purpose

Replace the manually-curated legal JSON in [src/data/](../src/data/) ([disabilityData.json](../src/data/disabilityData.json), [cfr3Regulations.json](../src/data/cfr3Regulations.json), [secondary_conditions_db.json](../src/data/secondary_conditions_db.json)) with a self-refreshing index over the authoritative sources. Goal: every legal answer in the app carries a citation + a fetched-on date, and the index updates weekly with no human review loop.

---

## 2. Sources of truth

| Source                               | Status                                                         | What we ingest                          | Update cadence | Fetcher                                    |
| ------------------------------------ | -------------------------------------------------------------- | --------------------------------------- | -------------- | ------------------------------------------ |
| eCFR (Title 38, Parts 3, 4, 19, 20)  | **Live, verified** — 1,060 chunks, 2.6 MB                       | Adjudication, rating schedules, appeals | Weekly         | `scripts/legal-ingestion/fetch-ecfr.mjs`   |
| VA M21-1 manual                      | **Live** — shard populated (S44), 4,720 chunks, `content-verified` status | Adjudication procedure                  | Monthly        | `scripts/legal-ingestion/fetch-m21-1.mjs`  |
| VA M21-4 manual                      | **Live** — shard populated (S44), 341 chunks, `content-verified` status  | RO workload / national quality review   | Monthly        | `scripts/legal-ingestion/fetch-m21-4.mjs`  |
| VA M21-5 manual                      | **Live** — shard populated (S44), 453 chunks, `content-verified` status  | Appeals and reviews                     | Monthly        | `scripts/legal-ingestion/fetch-m21-5.mjs`  |
| CAVC precedential decisions          | **Live** — shard populated (S44), 11,920 chunks, `content-verified` status | Veterans-court precedent                | Weekly         | `scripts/legal-ingestion/fetch-cavc.mjs`   |
| Federal Circuit veteran-law opinions | **Live** — shard populated (S44), 7,233 chunks, `content-verified` status | Higher-court precedent                  | Weekly         | `scripts/legal-ingestion/fetch-fedcir.mjs` |
| OGC precedent opinions               | **Live** — shard populated (S44), 893 chunks, `content-verified` status  | VA policy precedent (1987-2019)         | Quarterly      | `scripts/legal-ingestion/fetch-ogc.mjs`    |
| VA compensation + SMC rate tables    | **Live** — structured (not a shard), `content-verified` status (S44)    | Current-year comp + SMC rates           | Annual         | `scripts/legal-ingestion/fetch-rate-tables.mjs` |

See [knowledge-sources.yaml](../knowledge-sources.yaml) for detailed API endpoints, last-verified dates, and status of each source.

---

## 3. Schema (per ingested document)

```jsonc
{
  "source": "ecfr", // ecfr | m21-1 | cavc | fedcir
  "jurisdiction": "federal",
  "citation": "38 CFR § 4.71a", // canonical citation string
  "title": "Schedule of Ratings — Musculoskeletal System",
  "body": "…", // sanitized plain text; HTML/script stripped
  "fetched_at": "2026-05-14T04:00:00Z",
  "source_url": "https://www.ecfr.gov/current/title-38/...",
  "content_hash": "sha256:…", // for diff detection between runs
}
```

---

## 4. Chunking + embeddings

- **Chunking** (scripts/legal-ingestion/chunk.mjs): structure-aware, not naive fixed-size. CFR rating tables (HTML `<table>`) are preserved as atomic Markdown chunks, never split. Prose is packed on paragraph boundaries; only oversized paragraphs use a ~15%-overlap word-window fallback. All chunks preserve their parent citation in metadata.
- **Embedding model**: `bge-small-en-v1.5` (384-dim), via `@huggingface/transformers`. Vectors quantized to Int8 (384 bytes per vector) to keep the lazy-loaded bundle under the 25 MB target.
- **Contextual retrieval** (optional, OFF by default): when `CONTEXTUALIZE_CHUNKS=1`, chunks are re-embedded with their section-title prefix prepended (via `contextualize.mjs`). Evaluated in S20 with mixed results; currently disabled pending future investigation on other corpora. Enable via environment variable for testing.

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

## 6. Retrieval flow

```
user question
   └─► PII scrub (piiScrubber)
         └─► hybrid retrieval (src/services/legalRag.js):
               ├─ BM25 lexical search over all chunks
               └─ dense cosine search over public/legal-index/v*/vectors
                     └─► Reciprocal Rank Fusion (RRF) combines BM25 + dense top-K
                           └─► MMR diversity reranking (eliminate redundant chunks)
                                 └─► return { chunks, citations, fetched_at }
                                       └─► parent-child expansion (expandChunksWithSiblings):
                                             retrieved chunk + sibling chunks from same citation
                                                   └─► dual-LLM split:
                                                         retriever-pass (sees expanded chunks) → structured fields
                                                         synthesizer-pass (sees only structured fields) → answer
                                                               └─► UI: LegalCitation.jsx + AskTheRegsModal.jsx render citation + fetched_at + source_url
```

**Hard constraint:** the synthesizer **never** sees raw retrieved text directly — only structured fields produced by the retriever. This implements the dual-LLM defense from Sprint 3.

**Parent-child expansion** (additive to dual-LLM security): when a chunk is retrieved, `legalAnswerer.js` automatically includes all sibling chunks from the same legal citation before the retriever LLM sees them. This ensures the retriever has full section context without requiring the user's query to explicitly name it.

---

## 7. Lethal-trifecta posture

The pipeline combines:

1. **Private data** — user's PII embedded in their claim questions.
2. **Untrusted content** — fetched legal text could in principle be poisoned at fetch time (eCFR is official, but defense in depth).
3. **External rendering** — model output reaches the DOM and is read by the veteran.

Mitigations (implemented in Sprint 3 and applied here in Sprint 7):

- PII scrubbed _before_ embedding and retrieval — PII must not influence which chunks are retrieved.
- All fetched HTML/markdown stripped of `<script>` / `<style>` / `<iframe>` and inline event handlers during ingestion.
- URLs in body replaced with text-only citations at chunking time; URL allow-list applied at render time.
- Spotlight delimiters wrap any chunk text the retriever LLM sees.
- Dual-LLM split between retriever and synthesizer.
- Append-only audit log (IndexedDB) for every query, retrieved chunk set, and produced answer — replay-able for incident analysis.

---

## 8. User document semantic layer (parallel system)

The legal-index RAG pipeline described here covers **authoritative sources only** (eCFR, court precedent, VA manuals). A separate, parallel system in [src/utils/userDocSemanticIndex.js](../src/utils/userDocSemanticIndex.js) provides semantic search over veterans' own uploaded C-Files and supporting documents (using the same embedding model, same dual-LLM architecture). The two systems do not share state; users can search legal precedent and their own documents independently via separate UI surfaces. See the userDocSemanticIndex module's documentation for details on the C-File indexing flow.

---

## 9. Refresh automation

- **Workflow:** `.github/workflows/legal-ingestion.yml`
- **Schedule:** weekly cron `0 4 * * 1` UTC.
- **Behavior:** runs `run-all.mjs` → diffs against current `public/legal-index/v*/` → opens PR titled `chore(legal): refresh index → v{x.y.z}` if any change.
- **Failure mode:** any fetcher failure files an issue labeled `legal-ingestion-stale`.
- **PR body:** number of changed CFR sections, new CAVC opinions, top-line summary, link to full diff artifact.

---

## 10. Migration plan for existing static data

Sprint 7 cross-validates [disabilityData.json](../src/data/disabilityData.json), [cfr3Regulations.json](../src/data/cfr3Regulations.json), [secondary_conditions_db.json](../src/data/secondary_conditions_db.json) against the live index. Discrepancies become issues; the static files remain as a UI-friendly index of conditions, but legal _content_ is sourced from the RAG layer with `fetched_at` dates surfaced to the user.

---

## 11. Future improvements (beyond S25)

- **Conditional-GET support:** Fetchers currently diff all records post-hoc; sending ETag/If-Modified-Since headers would skip unchanged resources. Requires persistent state across weekly runs.
- **M21-1/M21-4/M21-5 + CAVC + Federal Circuit + OGC:** Real fetchers shipped in S31/S33/S34/S44 (KnowVA REST API, CAVC Atom-RSS, Federal Circuit WordPress REST, OGC HTML crawl). All sources now have populated, registered shards under `public/dkb-index/` (`registry.json` `shard_count: 8`); promotion from `content-verified` to `verified` status is pending two observed green weekly freshness-cron runs each. CAVC's Single-Judge historical backfill resumed in S44 after a 60s-timeout fix; confirm the registry's chunk count reflects the completed backfill before citing a higher figure. See [docs/DIAMOND_KNOWLEDGE_BASE.md](./DIAMOND_KNOWLEDGE_BASE.md) for current shard population status.
- **Semantic disambiguation:** Contextual retrieval (section-title prefixes) showed mixed results in S20; further exploration across different corpora is deferred.
- **Audit log export:** Currently append-only IndexedDB; a veteran transparency feature to export their query history + retrieved chunks is not yet implemented.
- **Performance on low-end mobile:** Vector search performance on resource-constrained devices was not yet profiled in S18-S25; prioritized higher-value improvements first.
