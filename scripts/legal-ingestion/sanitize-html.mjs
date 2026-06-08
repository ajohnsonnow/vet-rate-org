/**
 * sanitize-html.mjs — strip-on-ingest defense for legal HTML/markdown.
 *
 * Removes anything that could survive into a prompt and influence the
 * model: script/style/iframe tags, inline event handlers, non-gov URLs.
 * Decodes HTML entities to a normalized plain-text form so chunking +
 * embedding don't see garbage like `&amp;` or `&sect;`.
 *
 * Used by every fetcher in this directory. Pure functions; no deps.
 */

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const IFRAME_RE = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi;
const ON_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const TAG_RE = /<[^>]+>/g;
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
 * Strip HTML / decode entities / drop unsafe URLs.
 *
 * @param {string} html — raw HTML or markdown from a legal source
 * @returns {string} sanitized plain text
 */
export function sanitizeLegalHtml(html) {
  if (!html || typeof html !== "string") return "";
  let out = html;

  // Drop active tags + their bodies.
  out = out.replace(SCRIPT_RE, " ");
  out = out.replace(STYLE_RE, " ");
  out = out.replace(IFRAME_RE, " ");

  // Strip inline event handlers (even after removing tags below, the
  // string form of handler bodies can carry JS).
  out = out.replace(ON_HANDLER_RE, "");

  // Drop all remaining tags.
  out = out.replace(TAG_RE, " ");

  // Decode entities to normalized characters.
  out = decodeEntities(out);

  // Replace non-gov URLs with a marker so they don't survive into prompts.
  out = stripNonGovUrls(out);

  // Collapse whitespace.
  out = out.replace(/\s+/g, " ").trim();

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
