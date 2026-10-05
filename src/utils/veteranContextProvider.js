/**
 * Vet-Rate.org - Veteran Context Provider
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SHARED UTILITY: Every AI-powered tool in the app calls this ONE function
 * to get the veteran's full context (VKB + My Packet) before running AI.
 *
 * Think of it like a "veteran briefing packet" — before any AI tool can
 * give advice, it reads the veteran's file first. This module produces
 * that briefing in a single, standardized call.
 *
 * Usage:
 *   import { getVeteranAIContext } from '../utils/veteranContextProvider';
 *   const ctx = await getVeteranAIContext({ maxPacketTokens: 800 });
 *   // Inject ctx into your AI prompt as system-level context
 */

import {
  loadVKB,
  generateLLMContext,
  addDocumentToVKB,
  saveVKB,
} from "./veteranKnowledgeBase";
import { saveDocumentToPacket, generatePacketContext } from "./myPacketManager";
import { getSavedClaims } from "./claimsStorage";
import { getMyRatings, getVeteranProfile } from "./veteranProfile";
import { normalizeConditionName } from "./conditionName";
import {
  CFILE_EVENT_SOURCE,
  CFILE_LEGACY_EVENT_SOURCE,
  canonicalEventType,
  eventDayKey,
  eventIdentity,
  isCFileToolSource,
  isRealEventDate,
  isVeteranEdited,
} from "./eventIdentity";
import { redactVeteranIdentifiers } from "./piiScrubber";

// ============================================================
// CONDITION NORMALIZATION + RECORD AGGREGATION
// ============================================================

// Re-exported from the shared leaf module so existing importers
// (TacticalCalculator, tests) keep their `veteranContextProvider` entry-point,
// while veteranKnowledgeBase's migration path shares the exact same normalizer.
export { normalizeConditionName };

/**
 * Pure candidate builder (unit-testable): merges rated conditions from the
 * saved-claims store and VKB analyzer claims, excluding anything already in
 * My Ratings or duplicated across sources.
 */
export const buildConditionCandidates = ({
  excludeNames = [],
  claims = [],
  vkbClaims = [],
} = {}) => {
  const seen = new Set(excludeNames.map(normalizeConditionName));
  const candidates = [];

  const push = (name, rating, source) => {
    const key = normalizeConditionName(name);
    if (!key || seen.has(key)) return;
    const numeric = Number(rating);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return;
    seen.add(key);
    candidates.push({
      id: `record_${source}_${candidates.length}_${key.replace(/\s/g, "_")}`,
      name,
      rating: numeric,
      bodyPart: "",
      side: "none",
      source,
    });
  };

  claims.forEach((c) =>
    push(c.conditionName, c.selectedRating ?? c.ratingPercent, "claims"),
  );
  // vkbClaims unions two shapes during the schema transition: legacy
  // off-schema claims ({condition, rating/ratingPercent/selectedRating}) and
  // canonical medicalConditions.current ({name, ratedPercentage}). Unrated
  // C-File suggestions carry no rating and are dropped by push()'s finite-rating
  // guard, so they never reach the calculator.
  vkbClaims.forEach((c) =>
    push(
      c.condition || c.conditionName || c.name,
      c.selectedRating ?? c.ratingPercent ?? c.rating ?? c.ratedPercentage,
      "vkb",
    ),
  );
  return candidates;
};

/**
 * Gather rated conditions from the veteran's records (saved claims + VKB
 * analyzer output) that are NOT already in My Ratings, mapped to the shape
 * the rating calculators consume ({id, name, rating, bodyPart, side}).
 */
export const getLoadableConditions = async () => {
  const excludeNames = getMyRatings().map((r) => r.name);
  const claims = getSavedClaims();
  let vkbClaims = [];
  try {
    // An IndexedDB open blocked by another connection's pending upgrade
    // never settles — race it so the claims-store candidates still load.
    const vkb = await Promise.race([
      loadVKB(),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    // Dual-read during the schema transition: canonical
    // medicalConditions.current is the source of truth, but legacy vkb.claims
    // may still hold pre-migration data on VKBs that haven't been re-loaded
    // (loadVKB migrates on load, but a racing/timed-out load can return null).
    // buildConditionCandidates dedups the union by normalized name.
    const canonicalCurrent = Array.isArray(vkb?.medicalConditions?.current)
      ? vkb.medicalConditions.current
      : [];
    const legacyClaims = Array.isArray(vkb?.claims) ? vkb.claims : [];
    vkbClaims = [...canonicalCurrent, ...legacyClaims];
  } catch {
    // VKB unavailable (e.g. private browsing) — claims store still works
  }
  return buildConditionCandidates({ excludeNames, claims, vkbClaims });
};

// ============================================================
// CONTEXT LOADER  —  "Read the veteran's file"
// ============================================================

/**
 * Load the full veteran AI context string from VKB + My Packet.
 *
 * This is the SINGLE entry-point every tool should use.
 * Returns a plain-text string ready to inject into an LLM system prompt.
 *
 * @param {Object}  options
 * @param {number}  options.maxPacketTokens  — rough token budget for My Packet summary (default 800)
 * @param {boolean} options.includePacket    — whether to include My Packet context (default true)
 * @param {boolean} options.includeVKB       — whether to include VKB context (default true)
 * @returns {Promise<string>}  A ready-to-inject context string (may be empty if VKB has no data)
 */
export const getVeteranAIContext = async (options = {}) => {
  const {
    maxPacketTokens = 800,
    includePacket = true,
    includeVKB = true,
  } = options;

  let ctx = "";
  let vkb = null;

  try {
    // 1) VKB — structured knowledge graph (service history, conditions, etc.)
    if (includeVKB) {
      vkb = await loadVKB();
      // Content gate (not a fullName gate): include VKB context whenever the
      // knowledge base holds anything an AI tool can use — document-derived
      // conditions, filed claims, a timeline, or a stored C-File — even before
      // the veteran has typed their name. generateLLMContext guards each
      // section, so a partially-populated VKB renders only what it has.
      const hasVkbContent =
        !!vkb &&
        ((vkb.medicalConditions?.current?.length ?? 0) > 0 ||
          (vkb.vaClaimsHistory?.claims?.length ?? 0) > 0 ||
          (vkb.evidenceTimeline?.length ?? 0) > 0 ||
          (vkb.documentation?.cFiles?.length ?? 0) > 0 ||
          !!vkb.personal?.fullName);
      if (hasVkbContent) {
        ctx += generateLLMContext(vkb);
      }
    }

    // 2) My Packet — document archive summaries
    if (includePacket) {
      const packetCtx = await generatePacketContext({
        maxTokens: maxPacketTokens,
      });
      if (packetCtx) {
        ctx += "\n" + packetCtx;
      }
    }
  } catch (err) {
    console.warn(
      "[VeteranContextProvider] Failed to load veteran context:",
      err,
    );
  }

  // ADR-008 single enforcement point: generateLLMContext/generatePacketContext
  // already self-redact, but this is the outermost boundary every caller of
  // this module actually sees - a second pass here (using the SAME VKB
  // identifiers, so it's a cheap no-op over already-redacted text) means a
  // future piece concatenated onto `ctx` without its own redaction still
  // can't leak a direct identifier past this function.
  if (!vkb) {
    try {
      vkb = await loadVKB();
    } catch {
      // best-effort backstop only; nothing to redact against if this fails
    }
  }
  const claimNumbers = (vkb?.vaClaimsHistory?.claims || [])
    .map((c) => c.claimNumber)
    .filter(Boolean);
  // ADR-008: VKB's .personal block never carries firstName/lastName/
  // serviceNumber/mailingStreet/mailingCity - those live only on the flat
  // legacy profile store. Merge both so a veteran ingested through a path
  // that only ever populated one of the two stores is still fully covered.
  const personal = { ...getVeteranProfile(), ...vkb?.personal };
  return redactVeteranIdentifiers(ctx, personal, claimNumbers);
};

// ============================================================
// SAVE HELPERS  —  "File documents into the veteran's record"
// ============================================================

// C-File analysis output → VKB merge shape. Pure and unit-testable.
//
// Emits BOTH the legacy off-schema arrays (`claims`, `evidence`, `aiInsights`)
// that current readers like getLoadableConditions still depend on AND the
// canonical VKB schema fields, so the write is ADDITIVE (dual-write) and no
// existing reader breaks. See veteranKnowledgeBase.js VKB_SCHEMA for the
// canonical shapes.
//
// PRODUCT RULE: C-File potential_claims are AI SUGGESTIONS, not filed claims —
// they land in medicalConditions.current tagged source:"C-File Analysis"
// (read-only, no rating so calculators exclude them). They are NEVER written to
// vaClaimsHistory.claims, which is reserved for FILED claims from decision /
// denial letters.
const CFILE_SUGGESTION_SOURCE = CFILE_EVENT_SOURCE;
const CFILE_LEGACY_EVIDENCE_SOURCE = CFILE_LEGACY_EVENT_SOURCE;

const _cfileConditionName = (c) => c.condition || c.name || "";

// Suggested conditions → medicalConditions.current (source-tagged, unrated so
// buildConditionCandidates() excludes them from calculator input).
function _cfileCurrentConditions(claims, mhDiagnoses) {
  return [
    ...claims.map((c) => ({
      name: _cfileConditionName(c) || "Unknown",
      source: CFILE_SUGGESTION_SOURCE,
      serviceConnected: false,
      diagnosticCode: c.diagnosticCode || "",
      likelihood: c.likelihood || "",
      evidence: c.evidence || c.inServiceEvent || c.description || "",
    })),
    ...mhDiagnoses
      .map((d) => (typeof d === "string" ? d : d?.name || d?.condition || ""))
      .filter(Boolean)
      .map((name) => ({
        name,
        source: CFILE_SUGGESTION_SOURCE,
        serviceConnected: false,
      })),
  ]
    .filter((c) => c.name)
    .filter(
      (c, i, all) =>
        all.findIndex(
          (o) =>
            normalizeConditionName(o.name) === normalizeConditionName(c.name),
        ) === i,
    );
}

function _cfileMissingEvidence(claims) {
  return claims
    .filter((c) => c.missing_element || c.recommendation)
    .map((c) => ({
      condition: _cfileConditionName(c) || "Unknown",
      evidenceType: c.missing_element || "",
      howToObtain: c.recommendation || "",
      priority: c.likelihood || "medium",
    }));
}

const _eventText = (e) =>
  String(e.description || e.event || e.quote || "").trim();

const _sameWords = (text) => text.toLowerCase().replaceAll(/\s+/g, " ");

/**
 * The events of one analysis that can be written, and those that cannot. An
 * event without a real calendar date or without a description is never
 * written; it is returned with the reason. Two entries naming the same day
 * and words are one event, whatever category each names.
 * @param {Array} timeline the analysis' timeline
 * @returns {{events: object[], leftOut: {date: string, description: string, reason: string}[]}}
 */
export function splitCFileTimeline(timeline) {
  const events = [];
  const leftOut = [];
  const seen = new Set();
  for (const e of timeline) {
    const date = String(e?.date || "").trim();
    const description = _eventText(e || {});
    const missing = [
      !isRealEventDate(date) && "no real calendar date",
      !description && "no description",
    ].filter(Boolean);
    if (missing.length > 0) {
      leftOut.push({ date, description, reason: missing.join(" and ") });
      continue;
    }
    const item = {
      date,
      eventType: e.category || "c_file_event",
      description,
      source: CFILE_SUGGESTION_SOURCE,
      significance: e.significance || "",
    };
    const key = `${eventDayKey(date)}|${_sameWords(description)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(item);
  }
  return { events, leftOut };
}

const _cfileEvidenceTimeline = (timeline) =>
  splitCFileTimeline(timeline).events;

const _isCopyFromDocument = (e, source, sourceDocumentId) =>
  e.source === source && e.sourceDocumentId === sourceDocumentId;

// A copy saved before events carried a document id: same tool, same day, same
// canonical type (a legacy evidence item has no type, so the day alone), never
// already taken by another event of this save.
const _isLegacyCopy = (e, source, item, claimed) =>
  e.source === source &&
  e.date &&
  !e.sourceDocumentId &&
  !claimed.has(e) &&
  eventDayKey(e.date) === eventDayKey(item.date) &&
  (!e.eventType ||
    canonicalEventType(e.eventType) === canonicalEventType(item.eventType));

// The tool-written events a save replaces: every unedited event this tool
// wrote for the document, and each older copy saved before events carried a
// document id.
function _replacedCFileEvents(list, incoming, source, sourceDocumentId) {
  const replaced = new Set(
    list.filter(
      (e) =>
        _isCopyFromDocument(e, source, sourceDocumentId) && !isVeteranEdited(e),
    ),
  );
  const claimed = new Set();
  incoming.forEach((item) => {
    const legacy = list.find((e) => _isLegacyCopy(e, source, item, claimed));
    if (legacy) {
      claimed.add(legacy);
      replaced.add(legacy);
    }
  });
  return replaced;
}

// The edited event that stands for an incoming one: the same day and type
// first, else any other unpaired edited event on that day, because the model
// names the type differently on each run and the veteran's copy must not gain a
// second event beside it.
function _standInFor(edited, stoodFor, item) {
  const open = edited.filter((e) => !stoodFor.has(e));
  return (
    open.find((e) => eventIdentity(e) === eventIdentity(item)) ||
    open.find((e) => eventDayKey(e.date) === eventDayKey(item.date))
  );
}

// An event this tool wrote for another document does not stand for an incoming
// one: each document owns its events, so replacing one document's set never
// removes an event another document's save listed.
const _standsFor = (e, source, sourceDocumentId) =>
  !(
    e.source === source &&
    e.sourceDocumentId &&
    e.sourceDocumentId !== sourceDocumentId
  );

// Writes one document's events from this tool as a set: the earlier set is
// deleted and the new set written, so a re-analysis that words or counts its
// events differently leaves exactly the events it lists. Only events this tool
// wrote for this document are replaced; an event added by hand, taken from
// another tool or document, or edited by the veteran is never deleted or
// overwritten, and an incoming event the veteran's edited copy already stands
// for (same day) is not written a second time. `alsoEdited` names edited
// copies held in another list (the evidence timeline's, for the evidence
// mirror), because an edit is flagged in one place only.
function _replaceCFileEventSet({
  list,
  incoming,
  source,
  sourceDocumentId,
  keyOf,
  alsoEdited = [],
}) {
  const replaced = _replacedCFileEvents(
    list,
    incoming,
    source,
    sourceDocumentId,
  );
  const kept = list.filter((e) => !replaced.has(e));
  const edited = [
    ...kept.filter(
      (e) =>
        _isCopyFromDocument(e, source, sourceDocumentId) && isVeteranEdited(e),
    ),
    ...alsoEdited,
  ];
  const standing = new Set(
    kept.filter((e) => _standsFor(e, source, sourceDocumentId)).map(keyOf),
  );
  const stoodFor = new Set();
  const written = [];
  incoming.forEach((item) => {
    const mine = _standInFor(edited, stoodFor, item);
    if (mine) {
      stoodFor.add(mine);
      return;
    }
    const key = keyOf(item);
    if (standing.has(key)) return;
    standing.add(key);
    written.push(
      sourceDocumentId && item.source === source
        ? { ...item, sourceDocumentId }
        : item,
    );
  });
  return [...kept, ...written];
}

function _cfileEnvironmentalExposures(exposures) {
  return exposures
    .map((ex) =>
      typeof ex === "string"
        ? { type: ex, location: "", dates: "", documentation: "" }
        : {
            type: ex.type || "",
            location: ex.location || "",
            dates: ex.timeframe || ex.dates || "",
            documentation: "",
          },
    )
    .filter((e) => e.type);
}

function _cfilePresumptiveConditions(exposures) {
  return exposures.flatMap((ex) =>
    typeof ex === "object" && Array.isArray(ex.presumptive_conditions)
      ? ex.presumptive_conditions.filter(Boolean).map((cond) => ({
          condition: cond,
          exposureType: ex.type || "",
          eligibleUnder: ex.type || "",
        }))
      : [],
  );
}

export const buildVkbMergeFromCFile = (analysis = {}, extraction = {}) => {
  const claims = Array.isArray(analysis.potential_claims)
    ? analysis.potential_claims
    : [];
  const exposures = Array.isArray(analysis.exposures) ? analysis.exposures : [];
  const mhDiagnoses = Array.isArray(analysis.mentalHealth?.diagnoses)
    ? analysis.mentalHealth.diagnoses
    : [];
  const evidenceTimeline = _cfileEvidenceTimeline(
    Array.isArray(analysis.timeline) ? analysis.timeline : [],
  );

  return {
    // ── Legacy off-schema (dual-write; kept until Wave 2 repoints readers) ──
    claims: claims.map((c) => ({
      condition: _cfileConditionName(c) || "Unknown",
      status: "identified",
      source: CFILE_SUGGESTION_SOURCE,
      evidence: c.evidence || c.description || "",
      diagnosticCode: c.diagnosticCode || "",
    })),
    evidence: evidenceTimeline.map((e) => ({
      date: e.date,
      type: "c_file_event",
      eventType: e.eventType,
      description: e.description,
      significance: e.significance,
      source: CFILE_LEGACY_EVIDENCE_SOURCE,
    })),
    aiInsights: {
      cfileAnalysisSummary: analysis.summary || "",
      cfileExposures: analysis.exposures || [],
      cfileActionItems: analysis.actionItems || [],
      cfileExtraction: {
        ocrMethod: extraction.method,
        ocrUsed: extraction.ocrUsed,
        confidence: extraction.confidence,
      },
    },
    // ── Canonical VKB schema fields (new; merged by dedicated helpers) ──
    medicalConditionsCurrent: _cfileCurrentConditions(claims, mhDiagnoses),
    missingEvidence: _cfileMissingEvidence(claims),
    evidenceTimeline,
    environmentalExposures: _cfileEnvironmentalExposures(exposures),
    presumptiveConditions: _cfilePresumptiveConditions(exposures),
  };
};

/**
 * Save an AI analysis result to BOTH VKB and My Packet in one call.
 * This is the standard "save pipeline" every analyzer tool should use
 * after it produces results.
 *
 * @param {Object} opts
 * @param {string} opts.toolName          — human-readable tool name ("Denial Decoder")
 * @param {string} opts.classification    — PACKET_DOC_TYPES value (e.g., 'va_correspondence')
 * @param {string} opts.rawText           — the original input text (OCR output, pasted text, etc.)
 * @param {Object} opts.extractedData     — structured analysis results (the JSON the AI returned)
 * @param {Object} opts.vkbDocument       — optional object to pass to addDocumentToVKB()
 * @param {string} opts.fileName          — optional display filename
 * @param {number} opts.pageCount         — optional page count
 * @param {Object} opts.vkbMergeData      — optional extra fields to merge directly into VKB
 */
function _mergeAiInsightsAndKeyFacts(vkb, vkbMergeData) {
  if (vkbMergeData.aiInsights) {
    vkb.aiInsights = vkb.aiInsights || {};
    Object.assign(vkb.aiInsights, vkbMergeData.aiInsights);
  }
  if (vkbMergeData.keyFacts && Array.isArray(vkbMergeData.keyFacts)) {
    vkb.keyFacts = vkb.keyFacts || [];
    vkb.keyFacts.push(...vkbMergeData.keyFacts);
  }
}

function _mergeClaims(vkb, vkbMergeData, sourceDocumentId) {
  if (!vkbMergeData.claims || !Array.isArray(vkbMergeData.claims)) return;

  vkb.claims = vkb.claims || [];
  const existingConditions = new Set(
    vkb.claims.map((c) =>
      normalizeConditionName(c.condition || c.conditionName),
    ),
  );
  vkbMergeData.claims.forEach((claim) => {
    const key = normalizeConditionName(claim.condition || claim.conditionName);
    if (key && !existingConditions.has(key)) {
      existingConditions.add(key);
      vkb.claims.push(
        sourceDocumentId && !claim.sourceDocumentId
          ? { ...claim, sourceDocumentId }
          : claim,
      );
    }
  });
}

function _mergeEvidence(vkb, vkbMergeData, sourceDocumentId) {
  if (!vkbMergeData.evidence || !Array.isArray(vkbMergeData.evidence)) return;

  vkb.evidence = vkb.evidence || [];
  const evidenceKey = (e) =>
    `${e.date || ""}|${normalizeConditionName(e.description || e.text || "")}`;
  const fromCFile = vkbMergeData.evidence.filter(
    (item) => item.source === CFILE_LEGACY_EVIDENCE_SOURCE,
  );
  const others = vkbMergeData.evidence.filter(
    (item) => item.source !== CFILE_LEGACY_EVIDENCE_SOURCE,
  );
  if (sourceDocumentId) {
    vkb.evidence = _replaceCFileEventSet({
      list: vkb.evidence,
      incoming: fromCFile,
      source: CFILE_LEGACY_EVIDENCE_SOURCE,
      sourceDocumentId,
      keyOf: evidenceKey,
      alsoEdited: (vkb.evidenceTimeline || []).filter(
        (e) =>
          isCFileToolSource(e.source) &&
          e.sourceDocumentId === sourceDocumentId &&
          isVeteranEdited(e),
      ),
    });
  }
  const existingEvidence = new Set(vkb.evidence.map(evidenceKey));
  (sourceDocumentId ? others : vkbMergeData.evidence).forEach((item) => {
    const key = evidenceKey(item);
    if (existingEvidence.has(key)) return;
    existingEvidence.add(key);
    vkb.evidence.push(
      sourceDocumentId && !item.sourceDocumentId
        ? { ...item, sourceDocumentId }
        : item,
    );
  });
}

function _mergeMedical(vkb, vkbMergeData) {
  if (!vkbMergeData.medical) return;

  vkb.medical = vkb.medical || {};
  if (vkbMergeData.medical.conditions) {
    vkb.medical.conditions = vkb.medical.conditions || [];
    const existing = new Set(
      vkb.medical.conditions.map((c) => normalizeConditionName(c.name)),
    );
    vkbMergeData.medical.conditions.forEach((cond) => {
      const key = normalizeConditionName(cond.name);
      if (key && !existing.has(key)) {
        existing.add(key);
        vkb.medical.conditions.push(cond);
      }
    });
  }
  if (vkbMergeData.medical.medications) {
    vkb.medical.medications = vkb.medical.medications || [];
    vkb.medical.medications.push(...vkbMergeData.medical.medications);
  }
}

// ── Canonical VKB schema merges (parallel to the legacy _mergeClaims /
// _mergeEvidence above). Each is dedup-guarded and no-ops when its field is
// absent, so the write stays additive and idempotent across re-saves. ──

function _mergeMedicalConditionsCurrent(vkb, vkbMergeData) {
  if (!Array.isArray(vkbMergeData.medicalConditionsCurrent)) return;
  vkb.medicalConditions = vkb.medicalConditions || {};
  vkb.medicalConditions.current = vkb.medicalConditions.current || [];
  const existing = new Set(
    vkb.medicalConditions.current.map((c) =>
      normalizeConditionName(c.name || c.condition),
    ),
  );
  vkbMergeData.medicalConditionsCurrent.forEach((cond) => {
    const key = normalizeConditionName(cond.name);
    if (key && !existing.has(key)) {
      existing.add(key);
      vkb.medicalConditions.current.push(cond);
    }
  });
}

function _mergePresumptiveConditions(vkb, vkbMergeData) {
  if (!Array.isArray(vkbMergeData.presumptiveConditions)) return;
  vkb.medicalConditions = vkb.medicalConditions || {};
  vkb.medicalConditions.presumptive = vkb.medicalConditions.presumptive || [];
  const existing = new Set(
    vkb.medicalConditions.presumptive.map((p) =>
      normalizeConditionName(p.condition),
    ),
  );
  vkbMergeData.presumptiveConditions.forEach((p) => {
    const key = normalizeConditionName(p.condition);
    if (key && !existing.has(key)) {
      existing.add(key);
      vkb.medicalConditions.presumptive.push(p);
    }
  });
}

function _mergeEvidenceTimeline(vkb, vkbMergeData, sourceDocumentId) {
  if (!Array.isArray(vkbMergeData.evidenceTimeline)) return;
  vkb.evidenceTimeline = vkb.evidenceTimeline || [];
  const timelineKey = (e) =>
    `${e.date || ""}|${(e.eventType || "").toLowerCase()}|${normalizeConditionName(e.description || "")}`;
  const fromCFile = vkbMergeData.evidenceTimeline.filter(
    (e) => e.source === CFILE_SUGGESTION_SOURCE,
  );
  const others = vkbMergeData.evidenceTimeline.filter(
    (e) => e.source !== CFILE_SUGGESTION_SOURCE,
  );
  if (sourceDocumentId) {
    vkb.evidenceTimeline = _replaceCFileEventSet({
      list: vkb.evidenceTimeline,
      incoming: fromCFile,
      source: CFILE_SUGGESTION_SOURCE,
      sourceDocumentId,
      keyOf: timelineKey,
    });
  }
  const existing = new Set(vkb.evidenceTimeline.map(timelineKey));
  (sourceDocumentId ? others : vkbMergeData.evidenceTimeline).forEach((e) => {
    const key = timelineKey(e);
    if (existing.has(key)) return;
    existing.add(key);
    vkb.evidenceTimeline.push(e);
  });
}

function _mergeMissingEvidence(vkb, vkbMergeData) {
  if (!Array.isArray(vkbMergeData.missingEvidence)) return;
  vkb.aiInsights = vkb.aiInsights || {};
  vkb.aiInsights.missingEvidence = vkb.aiInsights.missingEvidence || [];
  const missingKey = (m) =>
    `${normalizeConditionName(m.condition)}|${(m.evidenceType || "").toLowerCase()}`;
  const existing = new Set(vkb.aiInsights.missingEvidence.map(missingKey));
  vkbMergeData.missingEvidence.forEach((m) => {
    const key = missingKey(m);
    if (!existing.has(key)) {
      existing.add(key);
      vkb.aiInsights.missingEvidence.push(m);
    }
  });
}

function _mergeEnvironmentalExposures(vkb, vkbMergeData) {
  if (!Array.isArray(vkbMergeData.environmentalExposures)) return;
  vkb.exposures = vkb.exposures || {};
  vkb.exposures.environmental = vkb.exposures.environmental || [];
  const exposureKey = (e) =>
    `${(e.type || "").toLowerCase()}|${(e.location || "").toLowerCase()}`;
  const existing = new Set(vkb.exposures.environmental.map(exposureKey));
  vkbMergeData.environmentalExposures.forEach((e) => {
    const key = exposureKey(e);
    if (!existing.has(key)) {
      existing.add(key);
      vkb.exposures.environmental.push(e);
    }
  });
}

async function _saveToPacket({
  toolName,
  classification,
  rawText,
  extractedData,
  fileName,
  pageCount,
  timestamp,
}) {
  try {
    const packetResult = await saveDocumentToPacket({
      classification,
      fileName: fileName || `${toolName}_${timestamp.slice(0, 10)}.txt`,
      rawText,
      extractedData: {
        ...extractedData,
        _analyzedBy: toolName,
        _analyzedAt: timestamp,
      },
      pageCount,
      metadata: {
        source: toolName,
        analyzedAt: timestamp,
      },
    });
    // eslint-disable-next-line no-console
    console.log(
      `[VeteranContextProvider] ✅ Saved ${toolName} results to My Packet`,
    );
    return packetResult?.documentId || null;
  } catch (err) {
    console.error(
      `[VeteranContextProvider] ❌ Failed to save to My Packet:`,
      err,
    );
    return null;
  }
}

async function _saveToVkb({
  toolName,
  vkbDocument,
  vkbMergeData,
  sourceDocumentId,
  timestamp,
  strict = false,
}) {
  try {
    if (vkbDocument) {
      await addDocumentToVKB(vkbDocument);
      // eslint-disable-next-line no-console
      console.log(
        `[VeteranContextProvider] ✅ Saved ${toolName} document to VKB`,
      );
    }

    if (!vkbMergeData) return;

    const vkb = await loadVKB();
    if (!vkb) {
      if (strict) throw new Error("The Knowledge Base could not be opened.");
      return;
    }

    _mergeAiInsightsAndKeyFacts(vkb, vkbMergeData);
    // Merge claims data (normalized names so "PTSD (chronic)" and "ptsd"
    // don't stack as duplicates; each claim keeps a pointer to the My
    // Packet document it came from)
    _mergeClaims(vkb, vkbMergeData, sourceDocumentId);
    // Merge evidence items (deduped by date + description; stamped with
    // the source document like claims above)
    _mergeEvidence(vkb, vkbMergeData, sourceDocumentId);
    _mergeMedical(vkb, vkbMergeData);

    // Canonical VKB schema (additive dual-write alongside the legacy arrays):
    // populate the fields the AI-context builders and future readers consume.
    _mergeMedicalConditionsCurrent(vkb, vkbMergeData);
    _mergePresumptiveConditions(vkb, vkbMergeData);
    _mergeEvidenceTimeline(vkb, vkbMergeData, sourceDocumentId);
    _mergeMissingEvidence(vkb, vkbMergeData);
    _mergeEnvironmentalExposures(vkb, vkbMergeData);

    vkb.lastUpdated = timestamp;
    const saved = await saveVKB(vkb);
    if (strict && saved?.success === false) {
      throw new Error(
        saved.error || "The Knowledge Base save did not complete.",
      );
    }
    // eslint-disable-next-line no-console
    console.log(`[VeteranContextProvider] ✅ Merged ${toolName} data into VKB`);
  } catch (err) {
    console.error(`[VeteranContextProvider] ❌ Failed to save to VKB:`, err);
    if (strict) throw err;
  }
}

export const saveAnalysisResults = async ({
  toolName,
  classification,
  rawText = "",
  extractedData = {},
  vkbDocument = null,
  fileName = null,
  pageCount = 1,
  vkbMergeData = null,
}) => {
  const timestamp = new Date().toISOString();

  // 1) Save to My Packet (document archive)
  const sourceDocumentId = await _saveToPacket({
    toolName,
    classification,
    rawText,
    extractedData,
    fileName,
    pageCount,
    timestamp,
  });

  // 2) Save to VKB (structured knowledge graph)
  await _saveToVkb({
    toolName,
    vkbDocument,
    vkbMergeData,
    sourceDocumentId,
    timestamp,
  });
};

// For a tool that has already filed its document: merges only the structured
// findings (conditions, timeline events) into the Knowledge Base, without a
// second My Packet record or Knowledge Base document. A merge that did not
// reach storage throws, so the caller never reports it as saved.
export const mergeAnalysisIntoVkb = ({
  toolName,
  vkbMergeData,
  sourceDocumentId = null,
}) =>
  _saveToVkb({
    toolName,
    vkbDocument: null,
    vkbMergeData,
    sourceDocumentId,
    timestamp: new Date().toISOString(),
    strict: true,
  });

// Re-export commonly-used constants so tools only need ONE import line
export { PACKET_DOC_TYPES, PACKET_DOC_LABELS } from "./myPacketManager";
