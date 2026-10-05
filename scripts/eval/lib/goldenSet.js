import { readFileSync } from "node:fs";

export const REQUIRED_CASE_FIELDS = [
  "id",
  "toolId",
  "expectedAgent",
  "expectedCapability",
  "scenario",
];

export function parseGoldenSet(text) {
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
      return parsed;
    });
}

export function loadGoldenSet(path) {
  return parseGoldenSet(readFileSync(path, "utf8"));
}

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
