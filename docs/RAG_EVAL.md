# Legal-RAG retrieval eval

Closes [AUDIT_FINDINGS](AUDIT_FINDINGS.md) **#14** (vector-RAG eval). S6
shipped ingestion; S7 shipped the runtime retriever
[`src/services/legalRag.js`](../src/services/legalRag.js); this harness
closes the loop with **recall@k / MRR / NDCG@k** over a hand-curated golden
set so regressions in the index or embedder are visible.

## Run

```sh
npm run eval:rag                # human-readable to stdout
npm run eval:rag:json > r.json  # machine-readable, full per-query payload
node scripts/legal-ingestion/eval/run-eval.mjs --k 10 --version v0.1.0
```

First run downloads `Xenova/bge-small-en-v1.5` (~30 MB) into the
`@huggingface/transformers` cache — same model the app uses, so numbers
faithfully reflect what users see.

## Inputs

- **Index:** `public/legal-index/{version}/{manifest.json, chunks/*.jsonl, vectors/*.bin}`.
  The harness reads these from disk via `fs` — same shape `legalRag.js`
  fetches over HTTP at runtime, so no network round-trip and no JSDOM.
- **Golden set:** [scripts/legal-ingestion/eval/golden-set.jsonl](../scripts/legal-ingestion/eval/golden-set.jsonl).
  25 queries × expected citations. Hand-curated from common veteran
  questions (TDIU, combined ratings, tinnitus, mental disorders, etc.).
  One JSON record per line: `{ id, query, expected_citations[], notes }`.

## Metrics

| Metric | What it answers | Math |
|---|---|---|
| **recall@k** | Did we surface *any* expected citation in the top-k? | `1` if any of top-k chunks has `citation ∈ expected` else `0`, averaged over queries |
| **MRR** | How far down the list is the first hit, on average? | `mean(1 / rank_of_first_relevant)`; `0` if never found |
| **NDCG@k** | Are the hits ranked near the top vs scattered? | binary-relevance DCG@k / IDCG@k where IDCG accounts for *all* relevant chunks in the corpus (not just expected-citation count) |

The `cosineQ8` math (Float32 query × Int8 stored, divide-by-127) is copied
from `legalRag.js` verbatim — if the runtime drifts from the harness,
fix one to match.

## Current baseline (v0.1.0, k=5, n=25)

| Metric | Value |
|---|---|
| recall@5 | **0.88** (22/25) |
| MRR | **0.78** |
| NDCG@5 | **0.64** |

Known misses (regressions to guard against, not features):

- **`How does VA combine multiple disability ratings?`** → expected `§ 4.25`
  (combined ratings table). The § 4.25 chunks score below § 4.16/§ 4.26.
- **`Can VA rate the same disability twice under different diagnostic codes?`**
  → expected `§ 4.14` (pyramiding). Query phrasing doesn't lexically
  overlap with the § 4.14 text; reformulation (e.g., "pyramiding") works.
- **`Are dental and oral conditions service-connectable for compensation?`**
  → expected `§ 4.149 / § 4.150`. Dental chunks rank low against
  "service-connectable" phrasing.

These are documented in the golden set, not flagged as harness bugs.
They give a concrete target for any future indexing work (richer
chunking, query expansion, hybrid BM25, etc.).

## When to re-run

- After any change to `scripts/legal-ingestion/{chunk,embed}.mjs`
- After any change to `src/services/legalRag.js` scoring logic
- After bumping the index version under `public/legal-index/`
- After upgrading `@huggingface/transformers` (embedder behavior can shift)

If numbers move materially, update the baseline table above with the new
run and a one-line note on the cause.

## Out of scope (non-goals)

- **Not** a generation eval — see `aiSystemPrompts` security tests for
  prompt-injection / dual-LLM coverage.
- **Not** a freshness eval — chunk recency is checked by the ingestion
  scripts (`diff.mjs`), not here.
- **No CI gate yet.** The harness needs the embedder to be cached; CI
  caching is a follow-up. For now, run locally before merging changes
  that touch retrieval.
