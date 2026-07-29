#!/usr/bin/env node
/**
 * diagnose-cavc-visual.mjs — S43 diagnostic-only script, NOT part of the
 * production fetch pipeline. Opens a real, VISIBLE Chromium window (via
 * Playwright, already a repo dependency for e2e tests) and drives the exact
 * same CAVC ISYS search flow fetch-cavc-historical.mjs uses via plain
 * fetch() — so a human can watch, in real time, whether the server responds
 * normally to a real browser or is genuinely unavailable right now.
 *
 * This does NOT replace the production fetcher: driving a full browser page
 * load per document would be far too slow for ~50,000 documents (the whole
 * reason fetch-cavc-historical.mjs uses raw fetch()). This is purely for
 * watching a handful of requests live to diagnose the outages hit this
 * session (a page that hung forever with no timeout; a stretch where even
 * opening a session timed out).
 *
 * Usage:
 *   node scripts/legal-ingestion/diagnose-cavc-visual.mjs
 *   node scripts/legal-ingestion/diagnose-cavc-visual.mjs --range=14101-14200   # test a specific range
 *   node scripts/legal-ingestion/diagnose-cavc-visual.mjs --database=PanelDecisions
 *
 * Leaves the browser window open at the end so you can keep looking around
 * manually — close it yourself when done (Ctrl+C here also works).
 */

import { chromium } from "@playwright/test";

const BASE = "http://search.uscourts.cavc.gov";
const USER_AGENT =
  "vet-rate-org legal-ingestion/1.0 (anthony.johnson.now@gmail.com)";

function parseArgs(argv) {
  const out = { database: "SingleJudgeDecisions", range: "1-100" };
  for (const a of argv) {
    if (a.startsWith("--range=")) out.range = a.split("=")[1];
    else if (a.startsWith("--database=")) out.database = a.split("=")[1];
  }
  return out;
}

function log(msg) {
  console.log(`[diagnose-cavc-visual] ${new Date().toISOString()} — ${msg}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [start, end] = args.range.split("-");

  log(`launching a VISIBLE Chromium window (headless: false)…`);
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  log(`step 1/4 — submitting the search form (IW_DATABASE=${args.database}) via the browser context…`);
  const t0 = Date.now();
  let searchRes;
  try {
    searchRes = await context.request.post(`${BASE}/search/`, {
      form: { IW_FIELD_WEB_STYLE: "*", IW_DATABASE: args.database },
      timeout: 30_000,
    });
  } catch (e) {
    log(`FAILED at step 1 (search POST) after ${Date.now() - t0}ms: ${e.message}`);
    log(`This means the server is not responding to a real browser's request either — a genuine server-side outage, not something specific to the fetch script.`);
    log(`Leaving the browser window open — you can navigate to ${BASE}/search/ manually to see for yourself.`);
    return; // deliberately don't close browser/context — see file header
  }
  const html = await searchRes.text();
  log(`step 1/4 — done in ${Date.now() - t0}ms, HTTP ${searchRes.status()}`);
  const guidMatch = /\/isysquery\/([0-9a-f-]{36})\//i.exec(html);
  if (!guidMatch) {
    log(`FAILED — no session guid found in the response. First 500 chars of body:`);
    log(html.slice(0, 500));
    return;
  }
  const guid = guidMatch[1];
  log(`session guid: ${guid}`);

  log(`step 2/4 — navigating the VISIBLE page to the date-sort URL (watch the window)…`);
  const t1 = Date.now();
  try {
    await page.goto(`${BASE}/isysquery/${guid}/-datetime/sort/`, { timeout: 30_000 });
    log(`step 2/4 — done in ${Date.now() - t1}ms`);
  } catch (e) {
    log(`FAILED at step 2 (sort navigation) after ${Date.now() - t1}ms: ${e.message}`);
    log(`Leaving the browser window open on this state for inspection.`);
    return;
  }

  log(`step 3/4 — navigating the VISIBLE page to list range ${start}-${end} (this is the request type that hung/timed out in the real fetch job)…`);
  const t2 = Date.now();
  try {
    await page.goto(`${BASE}/isysquery/${guid}/${start}-${end}/list/`, { timeout: 30_000 });
    log(`step 3/4 — done in ${Date.now() - t2}ms — SUCCESS, the server responded normally to this range in a real browser`);
  } catch (e) {
    log(`FAILED at step 3 (list page ${start}-${end}) after ${Date.now() - t2}ms: ${e.message}`);
    log(`This confirms the server itself is hanging/refusing on this exact request even from a real browser — not an artifact of the raw fetch() approach.`);
    log(`Leaving the browser window open on this state for inspection.`);
    return;
  }

  log(`step 4/4 — all steps succeeded. The window is showing the live results page for range ${start}-${end}.`);
  log(`Server appears healthy right now for this request. Leaving the browser open — look around, or close it yourself when done.`);
}

main().catch((e) => {
  console.error(`[diagnose-cavc-visual] top-level error: ${e.message}`);
  process.exit(1);
});
