import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Page } from "@playwright/test";
import { TOOLS } from "./tool-launch-matrix.data";

/**
 * Shared harness for the app-wide sweeps (layout, form controls, contrast).
 * It boots a returning user with the redacted packet and a set of saved
 * ratings, then visits the home page, every tool in the launch matrix, and
 * every tab inside each tool's dialog that can be reached with a click and
 * no AI. A sweep passes a `visit` callback that inspects whatever is on
 * screen and returns the problems it found.
 *
 * Not a spec file: Playwright refuses to collect a spec that imports another
 * spec, so shared code lives here (see tool-launch-matrix.data.ts).
 */

export const WIDTHS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "4K", width: 3840, height: 2160 },
] as const;

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;
const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/redacted-packet.json", "utf-8"),
);

const SAVED_RATINGS = [
  { name: "Knee (Left)", rating: 40, side: "left", bodyPart: "knee" },
  { name: "Knee (Right)", rating: 20, side: "right", bodyPart: "knee" },
  { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
  { name: "Lumbar strain", rating: 20, side: "none", bodyPart: "back" },
  { name: "Tinnitus", rating: 10, side: "none", bodyPart: "ear" },
];

const DIALOG = '[role="dialog"], [aria-modal="true"]';
const TAB_SELECTOR = '[role="tab"], nav button';

export type Finding = { screen: string; problem: string };
export type Visit = (page: Page, screen: string) => Promise<string[]>;

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0)),
        );
      }),
  );
}

export async function bootForSweep(
  page: Page,
  theme: "light" | "dark" = "light",
): Promise<void> {
  await page.addInitScript(
    ({ version, claims, ratings, themeName }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vet_rate_saved_claims", JSON.stringify(claims));
      localStorage.setItem("vet_rate_my_ratings", JSON.stringify(ratings));
      localStorage.setItem("vet-rate-theme", themeName);
    },
    {
      version: APP_VERSION,
      claims: FIXTURE.claims,
      ratings: SAVED_RATINGS,
      themeName: theme,
    },
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await settle(page);
}

async function closeDialog(page: Page): Promise<void> {
  const dialog = page.locator(DIALOG).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await dialog.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    const closed = await dialog
      .waitFor({ state: "hidden", timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (closed) break;
    const closeButton = page
      .locator(
        `${DIALOG.split(", ")
          .map(
            (d) =>
              `${d} button[aria-label="Close"], ${d} button[aria-label="Close dialog"]`,
          )
          .join(", ")}`,
      )
      .first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ force: true });
    }
  }
  await page
    .waitForFunction(
      () => !document.body.classList.contains("modal-open"),
      null,
      { timeout: 3000 },
    )
    .catch(() => {});
  await settle(page);
}

/**
 * Visits the home page, every tool, and every tab in each tool. Returns the
 * findings and the number of screens inspected. A tool that does not open is
 * itself a finding, so a sweep can never pass by seeing nothing.
 */
export async function sweep(
  page: Page,
  visit: Visit,
): Promise<{ findings: Finding[]; screens: number }> {
  const findings: Finding[] = [];
  let screens = 0;
  const inspect = async (screen: string) => {
    screens += 1;
    for (const problem of await visit(page, screen)) {
      findings.push({ screen, problem });
    }
  };

  await inspect("Home");

  for (const tool of TOOLS) {
    await page.evaluate(
      (eventName) => window.dispatchEvent(new CustomEvent(eventName)),
      tool.event,
    );
    const dialog = page.locator(DIALOG).first();
    const opened = await dialog
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      findings.push({ screen: tool.name, problem: "did not open" });
      continue;
    }
    await settle(page);
    await inspect(tool.name);

    const tabs = dialog.locator(TAB_SELECTOR);
    const tabCount = Math.min(await tabs.count(), 12);
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      if (!(await tab.isVisible().catch(() => false))) continue;
      const label = ((await tab.textContent()) ?? "").trim().slice(0, 30);
      await tab.click({ timeout: 2000 }).catch(() => {});
      await settle(page);
      if (!(await dialog.isVisible().catch(() => false))) break;
      await inspect(`${tool.name} › ${label || `tab ${i + 1}`}`);
    }
    await closeDialog(page);
  }
  return { findings, screens };
}

/** Writes a sweep's findings where a person can read them after the run. */
export function recordFindings(
  name: string,
  width: number,
  project: string,
  result: { findings: Finding[]; screens: number },
): void {
  mkdirSync("test-results/sweeps", { recursive: true });
  writeFileSync(
    `test-results/sweeps/${name}-${project}-${width}.json`,
    JSON.stringify(result, null, 2),
  );
}

export const describeFindings = (findings: Finding[]): string =>
  findings.map((f) => `${f.screen}: ${f.problem}`).join("\n");
