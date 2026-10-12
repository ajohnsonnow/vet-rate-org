import type { BrowserContextOptions, Page } from "@playwright/test";
import type { AppliedState, DeviceProfile } from "./types";

/**
 * Options for `use:` in a Playwright project, or `browser.newContext()`.
 * These must be set when the context is created; applyProfile does the rest.
 */
export function contextOptionsFor(p: DeviceProfile): BrowserContextOptions {
  return {
    viewport: p.viewport,
    screen: p.screen,
    deviceScaleFactor: p.deviceScaleFactor,
    isMobile: p.isMobile,
    hasTouch: p.hasTouch,
    userAgent: p.userAgent,
  };
}

interface InitPayload {
  deviceMemory: DeviceProfile["deviceMemory"];
  hardwareConcurrency: number;
  userAgentData: DeviceProfile["userAgentData"];
  gpu: DeviceProfile["gpu"];
}

// Runs inside the page, serialised by Playwright: it must not reference
// anything from this module's scope.
function installOverrides(p: InitPayload): void {
  const nav = navigator as unknown as Record<string, unknown>;
  const proto = Navigator.prototype as unknown as Record<string, unknown>;
  const define = (target: object, key: string, get: () => unknown) =>
    Object.defineProperty(target, key, { get, configurable: true });

  if (p.deviceMemory === null) delete proto.deviceMemory;
  else define(navigator, "deviceMemory", () => p.deviceMemory);
  define(navigator, "hardwareConcurrency", () => p.hardwareConcurrency);

  if (p.userAgentData === null) {
    delete proto.userAgentData;
  } else {
    const spec = p.userAgentData;
    // With a user-agent override active Chromium returns a fresh
    // NavigatorUAData on every read, so patching one instance does not stick.
    const real = nav.userAgentData as
      | {
          brands: unknown[];
          getHighEntropyValues(h: string[]): Promise<object>;
        }
      | undefined;
    const brands = () => real?.brands ?? [];
    const wrapper = {
      get brands() {
        return brands();
      },
      mobile: spec.mobile,
      platform: spec.platform,
      getHighEntropyValues: async (hints: string[]) => ({
        ...(real ? await real.getHighEntropyValues(hints) : {}),
        mobile: spec.mobile,
        platform: spec.platform,
      }),
      toJSON: () => ({
        brands: brands(),
        mobile: spec.mobile,
        platform: spec.platform,
      }),
    };
    define(navigator, "userAgentData", () => wrapper);
  }

  if (p.gpu === null) {
    delete proto.gpu;
    return;
  }
  const spec = p.gpu.adapter;
  const adapter = spec && {
    limits: { ...spec.limits },
    info: {
      vendor: spec.vendor,
      architecture: spec.architecture,
      device: spec.device,
      description: spec.description,
    },
    features: new Set<string>(),
    isFallbackAdapter: false,
    requestDevice: () =>
      Promise.reject(
        new Error("device-lab: profile adapters cannot create a GPU device"),
      ),
  };
  const requestAdapter = async () => adapter;
  const real = nav.gpu as Record<string, unknown> | undefined;
  if (real) {
    Object.defineProperty(real, "requestAdapter", {
      value: requestAdapter,
      configurable: true,
      writable: true,
    });
  } else {
    define(navigator, "gpu", () => ({
      requestAdapter,
      getPreferredCanvasFormat: () => "bgra8unorm",
      wgslLanguageFeatures: new Set<string>(),
    }));
  }
}

/**
 * Spoofs what the page is told (navigator fields, WebGPU adapter) and, on
 * Chromium, throttles the CPU and network through CDP. Pass
 * `{ network: false }` to skip the network conditions, for example against an
 * unbundled dev server where they make every page load take minutes. Call
 * before the first page.goto(). The init script runs in every frame of the context but not in
 * Web Workers.
 */
export async function applyProfile(
  page: Page,
  p: DeviceProfile,
  options: { network?: boolean } = {},
): Promise<AppliedState> {
  const payload: InitPayload = {
    deviceMemory: p.deviceMemory,
    hardwareConcurrency: p.hardwareConcurrency,
    userAgentData: p.userAgentData,
    gpu: p.gpu,
  };
  await page.context().addInitScript(installOverrides, payload);

  const state: AppliedState = {
    profile: p.name,
    cdp: false,
    cpuThrottleRate: null,
    network: null,
  };
  if (page.context().browser()?.browserType().name() !== "chromium") {
    return state;
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", {
    rate: p.cpuThrottleRate,
  });
  state.cdp = true;
  state.cpuThrottleRate = p.cpuThrottleRate;
  if (p.network && options.network !== false) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: p.network.latencyMs,
      downloadThroughput: (p.network.downloadKbps * 1000) / 8,
      uploadThroughput: (p.network.uploadKbps * 1000) / 8,
    });
    state.network = p.network;
  }
  return state;
}
