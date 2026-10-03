/**
 * Reads the JSON a model wrote for a DD-214. A reply is parsed as it stands
 * first; only a reply that is not valid JSON has comments and trailing commas
 * removed, and that cleanup never touches text inside a quoted string (a unit
 * or transfer line can legitimately contain "//" or "/*").
 */

// Tracks whether the scan is inside a JSON string. A backslash-escaped
// character (including an escaped quote) never ends the string early.
export function advanceStringState(ch, { inString, escaped }) {
  if (!inString) return { inString: ch === '"', escaped: false };
  if (escaped) return { inString: true, escaped: false };
  if (ch === "\\") return { inString: true, escaped: true };
  if (ch === '"') return { inString: false, escaped: false };
  return { inString, escaped };
}

// Finds the FIRST balanced top-level {...} object in text via brace-depth
// counting. A greedy first-brace-to-last-brace match broke on multi-page
// vision output, where each page's own JSON object is joined with a
// "--- Page Break ---" separator. A brace inside a JSON string value never
// counts.
export function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let state = { inString: false, escaped: false };
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const wasInString = state.inString;
    state = advanceStringState(ch, state);
    if (wasInString || state.inString) continue;

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function skipLineComment(text, from) {
  let i = from;
  while (i < text.length && text[i] !== "\n" && text[i] !== "\r") i++;
  return i;
}

function skipBlockComment(text, from) {
  const end = text.indexOf("*/", from + 2);
  return end === -1 ? text.length : end + 2;
}

export function stripJsonComments(text) {
  let out = "";
  let state = { inString: false, escaped: false };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (!state.inString && ch === "/" && next === "/") {
      i = skipLineComment(text, i);
    } else if (!state.inString && ch === "/" && next === "*") {
      i = skipBlockComment(text, i);
    } else {
      state = advanceStringState(ch, state);
      out += ch;
      i++;
    }
  }
  return out;
}

function nextSignificant(text, from) {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i++;
  return text[i];
}

export function dropTrailingCommas(text) {
  let out = "";
  let state = { inString: false, escaped: false };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isTrailing =
      !state.inString &&
      ch === "," &&
      ["}", "]"].includes(nextSignificant(text, i + 1));
    if (isTrailing) continue;
    state = advanceStringState(ch, state);
    out += ch;
  }
  return out;
}

function removeFences(text) {
  let out = text.trim();
  if (out.startsWith("```json")) out = out.slice(7);
  if (out.startsWith("```")) out = out.slice(3);
  if (out.endsWith("```")) out = out.slice(0, -3);
  return out.trim();
}

/**
 * Parse a model reply into an object. Throws when no variant parses; the
 * thrown error never carries the reply (it can hold identifiers).
 */
export function parseModelJsonReply(content) {
  const unfenced = removeFences(
    typeof content === "string" ? content : JSON.stringify(content),
  );
  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through to extraction and cleanup
  }
  const extracted = extractFirstJsonObject(unfenced);
  try {
    return JSON.parse(extracted);
  } catch {
    // fall through to cleanup
  }
  return JSON.parse(dropTrailingCommas(stripJsonComments(extracted)).trim());
}
