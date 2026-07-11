#!/usr/bin/env node
/**
 * snapshot-ecfr-hashes.mjs — diff eCFR Part 4 section hashes for the weekly
 * DKB freshness check (.github/workflows/dkb-freshness.yml).
 *
 * Consumes the output of `fetch-ecfr.mjs --part=4` (.work/ecfr.jsonl, one
 * sanitized record per section with a stable content_hash) and compares it
 * against the committed snapshot .ecfr-part4-hashes.json. Changed sections
 * are reported with the diagnostic codes they affect, resolved via
 * public/data/ecfr-dc-map.json.
 *
 * Usage:
 *   node scripts/legal-ingestion/fetch-ecfr.mjs --part=4
 *   node scripts/legal-ingestion/snapshot-ecfr-hashes.mjs           # diff (markdown to stdout)
 *   node scripts/legal-ingestion/snapshot-ecfr-hashes.mjs --write   # update the snapshot
 *
 * Exit codes: 0 = no change, 2 = drift detected, 1 = error.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORK_FILE = path.join(__dirname, ".work", "ecfr.jsonl");
const SNAPSHOT_FILE = path.join(__dirname, ".ecfr-part4-hashes.json");
const DC_MAP_FILE = path.join(ROOT, "public", "data", "ecfr-dc-map.json");

function loadCurrentHashes() {
  if (!existsSync(WORK_FILE)) {
    throw new Error(
      `${WORK_FILE} missing — run \`node scripts/legal-ingestion/fetch-ecfr.mjs --part=4\` first`,
    );
  }
  const hashes = {};
  for (const line of readFileSync(WORK_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    // Identifiers include reserved ranges like "4.47-4.54".
    const section = /section-([\d.]+[a-z]?(?:-[\d.]+[a-z]?)?)$/.exec(
      record.source_url,
    )?.[1];
    if (!section || !section.startsWith("4.")) continue;
    hashes[section] = record.content_hash;
  }
  if (Object.keys(hashes).length === 0) {
    throw new Error("no Part 4 sections found in .work/ecfr.jsonl");
  }
  return hashes;
}

function sortedSnapshot(hashes) {
  const sorted = {};
  for (const key of Object.keys(hashes).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  )) {
    sorted[key] = hashes[key];
  }
  return {
    generatedAt: new Date().toISOString(),
    source: "eCFR title 38, part 4 (fetch-ecfr.mjs --part=4)",
    sectionCount: Object.keys(sorted).length,
    hashes: sorted,
  };
}

function affectedDcs(section, dcMap) {
  if (!dcMap) return null;
  if (dcMap.sections[section]) return dcMap.sections[section];
  // Range identifiers ("4.80-4.84") — union the endpoints' mappings.
  const dcs = new Set();
  for (const part of section.split("-")) {
    for (const dc of dcMap.sections[part] ?? []) dcs.add(dc);
  }
  return [...dcs].sort();
}

function main() {
  const args = process.argv.slice(2);
  const current = loadCurrentHashes();

  if (args.includes("--write")) {
    writeFileSync(
      SNAPSHOT_FILE,
      JSON.stringify(sortedSnapshot(current), null, 2) + "\n",
    );
    console.log(
      `[snapshot] wrote ${Object.keys(current).length} Part 4 section hashes → ${SNAPSHOT_FILE}`,
    );
    return;
  }

  if (!existsSync(SNAPSHOT_FILE)) {
    console.error(
      `[snapshot] ${SNAPSHOT_FILE} missing — run with --write to create the baseline`,
    );
    process.exit(1);
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8"));
  const dcMap = existsSync(DC_MAP_FILE)
    ? JSON.parse(readFileSync(DC_MAP_FILE, "utf8"))
    : null;

  const added = Object.keys(current).filter((s) => !(s in snapshot.hashes));
  const removed = Object.keys(snapshot.hashes).filter((s) => !(s in current));
  const changed = Object.keys(current).filter(
    (s) => s in snapshot.hashes && snapshot.hashes[s] !== current[s],
  );

  if (!added.length && !removed.length && !changed.length) {
    console.log(
      `eCFR Part 4 unchanged since snapshot of ${snapshot.generatedAt} ` +
        `(${snapshot.sectionCount} sections).`,
    );
    return;
  }

  const lines = [];
  lines.push(`## eCFR Part 4 drift since snapshot of ${snapshot.generatedAt}`);
  lines.push("");
  lines.push(
    `${changed.length} changed · ${added.length} added · ${removed.length} removed (of ${snapshot.sectionCount} snapshotted sections)`,
  );
  for (const [title, sections] of [
    ["Changed sections", changed],
    ["Added sections", added],
    ["Removed sections", removed],
  ]) {
    if (!sections.length) continue;
    lines.push("");
    lines.push(`### ${title}`);
    for (const section of sections.sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true }),
    )) {
      const dcs = affectedDcs(section, dcMap);
      let dcNote;
      if (dcs === null) {
        dcNote = "(ecfr-dc-map.json missing — affected DCs unknown)";
      } else if (dcs.length) {
        dcNote = `affects DCs: ${dcs.join(", ")}`;
      } else {
        dcNote = "no mapped diagnostic codes";
      }
      lines.push(`- **§ ${section}** — ${dcNote}`);
    }
  }
  lines.push("");
  lines.push(
    "After re-verifying the affected entries in `src/data/disabilityData.json` " +
      "(update `lastVerifiedDate`), refresh the baseline:",
  );
  lines.push("");
  lines.push("```");
  lines.push("node scripts/legal-ingestion/fetch-ecfr.mjs --part=4");
  lines.push("node scripts/legal-ingestion/snapshot-ecfr-hashes.mjs --write");
  lines.push("```");

  console.log(lines.join("\n"));
  process.exit(2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`[snapshot] FAILED: ${e.message}`);
    process.exit(1);
  }
}
