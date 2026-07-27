#!/usr/bin/env node
/**
 * check-shard-freshness.mjs — S39 weekly freshness check for the sharded knowledge
 * sources (7 from S31-S38, + m21-5, m21-4 and rate-tables added S44).
 *
 * This script extends the dkb-freshness.yml pattern (originally eCFR-only, S25+)
 * to cover every shard that isn't the eCFR legal-index monolith. It checks:
 *   - 7 live-fetch sources (m21-1, m21-5, m21-4, cavc, rate-tables, fedcir,
 *     ogc) by running their fetchers in bounded mode and capturing exit codes.
 *     (rate-tables has no bounded knob — its default run already only
 *     fetches the current year, see fetch-rate-tables.mjs's scope decision.)
 *   - 3 staleness-only sources (bva, state-benefits, multinational) by
 *     computing days since last_verified and comparing against cadence thresholds.
 *
 * The hard-coded source config below MUST be kept in sync with the matching
 * entries in knowledge-sources.yaml by hand. See the sprint plan
 * (docs/SPRINT_PLAN_S27-S40_DKB_FULL_COVERAGE.md) for the master list.
 *
 * Exit codes:
 *   0 = all sources ok (no drift, no staleness, all fetchers passed)
 *   2 = at least one source has drift, failure, or staleness that should
 *       trigger a GitHub issue
 *   1 = the check itself failed (unexpected error, configuration bug)
 *
 * Output:
 *   - Prints a markdown report to stdout
 *   - Writes shard-freshness.md (parsed by the GitHub Actions workflow)
 *   - Respects SHARD_FRESHNESS_SKIP_LIVE_FETCH=1 to skip live fetchers
 *     (for testing the staleness logic without hitting real APIs)
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

// Hard-coded source config — must be kept in sync with knowledge-sources.yaml.
// Each source is one of:
//   { id, kind: "live-fetch", fetcher, cadence, lastVerified, boundedEnv? }
//   { id, kind: "staleness-only", cadence, lastVerified }
const SOURCES = [
  {
    id: "m21-1",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-m21-1.mjs",
    cadence: "monthly",
    lastVerified: "2026-07-18",
    boundedEnv: { M21_MAX_ARTICLES: "50" },
  },
  {
    id: "m21-5",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-m21-5.mjs",
    cadence: "monthly",
    lastVerified: "2026-07-20",
    boundedEnv: { M21_5_MAX_ARTICLES: "10" },
  },
  {
    id: "m21-4",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-m21-4.mjs",
    cadence: "monthly",
    lastVerified: "2026-07-20",
    boundedEnv: { M21_4_MAX_ARTICLES: "10" },
  },
  {
    id: "cavc",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-cavc.mjs",
    cadence: "weekly",
    lastVerified: "2026-07-18",
  },
  {
    id: "rate-tables",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-rate-tables.mjs",
    cadence: "annual",
    lastVerified: "2026-07-20",
  },
  {
    id: "fedcir",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-fedcir.mjs",
    cadence: "weekly",
    lastVerified: "2026-07-18",
    boundedEnv: { FEDCIR_MAX_PAGES: "3" },
  },
  {
    id: "ogc",
    kind: "live-fetch",
    fetcher: "scripts/legal-ingestion/fetch-ogc.mjs",
    cadence: "quarterly",
    lastVerified: "2026-07-18",
    boundedEnv: { OGC_MAX_YEARS: "3" },
  },
  {
    id: "bva",
    kind: "staleness-only",
    cadence: "quarterly",
    lastVerified: "2026-07-18",
  },
  {
    id: "state-benefits",
    kind: "staleness-only",
    cadence: "annual",
    lastVerified: "2026-07-15",
  },
  {
    id: "multinational",
    kind: "staleness-only",
    cadence: "annual",
    lastVerified: "2026-07-15",
  },
];

// Staleness thresholds per cadence (grace periods in days).
// These are conservative — a source is only flagged stale if it exceeds
// the expected refresh window by the grace margin.
const STALENESS_THRESHOLDS = {
  weekly: 21, // 3 weeks grace (3 missed weekly runs)
  monthly: 45, // 45 days grace (catchall for month + grace)
  quarterly: 120, // 120 days grace (90 days + 30 day grace)
  annual: 400, // 400 days grace (365 days + 35 day grace)
};

/**
 * Pure function to compute staleness status.
 * Exported for unit testing with deterministic `now` parameter.
 *
 * @param {string} lastVerifiedIso ISO date string (YYYY-MM-DD)
 * @param {string} refreshCadence "weekly" | "monthly" | "quarterly" | "annual"
 * @param {Date} now Current date (for testing; default new Date())
 * @returns {string} "ok" or "stale"
 */
export function computeStaleness(
  lastVerifiedIso,
  refreshCadence,
  now = new Date(),
) {
  const lastVerified = new Date(lastVerifiedIso);
  if (Number.isNaN(lastVerified.getTime())) {
    return "error"; // Invalid date string
  }

  const ageMs = now.getTime() - lastVerified.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const threshold = STALENESS_THRESHOLDS[refreshCadence];

  if (!threshold) {
    return "error"; // Unknown cadence
  }

  return ageDays > threshold ? "stale" : "ok";
}

/**
 * Run a live fetcher in bounded mode (if bounded env vars are provided).
 * Returns { status: "ok" | "failure" | "skipped", message: string }.
 */
function checkLiveFetcher(source, skipLiveFetch) {
  if (skipLiveFetch) {
    return {
      status: "skipped",
      message: `live fetcher skipped (SHARD_FRESHNESS_SKIP_LIVE_FETCH=1)`,
    };
  }

  const fetcherPath = path.join(REPO_ROOT, source.fetcher);
  const env = {
    ...process.env,
    ...(source.boundedEnv || {}),
  };

  // Run the fetcher as a child process with bounded config.
  const result = spawnSync("node", [fetcherPath], {
    env,
    cwd: REPO_ROOT,
    stdio: "pipe",
  });

  if (result.status === 0) {
    return { status: "ok", message: "fetcher succeeded" };
  } else if (result.status === null && result.signal) {
    return {
      status: "failure",
      message: `fetcher killed by signal ${result.signal}`,
    };
  } else {
    return {
      status: "failure",
      message: `fetcher exited with code ${result.status}`,
    };
  }
}

/**
 * Check staleness of a research-sourced shard (no live fetcher).
 * Returns { status: "ok" | "stale", message: string }.
 */
function checkStaleness(source, now) {
  const stalenessStatus = computeStaleness(
    source.lastVerified,
    source.cadence,
    now,
  );
  if (stalenessStatus === "error") {
    return {
      status: "error",
      message: `invalid date or cadence: ${source.lastVerified} / ${source.cadence}`,
    };
  }
  const ageMs = now.getTime() - new Date(source.lastVerified).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const threshold = STALENESS_THRESHOLDS[source.cadence];

  return {
    status: stalenessStatus,
    message: `${ageDays} days old (threshold: ${threshold} days)`,
  };
}

async function main() {
  const skipLiveFetch = process.env.SHARD_FRESHNESS_SKIP_LIVE_FETCH === "1";
  const now = new Date();
  const results = [];
  let hasFailure = false;

  for (const source of SOURCES) {
    let check;
    if (source.kind === "live-fetch") {
      check = checkLiveFetcher(source, skipLiveFetch);
    } else {
      check = checkStaleness(source, now);
    }

    results.push({
      id: source.id,
      kind: source.kind,
      cadence: source.cadence,
      ...check,
    });

    // "error" (invalid lastVerified/cadence in the hard-coded SOURCES config)
    // must fail loudly, not be silently swallowed as an unrecognized status —
    // otherwise a future config typo would exit 0 instead of surfacing.
    if (
      check.status === "failure" ||
      check.status === "stale" ||
      check.status === "error"
    ) {
      hasFailure = true;
    }
  }

  // Generate markdown report.
  const reportLines = [
    "# Shard Freshness Check Report",
    "",
    `Checked at: ${now.toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  const okCount = results.filter((r) => r.status === "ok").length;
  const stalCount = results.filter((r) => r.status === "stale").length;
  const failCount = results.filter((r) => r.status === "failure").length;
  const skipCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  reportLines.push(`- OK: ${okCount}`);
  reportLines.push(`- Stale: ${stalCount}`);
  reportLines.push(`- Failure: ${failCount}`);
  reportLines.push(`- Skipped: ${skipCount}`);
  reportLines.push(`- Error: ${errorCount}`);
  reportLines.push("");

  reportLines.push("## Details");
  reportLines.push("");

  for (const result of results) {
    const statusEmoji =
      {
        ok: "✓",
        stale: "⚠",
        failure: "✗",
        skipped: "⊘",
        error: "✗",
      }[result.status] || "?";

    reportLines.push(`### ${statusEmoji} ${result.id}`);
    reportLines.push(`- Kind: ${result.kind}`);
    reportLines.push(`- Cadence: ${result.cadence}`);
    reportLines.push(`- Status: ${result.status}`);
    reportLines.push(`- Message: ${result.message}`);
    reportLines.push("");
  }

  const report = reportLines.join("\n");

  // Print to stdout and write to file.
  console.log(report);
  writeFileSync(path.join(REPO_ROOT, "shard-freshness.md"), report);

  // Exit with appropriate code.
  if (hasFailure) {
    process.exit(2); // at least one source has drift/stale/failure
  } else {
    process.exit(0); // all clear
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`[check-shard-freshness] FATAL: ${e.message}`);
    process.exit(1);
  });
}
