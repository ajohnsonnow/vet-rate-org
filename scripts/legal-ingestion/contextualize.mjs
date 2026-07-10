/**
 * contextualize.mjs — build-time contextual-retrieval prefix (S20).
 *
 * Prepends a short, deterministic heading-path/citation/type descriptor to a
 * chunk's text before it reaches the embedder — NOT before it's persisted.
 * The prefix only ever influences the embedding vector; the chunk's `text`
 * field shipped in chunks/{source}.jsonl is untouched, so the runtime
 * extractor in legalAnswerer.js keeps seeing exactly the same spotlighted,
 * untrusted content it always has (docs/RAG_DESIGN.md §7).
 *
 * No LLM call: the descriptor is templated from metadata already on every
 * chunk record (citation, title, table/prose type, position within its
 * parent section) — cheap, deterministic, and reproducible across builds.
 *
 * Per Anthropic's contextual-retrieval technique, situating an otherwise
 * bare fragment (e.g. a rating table that's mostly diagnostic codes and
 * percentages, with no topic words of its own) inside its section heading
 * measurably improves retrieval — this is the concrete mechanism S20 uses.
 */

// Only Part 4 is fetched today (S18/S19 corpus). S25 adds Parts 3/19/20 and
// should extend this map with their real official titles rather than
// guessing — an unfetched part falls back to a bare "38 CFR Part {n}"
// instead of a fabricated subtitle.
const PART_TITLES = {
  4: "Schedule for Rating Disabilities",
};

/**
 * Extract "38 CFR Part {n} — {title}" from a citation like "38 CFR § 4.71a".
 * Falls back gracefully if the citation doesn't match the expected shape.
 */
export function partHeading(citation) {
  const m = /38 CFR § (\d+)\./.exec(citation || "");
  if (!m) return "38 CFR";
  const partNum = m[1];
  const title = PART_TITLES[partNum];
  return title ? `38 CFR Part ${partNum} — ${title}` : `38 CFR Part ${partNum}`;
}

function isTableChunkText(text) {
  const lines = text.split("\n").filter(Boolean);
  return lines.length >= 2 && lines.every((l) => l.trimStart().startsWith("|"));
}

/**
 * Templated descriptor distinguishing a table chunk from prose, and marking
 * later fragments of a multi-chunk section as "(continued)" so near-duplicate
 * embeddings (from overlapping windows) aren't ambiguous about their position.
 */
function typeDescriptor(text, { index, total }) {
  if (isTableChunkText(text)) return " (rating table)";
  if (total > 1 && index > 0) return " (continued)";
  return "";
}

/**
 * Build the text actually fed to the embedder for one chunk. `index`/`total`
 * describe this chunk's position among all chunks produced from the same
 * parent record (citation) — used only for the "(continued)" descriptor.
 *
 * @param {{ citation: string, title: string, text: string }} chunk
 * @param {{ index?: number, total?: number }} [position]
 * @returns {string}
 */
export function contextualizeText(chunk, { index = 0, total = 1 } = {}) {
  // Deliberately NOT prefixed with partHeading()'s corpus-wide constant
  // ("38 CFR Part 4 — Schedule for Rating Disabilities") — every chunk in
  // today's single-part corpus shares it verbatim, so it adds no
  // discriminative signal while diluting each embedding's specific content.
  // An A/B against the shipped index (S18 harness) showed the full heading
  // regressed 2 previously-correct queries (q01, q44) for one rank gain
  // (q22) — net recall loss. The section title alone (which IS unique per
  // chunk) captured q22's gain without the regression. Revisit once S25
  // adds multiple parts, where the part-level heading becomes genuinely
  // discriminative again.
  const section = chunk.title ?? "";
  const descriptor = typeDescriptor(chunk.text, { index, total });
  const prefix = `${section}${descriptor}`;
  return prefix ? `${prefix}\n\n${chunk.text}` : chunk.text;
}
