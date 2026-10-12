import type { PlaywrightTestConfig } from "@playwright/test";
import { contextOptionsFor } from "./apply-profile";
import type { DeviceLabOptions } from "./fixtures";
import { loadProfiles } from "./profiles";

export { applyProfile, contextOptionsFor } from "./apply-profile";
export { loadProfiles, getProfile } from "./profiles";
export {
  assertNoHorizontalScroll,
  assertProfileApplied,
  readPageFacts,
} from "./spec-helpers";
export { test } from "./fixtures";
export type { DeviceLabOptions } from "./fixtures";
export type * from "./types";

type Project = NonNullable<
  PlaywrightTestConfig<DeviceLabOptions>["projects"]
>[number];

/** One Playwright project per profile, named after it. */
export function projectsFor(
  profilesDir?: string,
  extra: Partial<Project> = {},
): Project[] {
  return loadProfiles(profilesDir).map((p) => {
    // A top-level use.screen is not honoured by the test runner (screen
    // height collapses to the viewport height); contextOptions.screen is.
    const { screen, ...options } = contextOptionsFor(p);
    return {
      name: p.name,
      ...extra,
      use: {
        browserName: "chromium",
        ...options,
        contextOptions: { screen },
        deviceProfile: p.name,
        profilesDir,
      },
    };
  });
}
