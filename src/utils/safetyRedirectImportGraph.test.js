/**
 * Regression guard for the collection-breaking bug this branch fixed:
 * safetyRedirect.js used to import dataPersistence.js directly, which pulls
 * in persistentStorage.js -> migrationManager.js -> version.js, and version.js
 * does `import packageJson from "../../package.json"` (a bare JSON import
 * with no import attribute). Vite/vitest handle that fine, but
 * tests/e2e/panic-escape.spec.ts imports a constant straight from
 * safetyRedirect.js, and Playwright loads spec files (and everything they
 * import) with Node's native ESM loader - which throws on it. That one throw
 * aborted collection of every e2e spec file, not just this one:
 * `playwright test --list` went from 1042 tests in 26 files to 0 in 0.
 *
 * This walks safetyRedirect.js's own relative-import graph (statically, via
 * source text - no bundler involved, the same way Playwright's loader sees
 * it) and fails loudly if a `.json` file shows up anywhere in it, so a
 * future edit can't silently reintroduce this failure mode.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UTILS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Only matches named/default `... from "./x"` imports (every relative
// import in this chain is written that way) - deliberately not a
// general-purpose import parser, to keep the pattern simple enough that a
// linter's ReDoS heuristic (ours included) doesn't flag it.
const FROM_IMPORT_REGEX = /\bfrom\s*["'](\.[^"']+)["']/g;

function stripBlockComments(source) {
  let result = "";
  let index = 0;
  for (;;) {
    const start = source.indexOf("/*", index);
    if (start === -1) {
      result += source.slice(index);
      return result;
    }
    result += source.slice(index, start);
    const end = source.indexOf("*/", start + 2);
    index = end === -1 ? source.length : end + 2;
  }
}

// This file's own JSDoc above quotes the literal offending import as an
// example - comments must not be mistaken for real import statements.
function stripComments(source) {
  return stripBlockComments(source)
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n");
}

function extractRelativeImports(filePath) {
  const source = stripComments(fs.readFileSync(filePath, "utf-8"));
  return Array.from(source.matchAll(FROM_IMPORT_REGEX), (match) => match[1]);
}

function resolveModule(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.json`];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function findJsonImportsInGraph(entryFile) {
  const visited = new Set();
  const queue = [entryFile];
  const jsonImportChains = [];

  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file) || file.endsWith(".json")) continue;
    visited.add(file);

    for (const specifier of extractRelativeImports(file)) {
      const resolved = resolveModule(file, specifier);
      if (!resolved) continue;
      if (resolved.endsWith(".json")) {
        jsonImportChains.push(`${file} -> ${resolved}`);
      }
      queue.push(resolved);
    }
  }

  return jsonImportChains;
}

describe("safetyRedirect.js's import graph", () => {
  it("never transitively imports a .json file - Node's native ESM loader (used by Playwright to load e2e specs) rejects bare JSON imports", () => {
    const entry = path.join(UTILS_DIR, "safetyRedirect.js");
    expect(findJsonImportsInGraph(entry)).toEqual([]);
  });
});
