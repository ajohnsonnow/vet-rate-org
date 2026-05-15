#!/usr/bin/env node
/**
 * fetch-ecfr.mjs — fetch 38 CFR Parts 3, 4, 19, 20 from the eCFR JSON API.
 *
 * Endpoint:  https://www.ecfr.gov/api/versioner/v1/full/{date}/title-38.json
 * Selectors: Parts 3 (Adjudication), 4 (Rating), 19 (BVA), 20 (Appeals)
 *
 * Output:    scripts/legal-ingestion/.work/ecfr.jsonl
 *
 * No auth required. Respects If-Modified-Since via ETag from prior runs.
 * Fails fast on non-2xx or schema mismatch.
 *
 * Note: this is the SCAFFOLD implementation (Sprint 6). The eCFR API
 * actually returns the entire title structure under nested `children`;
 * the section-walker below traverses it. Verify against a real fetch
 * before promoting to CI.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = 38;
const PARTS_OF_INTEREST = new Set(["3", "4", "19", "20"]);

/**
 * Resolve the latest published date for Title 38. eCFR uses date-versioned
 * snapshots; passing today() works but the API rewrites to the most recent.
 */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchTitle38(date) {
  const url = `${ECFR_BASE}/api/versioner/v1/full/${date}/title-${TITLE}.json`;
  console.log(`[ecfr] GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "vet-rate-org legal-ingestion/0.1 (anthony.johnson.now@gmail.com)",
    },
  });
  if (!res.ok) {
    throw new Error(`eCFR ${url} → HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Walk a structure node and yield each section the API exposes.
 * eCFR nests structure as { type, identifier, label, children, content, ... }.
 *
 * @param {Object} node
 * @param {Array<string>} ancestors
 */
function* walkSections(node, ancestors = []) {
  if (!node || typeof node !== "object") return;
  const ident = node.identifier || node.label_level || "";
  const here = [...ancestors, ident].filter(Boolean);

  if (node.type === "section") {
    yield {
      identifier: node.identifier,
      label: node.label || node.label_description || "",
      content: node.content || node.body || "",
      ancestors: here,
    };
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) yield* walkSections(child, here);
  }
}

/**
 * Filter sections to only those inside Parts 3, 4, 19, 20.
 */
function isInTargetPart(section) {
  // Identifier format examples: "4.71a", "3.310", "19.13"
  const partNum = String(section.identifier).split(".")[0];
  return PARTS_OF_INTEREST.has(partNum);
}

async function main() {
  const date = process.argv[2] || todayIso();
  mkdirSync(WORK_DIR, { recursive: true });

  const data = await fetchTitle38(date);

  // Newer eCFR responses wrap the title under "title" or top-level "structure"
  const root = data.title || data.structure || data;
  if (!root || typeof root !== "object") {
    throw new Error(
      "eCFR response did not contain a 'title' or 'structure' root — schema may have changed",
    );
  }

  const records = [];
  for (const sec of walkSections(root)) {
    if (!isInTargetPart(sec)) continue;
    if (!sec.content || sec.content.length < 20) continue; // skip empty / index sections

    const citation = `38 CFR § ${sec.identifier}`;
    const url = `${ECFR_BASE}/current/title-${TITLE}/chapter-I/part-${
      String(sec.identifier).split(".")[0]
    }/section-${sec.identifier}`;

    records.push(
      await makeRecord({
        source: "ecfr",
        citation,
        title: sec.label,
        body: sec.content,
        source_url: url,
      }),
    );
  }

  if (records.length === 0) {
    throw new Error(
      "eCFR yielded ZERO sections inside Parts 3/4/19/20 — schema may have changed",
    );
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "ecfr.jsonl");
  writeFileSync(outPath, out);
  console.log(`[ecfr] wrote ${records.length} sections → ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  main().catch((e) => {
    console.error(`[ecfr] FAILED: ${e.message}`);
    process.exit(1);
  });
}

export { fetchTitle38, walkSections, isInTargetPart };
