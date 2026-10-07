import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gradeRecord } from "./goldenChecks.js";
import { parseTranscript, runBaseName } from "./goldenRecord.js";
import { renderSummary } from "./goldenReport.js";

/*
 * Create a file that must not exist yet. The exclusive flag makes the check
 * and the creation one step, so nothing can take the name in between. Returns
 * false when the name is taken; any other failure is the caller's to see.
 */
function createExclusive(path) {
  try {
    closeSync(openSync(path, "wx"));
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

/**
 * Claim fresh transcript and summary paths for this run. Both files are
 * created with the exclusive flag, so an earlier run's files are never
 * opened for writing; on a name collision (same model, same second) a numeric
 * suffix is added. A transcript created for a name whose summary turns out to
 * be taken is removed again, so no stray file is left.
 */
export function claimRunFiles(outDir, modelId, date = new Date()) {
  mkdirSync(outDir, { recursive: true });
  const base = runBaseName(modelId, date);
  for (let attempt = 1; attempt < 1000; attempt++) {
    const name = attempt === 1 ? base : `${base}-${attempt}`;
    const transcriptPath = join(outDir, `${name}.jsonl`);
    const summaryPath = join(outDir, `${name}.md`);
    if (!createExclusive(transcriptPath)) continue;
    if (createExclusive(summaryPath)) {
      return { name, transcriptPath, summaryPath };
    }
    unlinkSync(transcriptPath);
  }
  throw new Error(`could not claim a unique run file name under ${outDir}`);
}

export function writeSummary(summaryPath, markdown) {
  writeFileSync(summaryPath, markdown, "utf8");
}

export function appendTranscript(transcriptPath, records) {
  appendFileSync(
    transcriptPath,
    records.map((r) => `${JSON.stringify(r)}\n`).join(""),
    "utf8",
  );
}

/**
 * Read a finished transcript, grade every recorded case, and write the
 * Markdown summary. Returns the parsed pieces so callers can assert on them.
 */
export function finalizeRun({
  transcriptPath,
  summaryPath,
  goldenCases,
  ctx,
  runInfo,
}) {
  const { meta, cases } = parseTranscript(readFileSync(transcriptPath, "utf8"));
  const byId = new Map(goldenCases.map((c) => [c.id, c]));
  const grades = cases.map((record) => {
    const caseDef = byId.get(record.id);
    if (!caseDef) {
      throw new Error(`transcript case ${record.id} is not in the golden set`);
    }
    return gradeRecord({ ...caseDef }, record, ctx);
  });
  const markdown = renderSummary({ meta, runInfo, goldenCases, cases, grades });
  writeSummary(summaryPath, markdown);
  return { meta, cases, grades, markdown };
}
