/**
 * Vet-Rate.org - Veteran Context Provider
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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
      if (vkb && vkb.personal?.fullName) {
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
  try {
    await saveDocumentToPacket({
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
    console.log(
      `[VeteranContextProvider] ✅ Saved ${toolName} results to My Packet`,
    );
  } catch (err) {
    console.error(
      `[VeteranContextProvider] ❌ Failed to save to My Packet:`,
      err,
    );
  }

  // 2) Save to VKB (structured knowledge graph)
  try {
    if (vkbDocument) {
      await addDocumentToVKB(vkbDocument);
      console.log(
        `[VeteranContextProvider] ✅ Saved ${toolName} document to VKB`,
      );
    }

    // Merge extra data directly into VKB if provided
    if (vkbMergeData) {
      const vkb = await loadVKB();
      if (vkb) {
        // Merge aiInsights
        if (vkbMergeData.aiInsights) {
          vkb.aiInsights = vkb.aiInsights || {};
          Object.assign(vkb.aiInsights, vkbMergeData.aiInsights);
        }
        // Merge keyFacts
        if (vkbMergeData.keyFacts && Array.isArray(vkbMergeData.keyFacts)) {
          vkb.keyFacts = vkb.keyFacts || [];
          vkb.keyFacts.push(...vkbMergeData.keyFacts);
        }
        // Merge claims data
        if (vkbMergeData.claims && Array.isArray(vkbMergeData.claims)) {
          vkb.claims = vkb.claims || [];
          // Avoid duplicates by checking condition names
          const existingConditions = new Set(
            vkb.claims.map((c) => c.condition?.toLowerCase()),
          );
          vkbMergeData.claims.forEach((claim) => {
            if (!existingConditions.has(claim.condition?.toLowerCase())) {
              vkb.claims.push(claim);
            }
          });
        }
        // Merge evidence items
        if (vkbMergeData.evidence && Array.isArray(vkbMergeData.evidence)) {
          vkb.evidence = vkb.evidence || [];
          vkb.evidence.push(...vkbMergeData.evidence);
        }
        // Merge medical conditions
        if (vkbMergeData.medical) {
          vkb.medical = vkb.medical || {};
          if (vkbMergeData.medical.conditions) {
            vkb.medical.conditions = vkb.medical.conditions || [];
            const existing = new Set(
              vkb.medical.conditions.map((c) => c.name?.toLowerCase()),
            );
            vkbMergeData.medical.conditions.forEach((cond) => {
              if (!existing.has(cond.name?.toLowerCase())) {
                vkb.medical.conditions.push(cond);
              }
            });
          }
          if (vkbMergeData.medical.medications) {
            vkb.medical.medications = vkb.medical.medications || [];
            vkb.medical.medications.push(...vkbMergeData.medical.medications);
          }
        }
        vkb.lastUpdated = timestamp;
        await saveVKB(vkb);
        console.log(
          `[VeteranContextProvider] ✅ Merged ${toolName} data into VKB`,
        );
      }
    }
  } catch (err) {
    console.error(`[VeteranContextProvider] ❌ Failed to save to VKB:`, err);
  }
};

// Re-export commonly-used constants so tools only need ONE import line
export { PACKET_DOC_TYPES, PACKET_DOC_LABELS };
