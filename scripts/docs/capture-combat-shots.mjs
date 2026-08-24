/**
 * Captures the documentation screenshots for the combat-service feature.
 *
 * Seeds a FICTIONAL veteran (Robert Lee Williams — the same stand-in the unit
 * tests use) into a throwaway browser profile, so nothing here can pick up a
 * real record. Never point this at a profile that has ingested real documents.
 *
 * Usage: node scripts/docs/capture-combat-shots.mjs
 *        APP_URL=http://localhost:5173 (default)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const SHOTS = "docs/assets/images/screenshots";
const PROFILE = join(tmpdir(), "vetrate-doc-shots-profile");

const iso = "2026-01-15T00:00:00.000Z";
const award = (name, abbreviation, isCombat) => ({
  id: `award_${abbreviation.toLowerCase()}`,
  name,
  abbreviation,
  dateReceived: null,
  notes: "",
  isCombat,
  devices: [],
  dateAdded: iso,
});

const SERVICE_HISTORY = {
  deployments: [],
  awards: [
    award("Army Achievement Medal", "AAM", false),
    award("Combat Action Badge", "CAB", true),
    award("Afghanistan Campaign Medal", "ACM", false),
    award("Global War on Terrorism Service Medal", "GWOTS", false),
    award("Army Service Ribbon", "ASR", false),
  ],
  dd214Data: {
    fullName: "WILLIAMS, ROBERT LEE",
    fullNameSourceForm: "DD214",
    branch: "Army",
    mos: "11B20",
    mosTitle: "INFANTRYMAN",
    rank: "SGT",
    payGrade: "E-5",
    entryDate: "2004-06-22",
    separationDate: "2008-06-21",
    yearsService: 4,
    characterOfService: "HONORABLE",
    dateProcessed: iso,
    confidence: 92,
  },
  servicePeriods: [
    {
      id: "p1",
      serviceStartDate: "2004-06-22",
      serviceEndDate: "2008-06-21",
      branch: "Army",
      component: "Active Duty",
      formType: "DD214",
      rank: "SGT",
      payGrade: "E-5",
      mos: "11B20",
      mosTitle: "INFANTRYMAN",
      characterOfService: "HONORABLE",
      sourceDocument: "DD214.pdf",
    },
  ],
  dutyStations: [],
  dateUpdated: iso,
};

mkdirSync(join(SHOTS, "my-packet"), { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  // Matches the viewport the rest of docs/assets/images/screenshots uses.
  viewport: { width: 1152, height: 810 },
});
const page = context.pages()[0] ?? (await context.newPage());

await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.evaluate((history) => {
  localStorage.setItem("vet_rate_service_history", JSON.stringify(history));
  localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
  localStorage.setItem("vetrate_disclaimer_accepted", "true");
}, SERVICE_HISTORY);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// First-run gates stack: welcome splash, then the terms waiver. Clear each in
// turn rather than guessing at the localStorage keys behind them.
for (const label of [
  /Enter Vet-Rate\.org/i,
  /I Understand & Accept the Risks/i,
  /Continue|Get Started/i,
]) {
  const btn = page.getByRole("button", { name: label }).first();
  if (await btn.count().catch(() => 0)) {
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    console.log("dismissed gate:", label.source);
  }
}

await page.evaluate(() =>
  globalThis.dispatchEvent(new CustomEvent("openMyPacket")),
);
await page.waitForTimeout(3000);

const dialog = page.locator('[role="dialog"]').last();
// Dispatched on the element rather than clicked: a promo banner overlays the
// tab strip on first open and intercepts the pointer event.
const switched = await dialog.evaluate((el) => {
  // The label carries a count badge ("🎖️ Service5"), so no word boundary
  // follows "Service".
  const btn = [...el.querySelectorAll("button")].find((b) =>
    /Service\d*$/.test((b.textContent || "").trim()),
  );
  btn?.click();
  return Boolean(btn);
});
console.log("service tab found:", switched);
if (!switched) {
  const labels = await dialog.evaluate((el) =>
    [...el.querySelectorAll("button")]
      .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 40),
  );
  console.log("buttons in dialog:", JSON.stringify(labels));
}
await page.waitForTimeout(2500);

const card = dialog.locator("div.border-l-4.border-red-500").first();
if (await card.count()) {
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  // Plain viewport screenshot: the modal is position:fixed with a blurred
  // backdrop, and both element-screenshots and page+clip composite it wrongly
  // (clip is document-relative, boundingBox is viewport-relative).
  await page.screenshot({
    path: join(SHOTS, "my-packet", "combat-service-card.png"),
  });
  console.log("captured my-packet/combat-service-card.png");
} else {
  console.log("combat card not found — is the seeded history being read?");
}

if (process.env.DEBUG_SHOTS) {
  await page.screenshot({ path: join(tmpdir(), "doc-shot-debug.png") });
  const seen = await page.evaluate(() =>
    localStorage.getItem("vet_rate_service_history")?.slice(0, 120),
  );
  console.log("seeded key reads back:", seen);
  console.log(
    "dialog text head:",
    (await dialog.innerText().catch(() => "")).slice(0, 500),
  );
}

const text = await dialog.innerText().catch(() => "");
console.log("card text present:", text.includes("Combat Service Verified"));
console.log("shows CAB:        ", text.includes("Combat Action Badge"));
console.log("shows citation:   ", text.includes("1.A.3.h"));

await context.close();
