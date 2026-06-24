import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  AI_LOAD_TIMEOUT,
  CFILE_PDF,
  STRESS_MODE,
  assertTelemetryVerdict,
  bootStressPage,
  initWllamaViaDevServer,
  openToolByEvent,
  skipUnlessStress,
  startTelemetry,
} from "./helpers";

interface GroundTruth {
  expectedCombined: number;
  minInServiceEvents: number;
  validDcSource: string;
  conservativeConditionSubstrings: string[];
  conditions: {
    conditionName: string;
    diagnosticCode: number;
    rating: number;
  }[];
}

const GROUND_TRUTH: GroundTruth = JSON.parse(
  readFileSync("tests/fixtures/cfile-ground-truth.json", "utf-8"),
);

// The allowed-DC set is loaded node-side from the same source the production
// hallucination trap uses; any rendered DC outside it is a hallucination.
const VALID_DCS: Set<string> = new Set(
  JSON.parse(
    readFileSync(GROUND_TRUTH.validDcSource, "utf-8"),
  ).disabilities.map((d: { diagnosticCode: string | number }) =>
    String(d.diagnosticCode),
  ),
);

// WS-1 pass bar: the progress UI must keep visibly moving.
// stream:false decode (batch GPU readback) starves setInterval macrotasks,
// so the heartbeat cannot fire during generation. On a 4080 SUPER the decode
// of a 1024-token chunk takes up to ~5 min for large chunks (high context
// utilisation + long JSON output); 360 s matches PHASE_TRANSITION_LIMIT_MS
// and gives safe margin without letting a genuine hang go undetected.
// Run br7dlofgw2 failed at 300342 ms (342 ms over the 300 s limit).
const PROGRESS_STALL_LIMIT_MS = 360_000;
// Document open / model warm-up phases are silent by nature on a 313MB file
const PHASE_TRANSITION_LIMIT_MS = 360_000;
const PROGRESS_POLL_MS = 1_000;

test.describe("WS-1 stress: 313MB C-File full pipeline", () => {
  test(`ingest and analyze [${STRESS_MODE}]`, async ({
    page,
    context,
  }, testInfo) => {
    skipUnlessStress();
    // Production gates make AI-off un-drivable: the Analyze button is disabled
    // unless isAnyAIAvailable(), so there is no extraction-only path to drive.
    test.skip(
      STRESS_MODE === "extract",
      "extract (AI-off) mode is un-drivable through the production UI",
    );

    await bootStressPage(page);
    const telemetry = await startTelemetry(context, page);

    // Pipe browser console errors to Node stdout so they appear in the output
    // file and make chunk-level failure reasons visible without DevTools.
    page.on("console", (msg) => {
      if (
        msg.type() === "error" ||
        msg.text().includes("❌") ||
        msg.text().includes("JSON Parse") ||
        msg.text().includes("Failed to parse") ||
        msg.text().includes("failedChunk")
      ) {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
      }
    });

    await openToolByEvent(page, "openCFileAnalyzer");
    const dialog = page.locator(
      '[role="dialog"][aria-labelledby="cfile-analyzer-title"]',
    );
    await expect(dialog).toBeVisible();

    // The input is hidden behind the drop zone — setInputFiles still works.
    await dialog
      .locator('input[type="file"][accept=".pdf,application/pdf"]')
      .setInputFiles(CFILE_PDF);

    if (STRESS_MODE === "webgpu") {
      await dialog.getByRole("button", { name: /📥 Load/ }).click();
    } else {
      await initWllamaViaDevServer(page);
    }

    // Gate is `!file || !isAnyAIAvailable()`; the component re-checks
    // availability every 1s, so the button flips once the model is ready.
    const analyzeBtn = dialog.getByRole("button", {
      name: /Analyze My C-File/,
    });
    await expect(analyzeBtn).toBeEnabled({ timeout: AI_LOAD_TIMEOUT });
    await analyzeBtn.click();

    const consent = page.locator(
      '[role="dialog"][aria-labelledby="cfile-privacy-title"]',
    );
    await expect(consent).toBeVisible();
    await consent
      .getByRole("button", { name: /I Understand - Start Analysis/ })
      .click();

    // Staleness watchdog: any change in the dialog's text counts as progress;
    // frozen text past the stall limit fails the run. Completion ends the loop;
    // an error screen freezes the text and fails through the same assertion.
    // pdf.js opening a 313MB document parses the xref/structure silently for
    // minutes before the first page batch reports — phase transitions get the
    // larger budget, steady-state progress gets the strict one.
    let lastText = "";
    let lastChangeAt = Date.now();
    let changesSeen = 0;
    for (;;) {
      const text = await dialog.innerText();
      if (text.includes("Analysis Complete")) break;
      if (text !== lastText) {
        lastText = text;
        lastChangeAt = Date.now();
        changesSeen++;
      }
      const budget =
        changesSeen < 3 ? PHASE_TRANSITION_LIMIT_MS : PROGRESS_STALL_LIMIT_MS;
      expect(
        Date.now() - lastChangeAt,
        `progress UI stalled (no visible update for ${budget / 1000}s)`,
      ).toBeLessThan(budget);
      await page.waitForTimeout(PROGRESS_POLL_MS);
    }
    // Known display bug: the completion header's page count renders blank —
    // deliberately not asserted here.

    // A partial analysis (failed chunks) is not a passing stress run.
    await expect(
      dialog.getByRole("alert").filter({ hasText: "Partial analysis" }),
    ).toHaveCount(0);

    await dialog.locator("button").filter({ hasText: "🎯" }).first().click();

    // Conservative recall: condition names render as h4 cards; assert the
    // ground-truth substrings appear somewhere in the collected headings.
    const conditionHeadings = await dialog.locator("h4").allInnerTexts();
    expect(
      conditionHeadings.length,
      "claims tab rendered no condition cards",
    ).toBeGreaterThan(0);
    const haystack = conditionHeadings.join("\n").toLowerCase();
    for (const fragment of GROUND_TRUTH.conservativeConditionSubstrings) {
      expect(haystack, `expected condition missing: ${fragment}`).toContain(
        fragment.toLowerCase(),
      );
    }

    // Anti-hallucination: every rendered "DC NNNN" badge must exist in the
    // rating schedule. Zero invalid codes is a hard WS-1 requirement.
    const spanTexts = await dialog.locator("span").allInnerTexts();
    const renderedDcs = spanTexts
      .map((t) => t.trim())
      .filter((t) => /^DC \d+$/.test(t))
      .map((t) => t.replace(/^DC /, ""));
    expect(
      renderedDcs.length,
      "no DC badges rendered — hallucination check would be vacuous",
    ).toBeGreaterThan(0);
    const hallucinated = renderedDcs.filter((dc) => !VALID_DCS.has(dc));
    expect(hallucinated, "hallucinated diagnostic codes rendered").toEqual([]);

    const report = await telemetry.stop(testInfo);
    assertTelemetryVerdict(report);
  });
});
