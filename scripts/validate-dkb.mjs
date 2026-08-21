#!/usr/bin/env node
/**
 * validate-dkb.mjs — Diamond Knowledge Base consistency gate (blocking CI job).
 *
 * Checks, with zero dependencies:
 *   1. src/data/disabilityData.json — per-entry schema (diagnostic-code
 *      pattern, rating structure, ecfr.gov URL, parseable lastVerifiedDate).
 *   2. Tier counts vs the constants in src/utils/dkbIndexedDB.js.
 *      The web tier (~8MB) is fully parsed; the full tier (~130MB, Git LFS)
 *      is stream-counted by its per-entry token — never JSON.parse'd — and
 *      skipped with a notice when only the LFS pointer is present (CI).
 *   3. Every diagnostic code referenced in src/data/secondary_conditions_db.json
 *      exists in disabilityData.json.
 *   4. public/data/ecfr-dc-map.json is in sync with disabilityData.json
 *      (rebuilt via scripts/legal-ingestion/build-inverse-index.mjs).
 *
 * Exit 0 = clean (warnings allowed), exit 1 = hard failure.
 */

import {
  readFileSync,
  createReadStream,
  existsSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSectionMap } from "./legal-ingestion/build-inverse-index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...segs) => path.join(ROOT, ...segs);

const failures = [];
const warnings = [];
const passes = [];

const DC_RE = /^\d{4}(-\d{4})?$/;
const ECFR_URL_RE = /^https:\/\/www\.ecfr\.gov\/current\/title-38\//;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATING_TYPES = new Set(["direct", "rated-as", "formula"]);

// Absolute floors and staleness ceiling (C-M02 / C-H03). These are deliberately
// NOT derived from the count constants in dkbIndexedDB.js: a truncated data file
// that decremented its matching constant in lockstep would otherwise pass. All
// three are env-tunable for an intentional override.
const MIN_DISABILITY_ENTRIES = Number(process.env.DKB_MIN_ENTRIES ?? "700");
const MIN_WEB_ENTRIES = Number(process.env.DKB_MIN_WEB_ENTRIES ?? "7000");
const MAX_STALENESS_DAYS = Number(process.env.DKB_MAX_STALENESS_DAYS ?? "365");
const MS_PER_DAY = 86_400_000;

/**
 * Absolute row-count floor. Returns a failure message array (empty when the
 * count clears the floor) so callers can spread it straight into `failures`.
 */
export function checkRowCountFloor(label, count, floor) {
  return count < floor
    ? [
        `${label}: ${count} entries is below the floor of ${floor} — possible truncation ` +
          `(raise/lower the floor deliberately via env if this is expected)`,
      ]
    : [];
}

/**
 * Staleness ceiling on the oldest verification date. Returns a failure message
 * array (empty when within the window, or when no date is given).
 */
export function checkStaleness(oldestIso, maxDays, now = Date.now()) {
  if (!oldestIso) return [];
  const daysOld = Math.floor((now - Date.parse(oldestIso)) / MS_PER_DAY);
  return daysOld > maxDays
    ? [
        `oldest lastVerifiedDate ${oldestIso} is ${daysOld} days old, exceeding the ` +
          `${maxDays}-day staleness ceiling — re-verify against the current 38 CFR ` +
          `(set DKB_MAX_STALENESS_DAYS to adjust the window)`,
      ]
    : [];
}

function readHead(file, bytes) {
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(bytes);
  const n = readSync(fd, buf, 0, bytes, 0);
  closeSync(fd);
  return buf.toString("utf8", 0, n);
}

function countToken(file, token) {
  return new Promise((resolve, reject) => {
    let count = 0;
    let tail = "";
    const stream = createReadStream(file, {
      encoding: "utf8",
      highWaterMark: 1 << 22,
    });
    stream.on("data", (chunk) => {
      const s = tail + chunk;
      let i = 0;
      while ((i = s.indexOf(token, i)) !== -1) {
        count++;
        i += token.length;
      }
      tail = s.slice(-(token.length - 1));
    });
    stream.on("end", () => resolve(count));
    stream.on("error", reject);
  });
}

function validateDiagnosticCode(label, dc, dcSet) {
  if (!DC_RE.test(dc)) {
    failures.push(
      `${label}: diagnosticCode "${dc}" does not match NNNN or NNNN-NNNN`,
    );
  } else if (dcSet.has(dc)) {
    failures.push(`${label}: duplicate diagnosticCode ${dc}`);
  } else {
    dcSet.add(dc);
  }
}

function validateConditionName(e, label) {
  if (typeof e.conditionName !== "string" || !e.conditionName.trim()) {
    failures.push(`${label}: missing conditionName`);
  }
}

function validateEcfrUrl(e, label) {
  if (e.ecfrUrl != null && !ECFR_URL_RE.test(e.ecfrUrl)) {
    failures.push(
      `${label}: ecfrUrl "${e.ecfrUrl}" is not an ecfr.gov title-38 URL`,
    );
  }
}

function validateLastVerifiedDate(e, label) {
  const lvd = e.lastVerifiedDate;
  if (
    typeof lvd !== "string" ||
    !ISO_DATE_RE.test(lvd) ||
    Number.isNaN(Date.parse(lvd))
  ) {
    failures.push(
      `${label}: lastVerifiedDate "${lvd}" is not a parseable YYYY-MM-DD date`,
    );
  }
}

function validateRatingsObject(ratings, label) {
  for (const [pct, text] of Object.entries(ratings)) {
    const n = Number(pct);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      failures.push(
        `${label}: rating key "${pct}" is not an integer percentage 0-100`,
      );
    }
    if (typeof text !== "string" || !text.trim()) {
      failures.push(`${label}: rating ${pct}% has an empty criteria string`);
    }
  }
}

function validateRatingCriteria(e, label, dc, noCriteria, emptyRatings) {
  const rc = e.ratingCriteria;
  if (rc == null) {
    noCriteria.push(dc);
    return;
  }
  if (!RATING_TYPES.has(rc.type)) {
    failures.push(
      `${label}: ratingCriteria.type "${rc.type}" not in {${[...RATING_TYPES].join(", ")}}`,
    );
  }
  const ratings = rc.ratings;
  if (ratings == null || Object.keys(ratings).length === 0) {
    emptyRatings.push(dc);
    return;
  }
  if (typeof ratings !== "object" || Array.isArray(ratings)) {
    failures.push(`${label}: ratingCriteria.ratings is not an object`);
    return;
  }
  validateRatingsObject(ratings, label);
}

function validateOneDisabilityEntry(e, idx, dcSet, noCriteria, emptyRatings) {
  const label = `disabilityData[${idx}] (DC ${e.diagnosticCode ?? "?"}, "${String(e.conditionName ?? "").slice(0, 40)}")`;
  const dc = String(e.diagnosticCode ?? "");

  validateDiagnosticCode(label, dc, dcSet);
  validateConditionName(e, label);
  validateEcfrUrl(e, label);
  validateLastVerifiedDate(e, label);
  validateRatingCriteria(e, label, dc, noCriteria, emptyRatings);
}

function validateDisabilityData(disabilities) {
  const dcSet = new Set();
  const emptyRatings = [];
  const noCriteria = [];

  disabilities.forEach((e, idx) =>
    validateOneDisabilityEntry(e, idx, dcSet, noCriteria, emptyRatings),
  );

  if (noCriteria.length) {
    warnings.push(
      `${noCriteria.length} entries have no ratingCriteria (e.g. DC ${noCriteria.slice(0, 5).join(", ")})`,
    );
  }
  if (emptyRatings.length) {
    warnings.push(
      `${emptyRatings.length} entries have ratingCriteria with empty ratings (e.g. DC ${emptyRatings.slice(0, 5).join(", ")})`,
    );
  }

  const dates = disabilities
    .map((e) => e.lastVerifiedDate)
    .filter((d) => typeof d === "string" && ISO_DATE_RE.test(d))
    .sort();
  passes.push(
    `disabilityData.json: ${disabilities.length} entries; ` +
      `lastVerifiedDate range ${dates[0] ?? "?"} → ${dates[dates.length - 1] ?? "?"}`,
  );
  return dcSet;
}

async function validateTierCounts() {
  const dkbSource = readFileSync(p("src", "utils", "dkbIndexedDB.js"), "utf8");
  const fullConst = Number(
    /FULL_DATABASE_COUNT\s*=\s*(\d+)/.exec(dkbSource)?.[1],
  );
  const webConst = Number(
    /WEB_DATABASE_COUNT\s*=\s*(\d+)/.exec(dkbSource)?.[1],
  );
  if (!fullConst || !webConst) {
    failures.push(
      "could not parse FULL_DATABASE_COUNT / WEB_DATABASE_COUNT from src/utils/dkbIndexedDB.js",
    );
    return;
  }

  const web = JSON.parse(
    readFileSync(p("public", "data", "diamond_knowledge.json"), "utf8"),
  );
  if (web.entries.length !== webConst || web.total_entries !== webConst) {
    failures.push(
      `web tier count mismatch: entries=${web.entries.length}, metadata total_entries=${web.total_entries}, ` +
        `WEB_DATABASE_COUNT=${webConst}`,
    );
  } else {
    passes.push(
      `web tier: ${web.entries.length} entries match WEB_DATABASE_COUNT`,
    );
  }
  if (web.full_database_count !== fullConst) {
    failures.push(
      `web tier metadata full_database_count=${web.full_database_count} ≠ FULL_DATABASE_COUNT=${fullConst}`,
    );
  }
  failures.push(
    ...checkRowCountFloor("web tier", web.entries.length, MIN_WEB_ENTRIES),
  );

  const fullPath = p("public", "data", "diamond_knowledge_full.json");
  const head = readHead(fullPath, 4096);
  if (head.startsWith("version https://git-lfs.github.com/spec/")) {
    warnings.push(
      "full tier is a Git LFS pointer here (CI checkout) — entry count skipped; run locally with LFS content to verify",
    );
    return;
  }
  const metaTotal = Number(/"total_entries":\s*(\d+)/.exec(head)?.[1]);
  // Each top-level entry opens with `"id"` at 6-space indent; JSON string
  // values cannot contain raw newlines, so this token count is exact.
  const streamed = await countToken(fullPath, '\n      "id": "');
  if (streamed !== fullConst || metaTotal !== fullConst) {
    failures.push(
      `full tier count mismatch: stream-counted=${streamed}, metadata total_entries=${metaTotal}, ` +
        `FULL_DATABASE_COUNT=${fullConst}`,
    );
  } else {
    passes.push(
      `full tier: ${streamed} entries (stream-counted) match FULL_DATABASE_COUNT`,
    );
  }
}

function validateSecondaryConditions(dcSet) {
  const db = JSON.parse(
    readFileSync(p("src", "data", "secondary_conditions_db.json"), "utf8"),
  );
  const refs = new Map();
  (function walk(node, ctx) {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, ctx));
    if (node && typeof node === "object") {
      const label = node.name || node.condition || ctx;
      for (const [key, value] of Object.entries(node)) {
        if (key === "ecfr_diagnostic_code" && typeof value === "string") {
          refs.set(`${label}: ${value}`, value);
        } else {
          walk(value, label);
        }
      }
    }
  })(db, "secondary_conditions_db");

  let checked = 0;
  const unparseable = [];
  for (const [label, ref] of refs) {
    const m = /\b(\d{4})\b/.exec(ref);
    if (!m) {
      unparseable.push(label);
      continue;
    }
    checked++;
    if (!dcSet.has(m[1])) {
      failures.push(
        `secondary_conditions_db.json — ${label}: DC ${m[1]} not found in disabilityData.json`,
      );
    }
  }
  if (unparseable.length) {
    warnings.push(
      `${unparseable.length} secondary-condition refs carry no numeric DC (rated-by-analogy text): ` +
        unparseable.map((u) => `"${u}"`).join("; "),
    );
  }
  passes.push(
    `secondary_conditions_db.json: ${checked} numeric DC references all resolve`,
  );
}

function validateInverseMap(disabilities) {
  const mapPath = p("public", "data", "ecfr-dc-map.json");
  if (!existsSync(mapPath)) {
    warnings.push(
      "public/data/ecfr-dc-map.json missing — run `node scripts/legal-ingestion/build-inverse-index.mjs`",
    );
    return;
  }
  const committed = JSON.parse(readFileSync(mapPath, "utf8"));
  const rebuilt = buildSectionMap(disabilities);
  if (JSON.stringify(committed.sections) !== JSON.stringify(rebuilt)) {
    failures.push(
      "public/data/ecfr-dc-map.json is out of sync with disabilityData.json — " +
        "regenerate with `node scripts/legal-ingestion/build-inverse-index.mjs`",
    );
  } else {
    passes.push(
      `ecfr-dc-map.json: ${Object.keys(rebuilt).length} sections in sync with disabilityData.json`,
    );
  }
}

async function main() {
  const started = Date.now();
  const data = JSON.parse(
    readFileSync(p("src", "data", "disabilityData.json"), "utf8"),
  );
  if (!Array.isArray(data.disabilities)) {
    console.error("✗ FAIL: disabilityData.json has no `disabilities` array");
    process.exit(1);
  }

  const dcSet = validateDisabilityData(data.disabilities);

  // C-M02 / C-H03: absolute floor + staleness ceiling, computed here so the
  // already-dense validateDisabilityData stays readable.
  failures.push(
    ...checkRowCountFloor(
      "disabilityData.json",
      data.disabilities.length,
      MIN_DISABILITY_ENTRIES,
    ),
  );
  const dkbDates = data.disabilities
    .map((e) => e.lastVerifiedDate)
    .filter((d) => typeof d === "string" && ISO_DATE_RE.test(d))
    .sort();
  const staleFailures = checkStaleness(dkbDates[0], MAX_STALENESS_DAYS);
  if (staleFailures.length) {
    failures.push(`disabilityData.json: ${staleFailures[0]}`);
  } else if (dkbDates.length) {
    passes.push(
      `disabilityData.json staleness: oldest entry ${dkbDates[0]} within ${MAX_STALENESS_DAYS}-day ceiling`,
    );
  }

  await validateTierCounts();
  validateSecondaryConditions(dcSet);
  validateInverseMap(data.disabilities);

  console.log(`\nDKB validation report (${new Date().toISOString()})`);
  console.log("─".repeat(72));
  for (const line of passes) console.log(`  ✓ ${line}`);
  for (const line of warnings) console.log(`  ⚠ ${line}`);
  for (const line of failures) console.log(`  ✗ ${line}`);
  console.log("─".repeat(72));
  console.log(
    `  ${passes.length} passed · ${warnings.length} warnings · ${failures.length} failures ` +
      `(${((Date.now() - started) / 1000).toFixed(1)}s)`,
  );

  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`✗ validate-dkb FATAL: ${err.message}`);
    process.exit(1);
  });
}
