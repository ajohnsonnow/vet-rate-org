/**
 * Derived, read-only summarization of everything already stored in the VKB.
 *
 * Deliberately deterministic — no model call anywhere in this module. My Packet
 * is what a veteran hands to a VSO or attaches to a claim, so a summary line
 * here has to be traceable to a stored field in a named document. Narrative
 * synthesis belongs to the retrieval work, behind its own citations.
 */
import { normalizeConditionName } from "./conditionName";

const asArray = (value) => (Array.isArray(value) ? value : []);

const cleanString = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const firstValue = (source, keys) => {
  for (const key of keys) {
    const raw = source?.[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    const text = cleanString(raw);
    if (text) return text;
  }
  return null;
};

/**
 * Extracted lists hold either plain strings or objects; both must render.
 * Code and title are kept together — an MOS code is what drives presumptive
 * exposure lookups, so collapsing "11B" into "Infantryman" loses claim signal.
 */
const labelOf = (item) => {
  if (typeof item === "string") return cleanString(item);
  if (!item || typeof item !== "object") return null;
  const name = firstValue(item, [
    "name",
    "title",
    "condition",
    "conditionName",
    "label",
    "description",
    "text",
  ]);
  const code = firstValue(item, ["code"]);
  if (name && code && name !== code) return `${code} — ${name}`;
  return name || code;
};

const uniqueLabels = (items) => {
  const seen = new Set();
  const out = [];
  for (const label of asArray(items).map(labelOf)) {
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
};

// OCR occasionally drops the space between two words entirely (e.g.
// "agoraphobiaand depressive disorder" alongside a clean "agoraphobia and
// depressive disorder" from a different page/document), so a normal
// whitespace-collapse can't unify them -- there's no run of whitespace to
// collapse, just a missing single space. Stripping ALL whitespace before
// comparing is a targeted, conditions-only dedup key (kept local to this
// module rather than changing the shared normalizeConditionName, which the
// VKB write/read paths also depend on).
const CONDITION_LENGTH_RANGE = [3, 120];

const looksLikeCondition = (label) => {
  if (!label) return false;
  const [min, max] = CONDITION_LENGTH_RANGE;
  if (label.length < min || label.length > max) return false;
  // Reject fragments with no letters at all -- page numbers, punctuation
  // runs, and other OCR noise occasionally land in a condition list.
  return /[a-z]/i.test(label);
};

// Scalar fields worth surfacing, in display order. Parsers disagree on casing
// and naming across document types, so each entry lists every alias seen.
const SCALAR_FINDINGS = [
  { label: "Branch", keys: ["branch", "branchOfService", "branch_of_service"] },
  { label: "Rank", keys: ["rank", "rankAtDischarge", "payGrade"] },
  { label: "Entered service", keys: ["entryDate", "serviceStartDate"] },
  { label: "Separated", keys: ["separationDate", "serviceEndDate"] },
  {
    label: "Character of service",
    keys: ["characterOfService", "dischargeStatus", "discharge_status"],
  },
  {
    label: "Claim / file number",
    keys: ["claimNumber", "fileNumber", "veteranFileNumber"],
  },
  { label: "Decision date", keys: ["decisionDate", "dateOfDecision"] },
  { label: "Combined rating", keys: ["combinedRating", "combined_rating"] },
  { label: "Provider", keys: ["provider", "facility", "examiner"] },
  { label: "Date range", keys: ["dateRange", "recordDateRange"] },
];

const LIST_FINDINGS = [
  { label: "MOS", keys: ["mos", "occupations"] },
  { label: "Awards", keys: ["awards", "decorations"] },
  { label: "Deployments", keys: ["deployments"] },
  { label: "Exposures", keys: ["exposures"] },
];

const CONDITION_KEYS = [
  "conditions",
  "ratedConditions",
  "diagnoses",
  "medicalConditions",
];

const CLAIM_KEYS = ["potential_claims", "potentialClaims", "claims"];

const collectScalarFindings = (data) =>
  SCALAR_FINDINGS.map(({ label, keys }) => ({
    label,
    value: firstValue(data, keys),
  })).filter((entry) => entry.value);

const collectListFindings = (data) =>
  LIST_FINDINGS.map(({ label, keys }) => {
    const values = keys.flatMap((key) => uniqueLabels(data?.[key]));
    return { label, values: uniqueLabels(values) };
  }).filter((entry) => entry.values.length > 0);

const collectFromKeys = (data, keys) =>
  uniqueLabels(keys.flatMap((key) => asArray(data?.[key])));

/** Code Sheet conditions are the authoritative rated list when a C-File has one. */
const collectCodeSheetConditions = (data) =>
  uniqueLabels(asArray(data?.codeSheet?.conditions));

const documentDate = (doc) =>
  cleanString(doc?.uploadDate)?.split("T")[0] || null;

/**
 * Flatten one stored VKB document into everything worth showing about it.
 * @param {object} doc - a `vkb.documentation.<category>[]` entry
 * @param {{key?: string, label?: string, icon?: string}} [categoryMeta]
 */
export function buildDocumentFindings(doc, categoryMeta = {}) {
  const data = doc?.extractedData || {};
  const scalars = collectScalarFindings(data);
  const lists = collectListFindings(data);
  const conditions = uniqueLabels([
    ...collectFromKeys(data, CONDITION_KEYS),
    ...collectCodeSheetConditions(data),
  ]).filter(looksLikeCondition);
  const potentialClaims = collectFromKeys(data, CLAIM_KEYS);
  const timeline = asArray(data.timeline);
  const segments = asArray(data.segments);

  return {
    id: doc?.id || null,
    fileName: doc?.fileName || "Untitled document",
    categoryKey: categoryMeta.key || doc?.category || null,
    categoryLabel: categoryMeta.label || null,
    icon: categoryMeta.icon || "📄",
    classification: doc?.classification || null,
    analyzedOn: documentDate(doc),
    pageCount: Number(doc?.pageCount) || null,
    fileSize: Number(doc?.fileSize) || null,
    ocrUsed: Boolean(doc?.ocrUsed),
    summary: firstValue(data, ["summary", "overview", "narrative"]),
    scalars,
    lists,
    conditions,
    potentialClaims,
    // Raw rows kept by reference so the existing claim/timeline cards can
    // render them; the label lists above are for counting and grouping.
    claimObjects: CLAIM_KEYS.flatMap((key) => asArray(data[key])),
    timeline,
    timelineCount: timeline.length,
    segmentCount: segments.length,
    inventoryCount: asArray(data.inventory?.inventory).length,
    // Surfaced, not swallowed: parseDocumentByType degrades to a raw-text
    // record when a parser throws, and a document that stored no structured
    // data should say so rather than render as an empty card.
    parseError: cleanString(data.parseError),
    findingCount:
      scalars.length +
      lists.reduce((sum, entry) => sum + entry.values.length, 0) +
      conditions.length +
      potentialClaims.length,
  };
}

/** Walk the getAllDocumentsByCategory() shape into a flat findings list. */
export function buildAllDocumentFindings(documentsByCategory) {
  if (!documentsByCategory) return [];
  return Object.entries(documentsByCategory).flatMap(([key, category]) =>
    asArray(category?.documents).map((doc) =>
      buildDocumentFindings(doc, {
        key,
        label: category?.label,
        icon: category?.icon,
      }),
    ),
  );
}

const upsertCondition = (index, name, patch) => {
  const key = normalizeConditionName(name).replace(/\s+/g, "");
  if (!key) return null;
  const existing = index.get(key);
  if (existing) return Object.assign(existing, patch);
  const entry = {
    key,
    name,
    ratedPercentage: null,
    serviceConnected: false,
    documents: [],
    sources: [],
    ...patch,
  };
  index.set(key, entry);
  return entry;
};

const addProvenance = (entry, { document, source }) => {
  if (!entry) return;
  if (document && !entry.documents.includes(document))
    entry.documents.push(document);
  if (source && !entry.sources.includes(source)) entry.sources.push(source);
};

const indexStoredConditions = (index, vkb) => {
  for (const condition of asArray(vkb?.medicalConditions?.current)) {
    const name = condition?.name || condition?.condition;
    const rating = Number(condition?.ratedPercentage);
    const entry = upsertCondition(index, name, {
      ...(Number.isFinite(rating) && { ratedPercentage: rating }),
      ...(condition?.serviceConnected && { serviceConnected: true }),
    });
    addProvenance(entry, {
      source: condition?.source || "Veteran Knowledge Base",
    });
  }
};

const indexDocumentConditions = (index, documentFindings) => {
  for (const doc of documentFindings) {
    for (const name of doc.conditions) {
      addProvenance(upsertCondition(index, name, {}), {
        document: doc.fileName,
        source: doc.categoryLabel || doc.classification,
      });
    }
  }
};

/**
 * Group every condition mentioned anywhere in the packet, with the documents
 * that mention it. Corroboration count is a document count, not a judgement
 * about evidentiary strength.
 */
export function buildConditionSynthesis(vkb, documentFindings = []) {
  const index = new Map();
  indexStoredConditions(index, vkb);
  indexDocumentConditions(index, documentFindings);

  return [...index.values()]
    .map((entry) => ({ ...entry, documentCount: entry.documents.length }))
    .sort(
      (a, b) =>
        b.documentCount - a.documentCount ||
        (b.ratedPercentage || 0) - (a.ratedPercentage || 0) ||
        a.name.localeCompare(b.name),
    );
}

const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const buildStats = (vkb, documentFindings, conditions) => ({
  documents: documentFindings.length,
  pages: documentFindings.reduce((sum, doc) => sum + (doc.pageCount || 0), 0),
  conditions: conditions.length,
  corroborated: conditions.filter((c) => c.documentCount > 1).length,
  serviceConnected: conditions.filter((c) => c.serviceConnected).length,
  rated: conditions.filter((c) => Number.isFinite(c.ratedPercentage)).length,
  potentialClaims: new Set(
    documentFindings.flatMap((doc) =>
      doc.potentialClaims.map((c) => c.toLowerCase()),
    ),
  ).size,
  timelineEvents: asArray(vkb?.evidenceTimeline).length,
  unparsed: documentFindings.filter((doc) => doc.parseError).length,
});

const buildBullets = (stats, conditions) => {
  const bullets = [];
  if (stats.documents > 0) {
    const pages = stats.pages ? ` covering ${plural(stats.pages, "page")}` : "";
    bullets.push({
      icon: "📄",
      text: `${plural(stats.documents, "document")} on file${pages}.`,
    });
  }
  if (stats.conditions > 0) {
    bullets.push({
      icon: "🩺",
      text: `${plural(stats.conditions, "condition")} named across your records${
        stats.corroborated
          ? `, ${stats.corroborated} appearing in more than one document`
          : ""
      }.`,
    });
  }
  if (stats.rated > 0) {
    const top = conditions
      .filter((c) => Number.isFinite(c.ratedPercentage))
      .slice(0, 3)
      .map((c) => `${c.name} (${c.ratedPercentage}%)`)
      .join(", ");
    bullets.push({ icon: "📊", text: `Rated conditions on file: ${top}.` });
  }
  if (stats.potentialClaims > 0) {
    bullets.push({
      icon: "🎯",
      text: `${plural(stats.potentialClaims, "potential claim")} flagged during document analysis.`,
    });
  }
  if (stats.timelineEvents > 0) {
    bullets.push({
      icon: "🗓️",
      text: `${plural(stats.timelineEvents, "dated evidence event")} extracted into your timeline.`,
    });
  }
  return bullets;
};

const buildGaps = (vkb, documentFindings, conditions, stats) => {
  const gaps = [];
  if (stats.unparsed > 0) {
    gaps.push(
      `${plural(stats.unparsed, "document")} stored raw text only — structured fields could not be extracted.`,
    );
  }
  const unsupported = conditions.filter((c) => c.documentCount === 0);
  if (unsupported.length > 0) {
    gaps.push(
      `${plural(unsupported.length, "condition")} has no supporting document in this packet: ${unsupported
        .slice(0, 5)
        .map((c) => c.name)
        .join(", ")}.`,
    );
  }
  if (!documentFindings.some((doc) => doc.categoryKey === "dd214s")) {
    gaps.push("No DD-214 or service record on file.");
  }
  if (!cleanString(vkb?.serviceHistory?.separationDate)) {
    gaps.push("Separation date is not recorded in your service history.");
  }
  return gaps;
};

/**
 * The at-a-glance panel: counts, the few lines that matter, and what is
 * missing. Every number traces to a stored record — nothing is inferred.
 */
export function buildPacketTldr(vkb, documentFindings = [], conditions = []) {
  const stats = buildStats(vkb, documentFindings, conditions);
  const headline =
    stats.documents === 0
      ? "No documents analyzed yet."
      : [
          plural(stats.documents, "document"),
          plural(stats.conditions, "condition"),
          `${stats.corroborated} corroborated`,
        ].join(" · ");

  return {
    headline,
    stats,
    bullets: buildBullets(stats, conditions),
    gaps: buildGaps(vkb, documentFindings, conditions, stats),
    isEmpty: stats.documents === 0 && stats.conditions === 0,
  };
}

/** One call for the My Packet view: findings, synthesis, and TL;DR together. */
export function buildPacketSummary(vkb, documentsByCategory) {
  const documents = buildAllDocumentFindings(documentsByCategory);
  const conditions = buildConditionSynthesis(vkb, documents);
  return {
    documents,
    conditions,
    tldr: buildPacketTldr(vkb, documents, conditions),
  };
}
