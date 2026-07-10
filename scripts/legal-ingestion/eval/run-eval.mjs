#!/usr/bin/env node
/**
 * run-eval.mjs — recall@k / MRR / NDCG@k over the runtime legal index.
 *
 * Reads the same on-disk artifacts that `src/services/legalRag.js` fetches
 * over HTTP at runtime:
 *   public/legal-index/v{x.y.z}/manifest.json
 *   public/legal-index/v{x.y.z}/chunks/{source}.jsonl
 *   public/legal-index/v{x.y.z}/vectors/{source}.bin
 *
 * Uses the same Float32-query × Q8-vector cosine math as legalRag.cosineQ8
 * so metric numbers are faithful to what users actually see in the app.
 *
 * Usage:
 *   node scripts/legal-ingestion/eval/run-eval.mjs
 *   node scripts/legal-ingestion/eval/run-eval.mjs --k 5 --version v0.1.0
 *   node scripts/legal-ingestion/eval/run-eval.mjs --json > eval-report.json
 *   node scripts/legal-ingestion/eval/run-eval.mjs --check-baseline   # exit 1 on >5% regression vs baseline.json
 *
 *   # Hybrid (BM25 + dense RRF fusion, S21) is the DEFAULT — it mirrors
 *   # legalRag.js's HYBRID_DEFAULT, so a bare --check-baseline (what the
 *   # weekly CI cron runs) reflects what actually ships, not a stale
 *   # dense-only number. Pass --dense-only for the legacy cosine-only path
 *   # (e.g. to see what hybrid is adding on top of).
 *   node scripts/legal-ingestion/eval/run-eval.mjs --dense-only --exclude-held-out
 *   node scripts/legal-ingestion/eval/run-eval.mjs --json   # hybrid, machine-readable
 *
 *   # A/B compare chunking-strategy variants built by build-variants.mjs
 *   # (name=path pairs; a bare name resolves to eval/.variants/<name>)
 *   node scripts/legal-ingestion/eval/run-eval.mjs --compare page-level 512tok-10pct 1024tok-15pct
 *   node scripts/legal-ingestion/eval/run-eval.mjs --compare current=v0.1.0 candidate=../scratch/v0.2.0-rc
 *
 *   # Golden-set held-out slice (see golden-set.jsonl `heldOut` field) — tune
 *   # weights/thresholds only against --exclude-held-out; report the
 *   # held-out numbers separately at the end of a sprint, unbiased by tuning.
 *   node scripts/legal-ingestion/eval/run-eval.mjs --exclude-held-out
 *   node scripts/legal-ingestion/eval/run-eval.mjs --held-out-only
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pipeline } from "@huggingface/transformers";
// Import the REAL runtime fusion so hybrid eval numbers reflect exactly what
// legalRag.query() computes in the app (no reimplementation to drift). Only
// pure functions/consts are pulled in; legalRag's fetch/transformers code is
// never touched at import time.
import {
  buildBM25Index,
  bm25ScoreAll,
  hybridFuse,
  tokenize,
  mmrRerank,
  dequantizeQ8,
  MMR_POOL_SIZE,
} from "../../../src/services/legalRag.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const EMBED_DIM = 384;
const EMBED_MODEL = "Xenova/bge-small-en-v1.5";
// Dense cosine floor, matches legalRag.query()'s default `threshold`.
const DENSE_THRESHOLD = 0.35;

// Flags that just flip a boolean — kept out of the parse loop's branching.
const BOOLEAN_FLAGS = {
  "--json": "json",
  "--check-baseline": "checkBaseline",
  "--held-out-only": "heldOutOnly",
  "--exclude-held-out": "excludeHeldOut",
  "--hybrid": "hybrid", // no-op now that hybrid is the default; kept for explicitness
  "--dense-only": "denseOnly",
  "--no-mmr": "noMmr", // disable MMR diversity reranking (S22) for A/B comparison
};

function parseArgs(argv) {
  const args = {
    k: 5,
    version: "v0.1.0",
    json: false,
    golden: null,
    checkBaseline: false,
    compare: null,
    heldOutOnly: false,
    excludeHeldOut: false,
    // Default TRUE — mirrors legalRag.js's HYBRID_DEFAULT. A bare `--check-baseline`
    // (what the weekly CI cron runs) must reflect what actually ships; pass
    // --dense-only to evaluate the legacy cosine-only path instead.
    hybrid: true,
    denseOnly: false,
    // Default TRUE — mirrors legalRag.js's always-on MMR (S22); --no-mmr opts out.
    mmr: true,
    noMmr: false,
    // Dense cosine floor for the candidate pool — mirrors legalRag.query()'s
    // default `threshold` (0.35). Exposed for S22-style threshold sweeps.
    threshold: 0.35,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a in BOOLEAN_FLAGS) {
      args[BOOLEAN_FLAGS[a]] = true;
    } else if (a === "--k") {
      args.k = Number(argv[++i]);
    } else if (a === "--threshold") {
      args.threshold = Number(argv[++i]);
    } else if (a === "--version") {
      args.version = argv[++i];
    } else if (a === "--golden") {
      args.golden = argv[++i];
    } else if (a === "--compare") {
      args.compare = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args.compare.push(argv[++i]);
      }
      if (args.compare.length < 2) {
        throw new Error("--compare requires at least 2 variants to compare");
      }
    }
  }
  if (!Number.isInteger(args.k) || args.k <= 0) {
    throw new Error(`--k must be a positive integer, got ${args.k}`);
  }
  if (args.heldOutOnly && args.excludeHeldOut) {
    throw new Error(
      "--held-out-only and --exclude-held-out are mutually exclusive",
    );
  }
  if (args.denseOnly) args.hybrid = false;
  if (args.noMmr) args.mmr = false;
  return args;
}

/**
 * Split a golden set by its `heldOut` flag. Sprints S19-S22 must tune
 * chunking/retrieval parameters only against the non-held-out slice; the
 * held-out slice is reported, never optimized against.
 */
export function filterGolden(golden, { heldOutOnly = false, excludeHeldOut = false } = {}) {
  if (heldOutOnly) return golden.filter((g) => g.heldOut === true);
  if (excludeHeldOut) return golden.filter((g) => g.heldOut !== true);
  return golden;
}

/**
 * Resolve a --compare entry to { name, dir }. Accepts "name=path" (path
 * resolved relative to the repo root) or a bare variant name, which resolves
 * to the scratch dir build-variants.mjs writes under eval/.variants/<name>.
 */
export function resolveCompareSpec(spec, { root, variantsDir }) {
  const eq = spec.indexOf("=");
  const name = eq === -1 ? spec : spec.slice(0, eq);
  let dir;
  if (eq === -1) {
    dir = path.join(variantsDir, spec);
  } else {
    const raw = spec.slice(eq + 1);
    dir = path.isAbsolute(raw) ? raw : path.resolve(root, raw);
  }
  return { name, dir };
}

async function loadGolden(file) {
  const text = await fs.readFile(file, "utf8");
  return text
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//"))
    .map((l, lineIdx) => {
      try {
        return JSON.parse(l);
      } catch (err) {
        throw new Error(`golden-set line ${lineIdx + 1}: ${err.message}`);
      }
    });
}

/**
 * Load a manifest + chunks + vectors index from an arbitrary directory
 * (either public/legal-index/<version>, shipped, or a build-variants.mjs
 * scratch dir under eval/.variants/<name>).
 */
async function loadIndexFromDir(base) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(base, "manifest.json"), "utf8"),
  );
  if (manifest.embedding_dim !== EMBED_DIM) {
    throw new Error(
      `manifest dim ${manifest.embedding_dim} ≠ harness ${EMBED_DIM}`,
    );
  }
  const sources = {};
  for (const sourceName of Object.keys(manifest.sources)) {
    const jsonl = await fs.readFile(
      path.join(base, "chunks", `${sourceName}.jsonl`),
      "utf8",
    );
    const chunks = jsonl
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const bin = new Int8Array(
      (await fs.readFile(path.join(base, "vectors", `${sourceName}.bin`)))
        .buffer,
    );
    if (bin.length !== chunks.length * EMBED_DIM) {
      throw new Error(
        `${sourceName}.bin (${bin.length}) ≠ chunks (${chunks.length}) × ${EMBED_DIM}`,
      );
    }
    sources[sourceName] = { chunks, bin };
  }
  return { manifest, sources };
}

async function loadIndex(version) {
  return loadIndexFromDir(path.join(ROOT, "public", "legal-index", version));
}

function l2NormalizeF32(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / norm;
  return out;
}

function cosineQ8(queryVec, bin, idx) {
  let dot = 0;
  const base = idx * EMBED_DIM;
  for (let i = 0; i < EMBED_DIM; i++) {
    dot += queryVec[i] * bin[base + i];
  }
  return dot / 127;
}

/**
 * MMR-rerank the top MMR_POOL_SIZE of an already-relevance-sorted list, then
 * append the untouched remainder. Mirrors legalRag.query()'s MMR step
 * exactly (imported, not reimplemented) — MMR only ever reorders within a
 * bounded pool, so the remainder stays in its original relevance order,
 * which is what metricsFor's beyond-k fallback search for MRR needs.
 *
 * @param {Array<{chunk:Object, score:number, cosine:number, bin:Int8Array, localIndex:number}>} list
 * @param {boolean} [enabled=true] — pass false for --no-mmr comparison runs
 * @returns {Array<{chunk:Object, score:number}>}
 */
function applyMmr(list, enabled = true) {
  if (!enabled) {
    return list.map((entry) => ({ chunk: entry.chunk, score: entry.score }));
  }
  const poolLen = Math.min(MMR_POOL_SIZE, list.length);
  const pool = list
    .slice(0, poolLen)
    .map((entry, i) => ({ index: i, cosine: entry.cosine }));
  const reranked = mmrRerank(pool, {
    topK: poolLen,
    getVector: (i) => dequantizeQ8(list[i].bin, list[i].localIndex),
  });
  const head = reranked.map((r) => {
    const entry = list[r.index];
    return { chunk: entry.chunk, score: entry.score };
  });
  const tail = list.slice(poolLen).map((entry) => ({ chunk: entry.chunk, score: entry.score }));
  return head.concat(tail);
}

function scoreAll(queryVec, sources, { mmr = true } = {}) {
  const scored = [];
  for (const [, { chunks, bin }] of Object.entries(sources)) {
    for (let i = 0; i < chunks.length; i++) {
      const cosine = cosineQ8(queryVec, bin, i);
      scored.push({ chunk: chunks[i], score: cosine, cosine, bin, localIndex: i });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return applyMmr(scored, mmr);
}

// Per-index BM25 cache keyed by the sources object identity, so we build the
// lexical index once per variant instead of once per query.
const bm25Cache = new WeakMap();
function bm25For(sources) {
  let cached = bm25Cache.get(sources);
  if (cached) return cached;
  cached = {};
  for (const [name, { chunks }] of Object.entries(sources)) {
    cached[name] = buildBM25Index(chunks.map((c) => c.text));
  }
  bm25Cache.set(sources, cached);
  return cached;
}

/**
 * Hybrid ranking that mirrors legalRag.query() exactly: flatten every source
 * into one global list, score dense cosine + BM25, fuse with RRF over the
 * {cosine ≥ threshold} ∪ {top-BM25} candidate pool. Returns the FULL fused
 * pool (topK omitted) so metricsFor can still find a first-relevant rank in
 * the tail for MRR — a doc outside the pool is genuinely unretrievable by
 * hybrid, so its MRR contribution is 0, honestly.
 */
function scoreAllHybrid(queryVec, queryText, sources, { mmr = true, threshold = DENSE_THRESHOLD } = {}) {
  const bm25Indexes = bm25For(sources);
  const queryTokens = tokenize(queryText);
  const flatChunks = [];
  const cosine = [];
  const bm25 = [];
  const binRefs = [];
  for (const [name, { chunks, bin }] of Object.entries(sources)) {
    const bm25Scores = bm25ScoreAll(bm25Indexes[name], queryTokens);
    for (let i = 0; i < chunks.length; i++) {
      flatChunks.push(chunks[i]);
      cosine.push(cosineQ8(queryVec, bin, i));
      bm25.push(bm25Scores[i]);
      binRefs.push({ bin, localIndex: i });
    }
  }
  const fused = hybridFuse({
    cosine,
    bm25,
    threshold,
    topK: 0,
  });
  const list = fused.map((r) => ({
    chunk: flatChunks[r.index],
    score: r.fusedScore,
    cosine: r.cosine,
    bin: binRefs[r.index].bin,
    localIndex: binRefs[r.index].localIndex,
  }));
  return applyMmr(list, mmr);
}

function countRelevantInCorpus(sources, expected) {
  let n = 0;
  for (const [, { chunks }] of Object.entries(sources)) {
    for (const c of chunks) if (expected.has(c.citation)) n++;
  }
  return n;
}

function metricsFor(ranked, expectedCitations, k, totalRelevant) {
  const expected = new Set(expectedCitations);
  let firstRelRank = 0;
  let hitsInTopK = 0;
  let dcg = 0;
  for (let i = 0; i < Math.min(ranked.length, k); i++) {
    const rel = expected.has(ranked[i].chunk.citation) ? 1 : 0;
    if (rel) {
      hitsInTopK++;
      if (firstRelRank === 0) firstRelRank = i + 1;
      dcg += rel / Math.log2(i + 2);
    }
  }
  // IDCG@k = ideal stacking of all relevant chunks at the top, capped by k.
  // `totalRelevant` is the count of chunks in the WHOLE corpus whose citation
  // is in `expected` — so an "ideal" ranker could place that many 1s before
  // any 0. Using expected.size (the count of distinct citations) under-counts
  // when multiple chunks share a citation, which made NDCG exceed 1.0.
  const idealRels = Math.min(totalRelevant, k);
  let idcg = 0;
  for (let i = 0; i < idealRels; i++) idcg += 1 / Math.log2(i + 2);

  if (firstRelRank === 0) {
    for (let i = k; i < ranked.length; i++) {
      if (expected.has(ranked[i].chunk.citation)) {
        firstRelRank = i + 1;
        break;
      }
    }
  }

  return {
    recallAtK: hitsInTopK > 0 ? 1 : 0,
    mrr: firstRelRank > 0 ? 1 / firstRelRank : 0,
    ndcgAtK: idcg > 0 ? dcg / idcg : 0,
    firstRelRank,
    hitsInTopK,
    totalRelevant,
  };
}

/**
 * Run every golden query against one loaded index and aggregate recall@k /
 * MRR / NDCG@k. Shared by the single-index path and --compare.
 */
async function evaluateIndex(
  sources,
  embedder,
  golden,
  k,
  { hybrid = false, mmr = true, threshold = DENSE_THRESHOLD } = {},
) {
  const results = [];
  for (const item of golden) {
    const out = await embedder(item.query, { pooling: "mean", normalize: false });
    const queryVec = l2NormalizeF32(new Float32Array(out.data));
    const ranked = hybrid
      ? scoreAllHybrid(queryVec, item.query, sources, { mmr, threshold })
      : scoreAll(queryVec, sources, { mmr });
    const expectedSet = new Set(item.expected_citations);
    const totalRelevant = countRelevantInCorpus(sources, expectedSet);
    const m = metricsFor(ranked, item.expected_citations, k, totalRelevant);
    results.push({
      id: item.id,
      query: item.query,
      expected: item.expected_citations,
      top: ranked
        .slice(0, k)
        .map((r) => ({ citation: r.chunk.citation, score: Number(r.score.toFixed(4)) })),
      ...m,
    });
  }
  const n = results.length;
  const agg = {
    n,
    k,
    recallAtK: n ? results.reduce((s, r) => s + r.recallAtK, 0) / n : 0,
    mrr: n ? results.reduce((s, r) => s + r.mrr, 0) / n : 0,
    ndcgAtK: n ? results.reduce((s, r) => s + r.ndcgAtK, 0) / n : 0,
  };
  return { agg, results };
}

const BASELINE_TOLERANCE = 0.05;

async function checkBaseline(agg) {
  const baselinePath = path.join(__dirname, "baseline.json");
  const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
  const regressions = [];
  for (const key of ["recallAtK", "mrr", "ndcgAtK"]) {
    const drop = (baseline[key] - agg[key]) / baseline[key];
    if (drop > BASELINE_TOLERANCE) {
      regressions.push(
        `${key}: ${agg[key].toFixed(3)} vs baseline ${baseline[key].toFixed(3)} (-${(drop * 100).toFixed(1)}%)`,
      );
    }
  }
  if (regressions.length) {
    console.error(
      `[eval] BASELINE REGRESSION (>${BASELINE_TOLERANCE * 100}% relative drop vs eval/baseline.json):`,
    );
    for (const r of regressions) console.error(`  ✗ ${r}`);
    process.exit(1);
  }
  console.error(
    `[eval] baseline check passed — all metrics within ${BASELINE_TOLERANCE * 100}% of eval/baseline.json`,
  );
}

function printAggTable(rows) {
  console.log("\nChunking-strategy comparison (tune = golden set minus held-out slice)");
  console.log("─".repeat(88));
  console.log(
    "  variant".padEnd(20) +
      "n(tune)".padStart(9) +
      "recall@k".padStart(11) +
      "MRR".padStart(9) +
      "NDCG@k".padStart(9) +
      "  |  n(held)".padStart(13) +
      "recall@k".padStart(11),
  );
  for (const row of rows) {
    const t = row.tune;
    const h = row.held;
    console.log(
      `  ${row.name}`.padEnd(20) +
        String(t.n).padStart(9) +
        t.recallAtK.toFixed(3).padStart(11) +
        t.mrr.toFixed(3).padStart(9) +
        t.ndcgAtK.toFixed(3).padStart(9) +
        (h ? `  |  ${String(h.n).padStart(6)}` : "  |       —") +
        (h ? h.recallAtK.toFixed(3).padStart(11) : "".padStart(11)),
    );
  }
  console.log("─".repeat(88));
}

async function runCompare(args, goldenPath) {
  const golden = await loadGolden(goldenPath);
  const tuneSet = filterGolden(golden, { excludeHeldOut: true });
  const heldSet = filterGolden(golden, { heldOutOnly: true });

  if (!args.json) {
    console.error(`[eval] loading embedder ${EMBED_MODEL}...`);
  }
  const embedder = await pipeline("feature-extraction", EMBED_MODEL);

  const variantsDir = path.join(__dirname, ".variants");
  const rows = [];
  for (const spec of args.compare) {
    const { name, dir } = resolveCompareSpec(spec, { root: ROOT, variantsDir });
    if (!args.json) console.error(`[eval] comparing "${name}" (${dir})...`);
    const { sources } = await loadIndexFromDir(dir);
    const tuneRun = await evaluateIndex(sources, embedder, tuneSet, args.k, {
      hybrid: args.hybrid,
      mmr: args.mmr,
      threshold: args.threshold,
    });
    const heldRun = heldSet.length
      ? await evaluateIndex(sources, embedder, heldSet, args.k, {
          hybrid: args.hybrid,
          mmr: args.mmr,
          threshold: args.threshold,
        })
      : null;
    rows.push({
      name,
      dir,
      tune: tuneRun.agg,
      held: heldRun?.agg ?? null,
      // Per-query detail (JSON mode only, see below) — lets a sprint compare
      // exactly which queries flip pass/fail between two variants instead of
      // just the aggregate, e.g. when a chunking change trades recall for NDCG.
      tuneResults: tuneRun.results,
      heldResults: heldRun?.results ?? [],
    });
  }

  if (args.json) {
    console.log(JSON.stringify({ ranAt: new Date().toISOString(), k: args.k, rows }, null, 2));
    return;
  }
  printAggTable(rows);
}

function printSingleIndexReport(args, n, agg, results) {
  const mode = agg.hybrid ? "hybrid (BM25+dense RRF)" : "dense-only";
  console.log(`\nLegal-RAG eval — version ${args.version}, mode=${mode}, n=${n}, k=${args.k}`);
  console.log("─".repeat(72));
  console.log(`  recall@${args.k}: ${agg.recallAtK.toFixed(3)}`);
  console.log(`  MRR        : ${agg.mrr.toFixed(3)}`);
  console.log(`  NDCG@${args.k}  : ${agg.ndcgAtK.toFixed(3)}`);
  console.log("─".repeat(72));
  console.log("\nPer-query (✓ = expected citation in top-k):");
  for (const r of results) {
    const mark = r.recallAtK ? "✓" : "✗";
    console.log(
      `  ${mark} ${r.id} rank=${r.firstRelRank || "—"} ` +
        `r@k=${r.recallAtK} rr=${r.mrr.toFixed(3)} ndcg=${r.ndcgAtK.toFixed(3)}  ${r.query}`,
    );
    if (!r.recallAtK) {
      console.log(`      expected: ${r.expected.join(" | ")}`);
      const top = r.top.map((t) => `${t.citation}(${t.score})`).join(" | ");
      console.log(`      top:      ${top}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const goldenPath = args.golden ?? path.join(__dirname, "golden-set.jsonl");

  if (args.compare) {
    await runCompare(args, goldenPath);
    return;
  }

  if (!args.json) {
    console.error(`[eval] loading index ${args.version}...`);
  }
  const { sources } = await loadIndex(args.version);

  if (!args.json) {
    console.error(`[eval] loading embedder ${EMBED_MODEL}...`);
  }
  const embedder = await pipeline("feature-extraction", EMBED_MODEL);

  const goldenAll = await loadGolden(goldenPath);
  const golden = filterGolden(goldenAll, {
    heldOutOnly: args.heldOutOnly,
    excludeHeldOut: args.excludeHeldOut,
  });
  if (!args.json) {
    console.error(`[eval] running ${golden.length} queries @ k=${args.k}`);
  }

  const { agg: aggRaw, results } = await evaluateIndex(
    sources,
    embedder,
    golden,
    args.k,
    { hybrid: args.hybrid, mmr: args.mmr, threshold: args.threshold },
  );
  const agg = {
    ...aggRaw,
    version: args.version,
    hybrid: args.hybrid,
    mmr: args.mmr,
    threshold: args.threshold,
  };

  if (args.json) {
    console.log(
      JSON.stringify(
        { ranAt: new Date().toISOString(), aggregate: agg, perQuery: results },
        null,
        2,
      ),
    );
    if (args.checkBaseline) await checkBaseline(agg);
    return;
  }

  printSingleIndexReport(args, results.length, agg, results);
  if (args.checkBaseline) await checkBaseline(agg);
}

// CLI entry — only when invoked directly, not when imported for its exported
// pure helpers (filterGolden, resolveCompareSpec) from a test file.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("[eval] FATAL:", err.message);
    process.exit(1);
  });
}
