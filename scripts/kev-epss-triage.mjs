#!/usr/bin/env node
/**
 * kev-epss-triage.mjs
 *
 * Cross-references npm audit output against the CISA Known Exploited Vulnerabilities (KEV) catalog.
 *
 * Usage:
 *   npm audit --json | node scripts/kev-epss-triage.mjs
 *   node scripts/kev-epss-triage.mjs --audit-file npm-audit.json
 *   node scripts/kev-epss-triage.mjs --audit-file npm-audit.json --dry-run
 *
 * Exit codes:
 *   0 — no KEV matches found
 *   1 — one or more KEV matches found (or fatal error)
 */

import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";

const KEV_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

const ARGS = process.argv.slice(2);
const isDryRun = ARGS.includes("--dry-run");
const auditFileIdx = ARGS.indexOf("--audit-file");
const auditFile = auditFileIdx !== -1 ? ARGS[auditFileIdx + 1] : null;

// ── helpers ────────────────────────────────────────────────────────────────

function severityRank(severity) {
  return { critical: 4, high: 3, moderate: 2, low: 1, info: 0 }[
    severity?.toLowerCase()
  ] ?? 0;
}

function actionLabel(severity, isKev) {
  if (isKev) return "CRITICAL-PATCH-NOW";
  if (severityRank(severity) >= 3) return "HIGH";
  if (severityRank(severity) === 2) return "MEDIUM";
  return "LOW";
}

function padEnd(str, len) {
  return String(str ?? "").padEnd(len).slice(0, len);
}

function printTable(rows) {
  const header = [
    padEnd("CVE", 22),
    padEnd("SEVERITY", 10),
    padEnd("PACKAGE", 28),
    padEnd("KEV", 5),
    padEnd("ACTION", 22),
  ].join(" | ");
  const divider = "-".repeat(header.length);
  console.log(divider);
  console.log(header);
  console.log(divider);
  for (const r of rows) {
    console.log(
      [
        padEnd(r.cve, 22),
        padEnd(r.severity, 10),
        padEnd(r.package, 28),
        padEnd(r.kev ? "YES" : "no", 5),
        padEnd(r.action, 22),
      ].join(" | ")
    );
  }
  console.log(divider);
}

// ── fetch KEV catalog ──────────────────────────────────────────────────────

async function fetchKevSet() {
  try {
    const res = await fetch(KEV_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return new Set(
      (data.vulnerabilities ?? []).map((v) => v.cveID?.toUpperCase())
    );
  } catch (err) {
    console.warn(
      `[kev-triage] WARNING: Could not fetch KEV catalog (${err.message}). KEV status will be unknown.`
    );
    return null;
  }
}

// ── read npm audit JSON ────────────────────────────────────────────────────

async function readAuditJson() {
  if (auditFile) {
    if (!existsSync(auditFile)) {
      console.error(`[kev-triage] ERROR: audit file not found: ${auditFile}`);
      process.exit(1);
    }
    return JSON.parse(readFileSync(auditFile, "utf8"));
  }

  // read from stdin
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    const lines = [];
    rl.on("line", (l) => lines.push(l));
    rl.on("close", () => {
      try {
        resolve(JSON.parse(lines.join("\n")));
      } catch {
        reject(new Error("Failed to parse JSON from stdin"));
      }
    });
    rl.on("error", reject);
  });
}

// ── extract CVE list from audit output ────────────────────────────────────

function extractVulns(auditJson) {
  const vulns = [];

  // npm audit --json v2 (npm 7+) uses auditJson.vulnerabilities
  if (auditJson.vulnerabilities) {
    for (const [pkgName, vuln] of Object.entries(auditJson.vulnerabilities)) {
      const via = Array.isArray(vuln.via) ? vuln.via : [];
      for (const v of via) {
        if (typeof v === "object" && v.cves?.length) {
          for (const cve of v.cves) {
            vulns.push({
              cve: cve.toUpperCase(),
              severity: vuln.severity ?? v.severity ?? "unknown",
              package: pkgName,
            });
          }
        }
      }
      // deduplicate: if no direct CVE list but has severity, add a placeholder
      if (!via.some((v) => typeof v === "object" && v.cves?.length)) {
        vulns.push({
          cve: "(no CVE)",
          severity: vuln.severity ?? "unknown",
          package: pkgName,
        });
      }
    }
  }

  // npm audit --json v1 (npm 6) uses auditJson.advisories
  if (auditJson.advisories) {
    for (const adv of Object.values(auditJson.advisories)) {
      const cves = adv.cves?.length ? adv.cves : ["(no CVE)"];
      for (const cve of cves) {
        vulns.push({
          cve: cve.toUpperCase(),
          severity: adv.severity ?? "unknown",
          package: adv.module_name ?? "unknown",
        });
      }
    }
  }

  // deduplicate by cve+package
  const seen = new Set();
  return vulns.filter((v) => {
    const key = `${v.cve}::${v.package}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  if (isDryRun) {
    console.log("[kev-triage] Dry-run mode — no exit code enforcement.");
  }

  let auditJson;
  try {
    auditJson = await readAuditJson();
  } catch (err) {
    console.error(`[kev-triage] ERROR reading audit JSON: ${err.message}`);
    process.exit(1);
  }

  const vulns = extractVulns(auditJson);

  if (vulns.length === 0) {
    console.log("[kev-triage] No vulnerabilities found in audit output.");
    process.exit(0);
  }

  console.log(`[kev-triage] Fetching CISA KEV catalog…`);
  const kevSet = await fetchKevSet();
  const kevUnavailable = kevSet === null;

  const rows = vulns.map((v) => {
    const isKev = !kevUnavailable && kevSet.has(v.cve);
    return {
      ...v,
      kev: isKev,
      kevUnknown: kevUnavailable,
      action: actionLabel(v.severity, isKev),
    };
  });

  // sort: KEV first, then by severity descending
  rows.sort((a, b) => {
    if (a.kev !== b.kev) return b.kev - a.kev;
    return severityRank(b.severity) - severityRank(a.severity);
  });

  console.log(`\n[kev-triage] Results (${rows.length} vulnerabilities):\n`);
  printTable(rows);

  const kevMatches = rows.filter((r) => r.kev);
  if (kevMatches.length > 0) {
    console.error(
      `\n[kev-triage] FAIL: ${kevMatches.length} KEV match(es) found. Patch immediately.`
    );
    if (!isDryRun) process.exit(1);
    else console.log("[kev-triage] Dry-run: skipping exit(1).");
  } else if (kevUnavailable) {
    console.warn(
      "\n[kev-triage] WARNING: KEV catalog unavailable; KEV status unknown."
    );
  } else {
    console.log("\n[kev-triage] OK: No KEV matches found.");
  }
}

main().catch((err) => {
  console.error(`[kev-triage] Unhandled error: ${err.message}`);
  process.exit(1);
});
