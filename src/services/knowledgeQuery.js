/**
 * knowledgeQuery — the unified Knowledge Base access layer (S30).
 *
 * ONE import surface every in-app KB consumer reads through, so no feature has
 * to know which flat file, service, or shard a given fact lives in. It is a
 * thin BOUNDARY over the already-proven implementations — it binds the data and
 * delegates; it does NOT re-implement search, scoring, or retrieval. Behavior
 * is therefore identical to the pre-S30 direct-import path by construction, and
 * every existing impl test (searchUtils, disabilityCount, secondaryClaimsEngine,
 * legalRag, dkbShardedRag) keeps passing untouched.
 *
 * What lives here:
 *   • Structured lookups over the bundled flat files (conditions, secondary
 *     links, DBQ logic, PACT mapping, regulations reference) — synchronous,
 *     because the JSON is import-inlined and available at module-eval time.
 *   • Semantic retrieval fan-out (queryLegal → legalRag; queryCorpus →
 *     dkbShardedRag/S29) — async, the entry point for "query any shard without
 *     knowing its file format."
 *
 * What deliberately does NOT live here (over-engineering / regression guard):
 *   • The three distinct retrieval algorithms are NOT collapsed into one.
 *     legalRag (Ask-the-Regs), dkbShardedRag (S29 full-corpus), and
 *     aiSystemPrompts.searchDKB (prompt-context injection) each have their own
 *     tuned scoring and eval baseline; unifying the ALGORITHMS is a behavior
 *     change that needs its own eval-gated sprint, not this access-layer one.
 *   • Prompt assembly (buildDKBContext, spotlight fencing) stays in
 *     aiSystemPrompts.js — that is a prompt-security concern, one layer above
 *     data access, and importing it here would create a dependency cycle.
 *   • Build-time Node validators (scripts/validate-dkb.mjs, etc.) intentionally
 *     keep reading the raw files directly: a validator must inspect the
 *     source-of-truth on disk, not a facade over it, or it cannot detect
 *     corruption in the file it is meant to guard.
 */

import disabilityDataJson from "../data/disabilityData.json";
import dbqLogicMap from "../data/dbq_logic_map.json";
import pactActData from "../data/pactActData.json";
import cfr3Regulations from "../data/cfr3Regulations.json";
import title38Regulations from "../data/title38Regulations.json";
import {
  getMultinationalCategories,
  getMultinationalByCategory,
  searchMultinational,
} from "../data/multinationalContent.js";

import {
  searchDisabilityData,
  getSearchSuggestions,
} from "../utils/searchUtils.js";
import {
  getDisabilityCount,
  getFormattedDisabilityCount,
} from "../utils/disabilityCount.js";
import { findSecondaryClaims } from "../utils/secondaryClaimsEngine.js";
import { query as legalRagQuery } from "./legalRag.js";
import { queryShards } from "./dkbShardedRag.js";

// Canonicalize the conditions dataset to the { disabilities, synonymDictionary }
// shape searchUtils expects, tolerating the historical bare-array format so the
// same defensive shim lives in exactly one place instead of five.
const CONDITION_DATASET = Array.isArray(disabilityDataJson)
  ? { disabilities: disabilityDataJson, synonymDictionary: {} }
  : {
      disabilities: disabilityDataJson.disabilities || [],
      synonymDictionary: disabilityDataJson.synonymDictionary || {},
    };

// ─────────────────────────────────────────────────────────────────────────────
// Conditions — disabilityData.json
// ─────────────────────────────────────────────────────────────────────────────

/** Raw conditions array (748 rating-schedule entries). */
export function getAllConditions() {
  return CONDITION_DATASET.disabilities;
}

/** Full dataset ({ disabilities, synonymDictionary }) for callers that need both. */
export function getConditionDataset() {
  return CONDITION_DATASET;
}

/** Authoritative live count (delegates to the single-source-of-truth util). */
export function getConditionCount() {
  return getDisabilityCount();
}

/** Display-formatted count, e.g. "748" or "748 conditions". */
export function getFormattedConditionCount(includeLabel = false) {
  return getFormattedDisabilityCount(includeLabel);
}

/**
 * Look up one condition by diagnostic code. String-coerced on both sides so a
 * numeric or string code both resolve the (string) `diagnosticCode` field.
 */
export function getConditionByCode(diagnosticCode) {
  if (diagnosticCode == null) return undefined;
  const dc = String(diagnosticCode);
  return CONDITION_DATASET.disabilities.find(
    (d) => String(d.diagnosticCode) === dc,
  );
}

/** Scored full-text/fuzzy/synonym search (searchUtils, data pre-bound). */
export function searchConditions(term) {
  return searchDisabilityData(term, CONDITION_DATASET);
}

/** Autocomplete suggestions (searchUtils, data pre-bound). */
export function getConditionSuggestions(term, limit = 10) {
  return getSearchSuggestions(term, CONDITION_DATASET, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary conditions — secondary_conditions_db.json (via 38 CFR § 3.310 engine)
// ─────────────────────────────────────────────────────────────────────────────

/** Prioritized secondary-claim suggestions for a list of service-connected names. */
export function findSecondaryConditions(userDisabilities) {
  return findSecondaryClaims(userDisabilities);
}

// ─────────────────────────────────────────────────────────────────────────────
// DBQ logic — dbq_logic_map.json
// ─────────────────────────────────────────────────────────────────────────────

/** Whole DBQ logic map, keyed by condition slug (migraines, ptsd, …). */
export function getDbqLogicMap() {
  return dbqLogicMap;
}

/** DBQ logic entry by its map key (condition slug). */
export function getDbqLogic(key) {
  return dbqLogicMap[key];
}

/** DBQ logic entry by its `diagnostic_code` field. */
export function getDbqLogicByDiagnosticCode(diagnosticCode) {
  if (diagnosticCode == null) return undefined;
  const code = String(diagnosticCode);
  const key = Object.keys(dbqLogicMap).find(
    (k) => String(dbqLogicMap[k]?.diagnostic_code) === code,
  );
  return key ? dbqLogicMap[key] : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PACT Act — pactActData.json
// ─────────────────────────────────────────────────────────────────────────────

/** Whole PACT Act dataset (info, exposure categories, presumptives, DC mapping). */
export function getPactActData() {
  return pactActData;
}

/** Presumptive-exposure mapping for a diagnostic code, or undefined. */
export function getPactMappingByCode(diagnosticCode) {
  if (diagnosticCode == null) return undefined;
  return pactActData.diagnosticCodePactMapping?.[String(diagnosticCode)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Multinational / OCONUS service — src/data/multinational/*.json (S38)
// ─────────────────────────────────────────────────────────────────────────────

/** The four multinational category files (presumptive-overseas, FMP, OCONUS, allied). */
export function getMultinationalContent() {
  return getMultinationalCategories();
}

/** Provisions for one category (e.g. "foreign_medical_program"), each source-cited. */
export function getMultinationalCategory(category) {
  return getMultinationalByCategory(category);
}

/** Substring search across all multinational provisions (name/description/keyPoints). */
export function queryMultinational(term) {
  return searchMultinational(term);
}

// ─────────────────────────────────────────────────────────────────────────────
// Regulations reference — cfr3Regulations.json / title38Regulations.json
// ─────────────────────────────────────────────────────────────────────────────

/** 38 CFR Part 3 reference document. */
export function getCfr3Regulations() {
  return cfr3Regulations;
}

/** Title 38 (Parts 4/19/20, pension, BVA appeals) reference document. */
export function getTitle38Regulations() {
  return title38Regulations;
}

/** Both regulation reference documents together. */
export function getRegulations() {
  return { cfr3: cfr3Regulations, title38: title38Regulations };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic retrieval — the "query any shard without knowing its format" surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hybrid BM25+dense retrieval over the eCFR legal index (the Ask-the-Regs
 * engine). Returns { query, version, chunks[] }. Untrusted chunk text — route
 * through legalAnswerer's dual-LLM split before an LLM sees it.
 */
export async function queryLegal(text, opts = {}) {
  return legalRagQuery(text, opts);
}

/**
 * Full-corpus cross-shard retrieval (S29). Fans out over every populated shard
 * under public/dkb-index/, authority-tier-aware, device-tier gated. Returns
 * { query, shards[], chunks[] } with each chunk carrying its authority_tier and
 * dkb_id. Same untrusted-content discipline as queryLegal.
 */
export async function queryCorpus(text, opts = {}) {
  return queryShards(text, opts);
}

export default {
  getAllConditions,
  getConditionDataset,
  getConditionCount,
  getFormattedConditionCount,
  getConditionByCode,
  searchConditions,
  getConditionSuggestions,
  findSecondaryConditions,
  getDbqLogicMap,
  getDbqLogic,
  getDbqLogicByDiagnosticCode,
  getPactActData,
  getPactMappingByCode,
  getMultinationalContent,
  getMultinationalCategory,
  queryMultinational,
  getCfr3Regulations,
  getTitle38Regulations,
  getRegulations,
  queryLegal,
  queryCorpus,
};
