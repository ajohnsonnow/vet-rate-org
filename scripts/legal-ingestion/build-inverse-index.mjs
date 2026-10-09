#!/usr/bin/env node
/**
 * build-inverse-index.mjs — eCFR section → diagnostic codes map.
 *
 * Reads src/data/disabilityData.json (ratingSchedule + ecfrUrl per entry)
 * and emits public/data/ecfr-dc-map.json so automation can answer
 * "§ 4.87 changed — which DKB entries are affected?".
 *
 * scripts/validate-dkb.mjs imports buildSectionMap to verify the committed
 * map stays in sync with disabilityData.json.
 *
 * Usage:
 *   node scripts/legal-ingestion/build-inverse-index.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_PATH = path.join(ROOT, "src", "data", "disabilityData.json");
const OUT_PATH = path.join(ROOT, "public", "data", "ecfr-dc-map.json");

// Matches "4.71a" in both "38 CFR § 4.71a" and ".../section-4.71a".
// Range refs like "4.75-4.84" yield their two endpoints.
const SECTION_RE = /\b(\d+\.\d+[a-z]?)\b/g;

export function extractSections(entry) {
  const sections = new Set();
  for (const text of [entry.ratingSchedule, entry.ecfrUrl]) {
    if (typeof text !== "string") continue;
    for (const m of text.matchAll(SECTION_RE)) sections.add(m[1]);
  }
  return sections;
}

/**
 * @param {Array<Object>} disabilities — disabilityData.json `disabilities`
 * @returns {Record<string, string[]>} section id → sorted diagnostic codes
 */
export function buildSectionMap(disabilities) {
  const map = new Map();
  for (const entry of disabilities) {
    const dc = String(entry.diagnosticCode);
    for (const section of extractSections(entry)) {
      if (!map.has(section)) map.set(section, new Set());
      map.get(section).add(dc);
    }
  }
  const sections = {};
  const keys = [...map.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  for (const key of keys) {
    sections[key] = [...map.get(key)].sort();
  }
  return sections;
}

function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const sections = buildSectionMap(data.disabilities);

  const mappedDcs = new Set();
  for (const dcs of Object.values(sections)) {
    for (const dc of dcs) mappedDcs.add(dc);
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "src/data/disabilityData.json",
      conditionCount: data.disabilities.length,
      sectionCount: Object.keys(sections).length,
      mappedDcCount: mappedDcs.size,
    },
    sections,
  };

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `[inverse-index] wrote ${out.meta.sectionCount} sections covering ` +
      `${out.meta.mappedDcCount}/${out.meta.conditionCount} diagnostic codes → ${OUT_PATH}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
