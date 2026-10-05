import { existsSync, readFileSync } from "node:fs";

export const DEFAULT_LEGAL_CHUNKS_PATH =
  "public/legal-index/v0.1.0/chunks/ecfr.jsonl";

const SECTION = String.raw`\d{1,3}\.\d{1,4}[a-z]?`;
const CFR_HEAD = new RegExp(
  String.raw`\b38\s*C\.?\s*F\.?\s*R\.?\s*(?:§§?|sections?|secs?\.?)?\s*(${SECTION})(?![\d.]*\d)`,
  "gi",
);
const CFR_CONTINUATION = new RegExp(
  String.raw`^(?:\s*\((?:[a-z0-9]{1,4})\))*\s*(?:,|;|\band\b|&|\bor\b)\s*(?:(?:and|or)\s+)?(?:§§?\s*)?(${SECTION})(?![\d.]*\d)`,
  "i",
);

/**
 * Every 38 CFR section a text cites, normalised to lower-case
 * "<part>.<section>[letter]" with paragraph designators dropped. Handles
 * "38 CFR § 4.25", "38 C.F.R. 3.304(f)" and lists introduced by one
 * "38 CFR" ("38 CFR §§ 3.304 and 3.310"). A bare "38 CFR Part 4" cites no
 * section and is ignored.
 */
export function extractCfrSections(text) {
  const found = [];
  const source = String(text ?? "");
  CFR_HEAD.lastIndex = 0;
  let head;
  while ((head = CFR_HEAD.exec(source)) !== null) {
    found.push(head[1].toLowerCase());
    let cursor = head.index + head[0].length;
    for (;;) {
      const next = CFR_CONTINUATION.exec(source.slice(cursor));
      if (!next) break;
      found.push(next[1].toLowerCase());
      cursor += next[0].length;
    }
  }
  return [...new Set(found)];
}

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
