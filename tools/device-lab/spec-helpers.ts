import { expect, type Page } from "@playwright/test";
import type { DeviceProfile } from "./types";

export interface PageFacts {
  userAgent: string;
  uaMobile: boolean | null;
  uaPlatform: string | null;
  deviceMemory: number | null;
  hardwareConcurrency: number;
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  touch: boolean;
  hasViewportMeta: boolean;
  gpu:
    | { exposed: false }
    | {
        exposed: true;
        adapter: null | {
          maxBufferSize: number;
          maxStorageBufferBindingSize: number;
          vendor: string;
          architecture: string;
          description: string;
        };
      };
}

export async function readPageFacts(page: Page): Promise<PageFacts> {
  return page.evaluate(async () => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      gpu?: { requestAdapter(): Promise<any> };
      userAgentData?: { mobile: boolean; platform: string };
    };
    let gpu: PageFacts["gpu"] = { exposed: false };
    if (nav.gpu) {
      const a = await nav.gpu.requestAdapter();
      gpu = {
        exposed: true,
        adapter: a && {
          maxBufferSize: a.limits.maxBufferSize,
          maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
          vendor: a.info?.vendor ?? "",
          architecture: a.info?.architecture ?? "",
          description: a.info?.description ?? "",
        },
      };
    }
    return {
      userAgent: nav.userAgent,
      uaMobile: nav.userAgentData ? nav.userAgentData.mobile : null,
      uaPlatform: nav.userAgentData ? nav.userAgentData.platform : null,
      deviceMemory: nav.deviceMemory ?? null,
      hardwareConcurrency: nav.hardwareConcurrency,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      touch: nav.maxTouchPoints > 0,
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      gpu,
    };
  });
}

/**
 * Reads the values back inside the page and compares them with the profile.
 * Requires a page that has navigated (an init script only runs on navigation).
 * CPU and network throttling cannot be read back from the page; those are
 * checked by selftest/selftest.spec.ts.
 */
export async function assertProfileApplied(
  page: Page,
  p: DeviceProfile,
): Promise<PageFacts> {
  const f = await readPageFacts(page);
  expect(f.userAgent, "userAgent").toBe(p.userAgent);
  expect(f.uaMobile, "userAgentData.mobile").toBe(
    p.userAgentData ? p.userAgentData.mobile : null,
  );
  expect(f.uaPlatform, "userAgentData.platform").toBe(
    p.userAgentData ? p.userAgentData.platform : null,
  );
  expect(f.deviceMemory, "deviceMemory").toBe(p.deviceMemory);
  expect(f.hardwareConcurrency, "hardwareConcurrency").toBe(
    p.hardwareConcurrency,
  );
  expect([f.screenWidth, f.screenHeight], "screen width and height").toEqual([
    p.screen.width,
    p.screen.height,
  ]);
  expect(f.devicePixelRatio, "devicePixelRatio").toBeCloseTo(
    p.deviceScaleFactor,
    2,
  );
  expect(f.touch, "touch points present").toBe(p.hasTouch);
  if (!p.isMobile || f.hasViewportMeta) {
    expect([f.innerWidth, f.innerHeight], "viewport width and height").toEqual([
      p.viewport.width,
      p.viewport.height,
    ]);
  }
  if (p.gpu === null) {
    expect(f.gpu, "navigator.gpu").toEqual({ exposed: false });
  } else if (p.gpu.adapter === null) {
    expect(f.gpu, "navigator.gpu with a null adapter").toEqual({
      exposed: true,
      adapter: null,
    });
  } else {
    const a = p.gpu.adapter;
    expect(f.gpu, "navigator.gpu adapter").toEqual({
      exposed: true,
      adapter: {
        maxBufferSize: a.limits.maxBufferSize,
        maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
        vendor: a.vendor,
        architecture: a.architecture,
        description: a.description,
      },
    });
  }
  return f;
}

/** The page, or the element matching `within`, must not scroll sideways. */
export async function assertNoHorizontalScroll(
  page: Page,
  within?: string,
): Promise<void> {
  const m = await page.evaluate((selector) => {
    const el = selector
      ? document.querySelector(selector)
      : document.documentElement;
    if (!el) return null;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      viewport: window.innerWidth,
    };
  }, within);
  expect(m, `element ${within} exists`).not.toBeNull();
  const overflow = m!.scrollWidth - m!.clientWidth;
  expect(
    overflow,
    `${within ?? "page"} scrolls sideways by ${overflow}px (scrollWidth ${m!.scrollWidth}, clientWidth ${m!.clientWidth}, viewport ${m!.viewport})`,
  ).toBeLessThanOrEqual(0);
}
