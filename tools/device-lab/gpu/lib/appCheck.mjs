/* eslint-disable max-lines-per-function, complexity, sonarjs/cognitive-complexity -- one linear session: boot, load, two generations, collect */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROBE_ORIGIN } from "./browser.mjs";
import { REPO_ROOT } from "./server.mjs";
import { SHORT_PROMPT, buildLongPrompt } from "../probe/prompts.js";

const APP_TOOL_ID = "personal-statement";
const APP_MAX_TOKENS = 128;
const APP_VERSION = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
).version;

const errText = (e) => (e instanceof Error ? e.message : String(e));

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

// The returning-user localStorage keys of bootStressPage in tests/stress/helpers.ts,
// and the swarm routing key for "webgpu" mode. The app then boots past its
// first-run dialogs without any change to src/.
function bootScript({ appVersion }) {
  localStorage.setItem("vet-rate-tos-accepted", "true");
  localStorage.setItem("vet_rate_last_seen_version", appVersion);
  localStorage.setItem("vetrate-tour-completed", "true");
  localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
  localStorage.removeItem("vetrate_formation_state");
  localStorage.setItem("vet_rate_ai_mode", "swarm");
  window.__labDeviceEvents = [];
  new BroadcastChannel("device-lab-gpu").onmessage = (e) => {
    if (window.__labDeviceEvents.length < 40)
      window.__labDeviceEvents.push(e.data);
  };
}

async function dismissDisclaimer(page) {
  await page
    .locator("#main-content")
    .waitFor({ state: "attached", timeout: 30_000 });
  const dialog = page.locator(
    '[role="dialog"][aria-labelledby="splash-title"]',
  );
  if (!(await dialog.isVisible().catch(() => false))) return;
  await page.evaluate(() => {
    const d = document.querySelector(
      '[role="dialog"][aria-labelledby="splash-title"]',
    );
    const buttons = d?.querySelectorAll("button") ?? [];
    buttons[buttons.length - 1]?.click();
  });
  await dialog.waitFor({ state: "hidden", timeout: 8000 });
}

// The same three modules and the same calls as tests/eval/golden-set.spec.ts
// (exposeAppModules, loadForcedModel, runCase): detectDeviceCapabilities for
// the tier and context window, initializeSwarm for the load, generateAI for
// each prompt. Only the model list is narrowed to the model under test.
// openAdvice is left off, as for the writing tools: with it the app holds the
// question back from the 2B and 1.5B models and never calls them (ADR-010 s.11).
const EXPOSE_MODULES = `
  import * as dc from "/src/utils/deviceCapabilityDetector.js";
  import * as swarm from "/src/utils/diamondSwarm.js";
  import * as ai from "/src/utils/unifiedAIService.js";
  window.__labApp = { dc, swarm, ai };
`;

async function loadModel(page, model) {
  return page.evaluate(async (modelId) => {
    const { dc, swarm, ai } = window.__labApp;
    const profile = await dc.detectDeviceCapabilities();
    profile.recommendedModels = [modelId];
    const t0 = performance.now();
    const loaded = await swarm.initializeSwarm("auditor");
    return {
      loaded,
      loadSeconds: (performance.now() - t0) / 1000,
      ready: ai.isDiamondSwarmReady(),
      modelLoaded: swarm.getSwarmStatus().model,
      tier: profile.tier,
      contextWindowSize: profile.contextWindowSize,
    };
  }, model);
}

function generate(page, prompt, timeoutMs) {
  return page.evaluate(
    async ({ prompt, timeoutMs, toolId, maxTokens }) => {
      const { swarm, ai } = window.__labApp;
      swarm.clearLastSwarmGeneration();
      ai.resetAICircuitBreaker();
      const t0 = performance.now();
      const visibleAtStart = document.visibilityState;
      try {
        const result = await ai.generateAI(prompt, {
          toolId,
          dataClass: "context",
          temperature: 0,
          maxTokens,
          thinking: false,
          timeout: timeoutMs,
        });
        const text = typeof result === "string" ? result : (result?.text ?? "");
        const onDevice = Boolean(swarm.getLastSwarmGeneration()?.raw);
        return {
          ok: onDevice,
          error: onDevice
            ? null
            : "generateAI did not go through the on-device swarm",
          seconds: (performance.now() - t0) / 1000,
          outputChars: text.length,
          textHead: text.slice(0, 80),
          visibleAtStart,
          visibleAtEnd: document.visibilityState,
        };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          seconds: (performance.now() - t0) / 1000,
          visibleAtStart,
          visibleAtEnd: document.visibilityState,
        };
      }
    },
    { prompt, timeoutMs, toolId: APP_TOOL_ID, maxTokens: APP_MAX_TOKENS },
  );
}

/**
 * One cross-check session: the real app in a browser pinned to the same adapter,
 * its own tier detection and generation path, one short and one long synthetic
 * prompt. Device loss is seen through the same requestDevice hook the probe
 * uses (the lab's dev server prepends it to the app's inference worker; see
 * vite.config.mjs), plus console signals and tab crashes. Nothing here adds an
 * animation loop to the page: the app paints whatever its own UI paints, and
 * only the visibility state is recorded.
 */
export async function runAppCheck({ target, model, options, profileDir }) {
  const out = {
    path: "app generateAI (initializeSwarm + generateAI)",
    prompts: {},
  };
  let browser = null;
  try {
    browser = await target.launch(profileDir);
    const { page, events, context } = browser;
    out.events = events;
    await page.addInitScript(bootScript, { appVersion: APP_VERSION });
    await page.goto(`${PROBE_ORIGIN}/`);
    await dismissDisclaimer(page);
    if (options.backgroundTab) {
      const other = await context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
    }
    await page.addScriptTag({ type: "module", content: EXPOSE_MODULES });
    await page.waitForFunction(() => Boolean(window.__labApp), null, {
      timeout: 60_000,
    });
    const load = await withTimeout(
      loadModel(page, model),
      20 * 60_000,
      "app model load",
    );
    out.load = load;
    out.contextWindow = load.contextWindowSize;
    if (!load.loaded || load.modelLoaded !== model || !load.ready) {
      out.error = `app did not load ${model}: ${JSON.stringify(load)}`;
      return out;
    }
    const timeoutMs = options.generationTimeoutMs;
    const prompts = [
      ["short", SHORT_PROMPT],
      ["long", buildLongPrompt(options.longParagraphs)],
    ];
    for (const [kind, prompt] of prompts) {
      const g = await withTimeout(
        generate(page, prompt, timeoutMs),
        timeoutMs + 60_000,
        `app ${kind} generation`,
      );
      out.prompts[kind] = { ...g, promptChars: prompt.length };
      if (!g.ok) {
        out.error = g.error;
        break;
      }
    }
    return out;
  } catch (err) {
    out.error = errText(err);
    return out;
  } finally {
    if (browser) {
      out.deviceEvents = await browser.page
        .evaluate(() => window.__labDeviceEvents ?? [])
        .catch(() => null);
    }
    out.crashed = (out.events ?? []).some((e) => e.kind === "page-crash");
    const lostEvent = (out.deviceEvents ?? []).find(
      (e) => e.kind === "device-lost" && e.reason !== "destroyed",
    );
    out.deviceLost = lostEvent
      ? (lostEvent.message.match(/DXGI_ERROR_[A-Z_]+/)?.[0] ??
        lostEvent.message.slice(0, 80))
      : null;
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
  }
}
