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
import {
  buildVkbMergeFromCFile,
  splitCFileTimeline,
} from "./veteranContextProvider";
import { resolveTimelineDate } from "./musterCallProcessor";
import { getDocumentTypeLabel } from "./documentClassifier";

const MIN_CONTENT_WORDS = 2;
const MIN_CONTENT_WORD_LETTERS = 4;

let catalogueIndex = null;

const _phraseOf = (text) =>
  String(text || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

// The phrases the catalogue knows a condition by: its name and aliases are
// whole names; its search terms are only ever a part of one. The words are
// those every phrase is made of.
function _catalogue() {
  if (!catalogueIndex) {
    const conditions = getAllConditions();
    const names = new Set(
      conditions
        .flatMap((d) => [d.conditionName, ...(d.aliases || [])])
        .map(_phraseOf)
        .filter(Boolean),
    );
    const words = new Set(
      [
        ...names,
        ...conditions.flatMap((d) => (d.searchTerms || []).map(_phraseOf)),
      ]
        .flatMap((phrase) => phrase.split(" "))
        .filter((w) => w.length >= MIN_CONTENT_WORD_LETTERS),
    );
    catalogueIndex = { names, words };
  }
  return catalogueIndex;
}

// A name the catalogue holds whole, or a wording of two or more content words
// the catalogue knows. One everyday word that merely occurs inside condition
// names ("Hearing", "Back pay") is not a condition.
function _catalogueRecognises(name) {
  const { names, words } = _catalogue();
  const phrase = _phraseOf(normalizeConditionName(String(name).split("(")[0]));
  if (!phrase) return false;
  if (names.has(phrase)) return true;
  const content = phrase
    .split(" ")
    .filter((w) => w.length >= MIN_CONTENT_WORD_LETTERS);
  return (
    content.length >= MIN_CONTENT_WORDS && content.every((w) => words.has(w))
  );
}

/**
 * The cleaned name when the text validates as a condition, else null. Only the
 * name decides: a diagnostic code the model attached never makes a word a
 * condition.
 * @param {string} rawName
 */
export function validateConditionName(rawName) {
  const raw = String(rawName || "").trim();
  if (_catalogue().names.has(_phraseOf(raw))) return raw;
  const cleaned = _cleanConditionName(rawName);
  if (!cleaned) return null;
  if (lookupDiagnosticCodeByName(cleaned)) return cleaned;
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
    const cleaned = validateConditionName(raw);
    if (cleaned) {
      kept.push({ item, name: cleaned });
      continue;
    }
    const key = conditionKey(raw);
    const isTicked = ticked.has(key);
    if (isTicked) kept.push({ item, name: raw });
    leftOut.push({ name: raw, key, ticked: isTicked });
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
 *   leftOut: {name: string, key: string, ticked: boolean}[],
 *   timeline: {date: string, eventType: string, description: string}[],
 *   timelineLeftOut: {date: string, description: string, reason: string}[],
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
    timelineLeftOut: splitCFileTimeline(
      Array.isArray(analysis.timeline) ? analysis.timeline : [],
    ).leftOut,
    timeline: [
      ...vkbMergeData.evidenceTimeline,
      ...(document ? [document] : []),
    ],
  };
}
