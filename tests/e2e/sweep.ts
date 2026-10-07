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

// What a veteran would see as a crash: an uncaught error, or a console error
// from an error boundary or a null dereference. Layout and contrast checks
// pass on a screen that recovered from one, so the sweeps collect these and
// report them against the screen that was open.
const CRASH_TEXT = /Unhandled error|error boundary|Cannot read properties/i;
const crashes = new WeakMap<Page, string[]>();

function watchForCrashes(page: Page): void {
  if (crashes.has(page)) return;
  const seen: string[] = [];
  crashes.set(page, seen);
  page.on("pageerror", (error) => {
    seen.push(
      `uncaught error: ${(error.stack ?? error.message).slice(0, 700)}`,
    );
  });
  page.on("console", (message) => {
    if (message.type() === "error" && CRASH_TEXT.test(message.text())) {
      seen.push(`console error: ${message.text().slice(0, 700)}`);
    }
  });
}

const takeCrashes = (page: Page, screen: string): Finding[] =>
  (crashes.get(page)?.splice(0) ?? []).map((problem) => ({ screen, problem }));

export async function bootForSweep(
  page: Page,
  theme: "light" | "dark" = "light",
): Promise<void> {
  watchForCrashes(page);
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
      claims: FIXTURE.data.claims,
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
    findings.push(...takeCrashes(page, screen));
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
    findings.push(...takeCrashes(page, `${tool.name} (closing)`));
  }
  return { findings, screens };
}

// ── States behind input ─────────────────────────────────────────────────
// The sweep above sees each screen as it opens. These are the states QA
// reached by hand that only exist after a veteran has typed or clicked, so
// they stay covered: none needs an AI model.

const ANY_DIALOG = `${DIALOG}, [role="alertdialog"]`;
const tool = (page: Page) => page.locator('[role="dialog"]').last();

async function openTool(page: Page, event: string) {
  await page.evaluate(
    (name) => window.dispatchEvent(new CustomEvent(name)),
    event,
  );
  await tool(page).waitFor({ state: "visible", timeout: 15000 });
  await settle(page);
  return tool(page);
}

/** Gives every empty visible text field, date and select in the dialog a value. */
async function fillVisibleFields(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (!root) return;
    const fields = root.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select");
    for (const el of fields) {
      if (!el.getBoundingClientRect().width) continue;
      if (el instanceof HTMLSelectElement) {
        if (!el.value) {
          el.selectedIndex = 1;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        continue;
      }
      if (el.type === "checkbox" || el.type === "radio" || el.value) continue;
      const values: Record<string, string> = {
        email: "qa@example.invalid",
        date: "2015-06-15",
        tel: "555-010-0199",
      };
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
        el,
        values[el.type] ?? "Fictional answer",
      );
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

const visibleButton = (page: Page, text: RegExp) =>
  tool(page).locator("button:visible").filter({ hasText: text });

async function startGuidedForm(page: Page, form: RegExp) {
  await openTool(page, "openFormsHelper");
  await tool(page).getByRole("button", { name: form }).first().click();
  await visibleButton(page, /Start Guided Builder/).click();
  await settle(page);
}

async function generateFormsStatement(page: Page) {
  await startGuidedForm(page, /Statement in Support of Claim/);
  for (let step = 0; step < 8; step++) {
    await fillVisibleFields(page);
    const generate = tool(page)
      .locator("button:visible:not([disabled])")
      .filter({ hasText: /Generate Statement/ });
    if (await generate.count()) {
      await generate.last().click();
      break;
    }
    await visibleButton(page, /^Next$/)
      .last()
      .click();
    await settle(page);
  }
  await tool(page)
    .getByText("Statement Generated!")
    .waitFor({ timeout: 20000 });
}

const FICTIONAL_LETTER =
  "FICTIONAL TEST LETTER. Service connection for tinnitus is denied. The evidence does not show a nexus between the claimed condition and service. The examiner opined it is less likely than not related to service.";

const CALCULATOR_CONDITIONS = [
  ["knee", "left", "40"],
  ["knee", "right", "20"],
  ["mental", null, "50"],
  ["back", null, "20"],
  ["ear", null, "10"],
] as const;

export const STATES: { name: string; reach: (page: Page) => Promise<void> }[] =
  [
    {
      name: "Calculator with five conditions and a bilateral pair",
      reach: async (page) => {
        const dialog = await openTool(page, "openTacticalCalculator");
        await dialog
          .locator("nav button")
          .filter({ hasText: /Calculator/ })
          .first()
          .click();
        for (const [bodyPart, side, rating] of CALCULATOR_CONDITIONS) {
          await dialog
            .getByLabel("Body Part / Condition Type")
            .selectOption(bodyPart);
          if (side)
            await dialog.getByLabel("Side", { exact: true }).selectOption(side);
          await dialog.getByLabel("Rating %").selectOption(rating);
          await dialog
            .getByRole("button", { name: /Add to Calculator/i })
            .click();
        }
        await dialog
          .getByText(`Your Rated Conditions (${CALCULATOR_CONDITIONS.length})`)
          .waitFor({ timeout: 5000 });
      },
    },
    {
      name: "Calculator Rates tab",
      reach: async (page) => {
        const dialog = await openTool(page, "openTacticalCalculator");
        await dialog
          .locator("nav button")
          .filter({ hasText: /Rates/ })
          .first()
          .click();
      },
    },
    {
      name: "Forms Helper at a checklist step",
      reach: async (page) => {
        await startGuidedForm(page, /PTSD Stressor Statement/);
        for (let step = 0; step < 8; step++) {
          if (await tool(page).locator('input[type="checkbox"]').count()) break;
          await fillVisibleFields(page);
          await visibleButton(page, /^Next$/)
            .last()
            .click();
          await settle(page);
        }
        await tool(page)
          .locator('input[type="checkbox"]')
          .first()
          .waitFor({ state: "attached", timeout: 5000 });
      },
    },
    {
      name: "Forms Helper result view",
      reach: generateFormsStatement,
    },
    {
      name: "Unsaved-edit dialog",
      reach: async (page) => {
        await generateFormsStatement(page);
        const draft = tool(page).locator("textarea:visible").last();
        await draft.focus();
        await page.keyboard.type(" An edit that has not been saved.");
        await page.keyboard.press("Escape");
        await page
          .locator('[role="alertdialog"]')
          .waitFor({ state: "visible", timeout: 5000 });
      },
    },
    {
      name: "Decision Decoder with the fictional letter",
      reach: async (page) => {
        const dialog = await openTool(page, "openDecisionDecoder");
        await dialog.locator("textarea").first().fill(FICTIONAL_LETTER);
        const decode = dialog.getByRole("button", {
          name: /Decode This Decision/,
        });
        if (!(await decode.isDisabled())) {
          await decode.click();
          await dialog
            .getByText(/Supplemental Claim|Higher-Level Review|Board Appeal/i)
            .first()
            .waitFor({ timeout: 15000 });
        }
      },
    },
    {
      name: "My Packet with one saved statement",
      reach: async (page) => {
        await generateFormsStatement(page);
        await visibleButton(page, /Save to Packet/)
          .first()
          .click();
        await tool(page)
          .getByText(/Saved to My Packet/)
          .first()
          .waitFor({ timeout: 10000 });
        await closeEverything(page);
        const packet = await openTool(page, "openMyPacket");
        const statements = packet
          .locator("nav button")
          .filter({ hasText: /Forms/ })
          .first();
        if (await statements.count()) await statements.click();
        await settle(page);
      },
    },
    {
      name: "Million Dollar Dashboard with saved ratings",
      reach: async (page) => {
        await openTool(page, "openMillionDollarDashboard");
        await page
          .getByRole("link", { name: /Buy Luna a Treat/ })
          .waitFor({ timeout: 10000 });
      },
    },
    {
      name: "AI Command Center Advanced tab",
      reach: async (page) => {
        const dialog = await openTool(page, "openAISettings");
        await dialog
          .getByRole("button", { name: /Advanced/ })
          .first()
          .click();
        await settle(page);
      },
    },
    {
      name: "Assistant after one message with no AI set up",
      reach: async (page) => {
        await page.getByRole("button", { name: /Open AI Navigator/ }).click();
        const input = page.locator("textarea:visible").last();
        await input.waitFor({ state: "visible", timeout: 10000 });
        await input.fill("What is a nexus letter?");
        await input.press("Enter");
        await page
          .getByText("What is a nexus letter?")
          .last()
          .waitFor({ timeout: 10000 });
        await page.waitForTimeout(3000);
        const problem = await page.evaluate(() => {
          const title = document.querySelector(
            "#tour-ai-navigator-expanded h3",
          );
          if (!title) return "the assistant title element is missing";
          const box = title.getBoundingClientRect();
          if (box.width < 40)
            return `the assistant title is ${Math.round(box.width)}px wide`;
          if (title.scrollWidth > title.clientWidth + 1) {
            return "the assistant title is clipped";
          }
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          // The title takes no pointer events, so a hit on a plain ancestor of it is the title showing through.
          return hit &&
            hit.closest("#tour-ai-navigator-expanded") &&
            (title.contains(hit) || hit.contains(title))
            ? null
            : `the assistant title is covered by <${hit?.tagName.toLowerCase()} class="${String(hit?.className).slice(0, 80)}">`;
        });
        if (problem) throw new Error(problem);
        const statusProblem = await page.evaluate(() => {
          const win = document.querySelector("#tour-ai-navigator-expanded");
          const button = win?.querySelector('[data-testid="ai-status-badge"]');
          const label = button?.querySelector("span");
          if (!button || !label)
            return "the assistant status button is missing";
          const text = (label.textContent ?? "").trim();
          if (!text) return "the assistant status has no visible text";
          const box = label.getBoundingClientRect();
          const outer = win.getBoundingClientRect();
          if (box.width < 20)
            return `the status label is ${Math.round(box.width)}px wide`;
          if (label.scrollWidth > label.clientWidth + 1) {
            return `the status label "${text}" is clipped`;
          }
          if (box.right > Math.min(outer.right, window.innerWidth) + 1) {
            return `the status label "${text}" runs past the window`;
          }
          if (button.getBoundingClientRect().height < 44) {
            return "the status button is under 44px tall";
          }
          // axe cannot judge text over a gradient, so compute the contrast
          // here: the label against the button's backing laid over each end
          // of the header gradient.
          const nums = (css: string) =>
            (css.match(/[0-9.]+/g) ?? []).map(Number);
          const lum = (rgb: number[]) => {
            const [r, g, bl] = rgb.map((v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
          };
          const ratio = (x: number[], y: number[]) => {
            const [hi, lo] = [lum(x), lum(y)].sort((m, n) => n - m);
            return (hi + 0.05) / (lo + 0.05);
          };
          const labelRgb = nums(getComputedStyle(label).color).slice(0, 3);
          const backing = nums(getComputedStyle(button).backgroundColor);
          const alpha = backing.length > 3 ? backing[3] : 1;
          const header = button.closest(".drag-handle");
          const ends = [
            ...(header
              ? getComputedStyle(header).backgroundImage.matchAll(
                  /rgba?[(][^)]*[)]/g,
                )
              : []),
          ].map((m) => nums(m[0]).slice(0, 3));
          if (labelRgb.length < 3 || backing.length < 3 || ends.length < 2) {
            return "could not read the status label's colours";
          }
          for (const end of ends) {
            const behind = backing
              .slice(0, 3)
              .map((v, i) => v * alpha + end[i] * (1 - alpha));
            const found = ratio(labelRgb, behind);
            if (found < 4.5) {
              return `the status label is ${found.toFixed(2)}:1 over the header gradient (needs 4.5:1)`;
            }
          }
          return null;
        });
        if (statusProblem) throw new Error(statusProblem);
      },
    },
  ];

/** Closes whatever is open, discarding an unsaved-edit prompt if one appears. */
async function closeEverything(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const prompt = page.locator('[role="alertdialog"]');
    if (await prompt.isVisible().catch(() => false)) {
      await prompt
        .locator("button")
        .nth(1)
        .click()
        .catch(() => {});
      await settle(page);
      continue;
    }
    if (
      !(await page
        .locator(ANY_DIALOG)
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      break;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  const assistantClose = page
    .locator('button[aria-label*="Close" i]:visible')
    .last();
  if (await assistantClose.isVisible().catch(() => false)) {
    await assistantClose.click().catch(() => {});
  }
  await settle(page);
}

/**
 * Reaches each state in STATES and inspects it. A state that cannot be
 * reached is itself a finding, so a broken flow cannot pass by being skipped.
 */
export async function sweepStates(
  page: Page,
  visit: Visit,
): Promise<{ findings: Finding[]; screens: number }> {
  const findings: Finding[] = [];
  let screens = 0;
  // Actions have no timeout by default; without one a missing button would
  // hang until the whole test timed out instead of being reported.
  page.setDefaultTimeout(12_000);
  findings.push(...takeCrashes(page, "Home"));
  for (const state of STATES) {
    try {
      await state.reach(page);
      await settle(page);
      screens += 1;
      for (const problem of await visit(page, state.name)) {
        findings.push({ screen: state.name, problem });
      }
    } catch (error) {
      findings.push({
        screen: state.name,
        problem: `could not reach this state: ${String(error).split("\n")[0].slice(0, 160)}`,
      });
    }
    findings.push(...takeCrashes(page, state.name));
    await closeEverything(page);
    findings.push(...takeCrashes(page, `${state.name} (closing)`));
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
