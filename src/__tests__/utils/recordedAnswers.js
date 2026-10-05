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

/** Every `case` line of every recorded run, with `run` = its date and time. */
export function recordedCases() {
  return readdirSync(RESULTS_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .sort()
    .flatMap((name) =>
      parseLines(join(RESULTS_DIR, name))
        .filter((line) => line.type === "case")
        .map((line) => ({ ...line, run: name.slice(4, 21) })),
    );
}

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
