import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { TOOL_ENTRY_NAMES } from "./toolEntries.js";

export const REQUIRED_CASE_FIELDS = [
  "id",
  "toolId",
  "expectedAgent",
  "expectedCapability",
  "scenario",
];

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A tool case names a production entry point (`entry`) and carries the form
 * inputs that function is called with (`formInputs`), where a plain case
 * sends its `input` text straight to generateAI. `match` is a phrase from
 * the inputs that the tool puts in its request; the runner uses it to pick
 * this case's request out of everything the engine received. `document`
 * attaches a text file, read into formInputs.documentText.
 */
function validateToolCase(parsed, readDocument) {
  if (!TOOL_ENTRY_NAMES.includes(parsed.entry)) {
    throw new Error(
      `golden set case ${parsed.id} names unknown entry ${JSON.stringify(parsed.entry)}; known: ${TOOL_ENTRY_NAMES.join(", ")}`,
    );
  }
  if (!isPlainObject(parsed.formInputs)) {
    throw new Error(
      `golden set case ${parsed.id} formInputs must be an object`,
    );
  }
  if (typeof parsed.match !== "string" || parsed.match.trim() === "") {
    throw new Error(
      `golden set case ${parsed.id} needs a match phrase from its inputs`,
    );
  }
  if (parsed.document === undefined) return parsed;
  if (typeof parsed.document !== "string" || !readDocument) {
    throw new Error(
      `golden set case ${parsed.id} attaches a document that cannot be read here`,
    );
  }
  return {
    ...parsed,
    formInputs: {
      ...parsed.formInputs,
      documentText: readDocument(parsed.document, parsed.id),
    },
  };
}

function stringLeaves(value) {
  if (typeof value === "string") return [value];
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(stringLeaves);
}

/** Everything a case supplies, as text: its input and every form value. */
export const suppliedText = (caseDef) =>
  [caseDef.input ?? "", ...stringLeaves(caseDef.formInputs)].join("\n");

export function parseGoldenSet(text, { readDocument } = {}) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        throw new Error(
          `golden set line ${index + 1} is not valid JSON: ${err.message}`,
        );
      }
      for (const field of REQUIRED_CASE_FIELDS) {
        if (!parsed[field]) {
          throw new Error(
            `golden set line ${index + 1} (${parsed.id ?? "no id"}) missing ${field}`,
          );
        }
      }
      if (typeof parsed.input !== "string") {
        throw new Error(
          `golden set case ${parsed.id} input must be a string (may be empty)`,
        );
      }
      if (parsed.entry === undefined) return parsed;

      const toolCase = validateToolCase(parsed, readDocument);
      if (!suppliedText(toolCase).includes(toolCase.match)) {
        throw new Error(
          `golden set case ${parsed.id} match phrase is not in its inputs`,
        );
      }
      return toolCase;
    });
}

/**
 * Reads an attached document. The path is relative to the golden set and
 * must stay inside its directory.
 */
export function documentReader(goldenSetPath) {
  const base = dirname(resolve(goldenSetPath));
  return (documentPath, caseId) => {
    const target = resolve(base, documentPath);
    const fromBase = relative(base, target);
    if (fromBase.startsWith("..") || isAbsolute(fromBase)) {
      throw new Error(
        `golden set case ${caseId} document must be inside ${base}`,
      );
    }
    return readFileSync(target, "utf8");
  };
}

export function loadGoldenSet(path) {
  return parseGoldenSet(readFileSync(path, "utf8"), {
    readDocument: documentReader(path),
  });
}

export const isToolCase = (caseDef) => typeof caseDef?.entry === "string";

export function selectCases(cases, idList) {
  if (!idList || idList.length === 0) return cases;
  const wanted = new Set(idList);
  const known = new Set(cases.map((c) => c.id));
  const unknown = idList.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`unknown golden-set case id(s): ${unknown.join(", ")}`);
  }
  return cases.filter((c) => wanted.has(c.id));
}
