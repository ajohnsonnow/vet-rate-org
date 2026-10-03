/**
 * Vet-Rate.org - C-File Analyzer Save plan
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * What "Save to my records" writes, worked out once. The Save panel lists
 * this plan and the save writes this plan's merge, so what the veteran reads
 * is what is stored.
 *
 * A name is saved as a current condition only when it validates as one: the
 * existing name cleanup keeps it AND the condition catalogue recognises it.
 * Everything else is listed as not recognised and left out unless the veteran
 * ticks it, so a real condition is never dropped without being shown.
 */

import { _cleanConditionName } from "./cfileAnalyzer";
import { getAllConditions } from "../services/knowledgeQuery";
import { lookupDiagnosticCodeByName } from "./hallucinationTrap";
import { normalizeConditionName } from "./conditionName";
import { buildVkbMergeFromCFile } from "./veteranContextProvider";
import { resolveTimelineDate } from "./musterCallProcessor";
import { getDocumentTypeLabel } from "./documentClassifier";

const MIN_CONTENT_WORD_LETTERS = 4;

let catalogueIndex = null;

const _phraseOf = (text) =>
  String(text || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

// Every phrase the catalogue knows a condition by (its name, aliases and
// search terms) and the words those phrases are made of.
function _catalogue() {
  if (!catalogueIndex) {
    const phrases = new Set(
      getAllConditions()
        .flatMap((d) => [
          d.conditionName,
          ...(d.aliases || []),
          ...(d.searchTerms || []),
        ])
        .map(_phraseOf)
        .filter(Boolean),
    );
    const words = new Set(
      [...phrases]
        .flatMap((phrase) => phrase.split(" "))
        .filter((w) => w.length >= MIN_CONTENT_WORD_LETTERS),
    );
    catalogueIndex = { phrases, words };
  }
  return catalogueIndex;
}

function _catalogueRecognises(name) {
  const { phrases, words } = _catalogue();
  const phrase = _phraseOf(normalizeConditionName(name));
  if (!phrase) return false;
  if (phrases.has(phrase)) return true;
  const content = phrase
    .split(" ")
    .filter((w) => w.length >= MIN_CONTENT_WORD_LETTERS);
  return content.length > 0 && content.every((w) => words.has(w));
}

/**
 * The cleaned name when the text validates as a condition, else null.
 * @param {string} rawName
 * @param {string|number|null} [diagnosticCode] a code already grounded in the
 *   rating schedule counts as a catalogue match
 */
export function validateConditionName(rawName, diagnosticCode = null) {
  const cleaned = _cleanConditionName(rawName);
  if (!cleaned) return null;
  if (diagnosticCode || lookupDiagnosticCodeByName(cleaned)) return cleaned;
  return _catalogueRecognises(cleaned) ? cleaned : null;
}

export const conditionKey = (rawName) =>
  _phraseOf(normalizeConditionName(String(rawName || "")) || rawName);

const _nameOf = (c) =>
  typeof c === "string" ? c : c?.condition || c?.name || "";

function _splitConditions(items, ticked) {
  const kept = [];
  const leftOut = [];
  for (const item of items) {
    const raw = _nameOf(item).trim();
    if (!raw) continue;
    const code = typeof item === "object" ? item.diagnosticCode : null;
    const cleaned = validateConditionName(raw, code);
    if (cleaned) kept.push({ item, name: cleaned });
    else if (ticked.has(conditionKey(raw))) kept.push({ item, name: raw });
    else leftOut.push({ name: raw, key: conditionKey(raw) });
  }
  return { kept, leftOut };
}

const _renamed = (item, name) =>
  typeof item === "string" ? name : { ...item, condition: name, name };

// The one timeline entry the document's own filing writes for this file
// (musterCallProcessor's persistFormationDocument), so the panel counts it.
function _documentEntry(extraction) {
  const filed = extraction?.deferredResult;
  if (!filed?.filename) return null;
  const label =
    getDocumentTypeLabel(filed.classification?.type) ||
    filed.classification?.type ||
    "Document";
  const { date } = resolveTimelineDate(filed, filed.filename);
  return {
    date: date || "",
    eventType: "document_import",
    description: `${label}: ${filed.filename}`,
    source: "Muster Call",
  };
}

/**
 * @param {object} analysis the analysis result shown to the veteran
 * @param {object} extraction the extraction result (carries the filed document)
 * @param {{ticked?: Iterable<string>}} [options] conditionKey values of the
 *   not-recognised names the veteran ticked
 * @returns {{
 *   vkbMergeData: object,
 *   conditions: string[],
 *   leftOut: {name: string, key: string}[],
 *   timeline: {date: string, eventType: string, description: string}[],
 * }}
 */
export function planCFileSave(analysis = {}, extraction = {}, options = {}) {
  const ticked = new Set(options.ticked || []);
  const claims = Array.isArray(analysis.potential_claims)
    ? analysis.potential_claims
    : [];
  const diagnoses = Array.isArray(analysis.mentalHealth?.diagnoses)
    ? analysis.mentalHealth.diagnoses
    : [];
  const fromClaims = _splitConditions(claims, ticked);
  const fromDiagnoses = _splitConditions(diagnoses, ticked);

  const vkbMergeData = buildVkbMergeFromCFile(
    {
      ...analysis,
      potential_claims: fromClaims.kept.map((k) => _renamed(k.item, k.name)),
      mentalHealth: {
        ...analysis.mentalHealth,
        diagnoses: fromDiagnoses.kept.map((k) => _renamed(k.item, k.name)),
      },
    },
    extraction,
  );
  const leftOut = [...fromClaims.leftOut, ...fromDiagnoses.leftOut].filter(
    (l, i, all) => all.findIndex((o) => o.key === l.key) === i,
  );
  const document = _documentEntry(extraction);
  return {
    vkbMergeData,
    conditions: vkbMergeData.medicalConditionsCurrent.map((c) => c.name),
    leftOut,
    timeline: [
      ...vkbMergeData.evidenceTimeline,
      ...(document ? [document] : []),
    ],
  };
}
