import { test as base } from "@playwright/test";
import { applyProfile } from "./apply-profile";
import { getProfile } from "./profiles";
import type { DeviceProfile } from "./types";

export interface DeviceLabOptions {
  /** Set per project: `use: { deviceProfile: "phone-iphone" }`. */
  deviceProfile: string | undefined;
  profilesDir: string | undefined;
  /** false skips the profile's network conditions. Default true. */
  applyNetwork: boolean;
}

export interface DeviceLabFixtures {
  profile: DeviceProfile;
}

/**
 * `test` with the project's profile applied to `page` before the test body
 * runs. The project must also spread contextOptionsFor(profile) into `use`
 * (see projectsFor in index.ts) because viewport, screen and touch can only be
 * set when the context is created.
 */
export const test = base.extend<DeviceLabFixtures & DeviceLabOptions>({
  deviceProfile: [undefined, { option: true }],
  profilesDir: [undefined, { option: true }],
  applyNetwork: [true, { option: true }],
  profile: async ({ deviceProfile, profilesDir }, use) => {
    if (!deviceProfile) {
      throw new Error("device-lab: project has no use.deviceProfile");
    }
    await use(getProfile(deviceProfile, profilesDir));
  },
  page: async ({ page, profile, applyNetwork }, use) => {
    await applyProfile(page, profile, { network: applyNetwork });
    await use(page);
  },
});
