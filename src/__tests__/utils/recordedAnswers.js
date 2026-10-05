import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateVARating } from "../../utils/vaCalculator";

const here = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(
  here,
  "..",
  "..",
  "..",
  "llm-compiler",
  "logs",
  "golden-set-results",
);

const parseLines = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

export const GOLDEN = Object.fromEntries(
  parseLines(join(here, "..", "agentic", "golden-set.jsonl")).map((c) => [
    c.id,
    c,
  ]),
);

const casesIn = (names) =>
  names.flatMap((name) =>
    parseLines(join(RESULTS_DIR, name))
      .filter((line) => line.type === "case")
      .map((line) => ({ ...line, run: name.slice(4, 21) })),
  );

/** Every `case` line of every run on disk, with `run` = its date and time. */
export const allRecordedCases = () =>
  casesIn(
    readdirSync(RESULTS_DIR)
      .filter((name) => name.endsWith(".jsonl"))
      .sort(),
  );

// The runs whose answers were read and labelled by hand. Tests that pin
// counts read exactly these files, so recording a new run never breaks them.
// Add a run here only together with new labels and counts.
export const LABELLED_RUN_FILES = Object.freeze([
  "run_2026-10-05_071859_Qwen2.5-3B-Instruct-q4f16_1-MLC.jsonl",
  "run_2026-10-05_074624_Qwen2.5-3B-Instruct-q4f16_1-MLC.jsonl",
  "run_2026-10-05_081228_Qwen2.5-3B-Instruct-q4f16_1-MLC.jsonl",
  "run_2026-10-05_090513_Qwen2.5-3B-Instruct-q4f16_1-MLC.jsonl",
  "run_2026-10-05_094601_Qwen2.5-3B-Instruct-q4f16_1-MLC.jsonl",
  "run_2026-10-05_105010_Qwen3.5-4B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_110055_Qwen3.5-2B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_110822_Qwen3.5-9B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_112504_Qwen3.5-4B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_122217_Qwen3.5-4B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_123216_Qwen3.5-4B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_124154_Qwen3.5-9B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_125630_Qwen3.5-2B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_135040_Qwen3.5-4B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_135908_Qwen3.5-9B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_141236_Qwen3.5-2B-q4f16_1-MLC.jsonl",
  "run_2026-10-05_201248_Qwen2.5-1.5B-Instruct-q4f16_1-MLC.jsonl",
]);

/** The `case` lines of the 17 labelled runs. */
export const recordedCases = () => casesIn(LABELLED_RUN_FILES);

/** What the model wrote: the replaced draft when the guard swapped the answer. */
export const modelTextOf = (record) =>
  record.calculatorReplacement?.draft ?? record.response ?? "";

/** The model's answer to each recorded case that has structured conditions. */
export function raterAnswers() {
  return recordedCases()
    .filter((record) => Array.isArray(GOLDEN[record.id]?.conditions))
    .map((record) => ({
      run: record.run,
      id: record.id,
      input: GOLDEN[record.id].input,
      text: modelTextOf(record),
      calc: calculateVARating(GOLDEN[record.id].conditions),
    }));
}

/** Every distinct text a veteran or the guard saw, across all recorded runs. */
export function everyRecordedText() {
  const texts = new Set();
  for (const record of recordedCases()) {
    for (const text of [
      record.response,
      record.rawResponse,
      record.calculatorReplacement?.draft,
    ]) {
      if (typeof text === "string" && text !== "") texts.add(text);
    }
  }
  return [...texts];
}

// The graded 38-case run on the integrated build. It is outside the labelled
// counts above; only the tests written from its grade read it.
export const GRADED_INTEGRATED_RUN_FILE =
  "run_2026-10-05_221648_Qwen3.5-4B-q4f16_1-MLC.jsonl";

export const gradedIntegratedCase = (id) =>
  casesIn([GRADED_INTEGRATED_RUN_FILE]).find((record) => record.id === id);

/** The model's own text in a recorded answer that led with the working. */
export const commentaryOf = (record, lead) =>
  record.response.split(`${lead}\n\n`)[1] ?? "";
