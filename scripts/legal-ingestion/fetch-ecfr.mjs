#!/usr/bin/env node
/**
 * fetch-ecfr.mjs — fetch 38 CFR Parts 3, 4, 19, 20 from the eCFR API.
 *
 * The eCFR API splits a Title across two endpoints:
 *
 *   1. structure/{date}/title-{N}.json  — JSON tree of chapters/parts/sections,
 *      metadata only (no body content).
 *   2. renderer/v1/content/enhanced/{date}/title-{N}?part=X&section=Y
 *      — HTML body for a single section.
 *
 * Strategy: walk the structure once, then GET the renderer per section
 * inside Parts 3/4/19/20, throttled to be a good citizen.
 *
 * Output: scripts/legal-ingestion/.work/ecfr.jsonl
 *
 * Usage:
 *   node scripts/legal-ingestion/fetch-ecfr.mjs                # all 4 parts, today's snapshot
 *   node scripts/legal-ingestion/fetch-ecfr.mjs 2026-05-01     # explicit date
 *   node scripts/legal-ingestion/fetch-ecfr.mjs --part=4       # one part only (for testing)
 *   node scripts/legal-ingestion/fetch-ecfr.mjs --limit=5      # cap section count
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeRecord } from "./sanitize-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(__dirname, ".work");

const ECFR_BASE = "https://www.ecfr.gov";
const TITLE = 38;
const DEFAULT_PARTS = new Set(["3", "4", "19", "20"]);
const USER_AGENT =
  "vet-rate-org legal-ingestion/0.1 (anthony.johnson.now@gmail.com)";
const THROTTLE_MS = 500;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const out = { parts: null, limit: null, date: null };
  for (const a of argv) {
    if (a.startsWith("--part=")) {
      out.parts = new Set(a.slice(7).split(",").map((s) => s.trim()));
    } else if (a.startsWith("--limit=")) {
      out.limit = Number.parseInt(a.slice(8), 10);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(a)) {
      out.date = a;
    }
  }
  return out;
}

async function fetchStructure(date) {
  const url = `${ECFR_BASE}/api/versioner/v1/structure/${date}/title-${TITLE}.json`;
  console.log(`[ecfr] GET ${url}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`structure ${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchSectionHtml({ date, part, section }) {
  const url = `${ECFR_BASE}/api/renderer/v1/content/enhanced/${date}/title-${TITLE}?part=${part}&section=${section}`;
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`section ${url} → HTTP ${res.status}`);
  return res.text();
}

/**
 * Walk the structure tree and emit `{ part, section, label }` for every
 * section node inside the target parts.
 *
 * @param {Object} root
 * @param {Set<string>} wantParts
 * @returns {Array<{ part: string, section: string, label: string }>}
 */
export function enumerateSections(root, wantParts) {
  const out = [];
  function walk(node, currentPart) {
    if (!node || typeof node !== "object") return;
    let part = currentPart;
    if (node.type === "part") {
      part = String(node.identifier);
      if (!wantParts.has(part)) return; // prune whole subtree
    }
    if (node.type === "section" && part) {
      out.push({
        part,
        section: String(node.identifier),
        label: node.label || node.label_description || "",
      });
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c, part);
    }
  }
  walk(root, null);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = args.date || todayIso();
  const wantParts = args.parts || DEFAULT_PARTS;

  mkdirSync(WORK_DIR, { recursive: true });

  const structure = await fetchStructure(date);
  let sections = enumerateSections(structure, wantParts);

  console.log(
    `[ecfr] discovered ${sections.length} sections across parts: ${[...wantParts].join(", ")}`,
  );

  if (args.limit && sections.length > args.limit) {
    sections = sections.slice(0, args.limit);
    console.log(`[ecfr] --limit applied: capped to ${sections.length}`);
  }

  if (sections.length === 0) {
    throw new Error(
      "eCFR structure returned ZERO sections in target parts — check parts filter or API",
    );
  }

  const records = [];
  let i = 0;
  for (const sec of sections) {
    i += 1;
    try {
      const html = await fetchSectionHtml({
        date,
        part: sec.part,
        section: sec.section,
      });
      const citation = `38 CFR § ${sec.section}`;
      const sourceUrl =
        `${ECFR_BASE}/current/title-${TITLE}/chapter-I/part-${sec.part}/section-${sec.section}`;
      records.push(
        await makeRecord({
          source: "ecfr",
          citation,
          title: sec.label,
          body: html,
          source_url: sourceUrl,
        }),
      );
      if (i % 10 === 0 || i === sections.length) {
        console.log(`[ecfr] fetched ${i}/${sections.length} sections`);
      }
    } catch (e) {
      console.error(`[ecfr] section ${sec.section} failed: ${e.message}`);
    }
    if (i < sections.length) await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  if (records.length === 0) {
    throw new Error("eCFR fetcher produced ZERO records after fetching");
  }

  const out = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const outPath = path.join(WORK_DIR, "ecfr.jsonl");
  writeFileSync(outPath, out);
  console.log(`[ecfr] wrote ${records.length} sections → ${outPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[ecfr] FAILED: ${e.message}`);
    process.exit(1);
  });
}

export { fetchStructure, fetchSectionHtml };
