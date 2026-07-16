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
import {
  saveDocumentToPacket,
  generatePacketContext,
  PACKET_DOC_TYPES,
  PACKET_DOC_LABELS,
} from "./myPacketManager";
import { getSavedClaims } from "./claimsStorage";
import { getMyRatings } from "./veteranProfile";

// ============================================================
// CONDITION NORMALIZATION + RECORD AGGREGATION
// ============================================================

/**
 * Normalize a condition name for duplicate detection.
 * "Tinnitus (Service Connected)" / "TINNITUS" / " tinnitus. " all collapse
 * to "tinnitus" so analyzer output, saved claims, and manual entries merge
 * instead of stacking duplicates.
 */
export const normalizeConditionName = (name) => {
  if (typeof name !== "string") return "";
  return (
    name
      .toLowerCase()
      // eslint-disable-next-line sonarjs/slow-regex -- single negated character class, standard linear-time pattern
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
};

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
  vkbClaims.forEach((c) =>
    push(
      c.condition || c.conditionName,
      c.selectedRating ?? c.ratingPercent ?? c.rating,
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
    vkbClaims = Array.isArray(vkb?.claims) ? vkb.claims : [];
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

  try {
    // 1) VKB — structured knowledge graph (service history, conditions, etc.)
    if (includeVKB) {
      const vkb = await loadVKB();
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

  return ctx;
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
const CFILE_SUGGESTION_SOURCE = "C-File Analysis";

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
  ].filter((c) => c.name);
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

function _cfileEvidenceTimeline(timeline) {
  return timeline.map((e) => ({
    date: e.date || "",
    eventType: e.category || "c_file_event",
    description: e.description || e.event || e.quote || "",
    source: CFILE_SUGGESTION_SOURCE,
    significance: e.significance || "",
  }));
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
  const timeline = Array.isArray(analysis.timeline) ? analysis.timeline : [];
  const exposures = Array.isArray(analysis.exposures) ? analysis.exposures : [];
  const mhDiagnoses = Array.isArray(analysis.mentalHealth?.diagnoses)
    ? analysis.mentalHealth.diagnoses
    : [];

  return {
    // ── Legacy off-schema (dual-write; kept until Wave 2 repoints readers) ──
    claims: claims.map((c) => ({
      condition: _cfileConditionName(c) || "Unknown",
      status: "identified",
      source: CFILE_SUGGESTION_SOURCE,
      evidence: c.evidence || c.description || "",
      diagnosticCode: c.diagnosticCode || "",
    })),
    evidence: timeline.map((e) => ({
      date: e.date,
      type: "c_file_event",
      description: e.event || e.description || "",
      source: "C-File",
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
    evidenceTimeline: _cfileEvidenceTimeline(timeline),
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
  const existingEvidence = new Set(vkb.evidence.map(evidenceKey));
  vkbMergeData.evidence.forEach((item) => {
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

function _mergeEvidenceTimeline(vkb, vkbMergeData) {
  if (!Array.isArray(vkbMergeData.evidenceTimeline)) return;
  vkb.evidenceTimeline = vkb.evidenceTimeline || [];
  const timelineKey = (e) =>
    `${e.date || ""}|${(e.eventType || "").toLowerCase()}|${normalizeConditionName(e.description || "")}`;
  const existing = new Set(vkb.evidenceTimeline.map(timelineKey));
  vkbMergeData.evidenceTimeline.forEach((e) => {
    const key = timelineKey(e);
    if (!existing.has(key)) {
      existing.add(key);
      vkb.evidenceTimeline.push(e);
    }
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
    if (!vkb) return;

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
    _mergeEvidenceTimeline(vkb, vkbMergeData);
    _mergeMissingEvidence(vkb, vkbMergeData);
    _mergeEnvironmentalExposures(vkb, vkbMergeData);

    vkb.lastUpdated = timestamp;
    await saveVKB(vkb);
    // eslint-disable-next-line no-console
    console.log(`[VeteranContextProvider] ✅ Merged ${toolName} data into VKB`);
  } catch (err) {
    console.error(`[VeteranContextProvider] ❌ Failed to save to VKB:`, err);
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

// Re-export commonly-used constants so tools only need ONE import line
export { PACKET_DOC_TYPES, PACKET_DOC_LABELS };
