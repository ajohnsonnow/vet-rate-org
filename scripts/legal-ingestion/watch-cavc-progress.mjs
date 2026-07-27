#!/usr/bin/env node
/**
 * watch-cavc-progress.mjs — live terminal progress bar for a running
 * fetch-cavc-historical.mjs pass (S44).
 *
 * Reads ONLY the checkpoint file fetch-cavc-historical.mjs already writes
 * after every completed page — this is a pure observer, it never touches
 * the fetch process or its output file. Safe to run/stop/rerun any number
 * of times without affecting the actual backfill.
 *
 * Usage:
 *   node scripts/legal-ingestion/watch-cavc-progress.mjs [database-slug]
 *   (default slug: singlejudge — the current long-running backfill; pass
 *   "panel" to watch a Panel Decisions run instead)
 *
 * Ctrl+C to stop watching (does not stop the fetch).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2] || "singlejudge";
const checkpointPath = path.join(
  __dirname,
  ".work",
  `cavc-historical-${slug}.checkpoint.json`,
);
const outputPath = path.join(
  __dirname,
  ".work",
  `cavc-historical-${slug}.jsonl`,
);

const POLL_MS = 2000;
const BAR_WIDTH = 40;

// TOTAL_HINT: the checkpoint doesn't carry the database's total document
// count (that's only known from the live session that opened it), so this
// is a best-effort cap read from an env override or a sane default matching
// the known SingleJudgeDecisions size — purely cosmetic (denominator for
// the bar), never affects the actual fetch.
const TOTAL_HINT = Number(process.env.CAVC_WATCH_TOTAL) || 50000;

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function renderBar(fraction) {
  const filled = Math.round(BAR_WIDTH * Math.min(1, Math.max(0, fraction)));
  return `[${"#".repeat(filled)}${"-".repeat(BAR_WIDTH - filled)}]`;
}

// Progress arrives in chunks (one jump per completed page, ~35-40s apart),
// not continuously — a rate computed from "a fixed-time-ago sample vs now"
// drifts upward for the whole gap between chunks (elapsed keeps growing,
// the numerator doesn't, until the next chunk arrives). Instead, track only
// the last two ACTUAL checkpoint changes and hold that rate steady between
// them — the ETA only moves when real progress happens.
let lastChange = null; // shape: timestamp + scanned position
let prevChange = null;
let smoothedRatePerSec = null;
const RATE_SMOOTHING = 0.3; // exponential smoothing so one slow/fast page doesn't whipsaw the ETA
const startedAt = Date.now();

function tick() {
  if (!existsSync(checkpointPath)) {
    const done = existsSync(outputPath);
    process.stdout.write(
      `\r${done ? "✓ run complete — no checkpoint (finished cleanly)" : "waiting for first page to complete…"}` +
        " ".repeat(20),
    );
    return;
  }

  let cp;
  try {
    cp = JSON.parse(readFileSync(checkpointPath, "utf8"));
  } catch {
    return; // mid-write race — just wait for next tick
  }

  const now = Date.now();
  if (!lastChange || cp.lastCompletedEnd !== lastChange.scanned) {
    prevChange = lastChange;
    lastChange = { t: now, scanned: cp.lastCompletedEnd };
    if (prevChange) {
      const dt = (lastChange.t - prevChange.t) / 1000;
      const dScanned = lastChange.scanned - prevChange.scanned;
      if (dt > 0 && dScanned > 0) {
        const instantRate = dScanned / dt;
        smoothedRatePerSec =
          smoothedRatePerSec === null
            ? instantRate
            : smoothedRatePerSec * (1 - RATE_SMOOTHING) + instantRate * RATE_SMOOTHING;
      }
    }
  }

  const fraction = cp.lastCompletedEnd / TOTAL_HINT;
  const bar = renderBar(fraction);
  const pct = (fraction * 100).toFixed(1);

  let etaStr = "…";
  if (smoothedRatePerSec) {
    const remaining = TOTAL_HINT - cp.lastCompletedEnd;
    etaStr = fmtDuration((remaining / smoothedRatePerSec) * 1000);
  }

  const skips = cp.skippedWpd + cp.skippedEmpty + cp.skippedError + cp.skippedPages * 100;
  const line =
    `\r${bar} ${pct}%  ${cp.lastCompletedEnd}/${TOTAL_HINT}  ` +
    `records:${cp.recordCount}  skips:${skips}  errors:${cp.skippedError}  ` +
    `elapsed:${fmtDuration(now - startedAt)}  ETA:${etaStr}   `;
  process.stdout.write(line);
}

console.log(`Watching ${path.relative(process.cwd(), checkpointPath)} (Ctrl+C to stop)\n`);
tick();
const timer = setInterval(tick, POLL_MS);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\nStopped watching (fetch keeps running in its own process).");
  process.exit(0);
});
