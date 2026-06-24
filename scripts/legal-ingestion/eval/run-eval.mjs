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
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "@huggingface/transformers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const EMBED_DIM = 384;
const EMBED_MODEL = "Xenova/bge-small-en-v1.5";

function parseArgs(argv) {
  const args = {
    k: 5,
    version: "v0.1.0",
    json: false,
    golden: null,
    checkBaseline: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--k") args.k = Number(argv[++i]);
    else if (a === "--version") args.version = argv[++i];
    else if (a === "--golden") args.golden = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--check-baseline") args.checkBaseline = true;
  }
  if (!Number.isInteger(args.k) || args.k <= 0) {
    throw new Error(`--k must be a positive integer, got ${args.k}`);
  }
  return args;
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

async function loadIndex(version) {
  const base = path.join(ROOT, "public", "legal-index", version);
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

function scoreAll(queryVec, sources) {
  const scored = [];
  for (const [, { chunks, bin }] of Object.entries(sources)) {
    for (let i = 0; i < chunks.length; i++) {
      scored.push({ chunk: chunks[i], score: cosineQ8(queryVec, bin, i) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
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

async function main() {
  const args = parseArgs(process.argv);
  const goldenPath = args.golden ?? path.join(__dirname, "golden-set.jsonl");

  if (!args.json) {
    console.error(`[eval] loading index ${args.version}...`);
  }
  const { sources } = await loadIndex(args.version);

  if (!args.json) {
    console.error(`[eval] loading embedder ${EMBED_MODEL}...`);
  }
  const embedder = await pipeline("feature-extraction", EMBED_MODEL);

  const golden = await loadGolden(goldenPath);
  if (!args.json) {
    console.error(`[eval] running ${golden.length} queries @ k=${args.k}`);
  }

  const results = [];
  for (const item of golden) {
    const out = await embedder(item.query, {
      pooling: "mean",
      normalize: false,
    });
    const queryVec = l2NormalizeF32(new Float32Array(out.data));
    const ranked = scoreAll(queryVec, sources);
    const expectedSet = new Set(item.expected_citations);
    const totalRelevant = countRelevantInCorpus(sources, expectedSet);
    const m = metricsFor(
      ranked,
      item.expected_citations,
      args.k,
      totalRelevant,
    );
    results.push({
      id: item.id,
      query: item.query,
      expected: item.expected_citations,
      top: ranked.slice(0, args.k).map((r) => ({
        citation: r.chunk.citation,
        score: Number(r.score.toFixed(4)),
      })),
      ...m,
    });
  }

  const n = results.length;
  const agg = {
    n,
    k: args.k,
    version: args.version,
    recallAtK: results.reduce((s, r) => s + r.recallAtK, 0) / n,
    mrr: results.reduce((s, r) => s + r.mrr, 0) / n,
    ndcgAtK: results.reduce((s, r) => s + r.ndcgAtK, 0) / n,
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

  console.log(
    `\nLegal-RAG eval — version ${args.version}, n=${n}, k=${args.k}`,
  );
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
      console.log(
        `      top:      ${r.top.map((t) => `${t.citation}(${t.score})`).join(" | ")}`,
      );
    }
  }

  if (args.checkBaseline) await checkBaseline(agg);
}

main().catch((err) => {
  console.error("[eval] FATAL:", err.message);
  process.exit(1);
});
