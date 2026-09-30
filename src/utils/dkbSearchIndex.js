/**
 * DKB (Diamond Knowledge Base) search index - D16-7.
 *
 * The original searchDKB scored every DKB entry (~8K) against every query
 * term with a plain substring scan (aiSystemPrompts.js's old
 * scoreTermMatches). That is fine for a short typed question, but at least
 * one real caller (musterCallProcessor.js's analyzeCFileWithAI) hands
 * searchDKB up to ~15,000 characters of raw C-File text as the "query" -
 * thousands of query terms x ~8K entries x 2 text fields, all synchronous,
 * on the main thread. Measured live against the real corpus
 * (public/data/diamond_knowledge.json, 7,988 entries): a single call with a
 * realistic 15K-character excerpt took 3.4-4.0s; a 50K-character one took
 * 11.7s. That single call is the "one synchronous main-thread task" D16-7
 * profiled during a large C-File import.
 *
 * Fix: a character-trigram inverted index built once (see buildDKBIndex),
 * so a query term only gets scored against entries that could possibly
 * contain it - candidate generation is a superset (trigram membership is a
 * necessary condition for a substring match), and every candidate is still
 * verified with the exact original `.includes()` check before contributing
 * to the score. That guarantees byte-identical results and ordering to the
 * original full-scan algorithm for every query, not just a sampled set -
 * see aiSystemPrompts.dkbSearchIndex.equivalence.test.js. Measured
 * speedup on the same corpus: the 15K-character excerpt above went from
 * 3.4-4.0s to 5-30ms; the 50K one from 11.7s to ~40ms.
 *
 * Index construction itself is real synchronous work (~1.1-1.5s over the
 * full corpus, once per session) and is chunked with a real event-loop
 * yield between batches for the same reason - see yieldToEventLoop below.
 */

// `setTimeout(resolve, 0)` clamps to >= 4ms once nested a few levels deep
// (a chunking loop's own await chain reaches that depth immediately). A
// MessageChannel round trip returns control to the event loop the same way
// but is not a timer, so the clamp does not apply - matches the approach
// already verified live (both Chromium and Firefox) in advancedOCR.js's own
// yieldToEventLoop. scheduler.yield() is deliberately not used here either:
// verified there that it starves real input in Firefox for an entire
// busy-loop, which is exactly the failure this yielding exists to prevent.
function yieldToEventLoop() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port2.onmessage = () => resolve();
    channel.port1.postMessage(null);
  });
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// A soft per-batch time budget, not an item count: entry text length in the
// real corpus ranges from empty to ~1,600 chars and query term counts range
// from one to (a large-blob caller's) thousands, so a fixed item count
// under- or over-shoots depending on what lands in a given batch. 16ms
// leaves comfortable headroom under D16-7's 200ms main-thread-task target
// even at a 4x CPU slowdown (16ms x ~5 = 80ms). Shared by buildDKBIndex and
// searchIndexedDKB's scoring loops - see maybeYield.
const YIELD_BUDGET_MS = 16;

function makeYieldBudget() {
  return { lastCheck: now() };
}

async function maybeYield(budget) {
  if (now() - budget.lastCheck > YIELD_BUDGET_MS) {
    await yieldToEventLoop();
    budget.lastCheck = now();
  }
}

function addTrigrams(str, keyIndex, trigramIndex) {
  const lastStart = str.length - 3;
  for (let i = 0; i <= lastStart; i++) {
    const tri = str.slice(i, i + 3);
    let postings = trigramIndex.get(tri);
    if (!postings) {
      postings = new Set();
      trigramIndex.set(tri, postings);
    }
    postings.add(keyIndex);
  }
}

// Postings start as Sets during construction (addTrigrams needs O(1)
// membership checks to dedupe repeated trigram occurrences within one
// entry's text) then get frozen into sorted Int32Arrays here - see
// finalizeTrigramIndex. A Set<number> holds each posting as a boxed V8
// object; on the real corpus (14,501 distinct trigrams, 3,196,193 text
// postings) that costs ~85MB of heap held for the entire session, vs.
// ~13MB (3,196,193 x 4 bytes) for packed Int32Arrays - measured live, see
// this fix's commit. Sorted so hasSorted below can binary-search instead
// of Set#has.
function finalizeTrigramIndex(trigramIndex) {
  for (const [gram, postings] of trigramIndex) {
    trigramIndex.set(gram, Int32Array.from(postings).sort());
  }
}

function hasSorted(sortedArray, value) {
  let lo = 0;
  let hi = sortedArray.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedArray[mid] === value) return true;
    if (sortedArray[mid] < value) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

function termTrigrams(term) {
  const grams = [];
  const lastStart = term.length - 3;
  for (let i = 0; i <= lastStart; i++) grams.push(term.slice(i, i + 3));
  return grams;
}

/**
 * Entries (by key index into whatever `trigramIndex` was built over) that
 * COULD contain `term` as a substring - a safe superset, not a confirmed
 * match. `term.length` is always >= 3 (callers only pass searchDKB's
 * already-filtered queryTerms), so there is always at least one trigram.
 * `trigramIndex`'s postings are sorted Int32Arrays (see
 * finalizeTrigramIndex) once buildDKBIndex has returned.
 */
function candidatesForTerm(trigramIndex, term) {
  const grams = termTrigrams(term);
  let smallest = null;
  for (const gram of grams) {
    const postings = trigramIndex.get(gram);
    if (!postings) return null;
    if (!smallest || postings.length < smallest.length) smallest = postings;
  }
  if (grams.length === 1) return smallest;

  const others = grams
    .map((gram) => trigramIndex.get(gram))
    .filter((postings) => postings !== smallest);
  const confirmed = [];
  for (const candidate of smallest) {
    if (others.every((postings) => hasSorted(postings, candidate))) {
      confirmed.push(candidate);
    }
  }
  return confirmed;
}

function indexOneEntry(entry, i, state) {
  const instruction = (entry.instruction || "").toLowerCase();
  const output = (entry.output || "").toLowerCase();
  state.lowerInstruction[i] = instruction;
  state.lowerOutput[i] = output;
  addTrigrams(instruction, i, state.textTrigramIndex);
  addTrigrams(output, i, state.textTrigramIndex);

  const dc = entry.metadata?.dc;
  if (dc) {
    if (!state.dcGroups.has(dc)) state.dcGroups.set(dc, []);
    state.dcGroups.get(dc).push(i);
  }

  const condition = (entry.metadata?.condition_name || "").toLowerCase();
  if (condition) {
    if (!state.conditionNameGroups.has(condition)) {
      state.conditionNameGroups.set(condition, []);
    }
    state.conditionNameGroups.get(condition).push(i);
  }
}

function indexConditionNames(state) {
  const distinctConds = [...state.conditionNameGroups.keys()];
  const condTrigramIndex = new Map();
  for (let i = 0; i < distinctConds.length; i++) {
    addTrigrams(distinctConds[i], i, condTrigramIndex);
  }
  finalizeTrigramIndex(condTrigramIndex);
  state.distinctConds = distinctConds;
  state.condTrigramIndex = condTrigramIndex;
}

/**
 * Build the DKB search index once. Chunked with a real event-loop yield
 * between batches so index construction itself never produces a single
 * main-thread task over budget (see module doc comment).
 */
export async function buildDKBIndex(entries) {
  const state = {
    entries,
    lowerInstruction: new Array(entries.length),
    lowerOutput: new Array(entries.length),
    textTrigramIndex: new Map(),
    dcGroups: new Map(),
    conditionNameGroups: new Map(),
  };

  const budget = makeYieldBudget();
  for (let i = 0; i < entries.length; i++) {
    indexOneEntry(entries[i], i, state);
    await maybeYield(budget);
  }

  finalizeTrigramIndex(state.textTrigramIndex);
  indexConditionNames(state);
  return state;
}

function detectQueryIntent(queryLower) {
  return {
    isSecondaryQuery:
      queryLower.includes("secondary") ||
      queryLower.includes("nexus") ||
      queryLower.includes("caused by"),
    isPACTQuery:
      queryLower.includes("pact") ||
      queryLower.includes("toxic") ||
      queryLower.includes("burn pit"),
    isRatingQuery:
      queryLower.includes("rating") ||
      queryLower.includes("percentage") ||
      queryLower.includes("criteria"),
    isBVAQuery:
      queryLower.includes("bva") ||
      queryLower.includes("appeal") ||
      queryLower.includes("board"),
  };
}

// Multipliers are identical to (and must stay in sync with) the original
// applySourceBoost/applyIntentBoost in aiSystemPrompts.js's pre-D16-7 code -
// duplicated here rather than imported so this module has no dependency on
// aiSystemPrompts.js (it builds/searches an index; prompt assembly is not
// its concern).
function applySourceBoost(score, source) {
  let boosted = score;
  if (source === "eCFR_OFFICIAL") boosted *= 1.3;
  if (source === "OGC_PRECEDENT_OPINION") boosted *= 1.4;
  if (source === "BVA_DECISIONS" || source === "BVA_REPORTS_OFFICIAL") {
    boosted *= 1.2;
  }
  return boosted;
}

function applyIntentBoost(score, source, type, intent) {
  let boosted = score;
  if (intent.isSecondaryQuery && source === "SECONDARY_CONDITIONS_MATRIX") {
    boosted *= 2.5;
  }
  if (intent.isPACTQuery && source === "PACT_ACT_OFFICIAL") boosted *= 2.5;
  if (intent.isRatingQuery && type === "rating_criteria") boosted *= 2;
  if (intent.isBVAQuery && (source.includes("BVA") || source.includes("OGC"))) {
    boosted *= 2;
  }
  return boosted;
}

function scoreTextMatchesForTerm(index, term, count, rawScore) {
  const candidates = candidatesForTerm(index.textTrigramIndex, term);
  if (!candidates) return;
  for (const i of candidates) {
    if (index.lowerInstruction[i].includes(term)) rawScore[i] += 2 * count;
    if (index.lowerOutput[i].includes(term)) rawScore[i] += 1 * count;
  }
}

// Item 2's own CDP profile (a 520-page synthetic import at 4x CPU throttle)
// measured one 253ms task here, over D16-7's 200ms target - this loop
// iterates over every unique query term (up to ~1,000+ for the large-blob
// caller D16-7 was written for), and unlike buildDKBIndex, scoring itself
// wasn't chunked, since it measured 5-30ms unthrottled. Same yield pattern
// as buildDKBIndex: check every iteration is cheap, actually yielding is
// what matters, and this keeps scoring correct for a real-time caller (see
// searchIndexedDKB's own doc comment) while capping worst-case task size.
async function scoreTextMatches(index, termFrequency, rawScore, budget) {
  for (const [term, count] of termFrequency) {
    scoreTextMatchesForTerm(index, term, count, rawScore);
    await maybeYield(budget);
  }
}

// Mirrors the original's per-term-iteration DC boost exactly, including its
// (pre-existing, unchanged-by-D16-7) quirk of multiplying by queryTerms.length
// rather than being a flat one-time bonus - see the equivalence test.
function scoreDiagnosticCodeMatches(
  index,
  query,
  isDCQuery,
  termCount,
  rawScore,
) {
  if (!isDCQuery || termCount === 0) return;
  for (const [dc, entryIndices] of index.dcGroups) {
    if (!query.includes(dc)) continue;
    for (const i of entryIndices) rawScore[i] += 10 * termCount;
  }
}

function scoreConditionNameMatchesForTerm(index, term, count, rawScore) {
  const candidates = candidatesForTerm(index.condTrigramIndex, term);
  if (!candidates) return;
  for (const condIdx of candidates) {
    const condition = index.distinctConds[condIdx];
    if (!condition.includes(term)) continue;
    for (const i of index.conditionNameGroups.get(condition)) {
      rawScore[i] += 3 * count;
    }
  }
}

async function scoreConditionNameMatches(
  index,
  termFrequency,
  rawScore,
  budget,
) {
  for (const [term, count] of termFrequency) {
    scoreConditionNameMatchesForTerm(index, term, count, rawScore);
    await maybeYield(budget);
  }
}

function buildTermFrequency(queryTerms) {
  const freq = new Map();
  for (const term of queryTerms) freq.set(term, (freq.get(term) || 0) + 1);
  return freq;
}

/**
 * Search a DKB index built by buildDKBIndex. Same signature/semantics as
 * the original searchDKB post-load logic: entries with score > 0, sorted
 * by score descending, top `topK`. Byte-identical output and ordering to
 * the pre-D16-7 full-scan algorithm for any query - see the equivalence
 * test for the proof. Async (not just for buildDKBIndex's benefit): the
 * text/condition-name scoring loops below also yield mid-loop on a large
 * query - see scoreTextMatches's doc comment.
 */
export async function searchIndexedDKB(index, query, topK = 10) {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const queryLower = query.toLowerCase();
  const isDCQuery = /\b\d{4}\b/.test(query);
  const intent = detectQueryIntent(queryLower);
  const termFrequency = buildTermFrequency(queryTerms);

  const rawScore = new Float64Array(index.entries.length);
  await scoreTextMatches(index, termFrequency, rawScore, makeYieldBudget());
  scoreDiagnosticCodeMatches(
    index,
    query,
    isDCQuery,
    queryTerms.length,
    rawScore,
  );
  await scoreConditionNameMatches(
    index,
    termFrequency,
    rawScore,
    makeYieldBudget(),
  );

  const scored = [];
  for (let i = 0; i < index.entries.length; i++) {
    if (rawScore[i] <= 0) continue;
    const entry = index.entries[i];
    const source = entry.metadata?.source || "";
    const type = entry.metadata?.type || "";
    let score = applySourceBoost(rawScore[i], source);
    score = applyIntentBoost(score, source, type, intent);
    scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.entry);
}
