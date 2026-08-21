/**
 * legalAnswerer - turn a user question into a cited answer grounded in
 * the static legal index.
 *
 * Pipeline:
 *   1. scrubPII(query)               - never embed PII for retrieval.
 *   2. legalRag.query(cleanQuery)    - top-K chunks by cosine sim.
 *   3. createDualLLM(generateAI):
 *        a. extractor reads each chunk as untrusted text → JSON facts.
 *        b. synthesizer reads only structured JSON facts → user answer.
 *   4. Build citation list from chunks the extractor accepted.
 *
 * The dual-LLM split is the indirect-injection defense for retrieved
 * legal text: even though the eCFR fetcher sanitized HTML at ingestion,
 * any future source (M21-1, CAVC opinions, Fed-Cir slip opinions) may
 * contain prose that resembles an instruction. The extractor's strict
 * JSON output isolates that risk.
 *
 * If retrieval returns nothing above the cosine threshold, we refuse
 * to answer rather than hallucinate - per the Sprint 7 DoD requirement
 * "say 'I don't have a current citation'".
 */

import { scrubPII } from "../utils/piiScrubber.js";
import { createDualLLM } from "../utils/dualLLM.js";
import { query as ragQuery, getChunksByCitation } from "./legalRag.js";

// Parent-child expansion budget (S21). A retrieved chunk is one paragraph/table
// fragment of a §-section; the extractor grounds better when it also sees the
// rest of that section. ~3.4 chars/token matches the cfileAnalyzer budgeting
// precedent. This is a fixed conservative per-block cap - no device-tier
// detection is wired to this code path yet (S24 owns device-tiering), so we
// keep the packed context small enough for a low-end local LLM regardless of
// device. The originally-retrieved chunk is ALWAYS kept whole (it is what
// scored); siblings from the same citation fill the remaining budget.
const CHARS_PER_TOKEN = 3.4;
const PARENT_EXPANSION_TOKEN_BUDGET = 600;
const PARENT_EXPANSION_CHAR_BUDGET = Math.round(
  PARENT_EXPANSION_TOKEN_BUDGET * CHARS_PER_TOKEN,
); // ~2040 chars per retrieved chunk's expanded block

const EXTRACTOR_SCHEMA = {
  applicable: "boolean - does this chunk address the user's question?",
  rule_summary:
    "string ≤ 280 chars - the rule this chunk states, in plain English",
  supporting_quote:
    "string ≤ 200 chars - verbatim sentence from the chunk that grounds rule_summary",
};

const SYNTHESIZER_INSTRUCTIONS = `You are a VA legal-research assistant. Synthesize a concise answer (≤ 4 sentences) to the user's question using ONLY the facts in EXTRACTED FIELDS below.

Rules:
- If no fact has applicable=true, answer: "I don't have a current citation that directly addresses that question." Do not speculate.
- Cite by citation string in parentheses immediately after each claim, e.g. "(38 CFR § 4.71a)".
- Never invent rules. If two facts conflict, surface the conflict.
- Plain English, no legalese unless quoting.
- No URLs in your answer - the UI renders citation links separately.`;

/**
 * Format retrieved chunks as a single untrusted-content blob the dual-LLM
 * extractor will parse. Each chunk is delimited so the extractor can map
 * its JSON output back by index.
 */
function packChunksForExtractor(chunks) {
  return chunks
    .map((c, i) => {
      const head = `[#${i}] ${c.citation} - ${c.title}`;
      return `${head}\n${c.text}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Parent-child expansion (S21). Each retrieved chunk is expanded IN PLACE with
 * sibling chunks from the same § section (same `citation`) so the extractor
 * sees fuller section context. Returns a NEW array 1:1 with `chunks` (same
 * length, same order) - only each block's `text` grows. Keeping the 1:1
 * mapping is load-bearing: `answer()` still attributes extractor facts via
 * `chunks[f._chunkIndex]`, and every sibling shares the retrieved chunk's
 * citation/title/source_url by definition, so citation attribution stays
 * correct (guards Ab-H03) and the expanded text is confined to the extractor's
 * input - it never reaches the synthesizer.
 *
 * Budget: the retrieved chunk's own text is always kept whole; siblings are
 * added nearest-first (by position in the section) until `budgetChars` is
 * reached. A sibling too large for the remaining budget is skipped, not a hard
 * stop, so the block fills with the most-adjacent siblings that fit.
 *
 * @param {Array<Object>} chunks - retrieved chunks (each has id, citation, text)
 * @param {(citation: string) => Array<Object>} getSiblings
 * @param {number} budgetChars
 * @returns {Array<Object>}
 */
function expandChunksWithSiblings(chunks, getSiblings, budgetChars) {
  if (!Number.isFinite(budgetChars) || budgetChars <= 0) return chunks;
  const retrievedIds = new Set(chunks.map((c) => c.id));
  const SEP = "\n\n";
  return chunks.map((chunk) => {
    const family = getSiblings(chunk.citation) || [];
    const selfPos = family.findIndex((s) => s.id === chunk.id);
    if (selfPos === -1) return chunk; // chunk not found in its own family - skip
    const candidates = family
      .map((s, pos) => ({ s, pos }))
      .filter(({ s }) => s.id !== chunk.id && !retrievedIds.has(s.id))
      // nearest-first; when equidistant, the following chunk (higher pos) first
      // so expanded text reads forward from the retrieved fragment.
      .sort((a, b) => {
        const da = Math.abs(a.pos - selfPos);
        const db = Math.abs(b.pos - selfPos);
        return da - db || b.pos - a.pos;
      });

    let text = chunk.text;
    let used = text.length;
    let expanded = false;
    for (const { s } of candidates) {
      const addLen = SEP.length + s.text.length;
      if (used + addLen > budgetChars) continue;
      text += SEP + s.text;
      used += addLen;
      expanded = true;
    }
    return expanded ? { ...chunk, text } : chunk;
  });
}

/**
 * Normalize the extractor's raw output into a flat facts array, then filter to
 * only entries the extractor marked applicable=true. Pairs each fact with its
 * ORIGINAL chunk index before filtering, so an applicable fact is attributed
 * to the chunk it was extracted from - not the Nth chunk (guards Ab-H03; see
 * answer() below for the full history of that bug).
 */
function extractApplicableFacts(extractedRaw) {
  // Normalize extractor output. The schema asks for a single object, but the
  // model may emit an array (one entry per chunk) or wrap with a key like
  // "results". Accept any shape that yields a list of {applicable, ...}.
  let facts = [];
  if (Array.isArray(extractedRaw)) facts = extractedRaw;
  else if (Array.isArray(extractedRaw?.results)) facts = extractedRaw.results;
  else if (extractedRaw && typeof extractedRaw === "object")
    facts = [extractedRaw];

  return facts
    .map((f, idx) => (f ? { ...f, _chunkIndex: idx } : f))
    .filter((f) => f && f.applicable);
}

/**
 * Build the synthesizer's structured facts payload, synthesize the answer
 * text, and build the citation list - all from the same applicable facts so
 * citations stay attributed to the chunk each fact was extracted from.
 */
async function synthesizeAnswer(dual, cleanQuery, applicable, chunks) {
  const synthesizerFacts = {
    user_question: cleanQuery,
    facts: applicable.map((f) => ({
      rule_summary: f.rule_summary,
      supporting_quote: f.supporting_quote,
      citation: chunks[f._chunkIndex]?.citation || f.citation,
    })),
  };

  const answerText = await dual.synthesize(
    synthesizerFacts,
    SYNTHESIZER_INSTRUCTIONS,
    { temperature: 0.2 },
  );

  const citations = applicable
    .map((f) => chunks[f._chunkIndex])
    .filter(Boolean)
    .map((c) => ({
      citation: c.citation,
      title: c.title,
      source_url: c.source_url,
      fetched_at: c.fetched_at,
      score: c.score,
    }));

  return { answerText, citations };
}

/**
 * Answer a user legal question, grounded in the retrieved index.
 *
 * @param {string} question
 * @param {Object} deps
 * @param {(prompt: string, options?: Object) => Promise<string>} deps.generateAI
 * @param {(text: string, opts?: Object) => Promise<{chunks: Array<Object>}>} [deps.retrieve]
 * @param {Object} [opts]
 * @param {number} [opts.topK=4]
 * @param {number} [opts.threshold=0.35]
 * @param {boolean} [opts.expandContext=true] - expand each retrieved chunk with
 *   sibling chunks from the same § section for the extractor (never the synthesizer)
 * @param {number} [opts.expansionCharBudget=PARENT_EXPANSION_CHAR_BUDGET]
 * @returns {Promise<{
 *   answer: string,
 *   citations: Array<{citation: string, title: string, source_url: string, fetched_at: string, score: number}>,
 *   retrieved: number,
 *   injectionAttempt: boolean,
 *   refusal: boolean,
 * }>}
 */
export async function answer(question, deps, opts = {}) {
  if (!deps || typeof deps.generateAI !== "function") {
    throw new TypeError("legalAnswerer.answer: deps.generateAI required");
  }
  const {
    topK = 4,
    threshold = 0.35,
    expandContext = true,
    expansionCharBudget = PARENT_EXPANSION_CHAR_BUDGET,
  } = opts;
  const retrieve = deps.retrieve || ragQuery;
  const getSiblings = deps.getSiblings || getChunksByCitation;

  const cleanQuery = scrubPII(question || "", {
    aggressive: true,
  }).scrubbedText;
  const { chunks } = await retrieve(cleanQuery, { topK, threshold });

  if (!chunks || chunks.length === 0) {
    return {
      answer:
        "I don't have a current citation that directly addresses that question.",
      citations: [],
      retrieved: 0,
      injectionAttempt: false,
      refusal: true,
    };
  }

  const dual = createDualLLM(deps.generateAI);
  // Parent-child expansion feeds ONLY the extractor's untrusted-content blob.
  // `chunks` (the originals) stays the attribution source below, so expanded
  // sibling text never reaches the synthesizer and _chunkIndex stays 1:1.
  const forExtractor = expandContext
    ? expandChunksWithSiblings(chunks, getSiblings, expansionCharBudget)
    : chunks;
  const packed = packChunksForExtractor(forExtractor);

  const { fields: extractedRaw, raw: extractRaw } = await dual.extract(
    packed,
    EXTRACTOR_SCHEMA,
    { contentLabel: "RETRIEVED LEGAL CHUNKS" },
  );

  const injectionAttempt = !!(
    extractedRaw && extractedRaw._injection_attempt === true
  );

  if (injectionAttempt) {
    return {
      answer:
        "I detected an instruction inside the retrieved sources that asked me to change my behavior. I refused. No answer was synthesized.",
      citations: [],
      retrieved: chunks.length,
      injectionAttempt: true,
      refusal: true,
    };
  }

  // Pairs each fact with its ORIGINAL chunk index before filtering, so an
  // applicable fact is attributed to the chunk it was extracted from - not the
  // Nth chunk. Previously a filtered index read the unfiltered chunks array, so a
  // non-applicable chunk #0 mis-attributed its citation to the first hit (Ab-H03).
  const applicable = extractApplicableFacts(extractedRaw);

  if (applicable.length === 0) {
    return {
      answer:
        "I don't have a current citation that directly addresses that question.",
      citations: [],
      retrieved: chunks.length,
      injectionAttempt: false,
      refusal: true,
      _extractRaw: extractRaw,
    };
  }

  const { answerText, citations } = await synthesizeAnswer(
    dual,
    cleanQuery,
    applicable,
    chunks,
  );

  return {
    answer: String(answerText).trim(),
    citations,
    retrieved: chunks.length,
    injectionAttempt: false,
    refusal: false,
  };
}

export const _internals = {
  EXTRACTOR_SCHEMA,
  SYNTHESIZER_INSTRUCTIONS,
  packChunksForExtractor,
  expandChunksWithSiblings,
  PARENT_EXPANSION_CHAR_BUDGET,
};
