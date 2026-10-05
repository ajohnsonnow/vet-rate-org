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
