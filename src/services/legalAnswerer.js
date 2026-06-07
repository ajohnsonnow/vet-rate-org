/**
 * legalAnswerer — turn a user question into a cited answer grounded in
 * the static legal index.
 *
 * Pipeline:
 *   1. scrubPII(query)               — never embed PII for retrieval.
 *   2. legalRag.query(cleanQuery)    — top-K chunks by cosine sim.
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
 * to answer rather than hallucinate — per the Sprint 7 DoD requirement
 * "say 'I don't have a current citation'".
 */

import { scrubPII } from "../utils/piiScrubber.js";
import { createDualLLM } from "../utils/dualLLM.js";
import { query as ragQuery } from "./legalRag.js";

const EXTRACTOR_SCHEMA = {
  applicable: "boolean — does this chunk address the user's question?",
  rule_summary:
    "string ≤ 280 chars — the rule this chunk states, in plain English",
  supporting_quote:
    "string ≤ 200 chars — verbatim sentence from the chunk that grounds rule_summary",
};

const SYNTHESIZER_INSTRUCTIONS = `You are a VA legal-research assistant. Synthesize a concise answer (≤ 4 sentences) to the user's question using ONLY the facts in EXTRACTED FIELDS below.

Rules:
- If no fact has applicable=true, answer: "I don't have a current citation that directly addresses that question." Do not speculate.
- Cite by citation string in parentheses immediately after each claim, e.g. "(38 CFR § 4.71a)".
- Never invent rules. If two facts conflict, surface the conflict.
- Plain English, no legalese unless quoting.
- No URLs in your answer — the UI renders citation links separately.`;

/**
 * Format retrieved chunks as a single untrusted-content blob the dual-LLM
 * extractor will parse. Each chunk is delimited so the extractor can map
 * its JSON output back by index.
 */
function packChunksForExtractor(chunks) {
  return chunks
    .map((c, i) => {
      const head = `[#${i}] ${c.citation} — ${c.title}`;
      return `${head}\n${c.text}`;
    })
    .join("\n\n---\n\n");
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
  const { topK = 4, threshold = 0.35 } = opts;
  const retrieve = deps.retrieve || ragQuery;

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
  const packed = packChunksForExtractor(chunks);

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

  // Normalize extractor output. The schema asks for a single object, but the
  // model may emit an array (one entry per chunk) or wrap with a key like
  // "results". Accept any shape that yields a list of {applicable, ...}.
  let facts = [];
  if (Array.isArray(extractedRaw)) facts = extractedRaw;
  else if (Array.isArray(extractedRaw?.results)) facts = extractedRaw.results;
  else if (extractedRaw && typeof extractedRaw === "object")
    facts = [extractedRaw];

  const applicable = facts.filter((f) => f && f.applicable);

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

  const synthesizerFacts = {
    user_question: cleanQuery,
    facts: applicable.map((f, i) => ({
      rule_summary: f.rule_summary,
      supporting_quote: f.supporting_quote,
      citation: chunks[i]?.citation || facts[i]?.citation,
    })),
  };

  const answerText = await dual.synthesize(
    synthesizerFacts,
    SYNTHESIZER_INSTRUCTIONS,
    { temperature: 0.2 },
  );

  const citations = chunks.slice(0, applicable.length).map((c) => ({
    citation: c.citation,
    title: c.title,
    source_url: c.source_url,
    fetched_at: c.fetched_at,
    score: c.score,
  }));

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
};
