#!/usr/bin/env node
/**
 * grid-mobile-audit.mjs — reporting-only detector for non-responsive CSS grids.
 *
 * S10 (docs/SPRINT_PLAN_S9-S17.md, Layer 3): the mobile defect is a Tailwind
 * `grid` whose UNPREFIXED column count is >= 2 — that count is what a 360px
 * phone renders, so `grid grid-cols-3` paints three columns on a phone and
 * overflows/cramps. The fix target is `grid-cols-1 sm:grid-cols-2 md:grid-cols-N`.
 *
 * This script ONLY reports. It never edits a file. It classifies each finding
 * into:
 *   - clean      : static className, static base grid-cols-N (N>=2), no col-span/
 *                  col-start anywhere in the same className → safe to apply the
 *                  mechanical `grid-cols-1 sm:` prefix after a visual check.
 *   - ambiguous  : dynamic className (template `${}`) OR interpolated grid-cols
 *                  OR col-span/col-start present (fixed-child layout — reflowing
 *                  columns may move spanned children) OR a known string-builder
 *                  file → must be hand-reviewed.
 *
 * Output: docs/audit/grid-mobile-worklist.{json,md}.
 *
 * Usage: node scripts/grid-mobile-audit.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

// String-builder / data files whose class strings are assembled, not authored as
// final markup — never mechanically rewrite these (plan: exclude colorSchemas.js
// + index.css literals). index.css is CSS, not scanned here.
const STRING_BUILDER_HINTS = ["colorSchemas", "/data/", "\\data\\"];

const VARIANT_RE = /:/; // any token with a colon carries a responsive/state variant
const BASE_GRID_RE = /^grid-cols-(\d+|\[[^\]]*\]|\$)/; // unprefixed grid-cols-*

/** Recursively collect .jsx/.js/.tsx/.ts files under a dir. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// --- string-aware scanners: return the index just past the closing delimiter ---
function skipString(code, i, quote) {
  i++; // past opening quote
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") i += 2;
    else if (c === quote) return i + 1;
    else i++;
  }
  return i;
}
function skipTemplate(code, i) {
  i++; // past opening backtick
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") i += 2;
    else if (c === "`") return i + 1;
    else if (c === "$" && code[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < code.length && depth > 0) {
        const d = code[i];
        if (d === "{") depth++;
        else if (d === "}") depth--;
        else if (d === '"' || d === "'") i = skipString(code, i, d) - 1;
        else if (d === "`") i = skipTemplate(code, i) - 1;
        i++;
      }
    } else i++;
  }
  return i;
}

/**
 * Extract className values only — anchored on `className=` so apostrophes in JSX
 * prose (you're, don't) can never be mistaken for string delimiters. Handles
 * `className="..."`, `className={`...`}`, and brace expressions (cn()/clsx()/
 * ternary) by pulling every double-quoted and template fragment from the
 * balanced `{...}`. Single-quoted class strings are intentionally skipped — the
 * codebase authors classes with double quotes / backticks, and single-quote
 * scanning is the source of the apostrophe false positives.
 */
/** Collect every "..." and `...` fragment from a balanced `{...}` brace expression. */
function extractBraceFragments(code, i, lineOf) {
  let depth = 1;
  i++;
  const fragments = [];
  while (i < code.length && depth > 0) {
    const c = code[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === '"') {
      const end = skipString(code, i, '"');
      fragments.push({ inner: code.slice(i + 1, end - 1), tpl: false, at: i });
      i = end;
      continue;
    } else if (c === "`") {
      const end = skipTemplate(code, i);
      fragments.push({ inner: code.slice(i + 1, end - 1), tpl: true, at: i });
      i = end;
      continue;
    } else if (c === "'") {
      i = skipString(code, i, "'");
      continue;
    }
    i++;
  }
  const conditional = fragments.length > 1;
  const results = [];
  for (const f of fragments) {
    if (!f.inner.includes("grid-cols-")) continue;
    results.push({
      inner: f.inner,
      line: lineOf(f.at),
      isTemplate: f.tpl || conditional,
      at: f.at,
    });
  }
  return results;
}

function extractClassNames(code) {
  const results = [];
  const re = /className\s*=\s*/g;
  const lineOf = (idx) => code.slice(0, idx).split("\n").length;
  while (re.exec(code) !== null) {
    const i = re.lastIndex;
    if (code[i] === '"' || code[i] === "'") {
      const end = skipString(code, i, code[i]);
      const inner = code.slice(i + 1, end - 1);
      if (inner.includes("grid-cols-"))
        results.push({ inner, line: lineOf(i), isTemplate: false, at: i });
    } else if (code[i] === "{") {
      // balanced brace expression — collect every "..." and `...` fragment
      results.push(...extractBraceFragments(code, i, lineOf));
    }
  }
  return results;
}

const UP_VARIANT_RE = /\b(sm|md|lg|xl|2xl):grid-cols-/; // a responsive step up

/** Mechanical fix target for an unprefixed base column count. */
function suggestFor(cols) {
  if (cols === 2) return "grid-cols-1 sm:grid-cols-2";
  if (cols === 3) return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  return `grid-cols-1 sm:grid-cols-2 md:grid-cols-${cols}`; // cols >= 4
}

/** Analyze one className-bearing string. Returns a finding or null. */
function analyze(str) {
  const { inner, isTemplate } = str;
  // Tokenize on whitespace; template `${...}` chunks survive as opaque tokens.
  const tokens = inner.split(/\s+/).filter(Boolean);

  // Find the unprefixed grid-cols token(s).
  const baseTokens = tokens.filter(
    (t) => !VARIANT_RE.test(t) && BASE_GRID_RE.test(t),
  );
  if (baseTokens.length === 0) return null; // only responsive cols → mobile-safe

  // Determine the base column count from the first unprefixed grid-cols.
  const base = baseTokens[0];
  const numMatch = base.match(/^grid-cols-(\d+)$/);
  const isDynamicCols =
    base.includes("${") || base.includes("[") || !numMatch;
  const cols = numMatch ? Number(numMatch[1]) : null;

  // grid-cols-1 base is already mobile-safe.
  if (cols === 1) return null;

  const interpolated = isTemplate && inner.includes("${");
  const hasColSpan = /\bcol-(span|start|end)-/.test(inner);

  const reasons = [];
  if (isDynamicCols) reasons.push("dynamic-col-count");
  if (interpolated) reasons.push("template-className");
  if (hasColSpan) reasons.push("fixed-child(col-span/start)");

  // Priority by what the phone actually renders (the unprefixed base count):
  // >=4 cols on 360px cramps/overflows (high); 3 is tight (medium); 2 is
  // usually acceptable (low). hasUpVariant means the author already authored a
  // responsive ladder and the base IS the deliberate mobile layout — the
  // mechanical prefix must reconcile with the existing variants, not concat.
  const hasUpVariant = UP_VARIANT_RE.test(inner);
  let priority;
  if (cols >= 4) priority = "high";
  else if (cols === 3) priority = "medium";
  else priority = "low";

  return {
    cols,
    bucket: reasons.length ? "ambiguous" : "clean",
    reasons,
    priority,
    hasUpVariant,
    suggested: isDynamicCols ? null : suggestFor(cols),
    className: inner.length > 160 ? inner.slice(0, 157) + "…" : inner,
  };
}

const files = walk(SRC);
const findings = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join("/");
  const isStringBuilder = STRING_BUILDER_HINTS.some((h) =>
    file.includes(h.split("/").join(sep)) || file.includes(h),
  );
  const code = readFileSync(file, "utf8");
  for (const str of extractClassNames(code)) {
    const a = analyze(str);
    if (!a) continue;
    let bucket = a.bucket;
    const reasons = [...a.reasons];
    // Subtree col-span scan: analyze() only sees the grid's OWN className, but a
    // fixed-child layout puts col-span/col-start on the *child* elements (e.g.
    // a grid-cols-6 form row with col-span-3 City + col-span-1 State). Reflowing
    // such a grid moves the spanned children, so it must be hand-fixed. Scan a
    // bounded window of the source right after the grid's className — the
    // immediate children — for child spans. Heuristic + bounded: it errs toward
    // ambiguous (safe for a report), never silently labels a span layout clean.
    if (
      typeof str.at === "number" &&
      !reasons.includes("fixed-child(col-span/start)") &&
      /\bcol-(span|start|end)-/.test(code.slice(str.at, str.at + 900))
    ) {
      bucket = "ambiguous";
      reasons.push("fixed-child-subtree(verify)");
    }
    if (isStringBuilder) {
      bucket = "ambiguous";
      reasons.push("string-builder-file");
    }
    findings.push({
      file: rel,
      line: str.line,
      cols: a.cols,
      bucket,
      reasons,
      priority: a.priority,
      hasUpVariant: a.hasUpVariant,
      suggested: a.suggested,
      className: a.className,
    });
  }
}

findings.sort(
  (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
);

const clean = findings.filter((f) => f.bucket === "clean");
const ambiguous = findings.filter((f) => f.bucket === "ambiguous");
const byPriority = (p) => clean.filter((f) => f.priority === p);
const high = byPriority("high");
const medium = byPriority("medium");
const low = byPriority("low");

// JSON artifact
const json = {
  generated: "run `node scripts/grid-mobile-audit.mjs` to refresh",
  totals: {
    findings: findings.length,
    clean: clean.length,
    ambiguous: ambiguous.length,
    high: high.length,
    medium: medium.length,
    low: low.length,
    files: new Set(findings.map((f) => f.file)).size,
  },
  clean,
  ambiguous,
};
writeFileSync(
  join(ROOT, "docs/audit/grid-mobile-worklist.json"),
  JSON.stringify(json, null, 2) + "\n",
);

// Markdown worklist
const byFile = (list) => {
  const map = new Map();
  for (const f of list) {
    if (!map.has(f.file)) map.set(f.file, []);
    map.get(f.file).push(f);
  }
  return [...map.entries()];
};
const fmt = (list) =>
  byFile(list)
    .map(
      ([file, items]) =>
        `### ${file}\n\n` +
        items
          .map(
            (i) =>
              `- L${i.line} \`grid-cols-${i.cols}\`` +
              (i.hasUpVariant ? " · already-responsive" : "") +
              (i.reasons.length ? ` — ${i.reasons.join(", ")}` : "") +
              `\n  current: \`${i.className}\`` +
              (i.suggested ? `\n  suggest base → \`${i.suggested}\`` : ""),
          )
          .join("\n"),
    )
    .join("\n\n");

const md = `# Grid mobile worklist (S10, reporting-only)

> Generated by \`scripts/grid-mobile-audit.mjs\`. Lists every Tailwind grid whose
> **unprefixed** column count is >= 2 — that count is what a 360px phone renders.
> Priority is by that mobile column count: **high** = 4+ cols (cramps/overflows a
> phone), **medium** = 3 cols (tight), **low** = 2 cols (usually acceptable).
> \`already-responsive\` means the author wrote an \`sm:/md:\` ladder, so the base IS
> the deliberate mobile layout — reconcile the suggested prefix with the existing
> variants, don't blind-concat. **Apply per-cluster with a visual check — never
> bulk auto-commit.**

**Totals:** ${findings.length} findings across ${json.totals.files} files — ${clean.length} clean (${high.length} high, ${medium.length} medium, ${low.length} low), ${ambiguous.length} ambiguous.

## High priority — 4+ unprefixed columns (cramps/overflows at 360px)

${high.length ? fmt(high) : "_None._"}

## Medium priority — 3 unprefixed columns (tight at 360px)

${medium.length ? fmt(medium) : "_None._"}

## Low priority — 2 unprefixed columns (usually acceptable; review text-heavy cells)

${low.length ? fmt(low) : "_None._"}

## Ambiguous bucket (hand-review: dynamic class, interpolated cols, fixed children, or string-builder)

${ambiguous.length ? fmt(ambiguous) : "_None._"}
`;
writeFileSync(join(ROOT, "docs/audit/grid-mobile-worklist.md"), md);

console.log(
  `grid-mobile-audit: ${findings.length} findings (${clean.length} clean [${high.length} high, ${medium.length} medium, ${low.length} low], ${ambiguous.length} ambiguous) across ${json.totals.files} files.`,
);
console.log("→ docs/audit/grid-mobile-worklist.md");
console.log("→ docs/audit/grid-mobile-worklist.json");
