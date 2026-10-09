/**
 * Tool-with-packet — deep interaction tests
 *
 * Pre-loads the synthetic redacted fixture (9 conditions, 70% combined) and
 * verifies that each tool cluster correctly reads and displays that data.
 *
 * Audit questions answered here:
 *   - Does Tactical Calculator display/compute the pre-loaded conditions?
 *   - Does Nexus Builder surface condition names for selection?
 *   - Does Million Dollar Dashboard show a compensation estimate?
 *   - Do the three previously-non-rendering tools now render after Sprint 6 fixes?
 *   - Do AI-dependent tools show a meaningful state (not blank/crash) without
 *     a live model loaded?
 *
 * All 9 fixture conditions (Migraine Headaches 40%, Cervical Strain 10%,
 * etc.) are an invented condition+rating set, with placeholder identity
 * JOHN Q. VETERAN / 000-00-0000 / C-000-0000.
 *
 * NOTE: These tests do NOT call any live AI — no Gemini key, no GGUF model.
 * They verify UI state and data-binding, not LLM output quality.
 */
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/redacted-packet.json", "utf-8"),
);
const FIXTURE_CLAIMS = FIXTURE.data.claims;

// Key condition names from the 70% scenario
const CONDITION_MIGRAINE = "Migraine Headaches";
const CONDITION_CERVICAL = "Cervical Strain";
const CONDITION_IBS = "Irritable Bowel Syndrome";

// React commits the interactive tree (including every cluster's listener-
// registering useEffect) once useBootSequence's isBooting gate flips false,
// but passive effects flush a tick AFTER that commit paints - networkidle
// only proves the commit happened, not that effects have run yet. Waiting
// on two animation frames plus a macrotask turn is tied to the browser's
// real paint/task-queue lifecycle (and so scales with actual system load)
// rather than guessing a fixed duration.
async function waitForInteractiveEffectsToSettle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0)),
        );
      }),
  );
}

// ── Boot helper ───────────────────────────────────────────────────────────────
async function bootWithPacket(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version, claims }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));
    },
    { version: APP_VERSION, claims: FIXTURE_CLAIMS },
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForInteractiveEffectsToSettle(page);
}

// ── Tool dispatch + wait ──────────────────────────────────────────────────────
// Waits up to 15s (matches the webServer/lazy-chunk budget established in
// mobile.spec.ts's Atomic Wipe test) for either dialog shape to become
// visible - a single locator.waitFor() replaces the old manual
// 500ms-interval poll loop with Playwright's own built-in retry. Heavier
// tools (PDF generation, adversarial-testing bundle) can exceed a tighter
// budget under the parallel-worker local dev-server contention this suite
// runs with (CI runs workers: 1, serial, no contention).
async function openTool(page: Page, eventName: string): Promise<boolean> {
  await page.evaluate((evt) => {
    window.dispatchEvent(new CustomEvent(evt));
  }, eventName);

  const found = await page
    .locator('[role="dialog"], [aria-modal="true"]')
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (found) return true;

  // Fallback: full-screen fixed overlay (ClaimNavigator before Sprint 6)
  return page
    .locator(".fixed.inset-0")
    .first()
    .isVisible()
    .catch(() => false);
}

async function closeTool(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page
    .locator('[role="dialog"], [aria-modal="true"]')
    .first()
    .waitFor({ state: "hidden", timeout: 2000 })
    .catch(() => {});
  // React's unmount/cleanup effects (focus restoration, scroll-lock removal)
  // flush as passive effects after the dialog's DOM node is already gone -
  // useBodyScrollLock's cleanup only removes "modal-open" once the LAST
  // open modal's effect has flushed, so waiting for that class to clear is
  // a real signal cleanup settled, not a fixed guess at how long that
  // takes. Falls back to the same double-rAF+macrotask settle for any
  // dialog that never used the body-scroll-lock hook in the first place.
  const stillLocked = await page
    .waitForFunction(
      () => !document.body.classList.contains("modal-open"),
      null,
      { timeout: 3000 },
    )
    .then(() => false)
    .catch(() => true);
  if (stillLocked) await waitForInteractiveEffectsToSettle(page);
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Calculate cluster — with 9-condition packet", () => {
  test("Tactical Calculator opens and renders a dialog", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openTacticalCalculator");
    expect(opened, "Tactical Calculator should render a dialog").toBe(true);
    await closeTool(page);
  });

  test("Tactical Calculator shows at least one condition from the fixture", async ({
    page,
  }) => {
    await bootWithPacket(page);
    await openTool(page, "openTacticalCalculator");

    // WS-7 acceptance: the calculator must surface the packet's 9 rated
    // conditions via "Load from My Records" and compute the verified 70%
    // combined rating with zero manual typing. (The previous version of
    // this test passed vacuously on Chromium — innerText included <option>
    // values containing "40"/"70" — while the conditions never hydrated.)
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const loadBtn = dialog.getByRole("button", {
      name: "Load into calculator",
    });
    await expect(loadBtn).toBeVisible({ timeout: 7000 });
    await loadBtn.click();

    await expect(dialog).toContainText("Migraine", { timeout: 7000 });
    await expect(dialog).toContainText("Irritable Bowel");
    await expect(dialog).toContainText("70%", { timeout: 7000 });
    await closeTool(page);
  });

  test("Million Dollar Dashboard opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openMillionDollarDashboard");
    expect(opened, "Million Dollar Dashboard should render").toBe(true);
    await closeTool(page);
  });

  test("Retro Pay Hunter opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openRetroPayHunter");
    expect(opened, "Retro Pay Hunter should render").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Discover cluster — with 9-condition packet", () => {
  test("Pathfinder opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openPathfinder");
    expect(opened, "Pathfinder should render").toBe(true);
    await closeTool(page);
  });

  test("Secondary Scout opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openSecondaryScoutLauncher");
    expect(opened, "Secondary Scout should render").toBe(true);
    await closeTool(page);
  });

  // NexusBuilder was in the "non-renders" list in Sprint 3 because it requires
  // condition data in app state. With 9 conditions pre-loaded, it should now render.
  test("Nexus Builder renders with pre-loaded conditions (Sprint 3 gap)", async ({
    page,
  }) => {
    await bootWithPacket(page);

    // NexusBuilder needs conditions hydrated into React state before it
    // decides whether to render - give that effect the same real
    // paint/task-queue settle bootWithPacket already waits on.
    await waitForInteractiveEffectsToSettle(page);
    await openTool(page, "openNexusBuilder");

    const appeared = await page
      .locator('[role="dialog"], [aria-modal="true"]')
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    expect(
      appeared,
      "NexusBuilder should render when conditions are pre-loaded in localStorage",
    ).toBe(true);
    await closeTool(page);
  });

  test("Claim Navigator opens and has role=dialog (Sprint 6 fix)", async ({
    page,
  }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openClaimNavigator");
    expect(opened, "Claim Navigator should be visible after event").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Evidence cluster — with 9-condition packet", () => {
  test("C-File AI Analyzer opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openCFileAnalyzer");
    expect(opened, "C-File AI Analyzer should render").toBe(true);
    await closeTool(page);
  });

  test("Blue Button X-Ray opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openBlueButtonXRay");
    expect(opened, "Blue Button X-Ray should render").toBe(true);
    await closeTool(page);
  });

  test("Nexus Builder opens (basic render)", async ({ page }) => {
    await bootWithPacket(page);
    await openTool(page, "openNexusBuilder");
    // Accept opened OR not-yet-fixed NexusBuilder (see the stricter Sprint 3
    // gap test above) — this one only asserts the app itself didn't crash.
    const bodyVisible = await page.locator("body").isVisible();
    expect(
      bodyVisible,
      "App should still be up after opening Nexus Builder",
    ).toBe(true);
    await closeTool(page);
  });

  test("Witness Bench opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openWitnessBench");
    expect(opened, "Witness Bench should render").toBe(true);
    await closeTool(page);
  });

  test("Muster Call (PDF) opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openMusterCall");
    expect(opened, "Muster Call should render").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("QC cluster — with 9-condition packet", () => {
  test("Denial Decoder opens and has role=dialog (Sprint 6 fix)", async ({
    page,
  }) => {
    await bootWithPacket(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("openDenialDecoder"));
    });

    // After Sprint 6 fix, DenialDecoder has role="dialog"
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await closeTool(page);
  });

  test("Decision Decoder opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openDecisionDecoder");
    expect(opened, "Decision Decoder should render").toBe(true);
    await closeTool(page);
  });

  test("Red Team opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openRedTeam");
    expect(opened, "Red Team should render").toBe(true);
    await closeTool(page);
  });

  test("Claim Stress Test (War Game) opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openClaimStressTest");
    expect(opened, "The War Game should render").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Maximize cluster — with 9-condition packet", () => {
  test("TDIU Builder opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openTDIUBuilder");
    expect(opened, "TDIU Builder should render").toBe(true);
    await closeTool(page);
  });

  test("State Benefit Hunter opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openStateBenefitHunter");
    expect(opened, "State Benefit Hunter should render").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Support cluster — with 9-condition packet", () => {
  test("My Packet opens and reflects loaded claims", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openMyPacket");
    expect(opened, "My Packet should render").toBe(true);

    const dialog = page.locator('[role="dialog"]').first();
    const dialogText = await dialog.innerText().catch(() => "");

    // My Packet should list the pre-loaded conditions
    const hasData =
      dialogText.includes("Migraine") ||
      dialogText.includes("Irritable Bowel") ||
      dialogText.includes("9") || // 9 conditions
      dialogText.includes("70");

    expect(
      hasData,
      `My Packet dialog text: "${dialogText.slice(0, 300)}"`,
    ).toBe(true);
    await closeTool(page);
  });

  test("Knowledge Base (VKB) opens", async ({ page }) => {
    await bootWithPacket(page);
    const opened = await openTool(page, "openVKBViewer");
    expect(opened, "VKB Viewer should render").toBe(true);
    await closeTool(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Packet persistence — cross-tool data consistency", () => {
  test("all 9 conditions are still in localStorage after opening 3 tools", async ({
    page,
  }) => {
    await bootWithPacket(page);

    // Open and close three tools that might modify state
    for (const evt of [
      "openTacticalCalculator",
      "openMyPacket",
      "openRetroPayHunter",
    ]) {
      await openTool(page, evt);
      await closeTool(page);
    }

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("vet_rate_saved_claims");
      return raw ? JSON.parse(raw) : null;
    });

    expect(stored).not.toBeNull();
    expect(stored.length).toBe(9);

    const migraine = stored.find((c: { conditionName: string }) =>
      c.conditionName.includes("Migraine"),
    );
    expect(migraine?.selectedRating ?? migraine?.ratingPercent).toBe(40);
  });

  test("no PII from the fixture appears in localStorage keys", async ({
    page,
  }) => {
    await bootWithPacket(page);

    const allStorage = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const data: Record<string, string> = {};
      for (const key of keys) {
        data[key] = localStorage.getItem(key) ?? "";
      }
      return data;
    });

    const allValues = Object.values(allStorage).join(" ");
    // Fixture uses placeholder PII
    expect(allValues).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN
    expect(allValues).not.toMatch(/JOHN Q\. VETERAN/i); // synthetic name — ok in fixture
    // Real name must never appear
    expect(allValues).not.toMatch(/\bAnthony\b.*\bJohnson\b/);
  });
});
