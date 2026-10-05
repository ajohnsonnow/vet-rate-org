#!/usr/bin/env node
/**
 * Build the bundled verified-reference data for the on-device AI:
 *
 *   src/data/verifiedReference.json  quoted regulation and manual text
 *   src/data/cfrSections.json        every 38 CFR Part 3 and Part 4 section
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

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ECFR_FILE = "public/legal-index/v0.1.0/chunks/ecfr.jsonl";
const M21_FILE = "public/dkb-index/m21_1/chunks.part0.jsonl";
const FORMS_ALLOWLIST_FILE = "src/data/validVAForms.json";
const REFERENCE_OUT = "src/data/verifiedReference.json";
const SECTIONS_OUT = "src/data/cfrSections.json";

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

const TOPIC_TAIL = [" References:", " Reference:"];
const BPOT_ARTICLE = "M21-1, Part VIII, Subpart ii, Chapter 2, Section A - ";
const HERBICIDE_ARTICLE =
  "M21-1, Part VIII, Subpart i, Chapter 1, Section A - ";

const ABBREVIATIONS = [
  { short: "SC", long: "service connection" },
  {
    short: "BPOT",
    long: "burn pits and other toxins, including fine particulate matter",
  },
];

const MANUAL_ENTRIES = [
  {
    id: "pact-toxic-conditions",
    citation:
      "M21-1 VIII.ii.2.A.1.f-h (PACT Act, 38 U.S.C. 1120; 38 CFR 3.320a, 3.320b)",
    article: BPOT_ARTICLE,
    topics: [
      {
        start: "VIII.ii.2.A.1.f.",
        end: "VIII.ii.2.A.1.g.",
        stopAt: TOPIC_TAIL,
      },
      {
        start: "VIII.ii.2.A.1.g.",
        end: "VIII.ii.2.A.1.h.",
        stopAt: TOPIC_TAIL,
      },
      { start: "VIII.ii.2.A.1.h.", end: " To Top", stopAt: TOPIC_TAIL },
    ],
  },
  {
    id: "pact-toxic-service",
    citation:
      "M21-1 VIII.ii.2.A.1.e (PACT Act covered Veteran: locations and dates, 38 U.S.C. 1119)",
    article: BPOT_ARTICLE,
    topics: [
      {
        start: "VIII.ii.2.A.1.e.",
        end: "VIII.ii.2.A.1.f.",
        stopAt: [" Important:", ...TOPIC_TAIL],
      },
    ],
  },
  {
    id: "pact-toxic-rule",
    citation:
      "M21-1 VIII.ii.2.A.1.d (PACT Act presumption of service connection)",
    article: BPOT_ARTICLE,
    topics: [
      {
        start: "VIII.ii.2.A.1.d.",
        end: "VIII.ii.2.A.1.e.",
        stopAt: TOPIC_TAIL,
      },
    ],
  },
  {
    id: "pact-herbicide-conditions",
    citation:
      "M21-1 VIII.i.1.A.1.f (presumptive herbicide disabilities, 38 CFR 3.309(e); 38 U.S.C. 1116)",
    article: HERBICIDE_ARTICLE,
    topics: [
      { start: "VIII.i.1.A.1.f.", end: "VIII.i.1.A.1.g.", stopAt: TOPIC_TAIL },
    ],
  },
  {
    id: "pact-herbicide-service",
    citation:
      "M21-1 VIII.i.1.A.1.c (presumed herbicide exposure: locations and dates)",
    article: HERBICIDE_ARTICLE,
    topics: [
      {
        start: "VIII.i.1.A.1.c.",
        end: "VIII.i.1.A.1.d.",
        stopAt: [" Notes:", ...TOPIC_TAIL],
      },
    ],
  },
  {
    id: "pact-herbicide-law-changes",
    citation: "M21-1 VIII.i.1.A.2.a (herbicide law changes, PACT Act)",
    article: HERBICIDE_ARTICLE,
    topics: [
      {
        start: "VIII.i.1.A.2.a.",
        end: "VIII.i.1.A.2.b.",
        stopAt: [" Important:", ...TOPIC_TAIL],
      },
    ],
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

function buildManualEntry(spec, m21) {
  const records = m21.filter((r) => r.title?.startsWith(spec.article));
  const urls = [...new Set(records.map((r) => r.source_url))];
  if (urls.length !== 1) {
    throw new Error(
      `${spec.id}: expected one M21-1 article for "${spec.article}", found ${urls.length}`,
    );
  }
  const article = stitchChunks(records);
  const text = spec.topics
    .map((topic) => sliceTopic(article, topic))
    .join("\n");
  return {
    id: spec.id,
    citation: spec.citation,
    sourceLabel: "VA Adjudication Procedures Manual M21-1",
    text,
    abbreviations: abbreviationsIn(text, `${records[0].title} ${article}`),
    source: {
      file: M21_FILE,
      article: records[0].title,
      url: urls[0],
      retrieved: dateOf(records),
      changeDate: changeDateBefore(article, spec.topics[0].start),
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

export function buildBundle(sourceRoot) {
  const read = (file) => readFileSync(path.join(sourceRoot, file), "utf8");
  const ecfr = parseJsonl(read(ECFR_FILE), ECFR_FILE);
  const m21 = parseJsonl(read(M21_FILE), M21_FILE);
  const allowlist = JSON.parse(
    readFileSync(path.join(REPO_ROOT, FORMS_ALLOWLIST_FILE), "utf8"),
  );
  const forms = buildFormsEntry(m21, allowlist);
  const generatedBy = "scripts/verified-reference/build.mjs";
  return {
    reference: {
      _generated: {
        by: generatedBy,
        note: "Generated. Do not edit by hand; change the script and rebuild.",
      },
      entries: [
        ...CFR_ENTRIES.map((spec) => buildCfrEntry(spec, ecfr)),
        ...MANUAL_ENTRIES.map((spec) => buildManualEntry(spec, m21)),
        forms.entry,
      ],
    },
    sections: {
      _generated: {
        by: generatedBy,
        note: "Generated. Do not edit by hand; change the script and rebuild.",
      },
      source: { file: ECFR_FILE, retrieved: dateOf(ecfr) },
      parts: collectSections(ecfr, ["3", "4"]),
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
    `sections: Part 3 ${bundle.sections.parts[3].length}, Part 4 ${bundle.sections.parts[4].length}`,
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
