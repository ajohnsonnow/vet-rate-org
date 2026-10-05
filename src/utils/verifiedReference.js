/**
 * Deterministic "verified reference" grounding: picks, by keyword and tool,
 * the bundled regulation and manual text that applies to a question and
 * formats it as the === VERIFIED REFERENCE === block. The text itself comes
 * from src/data/verifiedReference.json, which
 * scripts/verified-reference/build.mjs copies from the eCFR legal index and
 * the M21-1 shard. Nothing here calls a model or the network, and the block
 * holds public regulation text only.
 */

import reference from "../data/verifiedReference.json";

const ENTRIES = new Map(reference.entries.map((entry) => [entry.id, entry]));

const PACT = /\bpact\b|\bpresumpti(?:ve|on)s?\b/i;
const TOXIC_WORDS =
  /\bburn pits?\b|\bairborne hazards?\b|\btoxic exposures?\b|\bparticulate\b/i;
const TOXIC_PLACES =
  /\b(?:gulf war|southwest asia|iraq|afghanistan|kuwait|saudi arabia|somalia|djibouti|syria|uzbekistan|qatar|bahrain|oman|yemen|jordan|lebanon|egypt)\b/i;
const HERBICIDE_WORDS =
  /\bagent orange\b|\bherbicides?\b|\bblue water\b|\bc-?123\b|\bdioxin\b/i;
const HERBICIDE_PLACES =
  /\b(?:vietnam|thailand|laos|cambodia|guam|american samoa|johnston|korean dmz|demilitarized zone)\b/i;
const SECONDARY =
  /\bsecondar(?:y|ily)\b|\bproximately due\b|\b3\.310\b|\b(?:caused by|due to|result of|because of|aggravated by|worsened by) (?:my |a |an |the )?service[- ]connected\b/i;
const SECONDARY_PRESUMED = /\btbi\b|\btraumatic brain\b|\bamputat/i;

const FORM_WORDS =
  /\b(?:va|which|what|right|correct|wrong) forms?\b|\bforms? (?:do|should|number|is|are|for|to)\b/i;
const FORM_NUMBERS = /\bform \d|\b2\dp?-\d{3,5}[a-z]{0,2}\b|\b10182\b/i;

const isPactQuestion = (text, toolId) =>
  PACT.test(text) || toolId === "pact-navigator";

/**
 * Topic rules in priority order. `pattern` is tested against the question,
 * `toolIds` against the tool the question came from; `when` replaces both
 * for topics that need more than one signal. `entries` are bundled entry ids,
 * most important first.
 */
export const VERIFIED_REFERENCE_TOPICS = Object.freeze([
  {
    id: "intent-to-file",
    pattern: /\bintent(?:ion)?s? to file\b|\bITF\b|\b21-0966\b|\b3\.155\b/i,
    entries: ["cfr-3.155-b", "cfr-3.155-b-1"],
  },
  {
    id: "secondary",
    pattern: SECONDARY,
    entries: ["cfr-3.310-a", "cfr-3.310-b"],
  },
  {
    id: "secondary-presumed",
    when: (text) => SECONDARY.test(text) && SECONDARY_PRESUMED.test(text),
    entries: ["cfr-3.310-c-d"],
  },
  {
    id: "supplemental",
    pattern:
      /\bsupplemental claims?\b|\bnew and relevant\b|\b20-0995\b|\b3\.2501\b|\breopen(?:ed|ing)?\b/i,
    entries: ["cfr-3.2501", "cfr-3.2501-a-d"],
  },
  {
    id: "tdiu",
    pattern: /\btdiu\b|\bunemployab|\b4\.16\b|\b21-8940\b/i,
    toolIds: ["tdiu-builder", "tdiu-narrative"],
    entries: ["cfr-4.16-a", "cfr-4.16-b", "cfr-4.16-a-employment"],
  },
  {
    id: "bilateral-factor",
    pattern:
      /\bbilateral\b|\b4\.26\b|\bboth (?:knees|legs|arms|feet|ankles|hips|shoulders|elbows|wrists|hands)\b/i,
    entries: ["cfr-4.26", "cfr-4.26-a-b-d"],
  },
  {
    id: "combined-rating",
    pattern:
      /\bcombined (?:rating|evaluation|disability|percentage)\b|\bcombin(?:e|es|ing) (?:my |the |these |those )?(?:ratings|disabilities|percentages)\b|\bva math\b|\b4\.25\b/i,
    toolIds: ["calculator", "rating-calculator", "rating-analyzer"],
    entries: ["cfr-4.25-b", "cfr-4.25", "cfr-4.25-a"],
  },
  {
    id: "toxic-exposure",
    when: (text, toolId) =>
      TOXIC_WORDS.test(text) ||
      (isPactQuestion(text, toolId) && TOXIC_PLACES.test(text)),
    entries: ["pact-toxic-conditions", "pact-toxic-service", "pact-toxic-rule"],
  },
  {
    id: "herbicide",
    when: (text, toolId) =>
      HERBICIDE_WORDS.test(text) ||
      (isPactQuestion(text, toolId) && HERBICIDE_PLACES.test(text)),
    entries: [
      "pact-herbicide-conditions",
      "pact-herbicide-service",
      "pact-herbicide-law-changes",
    ],
  },
  {
    id: "pact-act",
    when: isPactQuestion,
    entries: [
      "pact-toxic-conditions",
      "pact-herbicide-conditions",
      "pact-toxic-service",
      "pact-herbicide-service",
      "pact-toxic-rule",
      "pact-herbicide-law-changes",
    ],
  },
  {
    id: "claim-forms",
    when: (text) => FORM_WORDS.test(text) || FORM_NUMBERS.test(text),
    entries: ["va-forms"],
  },
]);

const topicApplies = (topic, text, toolId) =>
  topic.when
    ? topic.when(text, toolId)
    : topic.pattern.test(text) || Boolean(topic.toolIds?.includes(toolId));

/** Ids of the topics a question raises, in priority order. */
export function detectReferenceTopics(question, toolId = null) {
  const text = String(question ?? "");
  return VERIFIED_REFERENCE_TOPICS.filter((topic) =>
    topicApplies(topic, text, toolId),
  ).map((topic) => topic.id);
}

/**
 * Entry ids for the matched topics, taking each topic's first entry, then
 * each topic's second, and so on, so no topic is starved by the one before.
 */
function rankEntryIds(topicIds) {
  const lists = VERIFIED_REFERENCE_TOPICS.filter((topic) =>
    topicIds.includes(topic.id),
  ).map((topic) => topic.entries);
  const ranked = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let round = 0; round < longest; round += 1) {
    for (const list of lists) {
      const id = list[round];
      if (id && !ranked.includes(id)) ranked.push(id);
    }
  }
  return ranked;
}

const HEADER = `\n\n=== VERIFIED REFERENCE ===
Each entry below is quoted from the regulation or VA manual it names and outranks anything you remember.
`;
const FOOTER = `\n=== END VERIFIED REFERENCE ===\n`;

function describeSource(entry) {
  const changed = entry.source.changeDate
    ? `, changed ${entry.source.changeDate}`
    : "";
  return `${entry.sourceLabel}${changed}, retrieved ${entry.source.retrieved}`;
}

function formatEntry(entry) {
  const lines = [`\n[${entry.citation}] (${describeSource(entry)})`];
  if (entry.abbreviations?.length > 0) {
    const pairs = entry.abbreviations.map((a) => `${a.short} = ${a.long}`);
    lines.push(`Abbreviations: ${pairs.join("; ")}.`);
  }
  lines.push(entry.text);
  return `${lines.join("\n")}\n`;
}

/**
 * The bundled entries that apply to a question and fit in `maxChars` once
 * formatted as a block. Entries are taken whole, in rank order; one that
 * does not fit is skipped and the next is tried, so legal text is never cut.
 */
export function selectVerifiedEntries(question, { toolId = null, maxChars }) {
  let remaining = maxChars - HEADER.length - FOOTER.length;
  const picked = [];
  for (const id of rankEntryIds(detectReferenceTopics(question, toolId))) {
    const entry = ENTRIES.get(id);
    const size = formatEntry(entry).length;
    if (size > remaining) continue;
    picked.push(entry);
    remaining -= size;
  }
  return picked;
}

/**
 * The === VERIFIED REFERENCE === block for a question, or "" when no topic
 * applies or nothing fits the budget.
 */
export function buildVerifiedReferenceBlock(question, options) {
  const entries = selectVerifiedEntries(question, options);
  if (entries.length === 0) return "";
  return `${HEADER}${entries.map(formatEntry).join("")}${FOOTER}`;
}
