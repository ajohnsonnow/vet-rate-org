/**
 * sanitize-html.mjs — strip-on-ingest defense for legal HTML/markdown.
 *
 * Removes anything that could survive into a prompt and influence the
 * model: script/style/iframe tags, inline event handlers, non-gov URLs.
 * Decodes HTML entities to a normalized plain-text form so chunking +
 * embedding don't see garbage like `&amp;` or `&sect;`.
 *
 * Table fidelity (S19): a minimal allow-list converts `<table>` structure
 * (`thead/tbody/tr/td/th/caption`) into Markdown pipe tables so CFR rating
 * schedules survive ingestion as structured rows instead of a flattened
 * prose blob. The conversion runs AFTER script/style/iframe/handler
 * removal, so nothing dangerous can ride inside a cell into the output —
 * see the "Security ordering" note on sanitizeLegalHtml.
 *
 * Used by every fetcher in this directory. Pure functions; no deps.
 */

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const IFRAME_RE = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi;
const ON_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const TAG_RE = /<[^>]+>/g;

// Table allow-list (S19). One table at a time; non-greedy so sibling tables
// don't merge. CFR tables are never nested.
const TABLE_RE = /<table\b[^>]*>[\s\S]*?<\/table\s*>/gi;
const CAPTION_RE = /<caption\b[^>]*>([\s\S]*?)<\/caption\s*>/i;
const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
const CELL_RE = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]\s*>/gi;
const INNER_TAG_RE = /<[^>]+>/g;
// Block-level boundaries become newlines so the structural chunker (chunk.mjs)
// can split prose on paragraph/sub-paragraph edges instead of mid-sentence.
const BLOCK_BOUNDARY_RE =
  /<\/?(?:p|div|li|ul|ol|h[1-6]|br|hr|blockquote|section|article|dd|dt|figcaption)\b[^>]*>/gi;
// Encoded pipe / newline entities that would otherwise decode (later, globally)
// into characters that break Markdown table structure. Neutralized inside cells
// only — a table-fidelity guard, not a security control.
const ENC_PIPE_RE = /&#0*124;|&#x0*7c;/gi;
const ENC_NEWLINE_RE = /&#0*(?:10|13);|&#x0*[ad];/gi;
const ENTITY_MAP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&sect;": "§",
  "&para;": "¶",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&copy;": "©",
  "&reg;": "®",
};

// LLM-output URL allow-list mirrors src/utils/sanitize.js. Keep in sync.
const GOV_URL_RE =
  /https:\/\/(?:[^/]+\.)?(va\.gov|ecfr\.gov|federalregister\.gov|uscourts\.cavc\.gov|cafc\.uscourts\.gov|ssa\.gov|house\.gov|senate\.gov)(?:\/[^\s)<>\]"'`]*)?/gi;

const ANY_URL_RE = /https?:\/\/[^\s)<>\]"'`]+/gi;

function decodeEntities(text) {
  // Named entities first
  let out = text;
  for (const [entity, ch] of Object.entries(ENTITY_MAP)) {
    out = out.split(entity).join(ch);
  }
  // Numeric entities &#1234; / &#x1F;
  out = out.replace(/&#(\d+);/g, (_, code) =>
    String.fromCodePoint(Number.parseInt(code, 10) || 0),
  );
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
    String.fromCodePoint(Number.parseInt(hex, 16) || 0),
  );
  return out;
}

function stripNonGovUrls(text) {
  // Pull every URL; replace non-gov URLs with [external-link]. Preserves
  // gov URLs because runtime citation rendering depends on them.
  return text.replace(ANY_URL_RE, (url) => {
    GOV_URL_RE.lastIndex = 0;
    return GOV_URL_RE.test(url) ? url : "[external-link]";
  });
}

/**
 * Reduce one table cell's inner HTML to a single-line, pipe-safe plain string.
 *
 * Runs during table conversion, i.e. AFTER script/style/iframe/handler removal
 * has already swept the whole document — so a cell can only contain inert
 * markup at this point. Inner tags are dropped; literal and entity-encoded
 * pipes are escaped and encoded newlines neutralized so an attacker cannot
 * forge extra columns/rows to reshape the Markdown table. Entity decoding and
 * non-gov-URL stripping are deliberately left to the global passes that run
 * later over the whole string (avoids double-decoding cell text).
 */
function cellText(rawCell) {
  return rawCell
    .replace(INNER_TAG_RE, " ") // drop inert inner markup
    .replace(/\|/g, "\\|") // literal pipe -> escaped (before we mint any)
    .replace(ENC_PIPE_RE, "\\|") // encoded pipe -> escaped, before global decode
    .replace(ENC_NEWLINE_RE, " ") // encoded newline -> space, before global decode
    .replace(/[\r\n]+/g, " ") // any stray newline -> space (single-line cell)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert one `<table>…</table>` fragment to a Markdown pipe table. Every
 * emitted line starts with `|`, so chunk.mjs can detect the contiguous run as
 * one atomic block and never split it. Caption (if any) becomes a leading
 * single-cell row so it stays inside that atomic block. Returns "" for a table
 * with no usable rows so it collapses away cleanly.
 */
function convertOneTable(tableHtml) {
  const lines = [];

  const capMatch = CAPTION_RE.exec(tableHtml);
  let body = tableHtml;
  if (capMatch) {
    const caption = cellText(capMatch[1]);
    if (caption) lines.push(`| ${caption} |`);
    body = body.replace(CAPTION_RE, " ");
  }

  ROW_RE.lastIndex = 0;
  let rowMatch;
  let emittedHeaderSep = false;
  while ((rowMatch = ROW_RE.exec(body)) !== null) {
    const cells = [];
    CELL_RE.lastIndex = 0;
    let cellMatch;
    while ((cellMatch = CELL_RE.exec(rowMatch[1])) !== null) {
      cells.push(cellText(cellMatch[1]));
    }
    if (cells.length === 0) continue;
    lines.push(`| ${cells.join(" | ")} |`);
    if (!emittedHeaderSep) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
      emittedHeaderSep = true;
    }
  }

  // A caption with no rows is not a table worth keeping atomic.
  if (!emittedHeaderSep) return " ";
  // Blank-line fenced so the chunker sees each table as its own block (rows
  // stay single-newline-joined and never split); adjacent tables don't merge.
  return `\n\n${lines.join("\n")}\n\n`;
}

function tablesToMarkdown(html) {
  return html.replace(TABLE_RE, (m) => convertOneTable(m));
}

/**
 * Final whitespace normalize that PRESERVES the newlines the pipeline inserts
 * on purpose (Markdown table rows + block/paragraph boundaries) while
 * collapsing every other whitespace run. The legacy sanitizer collapsed
 * everything to a single line; the structural chunker now needs those
 * boundaries.
 */
function collapseWhitespace(text) {
  return text
    .replace(/[^\S\n]+/g, " ") // horizontal whitespace -> single space
    .replace(/ *\n */g, "\n") // trim around newlines
    .replace(/\n{3,}/g, "\n\n") // >1 blank line -> single blank line
    .trim();
}

/**
 * Strip HTML / decode entities / drop unsafe URLs; convert allow-listed
 * tables to Markdown.
 *
 * Security ordering (do not reorder): every active-content control —
 * script/style/iframe bodies and inline `on*=` handlers — is removed from the
 * WHOLE document BEFORE any table is converted. So by the time a `<td>` is read
 * into a Markdown cell it can only hold inert markup; the table allow-list
 * cannot reopen an injection surface. Non-gov URLs and HTML entities are then
 * neutralized globally over the converted string, covering table cells and
 * prose identically. This is the strip-on-ingest defense the runtime dual-LLM
 * spotlighting relies on (docs/RAG_DESIGN.md §7); the table support widens
 * content fidelity, not the trust surface.
 *
 * @param {string} html — raw HTML or markdown from a legal source
 * @returns {string} sanitized plain text (Markdown tables preserved)
 */
export function sanitizeLegalHtml(html) {
  if (!html || typeof html !== "string") return "";
  let out = html;

  // 1. Drop active tags + their bodies (whole document, before table read).
  out = out.replace(SCRIPT_RE, " ");
  out = out.replace(STYLE_RE, " ");
  out = out.replace(IFRAME_RE, " ");

  // 2. Strip inline event handlers (even after removing tags below, the
  //    string form of handler bodies can carry JS) — also before table read.
  out = out.replace(ON_HANDLER_RE, "");

  // 3. Normalize incidental HTML whitespace/indentation to single spaces so
  //    the only newlines downstream are the structural ones inserted below.
  out = out.replace(/\s+/g, " ");

  // 4. Convert allow-listed tables to Markdown (cells are text-only by now).
  out = tablesToMarkdown(out);

  // 5. Turn block-level boundaries into blank lines so the structural chunker
  //    sees one paragraph per block, then drop every remaining tag.
  out = out.replace(BLOCK_BOUNDARY_RE, "\n\n");
  out = out.replace(TAG_RE, " ");

  // 6. Decode entities to normalized characters.
  out = decodeEntities(out);

  // 7. Replace non-gov URLs with a marker so they don't survive into prompts
  //    (covers table cells and prose alike).
  out = stripNonGovUrls(out);

  // 8. Collapse whitespace, preserving the structural newlines from 4 & 5.
  out = collapseWhitespace(out);

  return out;
}

/**
 * Compute a stable content hash for change-detection across runs.
 * Sync wrapper around node:crypto.
 *
 * @param {string} text
 * @returns {Promise<string>} `sha256:…` hex digest
 */
export async function contentHash(text) {
  const { createHash } = await import("node:crypto");
  return "sha256:" + createHash("sha256").update(text ?? "").digest("hex");
}

/**
 * Build the canonical record schema every fetcher emits.
 * @returns {{ source: string, jurisdiction: string, citation: string, title: string, body: string, fetched_at: string, source_url: string, content_hash: string }}
 */
export async function makeRecord({
  source,
  jurisdiction = "federal",
  citation,
  title,
  body,
  source_url,
}) {
  const sanitized = sanitizeLegalHtml(body);
  return {
    source,
    jurisdiction,
    citation,
    title,
    body: sanitized,
    fetched_at: new Date().toISOString(),
    source_url,
    content_hash: await contentHash(sanitized),
  };
}
