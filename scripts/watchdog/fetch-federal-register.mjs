#!/usr/bin/env node
/**
 * fetch-federal-register.mjs — weekly static snapshot for the Legislative
 * Watchdog (.github/workflows/dkb-freshness.yml).
 *
 * Queries the Federal Register API exactly like the live path in
 * src/components/LegislativeWatchdog.jsx and writes the matching alerts to
 * public/data/legislative-alerts.json ({ generatedAt, alerts }). The
 * component reads that static file first and only falls back to the live
 * API when it is missing or older than 14 days.
 *
 * If the alert list is unchanged, the existing file is left untouched
 * (including generatedAt) so the workflow's git-diff PR check stays quiet.
 *
 * Usage:
 *   node scripts/watchdog/fetch-federal-register.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const OUT_PATH = path.join(ROOT, "public", "data", "legislative-alerts.json");

const FEDERAL_REGISTER_API =
  "https://www.federalregister.gov/api/v1/documents.json";

// Keep in sync with WATCH_KEYWORDS in src/components/LegislativeWatchdog.jsx.
const WATCH_KEYWORDS = [
  "Schedule for Rating Disabilities",
  "VASRD",
  "38 CFR Part 4",
  "disability rating",
  "compensation",
  "service-connected",
  "presumptive",
  "tinnitus",
  "sleep apnea",
  "mental disorders",
  "musculoskeletal",
  "neurological",
  "brain injury",
  "TBI",
  "neuropathy",
  "paralysis",
  "4.124a",
  "PACT Act",
  "toxic exposure",
];

// Keep in sync with mapDocumentType in src/components/LegislativeWatchdog.jsx.
function mapDocumentType(type) {
  const mapping = {
    "Proposed Rule": "proposed_rule",
    Rule: "final_rule",
    Notice: "active",
    "Presidential Document": "active",
  };
  return mapping[type] || "active";
}

// Keep in sync with determineUrgency in src/components/LegislativeWatchdog.jsx.
function determineUrgency(doc) {
  const text = `${doc.title} ${doc.abstract || ""}`.toLowerCase();
  const highUrgencyKeywords = [
    "final rule",
    "immediate",
    "effective immediately",
    "tinnitus",
    "sleep apnea",
  ];
  const mediumUrgencyKeywords = ["proposed", "comment", "review"];

  if (highUrgencyKeywords.some((k) => text.includes(k))) return "high";
  if (mediumUrgencyKeywords.some((k) => text.includes(k))) return "medium";
  return "low";
}

async function fetchDocuments() {
  const params = new URLSearchParams({
    "conditions[agencies][]": "veterans-affairs-department",
    "conditions[cfr][title]": "38",
    per_page: "20",
    order: "newest",
  });
  // "public_inspection_document_deadline" is NOT a valid documents.json
  // field — including it makes the API return HTTP 400.
  for (const field of [
    "title",
    "abstract",
    "publication_date",
    "type",
    "document_number",
    "html_url",
    "comments_close_on",
  ]) {
    params.append("fields[]", field);
  }

  const res = await fetch(`${FEDERAL_REGISTER_API}?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Federal Register API → HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

function toAlerts(results) {
  return results
    .filter((doc) => {
      const text = `${doc.title} ${doc.abstract || ""}`.toLowerCase();
      return WATCH_KEYWORDS.some((keyword) =>
        text.includes(keyword.toLowerCase()),
      );
    })
    .map((doc) => ({
      id: doc.document_number,
      title: doc.title,
      type: mapDocumentType(doc.type),
      status: doc.comments_close_on ? "comment_period" : "active",
      publicationDate: doc.publication_date,
      commentDeadline: doc.comments_close_on,
      summary: doc.abstract || "No summary available.",
      link: doc.html_url,
      source: "Federal Register",
      urgency: determineUrgency(doc),
    }));
}

async function main() {
  const results = await fetchDocuments();
  const alerts = toAlerts(results);
  console.log(
    `[watchdog] ${results.length} VA documents fetched, ${alerts.length} match watch keywords`,
  );

  if (existsSync(OUT_PATH)) {
    const previous = JSON.parse(readFileSync(OUT_PATH, "utf8"));
    if (JSON.stringify(previous.alerts) === JSON.stringify(alerts)) {
      console.log(
        `[watchdog] no change since ${previous.generatedAt} — leaving ${OUT_PATH} untouched`,
      );
      return;
    }
  }

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(
    OUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), alerts }, null, 2) +
      "\n",
  );
  console.log(`[watchdog] wrote ${alerts.length} alerts → ${OUT_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[watchdog] FAILED: ${e.message}`);
    process.exit(1);
  });
}
