import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * Real-browser main-thread cost of advancedOCR.js's preprocessing chain
 * during a scanned-image import, and whether it blocks the panic key
 * (triple-Escape) or Quick Exit while it runs.
 *
 * This spec used to drive the whole real pipeline (advancedPDFAnalysis on a
 * real File, Tesseract worker pool included) and observe it for a fixed
 * 35s window. Two problems with that, found in review: (1) Tesseract worker
 * creation downloads its core/wasm files from a CDN before any preprocessing
 * runs at all - in a fresh browser context that download's latency is
 * unbounded, so a 35s window can end before the preprocessing chain (the
 * thing actually under test) has even started, silently proving nothing;
 * (2) the "still redirects promptly" tests pressed Escape/clicked Quick Exit
 * immediately after starting the import - before preprocessing began - and
 * asserted no latency bound, so they passed identically whether or not the
 * panic key was ever actually blocked.
 *
 * Fix: call the real, exported applyAdvancedPreprocessing/
 * PREPROCESS_STRATEGIES directly on a synthetic canvas, bypassing Tesseract/
 * the CDN entirely. This is deterministic (no network dependency) and lets
 * every assertion below target the exact property in question: does a
 * single degraded-document preprocessing pass ever produce a main-thread
 * block, and does the panic key still respond promptly while one is
 * in flight. Byte-identical proof that chunking doesn't change what gets
 * computed lives in src/utils/advancedOCR.chunkedYield.byteIdentical.test.js;
 * this spec only covers timing/responsiveness.
 *
 * Canvas size (4896x6336) matches the real working resolution of the
 * SEVERELY_AGED 8.0x high-scale retry (ENABLE_RETRY_WITH_HIGHER_SCALE) on a
 * Letter page - the worst case flagged in review, and the strategy with the
 * most preprocessing steps (grayscale, removeYellowing, autoLevels,
 * enhanceContrast, unsharpMask, adaptiveThreshold, morphologicalClosing,
 * denoise, sharpen).
 *
 * Honest limit on the two "still redirects promptly" tests below: Chromium
 * prioritizes genuine trusted input (a real keydown or a real
 * Input.dispatchMouseEvent click) over continuing JS work, so at this canvas
 * size a press landing right at the start of the chain measured ~50-220ms on
 * both the fixed code AND a targeted revert of grayscale/enhanceContrast/
 * removeYellowing/invert/autoLevels back to unchunked passes - those 4 flat
 * passes combined are individually fast enough (tens of ms even at 31M
 * pixels) that Chromium's input scheduling gets a keypress through either
 * way. These two are regression guards against a much larger future
 * regression (e.g. chunking removed entirely, which measured 38.9-39.1s on
 * base 39d73d40), not proof that this specific fix changed their outcome -
 * that proof is test 1 above (the longtask trigger) and the wall-clock/yield-
 * cost numbers in LONGTASK_TRIGGER_MS's and PANIC_KEY_LATENCY_TRIGGER_MS's
 * own comments.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

const PREPROCESS_WIDTH = 4896;
const PREPROCESS_HEIGHT = 6336;

// Measured live on this machine (real Chromium, this file's own fixture):
// fixed code's longest single task at this canvas size was 173-225ms across
// repeated runs (the rest of the chain stays chunked under the browser's own
// 50ms longtask threshold). A targeted revert of grayscale/enhanceContrast/
// removeYellowing/invert/autoLevels back to unchunked, synchronous passes
// (the code this test exists to catch a regression to) measured 552ms at the
// same size - back-to-back unchunked passes accumulating into one
// uninterrupted task before the chain's first yield point. 500ms sits
// between the two with margin on both sides.
const LONGTASK_TRIGGER_MS = 500;

// MessageChannel yields measured at ~0.007-0.01ms each in both browsers this
// app targets (vs. setTimeout(0)'s ~5.6ms nested-timer-clamped cost) - a
// keypress landing mid-chain should reach the redirect within well under a
// second even on a loaded CI runner. Contrast: the same measurement against
// base 39d73d40 (fully unchunked) was 38.9-39.1s. advancedOCR.js's own
// yieldToEventLoop doc comment covers why this is MessageChannel only, not
// scheduler.yield() - the latter starved real input for an entire busy-loop
// in Firefox specifically, verified live, despite being just as cheap
// per-yield as MessageChannel there.
const PANIC_KEY_LATENCY_TRIGGER_MS = 1000;

async function seedReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
}

async function stubWeatherRedirect(page: Page): Promise<void> {
  await page.route("https://www.weather.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
}

// Installs a real (not string-eval'd) canvas-building function on `window`
// before the app's own scripts run, so both helpers below can call it inside
// their own page.evaluate without duplicating the speckle-generation logic.
// Deterministic pseudo-random speckle standing in for a scanned page - no
// Math.random, reproducible across runs. Same generation shape as the old
// PDF-routed fixture, just built directly onto a canvas.
async function installSyntheticScanCanvasBuilder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__buildSyntheticScanCanvas = (width: number, height: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      ctx.fillStyle = "#f3ecd9";
      ctx.fillRect(0, 0, width, height);
      let seed = 42;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 400000; i++) {
        const x = Math.floor(rand() * width);
        const y = Math.floor(rand() * height);
        const shade = Math.floor(rand() * 120);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 2, 1);
      }
      return canvas;
    };
  });
}

async function measureSeverelyAgedPreprocessingLongTasks(
  page: Page,
): Promise<{ count: number; longest: number }> {
  return page.evaluate(
    async ({ width, height }) => {
      const tasks: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push(entry.duration);
      });
      observer.observe({ entryTypes: ["longtask"] });

      const canvas = window.__buildSyntheticScanCanvas(width, height);
      const mod = await import("/src/utils/advancedOCR.js");
      await mod.applyAdvancedPreprocessing(
        canvas,
        mod.PREPROCESS_STRATEGIES.SEVERELY_AGED,
      );
      // Long task entries only fire once their task completes and the
      // observer callback is flushed - give it one macrotask turn.
      await new Promise((resolve) => setTimeout(resolve, 0));
      observer.disconnect();
      return {
        count: tasks.length,
        longest: tasks.length ? Math.max(...tasks) : 0,
      };
    },
    { width: PREPROCESS_WIDTH, height: PREPROCESS_HEIGHT },
  );
}

async function startBackgroundSeverelyAgedPreprocessing(
  page: Page,
): Promise<void> {
  await page.evaluate(
    async ({ width, height }) => {
      const canvas = window.__buildSyntheticScanCanvas(width, height);
      const mod = await import("/src/utils/advancedOCR.js");
      // Fire-and-forget: the caller presses the panic key/clicks Quick Exit
      // while this is still running, not after it finishes. The page
      // navigates away before this ever resolves in the passing case.
      mod
        .applyAdvancedPreprocessing(
          canvas,
          mod.PREPROCESS_STRATEGIES.SEVERELY_AGED,
        )
        .catch(() => {});
    },
    { width: PREPROCESS_WIDTH, height: PREPROCESS_HEIGHT },
  );
}

async function measureKeydownToNavigation(page: Page): Promise<number> {
  const start = Date.now();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return Date.now() - start;
}

// page.mouse.click (real CDP Input.dispatchMouseEvent), not locator.click():
// verified live that this distinction is load-bearing, not stylistic.
// locator.click()'s own actionability pre-check waits for the element's
// bounding box to be stable across two consecutive animation frames before
// it dispatches anything - and a chunk loop that keeps rescheduling itself
// with ~0ms gaps starves rendering (no rAF/paint opportunity) for as long as
// it runs, so that pre-check (and a plain el.dispatchEvent("click")) both
// measured ~55-60s here, the same duration as the whole preprocessing pass -
// a false positive for "blocked", not a real one. A genuine trusted click is
// prioritized by Chromium's scheduler the same way a keydown is (measured
// ~100-200ms here) - this is what a real
// veteran's mouse click actually goes through, so it's what this test needs
// to measure.
async function measureClickToNavigation(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const start = Date.now();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return Date.now() - start;
}

test.describe("advancedOCR.js preprocessing: main-thread cost during a scanned-image import", () => {
  test("no single main-thread task exceeds the regression-guard trigger during SEVERELY_AGED preprocessing", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Long Tasks API (PerformanceObserver 'longtask') is Chromium-only - Firefox never reports entries for it.",
    );
    test.setTimeout(120_000);
    await installSyntheticScanCanvasBuilder(page);
    await seedReturningUser(page);

    const { count, longest } =
      await measureSeverelyAgedPreprocessingLongTasks(page);
    // eslint-disable-next-line no-console
    console.log(
      `[ocr-perf] SEVERELY_AGED @ ${PREPROCESS_WIDTH}x${PREPROCESS_HEIGHT}: taskCount=${count} longestTaskMs=${longest.toFixed(1)}`,
    );

    expect(longest).toBeLessThan(LONGTASK_TRIGGER_MS);
  });

  // Regression guard (see the file-level doc comment) - Chromium's input
  // scheduling already got a press through quickly on a targeted revert of
  // this fix at this canvas size, so this doesn't prove the fix by itself.
  test("regression guard: triple-Escape still redirects promptly while SEVERELY_AGED preprocessing is actively running", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installSyntheticScanCanvasBuilder(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);

    await startBackgroundSeverelyAgedPreprocessing(page);
    const latencyMs = await measureKeydownToNavigation(page);
    // eslint-disable-next-line no-console
    console.log(
      `[ocr-perf] triple-Escape during SEVERELY_AGED preprocessing: latency=${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_MS);
  });

  // Regression guard (see the file-level doc comment) - same caveat as
  // triple-Escape above.
  test("regression guard: Quick Exit still redirects promptly while SEVERELY_AGED preprocessing is actively running", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installSyntheticScanCanvasBuilder(page);
    await seedReturningUser(page);
    await stubWeatherRedirect(page);
    // Resolved before the heavy work starts: the button's position doesn't
    // move once mounted, and boundingBox() itself has its own (shorter,
    // but still non-zero) actionability wait that would otherwise leak into
    // the latency this test measures.
    const box = await page.locator(QUICK_EXIT_SELECTOR).first().boundingBox();
    if (!box) throw new Error("Quick Exit button has no bounding box");

    await startBackgroundSeverelyAgedPreprocessing(page);
    const latencyMs = await measureClickToNavigation(page, box);
    // eslint-disable-next-line no-console
    console.log(
      `[ocr-perf] Quick Exit during SEVERELY_AGED preprocessing: latency=${latencyMs}ms`,
    );

    expect(page.url()).toMatch(/weather\.com/);
    expect(latencyMs).toBeLessThan(PANIC_KEY_LATENCY_TRIGGER_MS);
  });
});

// D20-1: blank pages inside a text PDF used to go through maximum-strength
// OCR (~85 s each). A real generated PDF - one text page plus four blank
// ones - must now import in seconds with zero OCR, in a real browser.
test.describe("advancedOCR.js: blank pages inside a text PDF", () => {
  test("a text PDF with 4 blank pages imports in seconds without OCR", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await seedReturningUser(page);

    const outcome = await page.evaluate(async () => {
      const objects: string[] = [];
      const blank = "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>";
      const stream = "BT /F1 14 Tf 72 700 Td (Generic fixture page one) Tj ET";
      objects[1] = "<</Type/Catalog/Pages 2 0 R>>";
      objects[2] =
        "<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R 6 0 R 7 0 R]/Count 5>>";
      objects[3] =
        "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 8 0 R/Resources<</Font<</F1 9 0 R>>>>>>";
      for (const n of [4, 5, 6, 7]) objects[n] = blank;
      objects[8] = `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`;
      objects[9] = "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>";

      let body = "%PDF-1.4\n";
      const offsets: number[] = [];
      for (let n = 1; n <= 9; n++) {
        offsets[n] = body.length;
        body += `${n} 0 obj\n${objects[n]}\nendobj\n`;
      }
      const xrefAt = body.length;
      body += "xref\n0 10\n0000000000 65535 f \n";
      for (let n = 1; n <= 9; n++) {
        body += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
      }
      body += `trailer\n<</Size 10/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;

      const mod = await import("/src/utils/advancedOCR.js");
      const file = new File([body], "generic-text-with-blanks.pdf", {
        type: "application/pdf",
      });
      const started = performance.now();
      const result = await mod.default(file, {}, () => {});
      return {
        elapsedMs: performance.now() - started,
        pagesBlank: result.pagesBlank,
        pagesOCRd: result.pagesOCRd,
        pagesRead: result.pagesRead,
        ocrUsed: result.ocrUsed,
        text: result.text,
      };
    });

    expect(outcome.text).toContain("Generic fixture page one");
    expect(outcome.pagesBlank).toEqual([2, 3, 4, 5]);
    expect(outcome.pagesOCRd).toBe(0);
    expect(outcome.ocrUsed).toBe(false);
    expect(outcome.pagesRead).toBe(5);
    expect(outcome.elapsedMs).toBeLessThan(8000);
  });
});

declare global {
  interface Window {
    __buildSyntheticScanCanvas: (
      width: number,
      height: number,
    ) => HTMLCanvasElement;
  }
}
