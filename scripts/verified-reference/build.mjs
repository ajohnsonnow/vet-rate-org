#!/usr/bin/env node
/**
 * Build the bundled verified-reference data for the on-device AI:
 *
 *   src/data/verifiedReference.json  quoted regulation and manual text
 *   src/data/cfrSections.json        every 38 CFR section the index has text for
 *   src/data/verifiedQuotes.json     the decision review options, and the
 *                                    sentence each answer correction quotes
 *   src/__tests__/utils/fixtures/verifiedReferenceSource.json
 *                                    the manual passages as the shard holds
 *                                    them, for the word-for-word test
 *
 * Every word of entry text is copied from sources the repo already holds:
 * the eCFR legal index and the M21-1 shard. The specs below only say which
 * paragraphs or manual topics to copy; a selector that no longer matches the
 * source fails the build rather than producing a partial entry.
 *
 * Usage:
 *   node scripts/verified-reference/build.mjs [--source-root <dir>] [--check]
 *
 * --source-root  checkout whose public/ holds the real (git-lfs) index files;
 *                defaults to this repo. Only read from, never written to.
 * --check        exit 1 if the bundled files differ from a fresh build.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSections,
  extractFormTitle,
  parseJsonl,
  sectionParagraphs,
  sectionRecords,
  selectParagraphs,
  sliceTopic,
  stitchChunks,
} from "./lib/extract.js";
import { sameWords, structureText } from "./lib/structure.js";
import { MANUAL_TOPICS } from "./manual-topics.js";
import {
  CORRECTION_SPECS,
  REVIEW_ENTRIES,
  REVIEW_FORM_NUMBERS,
  REVIEW_OPTIONS_SPEC,
} from "./quote-specs.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ECFR_FILE = "public/legal-index/v0.1.0/chunks/ecfr.jsonl";
const M21_FILE = "public/dkb-index/m21_1/chunks.part0.jsonl";
const FORMS_ALLOWLIST_FILE = "src/data/validVAForms.json";
const REFERENCE_OUT = "src/data/verifiedReference.json";
const SECTIONS_OUT = "src/data/cfrSections.json";
const QUOTES_OUT = "src/data/verifiedQuotes.json";
const FLAT_SOURCE_OUT =
  "src/__tests__/utils/fixtures/verifiedReferenceSource.json";

const CFR_ENTRIES = [
  {
    id: "cfr-3.155-b",
    citation: "38 CFR § 3.155(b)",
    section: "3.155",
    select: [
      "The following paragraphs describe the manner",
      "(b) Intent to file a claim.",
      "(4) If an intent to file a claim is not submitted",
    ],
  },
  {
    id: "cfr-3.155-b-1",
    citation: "38 CFR § 3.155(b)(1)",
    section: "3.155",
    select: [
      {
        from: "(1) An intent to file a claim can be submitted",
        through: "(iii) Oral intent communicated",
      },
    ],
  },
  {
    id: "cfr-3.310-a",
    citation: "38 CFR § 3.310(a)",
    section: "3.310",
    select: ["(a) General."],
  },
  {
    id: "cfr-3.310-b",
    citation: "38 CFR § 3.310(b)",
    section: "3.310",
    select: ["(b) Aggravation of nonservice-connected disabilities."],
  },
  {
    id: "cfr-3.310-c-d",
    citation: "38 CFR § 3.310(c)-(d)",
    section: "3.310",
    select: [
      "(c) Cardiovascular disease.",
      {
        from: "(d) Traumatic brain injury.",
        through: "(2) Neither the severity levels",
      },
    ],
  },
  {
    id: "cfr-3.2501",
    citation: "38 CFR § 3.2501",
    section: "3.2501",
    select: ["Except as otherwise provided, a claimant"],
  },
  {
    id: "cfr-3.2501-a-d",
    citation: "38 CFR § 3.2501(a), (d)",
    section: "3.2501",
    select: [
      { from: "(a) New and relevant evidence.", through: "(1) Definition." },
      "(d) Date of filing.",
    ],
  },
  {
    id: "cfr-4.16-a",
    citation: "38 CFR § 4.16(a)",
    section: "4.16",
    select: [
      {
        from: "(a) Total disability ratings for compensation may be assigned",
        through: "(4) multiple injuries incurred in action",
      },
      { start: "(5) multiple disabilities incurred", firstSentences: 1 },
    ],
  },
  {
    id: "cfr-4.16-b",
    citation: "38 CFR § 4.16(b)",
    section: "4.16",
    select: ["(b) It is the established policy"],
  },
  {
    id: "cfr-4.16-a-employment",
    citation: "38 CFR § 4.16(a), continued",
    section: "4.16",
    select: [
      { start: "(5) multiple disabilities incurred", afterSentences: 1 },
    ],
  },
  {
    id: "cfr-4.25",
    citation: "38 CFR § 4.25",
    section: "4.25",
    select: ["Table I, Combined Ratings Table, results from"],
  },
  {
    id: "cfr-4.25-a",
    citation: "38 CFR § 4.25(a)",
    section: "4.25",
    select: ["(a) To use table I"],
  },
  {
    id: "cfr-4.25-b",
    citation: "38 CFR § 4.25(b)",
    section: "4.25",
    select: ["(b) Except as otherwise provided in this schedule"],
  },
  {
    id: "cfr-4.26",
    citation: "38 CFR § 4.26",
    section: "4.26",
    select: [
      "Except as provided in paragraph (d) of this section, when a partial",
      "(c) Applicability.",
    ],
  },
  {
    id: "cfr-4.26-a-b-d",
    citation: "38 CFR § 4.26(a), (b), (d)",
    section: "4.26",
    select: [
      "(a) Definitions.",
      "(b) Procedure for four affected extremities.",
      "(d) Exception.",
    ],
  },
];

const ABBREVIATIONS = [
  { short: "SC", long: "service connection" },
  {
    short: "BPOT",
    long: "burn pits and other toxins, including fine particulate matter",
  },
];

const MANUAL_ENTRIES = [
  {
    id: "pact-toxic",
    citation:
      "M21-1 VIII.ii.2.A.1.e-h (PACT Act burn pit and toxic exposure: who is covered, then the conditions)",
    topics: [
      "toxic-service",
      "toxic-conditions-1120",
      "toxic-conditions-3.320a",
      "toxic-conditions-3.320b",
    ],
  },
  {
    id: "pact-toxic-rule",
    citation:
      "M21-1 VIII.ii.2.A.1.d (PACT Act presumption of service connection)",
    topics: ["toxic-rule"],
  },
  {
    id: "pact-herbicide",
    citation:
      "M21-1 VIII.i.1.A.1.c, 1.f (herbicide exposure: who is covered, then the conditions)",
    topics: ["herbicide-service", "herbicide-conditions"],
  },
  {
    id: "pact-herbicide-law-changes",
    citation: "M21-1 VIII.i.1.A.2.a (herbicide law changes, PACT Act)",
    topics: ["herbicide-law-changes"],
  },
  {
    id: "pact-overview",
    citation:
      "M21-1 VIII.ii.2.A.1.e, VIII.i.1.A.1.c (who each PACT Act group covers)",
    topics: ["toxic-service", "herbicide-service"],
  },
];

const FORM_NUMBERS = [
  "21-526EZ",
  "21-0966",
  "20-0995",
  "20-0996",
  "10182",
  "21-4138",
  "21-10210",
  "21-0781",
  "21-8940",
  "21-4192",
  "21-4142",
  "21-4142a",
  "21-22",
  "21-22a",
  "21-686c",
  "21-2680",
];

const dateOf = (records) => {
  const dates = [...new Set(records.map((r) => r.fetched_at.slice(0, 10)))];
  if (dates.length !== 1) {
    throw new Error(`expected one retrieval date, found ${dates.join(", ")}`);
  }
  return dates[0];
};

function buildCfrEntry(spec, ecfr) {
  const records = sectionRecords(ecfr, spec.section);
  return {
    id: spec.id,
    citation: spec.citation,
    sourceLabel: "eCFR",
    text: selectParagraphs(sectionParagraphs(ecfr, spec.section), spec.select),
    source: {
      file: ECFR_FILE,
      section: `38 CFR § ${spec.section}`,
      url: records[0].source_url,
      retrieved: dateOf(records),
    },
  };
}

const CHANGE_DATE = /Change Date ([A-Z][a-z]+ \d{1,2}, \d{4})/g;

function changeDateBefore(article, marker) {
  const upTo = article.slice(0, article.indexOf(marker));
  return [...upTo.matchAll(CHANGE_DATE)].pop()?.[1] ?? null;
}

/**
 * Abbreviations an entry uses, kept only when the same article spells them
 * out as "<long form> (<SHORT>)".
 */
function abbreviationsIn(text, article) {
  const haystack = article.toLowerCase();
  return ABBREVIATIONS.filter(
    ({ short, long }) =>
      new RegExp(String.raw`\b${short}\b`).test(text) &&
      haystack.includes(`${long} (${short.toLowerCase()})`),
  );
}

function loadArticle(prefix, m21) {
  const records = m21.filter((r) => r.title?.startsWith(prefix));
  const urls = [...new Set(records.map((r) => r.source_url))];
  if (urls.length !== 1) {
    throw new Error(
      `expected one M21-1 article for "${prefix}", found ${urls.length}`,
    );
  }
  return {
    title: records[0].title,
    url: urls[0],
    retrieved: dateOf(records),
    text: stitchChunks(records),
  };
}

/**
 * One manual topic: `flat` as the shard holds it and `text` with its tables
 * and lists broken into lines. Refuses to return text that is not word for
 * word the source.
 */
function buildTopic(key, m21) {
  const topic = MANUAL_TOPICS[key];
  const article = loadArticle(topic.article, m21);
  const flat = sliceTopic(article.text, topic);
  const text = structureText(flat, topic.structure);
  if (!sameWords(flat, text)) {
    throw new Error(`${key}: structured text differs from its source`);
  }
  return {
    flat,
    text,
    article,
    changeDate: changeDateBefore(article.text, topic.start),
  };
}

const unique = (values) => [...new Set(values)];

function buildManualEntry(spec, m21) {
  const topics = spec.topics.map((key) => buildTopic(key, m21));
  const text = topics.map((topic) => topic.text).join("\n\n");
  const articles = unique(topics.map((topic) => topic.article.url)).map(
    (url) => topics.find((topic) => topic.article.url === url).article,
  );
  const defined = articles.map((a) => `${a.title} ${a.text}`).join(" ");
  return {
    flat: topics.map((topic) => topic.flat).join("\n"),
    entry: {
      id: spec.id,
      citation: spec.citation,
      sourceLabel: "VA manual M21-1",
      text,
      abbreviations: abbreviationsIn(text, defined),
      source: {
        file: M21_FILE,
        articles: articles.map((a) => ({ title: a.title, url: a.url })),
        retrieved: dateOf(articles.map((a) => ({ fetched_at: a.retrieved }))),
        changeDate: unique(topics.map((topic) => topic.changeDate)).join(
          " and ",
        ),
      },
    },
  };
}

function stitchArticles(m21) {
  const byUrl = new Map();
  for (const record of m21) {
    if (!byUrl.has(record.source_url)) byUrl.set(record.source_url, []);
    byUrl.get(record.source_url).push(record);
  }
  return [...byUrl.values()].map(stitchChunks);
}

function buildFormsEntry(m21, allowlist) {
  const allowed = new Set(
    Object.values(allowlist.forms).flatMap((group) => group.forms),
  );
  const articles = stitchArticles(m21);
  const forms = [];
  const omitted = [];
  for (const number of FORM_NUMBERS) {
    const found = allowed.has(number)
      ? extractFormTitle(articles, number)
      : null;
    if (found) forms.push({ number, ...found });
    else omitted.push(number);
  }
  return {
    entry: {
      id: "va-forms",
      citation: "VA claim forms: number and official title",
      sourceLabel: "titles as cited in VA Adjudication Procedures Manual M21-1",
      text: forms.map((f) => `VA Form ${f.number}: ${f.title}`).join("\n"),
      forms,
      source: {
        file: M21_FILE,
        numbersCheckedAgainst: FORMS_ALLOWLIST_FILE,
        retrieved: dateOf(m21),
      },
    },
    omitted,
  };
}

const formLine = (form) => `VA Form ${form.number}: ${form.title}`;

function findForm(forms, number) {
  const form = forms.find((f) => f.number === number);
  if (!form) throw new Error(`form ${number} is not in the forms table`);
  return { number: form.number, title: form.title };
}

function buildReviewFormsEntry(formsEntry) {
  return {
    id: "review-forms",
    citation: "Decision review forms: number and official title",
    sourceLabel: formsEntry.sourceLabel,
    text: REVIEW_FORM_NUMBERS.map((number) =>
      formLine(findForm(formsEntry.forms, number)),
    ).join("\n"),
    source: formsEntry.source,
  };
}

/** A quotation: the selected sentences as one line, with their citation. */
function quoteRegulation(spec, ecfr) {
  const selected = selectParagraphs(
    sectionParagraphs(ecfr, spec.section),
    spec.select,
  );
  return {
    citation: spec.citation,
    text: selected
      .split("\n")
      .filter((line) => line !== "[...]")
      .join(" "),
    source: {
      file: ECFR_FILE,
      retrieved: dateOf(sectionRecords(ecfr, spec.section)),
    },
  };
}

function quoteManualLine(spec, m21) {
  const topic = buildTopic(spec.topic, m21);
  const lines = topic.text
    .split("\n")
    .filter((line) => line.startsWith(spec.line));
  if (lines.length !== 1) {
    throw new Error(
      `${spec.topic}: expected one line starting "${spec.line}", found ${lines.length}`,
    );
  }
  const { article } = topic;
  return {
    citation: spec.citation,
    text: lines[0],
    abbreviations: abbreviationsIn(
      lines[0],
      `${article.title} ${article.text}`,
    ),
    source: { file: M21_FILE, retrieved: article.retrieved },
  };
}

function buildReviewOptions(ecfr, forms) {
  return {
    lead: quoteRegulation(REVIEW_OPTIONS_SPEC.lead, ecfr),
    lanes: REVIEW_OPTIONS_SPEC.lanes.map((lane) => ({
      id: lane.id,
      form: findForm(forms, lane.form),
      quotes: lane.quotes.map((spec) => quoteRegulation(spec, ecfr)),
    })),
  };
}

const buildCorrections = (ecfr, m21) =>
  Object.fromEntries(
    Object.entries(CORRECTION_SPECS).map(([id, spec]) => [
      id,
      spec.topic ? quoteManualLine(spec, m21) : quoteRegulation(spec, ecfr),
    ]),
  );

export function buildBundle(sourceRoot) {
  const read = (file) => readFileSync(path.join(sourceRoot, file), "utf8");
  const ecfr = parseJsonl(read(ECFR_FILE), ECFR_FILE);
  const m21 = parseJsonl(read(M21_FILE), M21_FILE);
  const allowlist = JSON.parse(
    readFileSync(path.join(REPO_ROOT, FORMS_ALLOWLIST_FILE), "utf8"),
  );
  const forms = buildFormsEntry(m21, allowlist);
  const manual = MANUAL_ENTRIES.map((spec) => buildManualEntry(spec, m21));
  const _generated = {
    by: "scripts/verified-reference/build.mjs",
    note: "Generated. Do not edit by hand; change the script and rebuild.",
  };
  return {
    reference: {
      _generated,
      entries: [
        ...[...CFR_ENTRIES, ...REVIEW_ENTRIES].map((spec) =>
          buildCfrEntry(spec, ecfr),
        ),
        ...manual.map((built) => built.entry),
        forms.entry,
        buildReviewFormsEntry(forms.entry),
      ],
    },
    quotes: {
      _generated,
      reviewOptions: buildReviewOptions(ecfr, forms.entry.forms),
      corrections: buildCorrections(ecfr, m21),
    },
    sections: {
      _generated,
      source: { file: ECFR_FILE, retrieved: dateOf(ecfr) },
      parts: collectSections(ecfr),
    },
    flatSource: {
      _generated,
      source: { file: M21_FILE },
      passages: Object.fromEntries(
        manual.map((built) => [built.entry.id, built.flat]),
      ),
    },
    omittedForms: forms.omitted,
  };
}

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

function main(argv) {
  const rootFlag = argv.indexOf("--source-root");
  const sourceRoot =
    rootFlag === -1 ? REPO_ROOT : path.resolve(argv[rootFlag + 1]);
  const bundle = buildBundle(sourceRoot);
  const outputs = [
    [REFERENCE_OUT, serialize(bundle.reference)],
    [SECTIONS_OUT, serialize(bundle.sections)],
    [QUOTES_OUT, serialize(bundle.quotes)],
    [FLAT_SOURCE_OUT, serialize(bundle.flatSource)],
  ];

  if (argv.includes("--check")) {
    const stale = outputs.filter(
      ([file, text]) =>
        readFileSync(path.join(REPO_ROOT, file), "utf8") !== text,
    );
    if (stale.length > 0) {
      console.error(`stale: ${stale.map(([file]) => file).join(", ")}`);
      process.exit(1);
    }
    console.log("verified reference is up to date");
    return;
  }

  for (const [file, text] of outputs) {
    writeFileSync(path.join(REPO_ROOT, file), text);
  }
  for (const entry of bundle.reference.entries) {
    console.log(`${String(entry.text.length).padStart(5)}  ${entry.id}`);
  }
  console.log(
    `sections: ${Object.entries(bundle.sections.parts)
      .map(([part, list]) => `Part ${part} ${list.length}`)
      .join(", ")}`,
  );
  if (bundle.omittedForms.length > 0) {
    console.warn(
      `forms left out (not in the allowlist, or no title stated twice in M21-1): ${bundle.omittedForms.join(", ")}`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
