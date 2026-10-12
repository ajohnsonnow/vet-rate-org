/* eslint-disable max-lines-per-function, complexity, sonarjs/cognitive-complexity -- one linear measurement sequence; splitting it would only scatter the phase timings */
import { runAppCheck } from "./appCheck.mjs";
import { PROBE_ORIGIN } from "./browser.mjs";

const PROBE_PAGE = `${PROBE_ORIGIN}/tools/device-lab/gpu/probe/probe.html`;
const MAX_TOKENS = 128;

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timeout after ${ms / 1000} s: ${label}`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

const errText = (e) => (e instanceof Error ? e.message : String(e));

/**
 * One session: launch a browser pinned to the adapter, prove the adapter,
 * run the detector, load the model, time two generations, unload, close.
 * When the model is not yet in the browser cache the session only downloads
 * (load, unload) so the cold download stays out of the measured run.
 */
async function session({ target, model, options, profileDir }) {
  const sampler = target.startSampler();
  const startedAt = Date.now();
  const result = { startedAt: new Date(startedAt).toISOString(), phases: {} };
  let browser = null;
  let baseTo = startedAt + 2500;
  try {
    await new Promise((r) => setTimeout(r, 2500));
    for (let i = 0; i < 40 && sampler.preLoad().usedMiB === null; i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    baseTo = Date.now();

    browser = await target.launch(profileDir);
    const { page, events } = browser;
    result.events = events;
    await page.goto(
      options.paint === false ? `${PROBE_PAGE}?paint=0` : PROBE_PAGE,
    );
    await withTimeout(
      page.waitForFunction(() => window.__probeReady, null, { timeout: 0 }),
      180_000,
      "probe page ready",
    );
    if (options.backgroundTab) {
      const other = await browser.context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
    }
    result.userAgent = await page.evaluate(() => navigator.userAgent);
    result.page = await page.evaluate(() => ({
      isSecureContext: window.isSecureContext,
      hasNavigatorGpu: Boolean(navigator.gpu),
      origin: location.origin,
    }));
    if (!result.page.isSecureContext || !result.page.hasNavigatorGpu) {
      result.error = `page is not usable for WebGPU: ${JSON.stringify(result.page)}`;
      return result;
    }

    result.adapterInReport = await page.evaluate(() =>
      window.__probe.adapterReport(),
    );
    result.adapterVerified =
      target.adapterMatches(result.adapterInReport.main) &&
      target.adapterMatches(result.adapterInReport.worker);
    if (!result.adapterVerified) {
      result.error = `adapter selection failed: page reports ${JSON.stringify(result.adapterInReport)}`;
      return result;
    }

    result.detector = await page.evaluate(() => window.__probe.detect());
    result.contextWindow =
      options.contextWindow ?? result.detector.contextWindowSize;
    result.contextWindowSource = options.contextWindow
      ? "--context override"
      : `detector, tier ${result.detector.tier}`;
    result.cachedBefore = await page.evaluate(
      (m) => window.__probe.isCached(m),
      model,
    );
    const preLoad = sampler.preLoad();
    result.preLoadMiB = preLoad.usedMiB;
    result.preLoadFreeMiB = preLoad.freeMiB;

    const loadTimeout = (result.cachedBefore ? 20 : 60) * 60_000;
    const loadStart = Date.now();
    const load = await withTimeout(
      page.evaluate(
        ([m, ctx]) => window.__probe.load(m, ctx),
        [model, result.contextWindow],
      ),
      loadTimeout,
      "model load",
    );
    const loadEnd = Date.now();
    result.load = {
      ok: load.ok,
      seconds: load.loadMs / 1000,
      error: load.error ?? null,
      lastProgress: load.lastProgress,
    };
    result.phases.load = { from: loadStart, to: loadEnd };
    if (!load.ok) {
      result.error = load.error;
      return result;
    }
    if (!result.cachedBefore) {
      await page.evaluate(() => window.__probe.unload()).catch(() => {});
      return result;
    }

    const warmStart = Date.now();
    result.warmup = await withTimeout(
      page.evaluate(() => window.__probe.generate("short", 8, 300_000)),
      330_000,
      "warm-up generation",
    );
    result.phases.warmup = { from: warmStart, to: Date.now() };
    if (!result.warmup.ok) {
      result.error = result.warmup.error;
      return result;
    }

    for (const kind of ["short", "long"]) {
      const from = Date.now();
      const g = await withTimeout(
        page.evaluate(
          ([k, n, t, p]) => window.__probe.generate(k, n, t, p),
          [
            kind,
            MAX_TOKENS,
            options.generationTimeoutMs,
            options.longParagraphs,
          ],
        ),
        options.generationTimeoutMs + 30_000,
        `${kind} generation`,
      );
      result.phases[kind] = { from, to: Date.now() };
      result[kind] = g;
      if (!g.ok) {
        result.error = g.error;
        break;
      }
    }
    await page.evaluate(() => window.__probe.unload()).catch(() => {});
    result.phases.end = Date.now();
    return result;
  } catch (err) {
    result.error = errText(err);
    return result;
  } finally {
    const stopAt = Date.now();
    if (browser) {
      result.paint = await browser.page
        .evaluate(() => window.__probe.paintReport())
        .catch(() => null);
      result.deviceEvents = await browser.page
        .evaluate(() => window.__probe.getDeviceEvents())
        .catch(() => null);
    }
    result.crashed = (result.events ?? []).some((e) => e.kind === "page-crash");
    const lostEvent = (result.deviceEvents ?? []).find(
      (e) => e.kind === "device-lost" && e.reason !== "destroyed",
    );
    result.deviceLost = lostEvent
      ? (lostEvent.message.match(/DXGI_ERROR_[A-Z_]+/)?.[0] ??
        lostEvent.message.slice(0, 80))
      : null;
    result.deviceLostSignals = [
      ...(result.events ?? [])
        .filter((e) => /lost/i.test(e.text))
        .map((e) => e.text),
      ...(result.deviceEvents ?? [])
        .filter(
          (e) =>
            (e.kind === "device-lost" && e.reason !== "destroyed") ||
            e.kind === "uncaptured-error",
        )
        .map((e) => `${e.kind}: ${e.reason ?? ""} ${e.message}`),
    ];
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    result.memory = sampler.summarize(
      { from: startedAt, to: baseTo },
      result.phases.load?.from ?? baseTo,
      stopAt,
    );
    if (result.phases.load) {
      result.memoryAfterLoad = sampler.summarize(
        { from: startedAt, to: baseTo },
        result.phases.load.from,
        result.phases.load.to,
      );
    }
    sampler.stop();
  }
}

function pageCondition(options) {
  if (options.paint === false) return "no-paint (stress condition)";
  return options.backgroundTab
    ? "painting, background tab"
    : "painting, foreground";
}

export async function runCell(args) {
  const { target, model, run, options, profileDir, ballast } = args;
  const cell = {
    adapter: target.label,
    platform: target.platform,
    ...target.cellInfo,
    model,
    run,
    headed: options.headed,
    pageCondition: pageCondition(options),
    backgroundTab: options.backgroundTab === true,
    maxTokens: MAX_TOKENS,
    longParagraphs: options.longParagraphs,
    ballast: ballast
      ? {
          targetFreeMiB: ballast.targetFreeMiB,
          freeBeforeMiB: ballast.freeBeforeMiB,
          freeAfterMiB: ballast.freeAfterMiB,
          heldMiB: ballast.heldMiB,
          verified: ballast.verified,
        }
      : null,
  };
  const first = await session({ target, model, options, profileDir });
  if (first.cachedBefore === false && first.load?.ok) {
    // The first session was a cold download: keep it as a separate record and
    // measure a fresh session on the now-warm cache.
    cell.coldDownload = {
      loadSeconds: first.load.seconds,
      memory: first.memory,
    };
    const second = await session({ target, model, options, profileDir });
    return withAppCheck({ ...cell, ...second }, args);
  }
  return withAppCheck({ ...cell, ...first }, args);
}

async function withAppCheck(cell, { target, model, options, profileDir }) {
  if (!options.appCheck || !cell.adapterVerified) return cell;
  const appCheck = await runAppCheck({ target, model, options, profileDir });
  return {
    ...cell,
    appCheck: { ...appCheck, agreed: agreement(cell, appCheck) },
  };
}

/** The outcome both paths are compared on: finished, lost the device or crashed, ran out of time, or failed otherwise. */
export function outcomeClass(r) {
  if (r.crashed || r.deviceLost) return "lost";
  if (/timed out|timeout/i.test(r.error ?? "")) return "timeout";
  if (r.error) return "error";
  return "ok";
}

function agreement(probe, app) {
  return {
    probe: outcomeClass(probe),
    app: outcomeClass(app),
    agreed: outcomeClass(probe) === outcomeClass(app),
  };
}
