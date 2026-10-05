import { readFileSync } from "node:fs";
import { test, expect, Locator, Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * D23-3 / D24-5: the notice that an import was cut short is read from local
 * storage, so it survives a killed browser and appears in any tab once the
 * owner stopped beating. At the narrowest and widest screens it must not scroll
 * the page sideways, its Dismiss must be reachable, and it must never cover
 * Quick Exit.
 */
const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const MARKER_PREFIX = "vetrate_import_in_progress:";
const STALE_MS = 5 * 60 * 1000;
const QUICK_EXIT_SELECTOR =
  'button[aria-label="Quick exit - immediately leave this page"]';

const CRISIS_LINK_SELECTOR = 'a[href="https://www.veteranscrisisline.net/"]';

const VIEWPORTS = [
  { name: "390 px phone", width: 390, height: 844 },
  { name: "3840 px monitor", width: 3840, height: 2160 },
];

async function seedFirstRunFlags(page: Page): Promise<void> {
  await page.addInitScript((version) => {
    localStorage.setItem("vet-rate-tos-accepted", "true");
    localStorage.setItem("vet_rate_last_seen_version", version);
    localStorage.setItem("vetrate-tour-completed", "true");
    localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
  }, APP_VERSION);
}

async function seedMarker(page: Page, ageMs: number): Promise<void> {
  await page.evaluate(
    ({ prefix, age }) => {
      localStorage.setItem(
        prefix + "e2e-interrupted-import",
        JSON.stringify({
          total: 4,
          saved: 3,
          labels: ["document 1", "document 2", "document 3", "document 4"],
          id: "e2e-interrupted-import",
          owner: "another-tab",
          heartbeat: Date.now() - age,
        }),
      );
    },
    { prefix: MARKER_PREFIX, age: ageMs },
  );
}

async function loadWithInterruptedImport(page: Page): Promise<void> {
  await seedFirstRunFlags(page);
  await page.goto("/");
  await dismissDisclaimer(page);
  await seedMarker(page, STALE_MS);
  await page.reload();
  await expect(page.getByTestId("interrupted-import-notice")).toBeAttached();
  await dismissDisclaimer(page);
}

const markerCount = (page: Page): Promise<number> =>
  page.evaluate(
    (prefix) =>
      Object.keys(localStorage).filter((key) => key.startsWith(prefix)).length,
    MARKER_PREFIX,
  );

async function isOnTop(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return hit === el || el.contains(hit);
  });
}

async function expectLifeSafetyClear(
  page: Page,
  notice: Locator,
): Promise<void> {
  const crisis = page.locator(CRISIS_LINK_SELECTOR).first();
  await expect(crisis).toBeVisible();
  const noticeBox = await notice.boundingBox();
  const crisisBox = await crisis.boundingBox();
  expect(noticeBox).not.toBeNull();
  expect(crisisBox).not.toBeNull();
  const overlaps =
    noticeBox!.x < crisisBox!.x + crisisBox!.width &&
    crisisBox!.x < noticeBox!.x + noticeBox!.width &&
    noticeBox!.y < crisisBox!.y + crisisBox!.height &&
    crisisBox!.y < noticeBox!.y + noticeBox!.height;
  expect(overlaps).toBe(false);
  expect(await isOnTop(crisis)).toBe(true);
  const alpha = await notice.evaluate((el) => {
    const parts = getComputedStyle(el)
      .backgroundColor.replace(/[^0-9.,]/g, "")
      .split(",");
    return parts.length === 4 ? Number(parts[3]) : 1;
  });
  expect(alpha).toBe(1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`interrupted-import notice at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("shows what is saved, fits the screen, never covers Quick Exit, and can be dismissed", async ({
      page,
    }) => {
      await loadWithInterruptedImport(page);

      const notice = page.getByTestId("interrupted-import-notice");
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("3 of 4 documents were saved");

      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

      const dismiss = notice.getByRole("button", { name: "Dismiss" });
      await expect(dismiss).toBeVisible();
      const box = await dismiss.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.height).toBeGreaterThanOrEqual(44);

      const quickExit = page.locator(QUICK_EXIT_SELECTOR);
      await expect(quickExit).toBeVisible();
      const noticeBox = await notice.boundingBox();
      const exitBox = await quickExit.boundingBox();
      expect(noticeBox).not.toBeNull();
      expect(exitBox).not.toBeNull();
      const overlaps =
        noticeBox!.x < exitBox!.x + exitBox!.width &&
        exitBox!.x < noticeBox!.x + noticeBox!.width &&
        noticeBox!.y < exitBox!.y + exitBox!.height &&
        exitBox!.y < noticeBox!.y + noticeBox!.height;
      expect(overlaps).toBe(false);

      expect(await isOnTop(quickExit)).toBe(true);
      expect(await isOnTop(dismiss)).toBe(true);
      await expectLifeSafetyClear(page, notice);

      await dismiss.click();
      await expect(notice).toBeHidden();
      expect(await markerCount(page)).toBe(0);
    });
  });
}

test("another tab of the same browser also shows an abandoned import", async ({
  page,
  context,
}) => {
  await loadWithInterruptedImport(page);
  await expect(page.getByTestId("interrupted-import-notice")).toBeVisible();

  const other = await context.newPage();
  await seedFirstRunFlags(other);
  await other.goto("/");
  await dismissDisclaimer(other);
  await expect(other.getByTestId("interrupted-import-notice")).toBeVisible();
});

test("an import still beating in another tab is not reported", async ({
  page,
  context,
}) => {
  await seedFirstRunFlags(page);
  await page.goto("/");
  await dismissDisclaimer(page);
  await seedMarker(page, 1000);

  const other = await context.newPage();
  await seedFirstRunFlags(other);
  await other.goto("/");
  await dismissDisclaimer(other);
  await expect(other.getByTestId("interrupted-import-notice")).toHaveCount(0);
  expect(await markerCount(other)).toBe(1);
});
