import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { dismissDisclaimer } from "../e2e/helpers";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

export async function bootReturningUser(page: Page): Promise<void> {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", appVersion);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
  }, APP_VERSION);
  await page.goto("/");
  await dismissDisclaimer(page);
  await page.waitForLoadState("networkidle");
}

export async function openByEvent(page: Page, event: string) {
  await page.evaluate((name) => {
    window.dispatchEvent(new CustomEvent(name));
  }, event);
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  return dialog;
}

export interface AppDeviceProfile {
  tier: string;
  hasWebGPU: boolean;
  gpuTier: string;
  isMobile: boolean;
  isTablet: boolean;
  canUseWebLLM: boolean;
  contextWindowSize: number;
  recommendedModels: string[];
  firstModel: null | {
    modelId: string;
    displayName: string;
    downloadGB: number | null;
  };
}

/**
 * Reads the profile the app itself computed. Vite's dev server serves the
 * detector at this URL, so the import returns the same module instance the
 * app uses and getCachedDeviceProfile() is the app's own cached result.
 * Nothing in src/ is touched. This only works under the dev server.
 */
export async function readAppDeviceProfile(
  page: Page,
): Promise<AppDeviceProfile | null> {
  return page.evaluate(async () => {
    const mod = await import(
      /* @vite-ignore */ "/src/utils/deviceCapabilityDetector.js"
    );
    const profile = mod.getCachedDeviceProfile();
    if (!profile) return null;
    return {
      tier: profile.tier,
      hasWebGPU: profile.hasWebGPU,
      gpuTier: profile.gpuTier,
      isMobile: profile.isMobile,
      isTablet: profile.isTablet,
      canUseWebLLM: profile.canUseWebLLM,
      contextWindowSize: profile.contextWindowSize,
      recommendedModels: profile.recommendedModels,
      firstModel: mod.describeDeviceModel(profile),
    };
  });
}

/**
 * A known issue is pinned, not excused: while the defect exists the test
 * asserts the specific wrong value the app produces today (the tier or the
 * tier's configuration the profile really lands in), so a timeout, a different
 * wrong value, or the defect being fixed all turn the test red. Returns true
 * when the aspect is pinned. DEVICE_LAB_RAW=1 turns pinning off and runs the
 * intended assertion instead, to see the real failure.
 */
export function pinsKnownIssue(reason: string | undefined): reason is string {
  if (!reason || process.env.DEVICE_LAB_RAW) return false;
  test.info().annotations.push({ type: "known-issue", description: reason });
  return true;
}
