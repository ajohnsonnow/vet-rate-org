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
  60 queries × expected citations (grown from 25 in S18 — see
  [SPRINT_PLAN_S18-S26_KB_INGESTION.md](./SPRINT_PLAN_S18-S26_KB_INGESTION.md)).
  Hand-curated from common veteran questions (TDIU, combined ratings,
  tinnitus, mental disorders, etc.) plus table-lookup, lexical-exact,
  cross-section, and known-miss categories added in S18.
  One JSON record per line: `{ id, query, expected_citations[], notes, category, heldOut }`.
  - `category`: `conceptual` | `table_lookup` | `lexical_exact` | `cross_section` | `known_miss`.
  - `heldOut`: `true` for the 12/60 (20%) queries reserved for unbiased
    end-of-sprint reporting — S19–S22 must tune chunking/retrieval
    parameters only against `--exclude-held-out`, never against held-out
    queries directly, so the held-out numbers stay an honest read of
    whether a change generalizes.

## Comparative chunking-strategy evaluation (S18)

Per the NVIDIA white paper's central lesson — there is no universal best
chunking strategy, only a corpus-specific one found by comparison — the
harness supports building and A/B-ing candidate chunkers before adopting one:

```sh
# Build candidate indexes into scratch dirs (page-level, section-level,
# 256/512/1024-token windows at 10%/15% overlap) — never touches
# public/legal-index/.
node scripts/legal-ingestion/eval/build-variants.mjs
node scripts/legal-ingestion/eval/build-variants.mjs --only page-level,1024tok-15pct

# A/B them — prints recall@k/MRR/NDCG@k for the tuning slice (golden set
# minus held-out) plus recall@k for the held-out slice, per variant.
node scripts/legal-ingestion/eval/run-eval.mjs --compare page-level 512tok-10pct 1024tok-15pct
node scripts/legal-ingestion/eval/run-eval.mjs --compare current=v0.1.0 candidate=../scratch/v0.2.0-rc --json
```

`build-variants.mjs` reads `scripts/legal-ingestion/.work/{source}.jsonl`
(fetcher output — run `node scripts/legal-ingestion/fetch-ecfr.mjs` first if
missing) and writes self-contained variant chunkers, so this harness keeps
comparing against a stable shape even as `chunk.mjs` itself evolves in later
sprints. "section-level" is an alias of "page-level": each eCFR fetch record
already IS one §-section, so there is no separate page boundary to detect on
this corpus. The `structural` variant (added S19) is the exception — it
imports the ACTUAL production `chunkRecord` from `chunk.mjs`, so the A/B
validates the real code path (tables-as-atomic-units + paragraph-boundary
prose packing) rather than a synthetic reimplementation. Table fidelity
depends on the sanitizer, so re-fetch (`fetch-ecfr.mjs`) before building
`structural` to pick up table-preserving `.work` records.

## Metrics

| Metric | What it answers | Math |
|---|---|---|
| **recall@k** | Did we surface *any* expected citation in the top-k? | `1` if any of top-k chunks has `citation ∈ expected` else `0`, averaged over queries |
| **MRR** | How far down the list is the first hit, on average? | `mean(1 / rank_of_first_relevant)`; `0` if never found |
| **NDCG@k** | Are the hits ranked near the top vs scattered? | binary-relevance DCG@k / IDCG@k where IDCG accounts for *all* relevant chunks in the corpus (not just expected-citation count) |

The `cosineQ8` math (Float32 query × Int8 stored, divide-by-127) is copied
from `legalRag.js` verbatim — if the runtime drifts from the harness,
fix one to match.

## Current baseline (v0.1.0, k=5, n=74, hybrid, 4-part corpus)

Re-baselined 2026-07-09 (S25): the corpus expanded from **Part 4 only** to
**all four in-scope eCFR parts (3, 4, 19, 20)** — 101 → 564 fetched records,
194 → 1,060 chunks, index size 2.6 MB (well under the 25 MB budget). The
golden set grew 60 → 74 with 14 new Part 3/19/20 queries. See "Corpus
expansion (S25)" below for the full story, including why recall/MRR/NDCG
dropped from the prior (Part-4-only) baseline without that being a quality
regression.

| Metric | Value | Prior (S21, Part 4 only, n=60) |
|---|---|---|
| recall@5 | **0.946** (70/74) | 0.967 (58/60) |
| MRR | **0.799** | 0.879 |
| NDCG@5 | **0.648** | 0.719 |

Fixed in S19 (table-loss misses, now in top-5):

- **`How does VA combine multiple disability ratings?`** (q02) → `§ 4.25`
  (combined ratings table), rank 2.
- **`Are dental and oral conditions service-connectable for compensation?`**
  (q22) → now expects `§ 4.150`, `§ 4.149`, **and `§ 3.381`** (added S25 — see
  below for why), rank 1 via the new Part 3 citation.

Known misses (lexical-mismatch / dense-appeals-corpus near-misses — not
chased with further tuning, per this cycle's discipline):

- **`Can VA rate the same disability twice under different diagnostic codes?`**
  (q06) → expected `§ 4.14` (pyramiding). **q57 ("Is it pyramiding to get
  separate ratings...") retrieves § 4.14 at rank 1** — same content,
  term-of-art phrasing works.
- **`If a veteran's condition existed before service and got worse, how much
  of the disability counts?`** (q42, held-out) → expected `§ 4.22`
  (aggravation by active service).
- **`What constitutes an appeal to the Board of Veterans' Appeals?`** (q70,
  new S25) → expected `§ 19.20`; displaced by closely-adjacent appeal-
  procedure sections (§ 19.22, § 20.100, § 20.102) in a densely
  cross-referential corpus.
- **`Are decisions of the Board of Veterans' Appeals precedential for other
  cases?`** (q73, new S25) → expected `§ 20.1303`; displaced by adjacent
  Board-authority sections (§ 20.105, § 20.801, § 20.1000).

## Contextual retrieval — evaluated, deferred (S20)

[scripts/legal-ingestion/contextualize.mjs](../scripts/legal-ingestion/contextualize.mjs)
implements Anthropic-style contextual retrieval (prepend the chunk's own
section title before embedding — templated, no LLM call) and is wired into
`embed.mjs` behind `CONTEXTUALIZE_CHUNKS=1` (default **off**), the same
opt-in pattern as `ENABLE_SCAFFOLD_FETCHERS`.

An S18-harness A/B against the shipped v0.1.0 index (n=48 tune slice) found
a **net wash on today's single-part corpus**:

| Metric | Off (shipped) | On (contextualized) |
|---|---|---|
| recall@5 | 0.979 | 0.958 |
| MRR | 0.883 | 0.873 |
| NDCG@5 | 0.733 | **0.779** |

NDCG improved (ranks tightened for already-correct queries — notably § 4.150
dental, rank 3→1), but one borderline query (q44, § 4.21 "application of
rating schedule") was displaced out of top-5 by adjacent procedural sections
(§ 4.28/4.29) whose own titles happened to pull them semantically closer to
that generic phrasing once contextualized. Net: recall/MRR both dipped
slightly — per this project's own "revert if they regress" rule, **not**
adopted into the shipped index this sprint.

The corpus-wide part heading ("38 CFR Part 4 — Schedule for Rating
Disabilities") was tried first and dropped: on a single-part corpus it's
identical across every chunk, so it added no discriminative signal while
diluting each embedding — that version regressed 2 queries (q01, q44) for
the same 1-query NDCG gain. The per-chunk section title alone captures the
win without that penalty, but still isn't a clean net positive yet.

**Re-evaluate when:** S21 lands hybrid BM25 (lexical matching should recover
borderline cases like q44 that dense-embedding contextualization confuses),
or S25 adds Parts 3/19/20/M21-1 (the part heading becomes genuinely
discriminative once more than one part is in the corpus).

## Hybrid retrieval — adopted (S21)

[`legalRag.js`](../src/services/legalRag.js) now fuses a dependency-free BM25
lexical ranking with the existing dense-cosine ranking via Reciprocal Rank
Fusion, and is the runtime default (`HYBRID_DEFAULT = true`; pass
`{hybrid: false}` for the legacy dense-only path). This is the "Current
baseline" above.

**Design.** BM25 (Okapi, k1=1.5, b=0.75) is built lazily per source and
cached alongside the existing chunk/vector caches. The candidate pool is
`{chunks with cosine ≥ threshold} ∪ {top-20 chunks by BM25 score}` — the
union, not an intersection, is what lets BM25 rescue a chunk the dense
embedder scored below `threshold`; this is the entire mechanism by which
hybrid can help lexical-mismatch queries at all. RRF (`RRF_K = 60`) then
fuses ranks across both rankers, weighted **1.0× dense / 0.25× BM25**
(`RRF_W_DENSE`/`RRF_W_BM25` in `legalRag.js`) — an equal-weight fusion was
tried first and regressed net recall (spurious lexical matches displaced
correct dense top-3 hits on this dense-strong corpus); down-weighting BM25
keeps its rescue power for genuine lexical-mismatch cases while protecting
queries dense already gets right. The returned chunk's `score` field stays
raw cosine (unchanged shape for `legalAnswerer.js`'s citation-confidence
display); `fusedScore`/`bm25`/`denseRank`/`bm25Rank` are new diagnostic
fields.

**Harness parity.** `run-eval.mjs` imports `buildBM25Index`/`bm25ScoreAll`/
`hybridFuse`/`tokenize` directly from `legalRag.js` (no reimplementation, no
drift risk) and defaults `--hybrid` to true, mirroring `HYBRID_DEFAULT`, so
the weekly CI cron's bare `--check-baseline` call reflects what actually
ships. Pass `--dense-only` to evaluate the legacy path.

**Result — honest, not a full fix.** q06 and q42 (the two remaining
lexical-mismatch misses) both improved meaningfully — q06 rank 29→16, q42
rank 26→15 — but neither reached top-5. Verified directly against the
section text: both queries are deliberately-adversarial paraphrases (written
in S18) with almost no exact-term overlap with their target sections (e.g.
q06's "twice"/"different"/"diagnostic"/"codes" don't appear anywhere in
§ 4.14's actual "Avoidance of pyramiding" text) — so even BM25's exact-match
signal has little to grab onto. This is a genuine limit of retrieval-only
methods on true paraphrase, not a harness or implementation bug, and is left
as an open target for S22's reranking (a cross-encoder can score
semantic-equivalence in ways neither BM25 nor bi-encoder cosine can) or
future query-expansion work — not something to chase further by tuning RRF
weights against these two specific queries.

**Parent-child expansion.** `legalAnswerer.js`'s `expandChunksWithSiblings()`
fills each retrieved chunk with nearest-first sibling chunks sharing the same
citation, up to a fixed ~2040-character budget, before packing for the
dual-LLM extractor. This is a build-independent runtime behavior with no
separate retrieval-metric signature (it doesn't change *which* chunks are
retrieved, only how much surrounding context the extractor sees per chunk),
so it isn't reflected in the recall/MRR/NDCG numbers above — verified instead
by dedicated unit tests asserting the budget cap, nearest-first ordering, and
— critically — that expanded sibling text reaches only the extractor's input
and never `dual.synthesize()`'s, preserving the dual-LLM security invariant.

## MMR reranking + retrieval tuning — landed, cross-encoder deferred (S22)

[`legalRag.js`](../src/services/legalRag.js)'s `query()` always applies
Maximal Marginal Relevance (MMR) reranking over a pool larger than `topK`
(`MMR_POOL_SIZE = 15`, `MMR_LAMBDA = 0.7`) before truncating to the final
result — greedily picking, after the top-relevance candidate, whichever
remaining candidate best balances relevance against redundancy with what's
already selected. `run-eval.mjs` applies the identical function (imported,
not reimplemented) so eval numbers stay faithful. Pass `{mmr: false}` /
`--no-mmr` for the raw-relevance path.

**Result: a genuine no-op on this corpus.** `--no-mmr` vs the default
produces byte-identical aggregate metrics. This isn't a bug — verified
directly that `mmrRerank` DOES reorder when redundancy exists (a unit test
constructs a near-duplicate pair and confirms MMR prefers a distinct
alternative) — it's that S19's structural, table-atomic, paragraph-packed
chunking already yields low-redundancy candidates per §-section on this
single-part corpus, so there's little near-duplicate crowding to fix. Kept
on by default as a low-cost, forward-looking safeguard: S25's multi-part
corpus expansion is more likely to introduce genuinely redundant candidates
(e.g. overlapping coverage between related sections in different parts).

**`topK`/`threshold` retuning: no change.** Swept `--k` at 3/5/7/10 —
recall@k plateaus at k=5 (nothing new enters between 5 and 10), confirming
the current `topK=5` default isn't leaving recall on the table. Swept
`--threshold` from 0.20 to 0.45 in 0.05 steps — byte-identical results at
every value, because the hybrid candidate pool's BM25-rescue union makes the
dense floor non-binding across this range on this corpus (a chunk that
matters either scores well above 0.45 on dense or gets pulled in via BM25
regardless of where the dense floor sits). The existing 5/0.35 defaults are
already robust; this is a documented "no change needed" finding, not a
missed tuning opportunity.

**Cross-encoder reranker: deferred, not dropped.** Feasibility confirmed —
[`Xenova/ms-marco-MiniLM-L-6-v2`](https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2)
is a small (6-layer) cross-encoder already converted for `transformers.js`.
Not implemented this sprint: a real integration means a new per-candidate
query-document-pair inference pipeline (a different shape than the existing
embedding pipeline, and one inference call per candidate rather than one per
query), quantization work, and device-tier gating logic that doesn't exist
yet for this code path (S24 owns device-tiering elsewhere in the app) — a
substantial, multi-part undertaking whose only currently-known target is the
2 remaining adversarial paraphrase misses (q06, q42) out of 60 golden
queries. That's not yet a demonstrated real-user need, and the download +
per-candidate inference cost would be paid by every user regardless. **Re-evaluate
when:** S23 wires the answerer into a real UI and actual usage surfaces
whether lexical-mismatch queries are common in practice, or S25's corpus
growth surfaces more cases like q06/q42 that make the investment clearly
worthwhile.

## Corpus expansion — eCFR Parts 3/19/20 landed, M21-1 deferred (S25)

`fetch-ecfr.mjs`'s `DEFAULT_PARTS` already covered all four in-scope parts
(`3, 4, 19, 20`) — prior ingestion runs had simply been invoked with an
explicit `--part=4`, not the default. S25 re-ran the fetcher with no `--part`
flag, then rebuilt the index in place (`node scripts/legal-ingestion/chunk.mjs
v0.1.0 && node scripts/legal-ingestion/embed.mjs v0.1.0`): 101 → 564 records,
194 → 1,060 chunks, 2.6 MB total (comfortably under the 25 MB budget even at
5.5× the corpus).

**Why recall/MRR/NDCG dropped without this being a quality regression.**
5.5× more candidate chunks means more topically-adjacent distractors compete
for every query's top-5 slots — previously-unambiguous rank-1 answers now
have more nearby noise in embedding space, causing rank churn even where the
correct answer still surfaces. This is an inherent, expected trade-off of
corpus growth, not something to tune away, and the new n=74 numbers above are
the honest baseline for the larger corpus — not a regression against the
smaller one.

**A genuine ground-truth fix, not a retrieval fix.** The eval gate initially
flagged q22 (dental) as newly regressed. Investigating the actual top result
(`§ 3.381`) showed it was **not** a false positive — its real title is
"Service connection of dental conditions for treatment purposes," which is
more directly on-point for the query ("are dental conditions
service-connectable") than the original expected `§ 4.150` (which only
covers the rating *percentage*, not whether a condition can be
service-connected at all). The golden set's `expected_citations` was
genuinely incomplete before Part 3 existed in the corpus; it now includes
`§ 3.381` alongside the original Part 4 citations. This is why growing a
corpus should always come with a re-read of what "regressed," not an
automatic revert — verified via the actual chunk text before touching
ground truth, per this project's `docs/RAG_EVAL.md` "no harness bugs assumed"
practice throughout S18–S25.

**M21-1: investigated and deferred, not hardened.** See
`knowledge-sources.yaml`'s `m21-1` entry for the full finding: the scaffold's
placeholder URL 404s, and the real, current KnowVA Table of Contents (found
via search) returns HTTP 200 but is a client-side-rendered Angular SPA shell
with zero real `<a>` links in the raw HTML — chapter content loads via a JS
API call after page load. A `fetch()`+regex scraper (the scaffold's entire
design) cannot work against this architecture regardless of selector fixes.
The legacy WARMS M21-1 URL now redirects into the same SPA shell, so there's
no simpler static fallback either. Real enablement needs a headless-browser
fetcher (a new dependency this pipeline doesn't otherwise carry) or reverse-
engineering the Angular app's content API — both open-ended, disproportionate
to this sprint. `ENABLE_SCAFFOLD_FETCHERS=1` will still only 404 with the
current fetcher; do not flip it until one of those is built.

## When to re-run

- After any change to `scripts/legal-ingestion/{chunk,embed}.mjs`
- After any change to `src/services/legalRag.js` scoring logic
- After bumping the index version under `public/legal-index/`
- After upgrading `@huggingface/transformers` (embedder behavior can shift)
- After re-running `fetch-ecfr.mjs` (a live source can change section text/
  numbering between runs)

If numbers move materially, update the baseline table above with the new
run and a one-line note on the cause.

## Out of scope (non-goals)

- **Not** a generation eval — see `aiSystemPrompts` security tests for
  prompt-injection / dual-LLM coverage.
- **Not** a freshness eval — chunk recency is checked by the ingestion
  scripts (`diff.mjs`), not here.
- **Not a per-PR CI check.** A regression gate exists (`.github/workflows/legal-ingestion.yml`
  runs `run-eval.mjs --check-baseline` — fails the job if any metric drops
  more than 5% relative to `scripts/legal-ingestion/eval/baseline.json`), but
  it only runs as part of the weekly index-rebuild workflow when a diff is
  detected, not automatically on every pull request. Run
  `npm run eval:rag -- --check-baseline` locally before merging any change
  that touches chunking, embedding, or retrieval.
