import { expect } from "@playwright/test";
import { assertProfileApplied, test } from "../../tools/device-lab";
import {
  bootReturningUser,
  pinsKnownIssue,
  openByEvent,
  readAppDeviceProfile,
  type AppDeviceProfile,
} from "./helpers";
import { PROFILES, TIERS } from "./expectations";

async function openAnalyzerAndReadProfile(
  page: import("@playwright/test").Page,
) {
  await bootReturningUser(page);
  const dialog = await openByEvent(page, "openCFileAnalyzer");
  await expect
    .poll(() => readAppDeviceProfile(page), { timeout: 20_000 })
    .not.toBeNull();
  const app = (await readAppDeviceProfile(page)) as AppDeviceProfile;
  return { dialog, app };
}

test("the profile reached the page before the app ran", async ({
  page,
  profile,
}) => {
  await bootReturningUser(page);
  await assertProfileApplied(page, profile);
});

test("the detected tier is the one intended for this device class", async ({
  page,
  profile,
}) => {
  const want = PROFILES[profile.name];
  const pinned = pinsKnownIssue(want.knownIssues?.tier);
  const { app } = await openAnalyzerAndReadProfile(page);
  expect(app.tier, `${profile.deviceClass}: detected tier`).toBe(
    pinned ? want.knownIssues!.actualTier : want.tier,
  );
});

test("the model list and limits match ADR-010 for the intended tier", async ({
  page,
  profile,
}) => {
  const want = PROFILES[profile.name];
  const pinned = pinsKnownIssue(want.knownIssues?.config);
  const tier = TIERS[pinned ? want.knownIssues!.actualTier : want.tier];
  const { app } = await openAnalyzerAndReadProfile(page);

  expect(app.canUseWebLLM, "canUseWebLLM").toBe(tier.canUseWebLLM);
  expect(app.recommendedModels[0] ?? null, "first model").toBe(tier.firstModel);
  expect(app.recommendedModels, "number of models").toHaveLength(
    tier.modelCount,
  );
  expect(
    app.recommendedModels.slice(1).filter((id) => /^Qwen3\.5/.test(id)),
    "fallbacks are the earlier models, not more Qwen3.5",
  ).toEqual([]);
  if (tier.contextWindowSize !== null) {
    expect(app.contextWindowSize, "context window").toBe(
      tier.contextWindowSize,
    );
  }
  expect(app.firstModel?.displayName ?? null, "display name").toBe(
    tier.displayName,
  );
});

test("the model card the visitor sees names the right download", async ({
  page,
  profile,
}) => {
  const want = PROFILES[profile.name];
  test.skip(want.noOnDeviceModel, "covered by the no-model test");
  const tier = TIERS[want.tier];
  const { dialog } = await openAnalyzerAndReadProfile(page);

  if (!tier.cardNamesModel) {
    await dialog.getByRole("button", { name: "Minimum requirements" }).click();
  }
  const text = (await dialog.innerText()).replace(/\s+/g, " ");
  expect(text).toContain(tier.download!);
  if (tier.cardNamesModel) expect(text).toContain(tier.displayName!);
  await expect(
    dialog.getByRole("button", { name: /^📥 Load/ }),
    "a load button is offered",
  ).toBeVisible();
});

test("phones and no-WebGPU browsers are not offered an on-device model", async ({
  page,
  profile,
}) => {
  const want = PROFILES[profile.name];
  test.skip(!want.noOnDeviceModel, "this profile can run a model");
  const { dialog, app } = await openAnalyzerAndReadProfile(page);

  expect(app.canUseWebLLM, "canUseWebLLM").toBe(false);
  expect(app.recommendedModels, "recommendedModels").toEqual([]);
  expect(app.firstModel, "describeDeviceModel").toBeNull();
  await expect(dialog.getByText(want.noModelReason!).first()).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^📥 Load/ }),
    "no load button",
  ).toHaveCount(0);
});

test("the laptop card does not say the model runs on the CPU", async ({
  page,
  profile,
}) => {
  const want = PROFILES[profile.name];
  test.skip(want.tier !== "laptop", "laptop tier only");
  const { dialog } = await openAnalyzerAndReadProfile(page);
  const text = (await dialog.innerText()).replace(/\s+/g, " ");
  expect(text).not.toMatch(/WASM fallback|run on your CPU/i);
});
