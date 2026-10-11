import { readFileSync } from "node:fs";
import { test, expect, Page, Request } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { dismissDisclaimer } from "./helpers";

/**
 * VSO help page (spec docs/VSO_SILOS_SPEC.md, S0 / AC16 / Q8).
 *
 * The page ships with no flag. Entry points that exist at S0: the footer link
 * and the link inside VSO Finder (plus the underlying `openVsoHelp` window
 * event both use). The wizard and the VSO banner's overflow menu arrive in
 * later sprints and add their own cases then.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const WIDTHS = [390, 1440, 3840] as const;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const HELP_TITLE = "Helping more than one veteran on one computer";

async function boot(page: Page): Promise<void> {
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

function helpDialog(page: Page) {
  return page.getByRole("dialog", { name: HELP_TITLE });
}

async function openByEvent(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("openVsoHelp")),
        );
        return helpDialog(page).count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  await expect(helpDialog(page)).toBeVisible();
}

async function openFromFooter(page: Page): Promise<void> {
  const link = page.getByRole("button", { name: "Helping several veterans" });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(helpDialog(page)).toBeVisible();
}

async function openFromVsoFinder(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("openVSOFinder")),
        );
        return page.getByRole("dialog").count();
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const link = page.getByRole("button", {
    name: "Helping several veterans on one computer?",
  });
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(helpDialog(page)).toBeVisible();
}

const ENTRY_POINTS: [string, (page: Page) => Promise<void>][] = [
  ["window event openVsoHelp", openByEvent],
  ["footer link", openFromFooter],
  ["VSO Finder link", openFromVsoFinder],
];

for (const [name, open] of ENTRY_POINTS) {
  test(`opens from the ${name}, shows the required content, and closes`, async ({
    page,
  }) => {
    await boot(page);
    await open(page);

    const dialog = helpDialog(page);
    for (const text of [
      /one browser profile per veteran/i,
      /add-profile feature/i,
      /do not install extensions/i,
      /sign in to the browser or turn on browser sync/i,
      /full-disk encryption/i,
      /screen lock/i,
      /removing their browser profile removes the data/i,
      /21-22 or 21-22a/i,
      /Social Security number, VA file number, or a veteran's full name/i,
    ]) {
      await expect(dialog).toContainText(text);
    }

    await page.keyboard.press("Escape");
    await expect(helpDialog(page)).toHaveCount(0);
  });
}

for (const width of WIDTHS) {
  test(`no horizontal scroll and axe clean at ${width}px`, async ({ page }) => {
    await boot(page);
    await page.setViewportSize({ width, height: width === 3840 ? 2160 : 900 });
    await openByEvent(page);

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth,
    }));
    expect(overflow.doc).toBeLessThanOrEqual(0);
    expect(overflow.body).toBeLessThanOrEqual(0);

    const box = await helpDialog(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(WCAG_TAGS)
      .analyze();
    expect(
      results.violations.map((v) => `${v.id} [${v.impact}] x${v.nodes.length}`),
    ).toEqual([]);
  });
}

test("opening the page makes no data requests and contacts no other host", async ({
  page,
  baseURL,
}) => {
  await boot(page);

  const origin = new URL(baseURL!).origin;
  const seen: Request[] = [];
  page.on("request", (r) => seen.push(r));

  await openFromFooter(page);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Escape");
  await openByEvent(page);
  await page.waitForLoadState("networkidle");

  // The only requests allowed are same-origin module/style loads of the lazy
  // chunk itself. Anything else (fetch, XHR, beacon, websocket, another host)
  // is a network call the page must not make.
  const offenders = seen
    .filter((r) => /^https?:/.test(r.url()))
    .filter(
      (r) =>
        new URL(r.url()).origin !== origin ||
        !["script", "stylesheet", "font"].includes(r.resourceType()),
    )
    .map((r) => `${r.resourceType()} ${r.url()}`);
  expect(offenders).toEqual([]);
});
