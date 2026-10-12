import { defineConfig } from "@playwright/test";
import { projectsFor, type DeviceLabOptions } from "../index";

export default defineConfig<DeviceLabOptions>({
  testDir: ".",
  testMatch: /selftest\.spec\.ts$/,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: "list",
  outputDir: "../../../test-results/device-lab-selftest",
  projects: projectsFor(),
});
