import { chromium } from "@playwright/test";
import { PROBE_PORT } from "./constants.mjs";

export const PROBE_ORIGIN = `http://localhost:${PROBE_PORT}`;

// Same dawn flags as playwright.stress.config.ts. The power-preference flags
// (--force-high-performance-gpu, --force-low-power-gpu) are left out on purpose:
// they did not move the adapter. --use-adapter-luid is what selects it.
// --enable-webgpu-developer-features is needed for adapter.info to carry the
// device id and description (empty otherwise), which is the proof of selection.
export function browserArgs(adapter) {
  return [
    "--enable-dawn-features=allow_unsafe_apis,use_dxc",
    "--enable-unsafe-webgpu",
    "--enable-webgpu-developer-features",
    `--use-adapter-luid=${adapter.luidArg}`,
  ];
}

export async function launchBrowser({
  adapter,
  profileDir,
  headed,
  screenWidth,
}) {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: headed ? undefined : "chromium",
    headless: !headed,
    args: browserArgs(adapter),
    viewport: { width: screenWidth, height: 1080 },
    screen: { width: screenWidth, height: 1080 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const events = attachEvents(page, context);
  return { context, page, events, close: () => context.close() };
}

export function attachEvents(page, context) {
  const events = [];
  const note = (kind, text) => {
    if (events.length < 60)
      events.push({ t: Date.now(), kind, text: String(text).slice(0, 400) });
  };
  const lossRe =
    /lost|crash|out of memory|oom|d3d12|dxgi|device.*(removed|reset)|gpu process/i;
  page.on("crash", () => note("page-crash", "renderer crashed"));
  page.on("close", () => note("page-close", "page closed"));
  page.on("pageerror", (e) => note("pageerror", e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning" || lossRe.test(m.text()))
      note(`console-${m.type()}`, m.text());
  });
  page.on("worker", (w) => {
    w.on?.("console", (m) => {
      if (lossRe.test(m.text())) note(`worker-console-${m.type()}`, m.text());
    });
  });
  context.on("close", () => note("context-close", "browser context closed"));
  return events;
}
