import { basename } from "node:path";
import { test, expect, Page } from "@playwright/test";
import {
  AI_LOAD_TIMEOUT,
  STRESS_MODE,
  assertTelemetryVerdict,
  bootStressPage,
  injectStressMods,
  listMusterCorpus,
  openToolByEvent,
  readDocCategoryCounts,
  shuffled,
  skipUnlessStress,
  startTelemetry,
} from "./helpers";

// Every document pauses for OCR + Warrant Council intel; DD214s additionally
// route through the Florence-2 vision worker, whose model downloads on first
// run — hence the generous per-document and total budgets.
const TOTAL_TIMEOUT_MS = 7_200_000;
const PER_DOC_TIMEOUT_MS = 600_000;

interface LedgerEntry {
  filename?: string;
  file?: { name?: string };
  status: string;
}

async function readLedger(page: Page): Promise<LedgerEntry[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("vetrate_formation_state");
    if (!raw) return [];
    try {
      return JSON.parse(raw).formation ?? [];
    } catch {
      return [];
    }
  });
}

test.describe("WS-1 stress: Muster Call randomized batch", () => {
  test(`full-corpus batch ingest [${STRESS_MODE}]`, async ({
    page,
    context,
  }, testInfo) => {
    skipUnlessStress();
    // Muster Call's aiReady gate is the Warrant Council swarm; wllama cannot
    // drive it and extract mode can never enable Begin Formation at all.
    test.skip(
      STRESS_MODE !== "webgpu",
      "Muster Call stress runs in webgpu (swarm) mode only",
    );
    test.setTimeout(TOTAL_TIMEOUT_MS);

    const files = shuffled(listMusterCorpus());
    expect(
      files.length,
      "corpus contains no accepted documents",
    ).toBeGreaterThan(0);
    const submittedNames = files.map((f) => basename(f));

    await bootStressPage(page);
    const telemetry = await startTelemetry(context, page);

    await openToolByEvent(page, "openMusterCall");

    await page.getByRole("button", { name: /🎖️ Load AI/ }).click();

    // Hidden multi-file input; setInputFiles bypasses the styled label.
    await page.locator("#muster-call-files").setInputFiles(files);

    // The button carries an aria-label ("Start processing documents"), so its
    // accessible name never contains "Begin Formation" — match on text content
    // instead. The "🚩 Begin Formation" text itself only renders once aiReady.
    const begin = page.locator("button").filter({ hasText: "Begin Formation" });
    await expect(begin).toBeEnabled({ timeout: AI_LOAD_TIMEOUT });
    await begin.click();

    // Sequential mode (the default) pauses on every document with an
    // intelligence briefing that must be verified and saved.
    for (let saved = 0; saved < files.length; saved++) {
      const verifyBtn = page.getByRole("button", { name: /Verify & Save/ });
      await verifyBtn.waitFor({
        state: "visible",
        timeout: PER_DOC_TIMEOUT_MS,
      });

      // The briefing has no "verify all" control: every extracted-field
      // checkbox must be ticked before the allFieldsVerified gate enables
      // Verify & Save. Only unchecked boxes are touched, so the saveToVKB /
      // updateProfile defaults (checked) are left alone.
      const briefing = page.locator('[role="dialog"]', { has: verifyBtn });
      for (;;) {
        const unchecked = briefing.locator(
          'input[type="checkbox"]:not(:checked)',
        );
        if ((await unchecked.count()) === 0) break;
        await unchecked.first().check();
      }

      // Explicit (short relative to PER_DOC_TIMEOUT_MS) timeout so a click
      // that's stuck on actionability (covered, unstable, still disabled)
      // fails fast with Playwright's own diagnostic instead of silently
      // retrying for the rest of the 2h test budget.
      await verifyBtn.click({ timeout: 30_000 });

      // Wait for this document's SAVED to land in the persisted ledger before
      // re-matching the (re-mounted) briefing for the next document.
      await expect
        .poll(
          async () =>
            (await readLedger(page)).filter((e) => e.status === "SAVED").length,
          { timeout: PER_DOC_TIMEOUT_MS },
        )
        .toBeGreaterThan(saved);
    }

    // FormationLineup unmounts once processing completes, so the final ledger
    // is read from localStorage — useFormationQueue persists it on every
    // change. Every submitted filename must reach terminal status SAVED;
    // anything ERROR, stuck mid-pipeline, or missing fails with its status.
    const ledger = await readLedger(page);
    const statusByName = new Map(
      ledger.map((e) => [e.filename ?? e.file?.name ?? "", e.status]),
    );
    const notSaved = submittedNames
      .filter((name) => statusByName.get(name) !== "SAVED")
      .map((name) => `${name} → ${statusByName.get(name) ?? "MISSING"}`);
    expect(notSaved, "documents that never reached SAVED").toEqual([]);

    // Per-type PLACEMENT: every doc must land in the CORRECT VKB documentation
    // bucket, not just reach SAVED. addDocumentToVKB routes DD214/service_record
    // → dd214s and rating_decision/claim_letter → cFiles. The corpus has 4
    // DD214s + 31 claim/decision letters, so both buckets must be non-empty;
    // zero in either means a whole document type was misrouted.
    await injectStressMods(page);
    const counts = await readDocCategoryCounts(page);
    expect(
      counts.dd214s,
      "DD214 service records not archived to documentation.dd214s",
    ).toBeGreaterThanOrEqual(1);
    expect(
      counts.cFiles,
      "claim/decision letters not archived to documentation.cFiles",
    ).toBeGreaterThanOrEqual(1);

    // Honest per-type coverage: unlike the C-File, the 35 letters/DD214s have no
    // ground-truth fixture, and their structured fields route to the separate
    // veteran-profile store — so we report routing + archived counts as the
    // recall proxy rather than claiming a field-level recall percentage.
    const coverage = { submitted: submittedNames.length, byCategory: counts };
    await testInfo.attach("per-type-doc-coverage", {
      body: JSON.stringify(coverage, null, 2),
      contentType: "application/json",
    });

    const report = await telemetry.stop(testInfo);
    assertTelemetryVerdict(report);
  });
});
