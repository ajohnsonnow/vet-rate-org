import { existsSync, readFileSync } from "node:fs";

export { extractCfrSections } from "../../../src/utils/cfrCitations.js";

export const DEFAULT_LEGAL_CHUNKS_PATH =
  "public/legal-index/v0.1.0/chunks/ecfr.jsonl";

const SECTION = String.raw`\d{1,3}\.\d{1,4}[a-z]?`;

const CITATION_SECTION = new RegExp(
  String.raw`38\s*CFR\s*§+\s*(${SECTION})`,
  "i",
);

export function isGitLfsPointer(text) {
  return /^version https:\/\/git-lfs\.github\.com\/spec\/v1/.test(text);
}

/**
 * Build the set of indexed 38 CFR sections from the text of the legal index
 * chunk file (one JSON record per line, each with a `citation` field).
 * Returns { sections, reason }: `sections` is null, with a reason, when the
 * file cannot serve as ground truth (an un-fetched git-lfs pointer, or no
 * parseable 38 CFR citation at all).
 */
export function parseLegalChunks(text) {
  if (isGitLfsPointer(text)) {
    return {
      sections: null,
      reason:
        "chunk file is a git-lfs pointer (run `git lfs pull` or pass --legal-chunks <path to the real ecfr.jsonl>)",
    };
  }
  const sections = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const match = CITATION_SECTION.exec(String(record?.citation ?? ""));
    if (match) sections.add(match[1].toLowerCase());
  }
  if (sections.size === 0) {
    return {
      sections: null,
      reason: "no '38 CFR § <section>' citation found in the chunk file",
    };
  }
  return { sections, reason: null };
}

export function loadLegalSections(path = DEFAULT_LEGAL_CHUNKS_PATH) {
  if (!existsSync(path)) {
    return {
      sections: null,
      reason: `legal index chunk file not found: ${path}`,
    };
  }
  return parseLegalChunks(readFileSync(path, "utf8"));
}
