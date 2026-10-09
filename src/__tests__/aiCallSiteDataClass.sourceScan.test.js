/**
 * ADR-009: every call to the provider boundary (`generateAI`) must declare
 * a `dataClass` ("document" | "context") at the call site - a call with no
 * declaration fails closed to "document" inside `generateAIInternal`
 * (aiDataClassPolicy.resolveDataClass), but that silent default is exactly
 * the failure mode a reviewer can miss: a genuinely "context"-only call
 * left undeclared would quietly stop reaching an off-device provider it
 * used to work on, with no test ever catching the regression.
 *
 * This is a static scan, not a runtime check - same `readFileSync`/
 * `readdirSync` pattern as serviceEntryWriteBoundary.test.js/s6Cleanup.test.js.
 * It fails on ANY new `generateAI(` call site added to src/ without a
 * `dataClass:` key somewhere in that call's argument list, regardless of
 * which value is used.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");

// Word-boundary before "generateAI(" so this never matches
// "generateAIWithImage(" (a different, always-on-device export with no
// off-device path to gate) or a differently-named function.
const CALL_RE = /\bgenerateAI\(/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (/\.(js|jsx)$/.test(entry) && !/\.test\./.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function relPath(full) {
  return relative(process.cwd(), full).split("\\").join("/");
}

// Balanced-paren slice of the call's full argument list, starting right
// after "generateAI(" - robust to multi-line option objects, unlike a
// fixed-length substring.
function _callArgsSlice(src, openParenIndex) {
  let depth = 1;
  let i = openParenIndex + 1;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
  }
  return src.slice(openParenIndex + 1, i);
}

const DATA_CLASS_KEY_RE = /\bdataClass\s*:/;

// unifiedAIService.js defines generateAI (as `generateAI = async (...) =>`,
// which CALL_RE never matches - no `(` immediately follows the identifier
// there) and is the enforcement point itself; nothing to scan.
const SELF_FILE = "src/utils/unifiedAIService.js";

// A prose reference to generateAI() inside a `//` or JSDoc `*` comment line
// (e.g. this file's own doc comment, or dualLLM.js's design-rationale
// header) is not a real call site - skip it rather than false-positive on
// documentation. Real call sites are never comment-prefixed.
function _isCommentLine(src, matchIndex) {
  const lineStart = src.lastIndexOf("\n", matchIndex) + 1;
  const linePrefix = src.slice(lineStart, matchIndex).trimStart();
  return linePrefix.startsWith("*") || linePrefix.startsWith("//");
}

function findUndeclaredCallSites() {
  const offenders = [];
  for (const full of walk(SRC_ROOT)) {
    const rel = relPath(full);
    if (rel === SELF_FILE) continue;
    const src = readFileSync(full, "utf8");
    CALL_RE.lastIndex = 0;
    let match;
    while ((match = CALL_RE.exec(src))) {
      if (_isCommentLine(src, match.index)) continue;
      const openParenIndex = match.index + "generateAI".length;
      const argsSlice = _callArgsSlice(src, openParenIndex);
      if (!DATA_CLASS_KEY_RE.test(argsSlice)) {
        const line = src.slice(0, match.index).split("\n").length;
        offenders.push(`${rel}:${line}`);
      }
    }
  }
  return offenders;
}

describe("ADR-009: every generateAI call site declares a dataClass", () => {
  it("CALL_RE matches a real call and not the lookalike generateAIWithImage export (self-check)", () => {
    expect(CALL_RE.test("await generateAI(prompt, { dataClass: 'x' })")).toBe(
      true,
    );
    CALL_RE.lastIndex = 0;
    expect(CALL_RE.test("export const generateAIWithImage = async (")).toBe(
      false,
    );
  });

  it("DATA_CLASS_KEY_RE self-check: catches a declared call, rejects an undeclared one", () => {
    expect(
      DATA_CLASS_KEY_RE.test(
        "prompt, { temperature: 0.2, dataClass: AI_DATA_CLASS.DOCUMENT }",
      ),
    ).toBe(true);
    expect(DATA_CLASS_KEY_RE.test("prompt, { temperature: 0.2 }")).toBe(false);
  });

  it("_callArgsSlice self-check: balances nested parens across a multi-line call", () => {
    const src =
      "await generateAI(prompt, {\n  systemPrompt: build(a, b),\n  dataClass: AI_DATA_CLASS.CONTEXT,\n});";
    const openParenIndex = src.indexOf("generateAI(") + "generateAI".length;
    const slice = _callArgsSlice(src, openParenIndex);
    expect(slice).toContain("dataClass: AI_DATA_CLASS.CONTEXT");
    expect(slice).not.toContain("});");
  });

  it("_isCommentLine self-check: skips a doc-comment mention, not a real call", () => {
    const commented =
      " * DD214Analyzer call single-LLM generateAI(); design note";
    const idx = commented.indexOf("generateAI(");
    expect(_isCommentLine(commented, idx)).toBe(true);

    const real = "  const r = await generateAI(prompt, { dataClass: 'x' });";
    const idx2 = real.indexOf("generateAI(");
    expect(_isCommentLine(real, idx2)).toBe(false);
  });

  it("no generateAI call site in src/ omits a dataClass declaration", () => {
    const offenders = findUndeclaredCallSites();
    expect(offenders).toEqual([]);
  });
});
