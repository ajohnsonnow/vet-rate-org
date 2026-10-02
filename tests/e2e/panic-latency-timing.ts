/**
 * Panic-key latency measured inside the page, not across the test runner.
 *
 * The first versions of the import-latency specs timed `Date.now()` in the
 * Playwright runner around `keyboard.press` / `mouse.click` / `waitForURL`.
 * That interval also contains the runner-to-browser round trips, so under
 * parallel load (4 workers) the same correct code read 1236 ms against a
 * 1000 ms budget at 4x CPU throttle, while measuring 61-185 ms alone.
 *
 * What these specs prove is that the page's main thread is never blocked
 * long enough to delay the panic redirect. That is the interval from the
 * FIRST input event of the gesture (the first Escape of the triple press, or
 * the Quick Exit pointerdown) to the page starting to unload, and both ends
 * are visible inside the page on one clock: `event.timeStamp` and
 * `performance.now()`. The start must be the first event, not the last: the
 * runner waits for each press to be acknowledged, so a main-thread block that
 * starts on press 1 delays press 2 from being sent at all, and only the first
 * event's timestamp sits before the block. Anything that blocks the main
 * thread (the work the specs exist to catch) therefore still lengthens this
 * interval, so the budgets are unchanged; only the runner's own
 * post-navigation bookkeeping is left out.
 */
import { expect, type Page } from "@playwright/test";

interface PanicTimingState {
  latenciesMs: number[];
}

const MAX_PLAUSIBLE_LATENCY_MS = 60_000;
const REPORT_WAIT_MS = 5_000;

const timingByPage = new WeakMap<Page, PanicTimingState>();

/**
 * Must run before the page's first navigation: the init script and the
 * exposed function only apply to documents created after they are added.
 */
export async function armPanicTiming(page: Page): Promise<void> {
  const state: PanicTimingState = { latenciesMs: [] };
  timingByPage.set(page, state);

  await page.exposeFunction("__reportPanicLatencyMs", (ms: number) => {
    state.latenciesMs.push(ms);
  });
  await page.addInitScript(() => {
    // The runner arms one gesture right before it starts pressing. Setup
    // code (closing dialogs, priming caches) also sends input, so "the first
    // Escape seen" is not necessarily the measured gesture's first Escape.
    let armed = false;
    let gestureStartedAt: number | null = null;
    (
      window as unknown as { __armPanicGesture?: () => void }
    ).__armPanicGesture = () => {
      armed = true;
      gestureStartedAt = null;
    };
    const markGestureStart = (event: Event) => {
      if (armed && gestureStartedAt === null) {
        gestureStartedAt = event.timeStamp;
      }
    };
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") markGestureStart(event);
      },
      true,
    );
    window.addEventListener("pointerdown", markGestureStart, true);
    window.addEventListener(
      "beforeunload",
      () => {
        if (gestureStartedAt === null) return;
        const report = (
          window as unknown as {
            __reportPanicLatencyMs?: (ms: number) => void;
          }
        ).__reportPanicLatencyMs;
        report?.(performance.now() - gestureStartedAt);
      },
      true,
    );
  });
}

function stateFor(page: Page): PanicTimingState {
  const state = timingByPage.get(page);
  if (!state) {
    throw new Error("armPanicTiming(page) must run before measuring latency");
  }
  return state;
}

async function takeReportedLatency(state: PanicTimingState): Promise<number> {
  await expect
    .poll(() => state.latenciesMs.length, {
      message: "the page never reported its panic-redirect timing",
      timeout: REPORT_WAIT_MS,
    })
    .toBeGreaterThan(0);
  const latencyMs = state.latenciesMs[state.latenciesMs.length - 1];
  if (latencyMs < 0 || latencyMs > MAX_PLAUSIBLE_LATENCY_MS) {
    throw new Error(
      `implausible in-page latency ${latencyMs}ms: event.timeStamp and performance.now() are not on the same clock`,
    );
  }
  return latencyMs;
}

/**
 * Call once the page is fully set up and idle, before the background import
 * is started: the next Escape or pointerdown becomes the measured gesture's
 * start. Deliberately not done inside the measure functions - an evaluate
 * issued while the import is running would itself wait out the very
 * main-thread block the spec is trying to catch, and the key presses would
 * then land after it.
 */
export async function armPanicGesture(page: Page): Promise<void> {
  stateFor(page).latenciesMs.length = 0;
  await page.evaluate(() =>
    (
      window as unknown as { __armPanicGesture: () => void }
    ).__armPanicGesture(),
  );
}

export async function measureKeydownToNavigation(page: Page): Promise<number> {
  const state = stateFor(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return takeReportedLatency(state);
}

export async function measureClickToNavigation(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const state = stateFor(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL(/weather\.com/, { timeout: 30000 });
  return takeReportedLatency(state);
}
