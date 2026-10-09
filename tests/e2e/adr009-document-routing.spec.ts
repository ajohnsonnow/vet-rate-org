import { readFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { test, expect, type Page } from "@playwright/test";
import { dismissDisclaimer } from "./helpers";

/**
 * ADR-009 fail-closed document routing, exercised end-to-end in a real
 * browser: `vite --mode e2e`'s fake on-device engine (tests/e2e/fakes/
 * web-llm.fake.js, extended here with per-tool JSON markers) stands in for
 * Warrant Council; a stubbed `page.route()` on the Gemini endpoint stands in
 * for "cloud" - never a real provider either way.
 *
 * Per tool: (a) cloud-only -> the document never reaches the stubbed cloud
 * route (zero matching requests), the plain-language notice shows, and the
 * local parser's result still shows. (b) on-device available -> the fake
 * engine's completion call actually contains the fixture's unique marker,
 * and the tool completes without error. A single shared test additionally
 * proves (c): a genuinely "context"-classed call (the AI Assistant) still
 * reaches the stubbed cloud with only the allow-listed content.
 *
 * D19-9: this used to intercept ONLY the Gemini endpoint (hand-typed as a
 * duplicate literal), which would silently miss a document leaking to any
 * OTHER off-device AI provider the app might add. `installProviderGuard`
 * (wired into `bootApp`, so every test in this file gets it) intercepts
 * EVERY request and fails the test outright on one to any external host
 * that isn't either the app's own dev server, a known-benign static asset
 * host (verified empirically - see BENIGN_EXTERNAL_HOSTS), or an AI
 * provider endpoint this file has explicitly stubbed. The Gemini endpoint
 * itself is read from unifiedAIService.js's own source text (not
 * re-typed), so a changed URL there is caught here too instead of the test
 * silently stubbing a now-stale pattern.
 */

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const DOC_MARKER = "ZZE2EDOCMARKER9f3a";
const CLOUD_KEY = "AIzaSyE2EFAKEKEY00000000000000000000";

// Reads the real endpoint out of the app's own source rather than
// hand-typing a second copy that could silently drift from it.
function readGeminiApiUrlFromSource(): string {
  const src = readFileSync("src/utils/unifiedAIService.js", "utf-8");
  const match = src.match(/GEMINI_API_URL\s*=\s*\n?\s*"([^"]+)"/);
  if (!match) {
    throw new Error(
      "Could not find GEMINI_API_URL in src/utils/unifiedAIService.js - " +
        "update this test's extraction regex to match the new shape.",
    );
  }
  return match[1];
}

const GEMINI_API_URL = readGeminiApiUrlFromSource();
const GEMINI_PATTERN = `${new URL(GEMINI_API_URL).origin}/**`;

// Verified empirically (a Playwright request logger run against a real
// boot + idle, and against every flow this file exercises): the flag-icons
// stylesheet/flag image and the goatcounter analytics beacon are the ONLY
// external hosts this app's own UI ever reaches on its own, independent of
// any AI call. Neither ever carries prompt/document content.
const BENIGN_EXTERNAL_HOSTS = [
  "cdn.jsdelivr.net",
  "gc.zgo.at",
  "flagcdn.com",
  "vet-rate-org.goatcounter.com",
];

function isBenignExternalHost(hostname: string): boolean {
  return BENIGN_EXTERNAL_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

interface ProviderGuard {
  unexpectedHosts: string[];
}

// Registered BEFORE any test-specific `page.route()` (e.g. stubCloudRoute),
// so a later, more specific route registered by the test itself is tried
// FIRST for a matching URL (Playwright tries the most-recently-registered
// matching handler first) - this catch-all only ever actually runs for a
// request nothing else claimed.
async function installProviderGuard(page: Page): Promise<ProviderGuard> {
  const guard: ProviderGuard = { unexpectedHosts: [] };
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const isLocalDevServer =
      url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (isLocalDevServer || isBenignExternalHost(url.hostname)) {
      await route.continue();
      return;
    }
    guard.unexpectedHosts.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  return guard;
}

const providerGuards = new WeakMap<Page, ProviderGuard>();

test.afterEach(async ({ page }) => {
  // A request the guard above caught means a document (or the veteran's
  // own words) reached an AI provider this file never intercepted/stubbed
  // - fail loudly rather than let it pass silently.
  expect(providerGuards.get(page)?.unexpectedHosts ?? []).toEqual([]);
});

// A desktop-class device (ADR-010): 2 GB max buffer and 8 GB of memory load the
// 4B model. A 1 GB buffer would classify as a laptop and load the 2B, which is
// small-class, so the Decision Decoder would hold the document back from it.
async function shimFakeGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!navigator.gpu) return;
    Object.defineProperty(navigator, "deviceMemory", {
      value: 8,
      configurable: true,
    });
    navigator.gpu.requestAdapter = async () => ({
      info: {
        vendor: "e2e-fake",
        architecture: "fake",
        device: "e2e fake GPU",
        description: "Deterministic e2e test adapter",
      },
      limits: {
        maxComputeInvocationsPerWorkgroup: 1024,
        maxStorageBufferBindingSize: 1 << 30,
        maxBufferSize: 2 ** 31,
        maxComputeWorkgroupSizeX: 1024,
        maxComputeWorkgroupSizeY: 1024,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupStorageSize: 32768,
        maxBindGroups: 4,
        maxBindingsPerBindGroup: 1000,
        maxDynamicStorageBuffersPerPipelineLayout: 4,
        maxStorageBuffersPerShaderStage: 8,
      },
      features: new Set(),
      requestDevice: async () => ({}),
    });
  });
}

async function bootApp(
  page: Page,
  { withCloudKey }: { withCloudKey: boolean },
): Promise<void> {
  providerGuards.set(page, await installProviderGuard(page));
  await page.addInitScript(
    ({ version, cloudKey, withCloudKey: seedKey }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      if (seedKey) localStorage.setItem("vetrate_gemini_key", cloudKey);
    },
    { version: APP_VERSION, cloudKey: CLOUD_KEY, withCloudKey },
  );
  await page.goto("/");
  await dismissDisclaimer(page);
}

interface CloudRecorder {
  bodies: string[];
}

// Stubs the ONE real off-device transport (Gemini) - never a real provider.
// Records every matched request's body before fulfilling with a minimal
// valid Gemini response shape, so a "context" call still gets a usable
// reply while a "document" call's absence from `bodies` is the assertion.
async function stubCloudRoute(page: Page): Promise<CloudRecorder> {
  const recorder: CloudRecorder = { bodies: [] };
  await page.route(GEMINI_PATTERN, async (route) => {
    recorder.bodies.push(route.request().postData() || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "[e2e stub cloud] no real provider ran." }],
            },
          },
        ],
      }),
    });
  });
  return recorder;
}

// deviceCapabilityDetector.js's _deviceTierFor forces ANY mobile-UA browser
// straight to the "mobile" tier (canUseWebLLM: false) BEFORE it even looks
// at WebGPU - a deliberate, pre-existing product decision (phones don't get
// on-device WebLLM regardless of API availability, not something this ADR-
// 009 test suite changed or should paper over). shimFakeGpuAdapter's fake
// adapter can never make "on-device available" reachable on mobile-chrome
// as a result, so these scenarios are structurally impossible there.
function skipOnDeviceOnMobileTier(testInfo: {
  project: { name: string };
}): void {
  test.skip(
    testInfo.project.name === "mobile-chrome",
    "mobile-chrome's UA forces the mobile device tier (canUseWebLLM: false " +
      "unconditionally) in deviceCapabilityDetector.js - on-device WebLLM " +
      "is unreachable here by design, real GPU or not.",
  );
}

// Every tool's "load on-device AI" affordance is the shared
// SmartAILoadButton (only rendered while `!isAnyAIAvailable()`) - clicking
// it and waiting for it to disappear is backend-agnostic across tools.
async function loadFakeOnDeviceAI(page: Page): Promise<void> {
  const loadBtn = page.getByRole("button", { name: /^(📥 Load|🔄 Switch)/ });
  await loadBtn.waitFor({ state: "visible", timeout: 10000 });
  await loadBtn.click();
  await loadBtn.waitFor({ state: "hidden", timeout: 30000 });
}

async function openToolDialog(
  page: Page,
  eventName: string,
  dialogSelector: string,
): Promise<void> {
  await page.evaluate(
    (name) => window.dispatchEvent(new CustomEvent(name)),
    eventName,
  );
  await page
    .locator(dialogSelector)
    .waitFor({ state: "visible", timeout: 10000 });
}

async function readFakeEngineCalls(
  page: Page,
): Promise<Array<{ system: string; user: string }>> {
  return page.evaluate(
    () =>
      (window as unknown as { __e2eFakeEngineCalls?: unknown[] })
        .__e2eFakeEngineCalls || [],
  ) as Promise<Array<{ system: string; user: string }>>;
}

function wrapPdfLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Real single-page text-layer PDF (not a scanned image) - PDF.js extracts
// its text directly, no OCR involved, keeping this fixture fast and
// deterministic.
async function makeTextPdfBuffer(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 740;
  for (const line of wrapPdfLines(text, 95)) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 16;
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

const DD214_DIALOG = '[role="dialog"][aria-labelledby="dd214-analyzer-title"]';

const DD214_FIXTURE_TEXT = (marker: string) => `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME: TESTFIXTURE, E2E
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
3. SOCIAL SECURITY: 123 45 6789
4A. GRADE: E-4
5. DATE OF BIRTH: 1990 01 01
7B. HOME OF RECORD: TESTVILLE, OH
8A. LAST DUTY ASSIGNMENT: FORT TEST
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20100101
12B. SEPARATION DATE THIS PERIOD: 20140101
18. REMARKS: ${marker}
24. CHARACTER OF SERVICE: HONORABLE
`;

test.describe("ADR-009: DD-214 Analyzer document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DD214_FIXTURE_TEXT(DOC_MARKER));
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();

    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/was not sent to/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);

    // D19 follow-up (ADR-009 Decision E / spec item 1): spelled out
    // explicitly, not just implied by `cloud.bodies.length === 0` above -
    // the fixture's own identifiers never reached the stubbed cloud
    // either.
    expect(cloud.bodies.some((b) => b.includes("TESTFIXTURE"))).toBe(false);
    expect(cloud.bodies.some((b) => b.includes("123 45 6789"))).toBe(false);

    // The local (non-AI) parser runs on the pasted text regardless of
    // provider, so the fixture's name/home-of-record still fill from that
    // local read even though no AI call happened at all (decision F: the
    // local parser is the only source of an identifier). They render as the
    // values of the editable identifier fields. "TESTFIXTURE" only (not the
    // full ", E2E" suffix) - dd214FieldExtractor's fullName value class is
    // letters/punctuation only, a pre-existing, separate limitation this
    // fixture's digit-bearing marker happens to hit.
    await expect(dialog.getByLabel("Full Name")).toHaveValue(/TESTFIXTURE/);
    await expect(dialog.getByLabel("Home of Record")).toHaveValue(/TESTVILLE/);
  });

  test("an identifier the local parser cannot read is an empty box the veteran can type into", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    await stubCloudRoute(page);

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(
        "DD FORM 214\n2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE\n" +
          "12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20100101\n" +
          "24. CHARACTER OF SERVICE: HONORABLE\n",
      );
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();
    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });

    // The profile-import prompt opens on its own after analysis; dismiss it
    // so the result panel underneath is reachable.
    await page.getByRole("button", { name: /Cancel Import/i }).click();

    const nameBox = dialog.getByLabel("Full Name");
    await expect(nameBox).toHaveValue("");
    await expect(
      dialog.getByText(/Not read from the document/i).first(),
    ).toBeVisible();
    await nameBox.fill("TYPED, VETERAN");
    await expect(nameBox).toHaveValue("TYPED, VETERAN");
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DD214_FIXTURE_TEXT(DOC_MARKER));
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();

    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);

    // Decision F (ADR-009 §3): the raw document still goes to the on-device
    // engine, but the real prompt-building path must NOT ask it for any
    // identifier field - the AI is never the source of one.
    const docCall = calls.find((c) => c.user.includes(DOC_MARKER));
    expect(docCall).toBeTruthy();
    for (const key of [
      "fullName",
      "ssnLast4",
      "dateOfBirth",
      "homeOfRecord",
      "homeAddress",
    ]) {
      expect(docCall!.system).not.toContain(`"${key}"`);
    }

    // The identifier fields still fill, from the local parser alone.
    await expect(dialog.getByLabel("Full Name")).toHaveValue(/TESTFIXTURE/);
    await expect(dialog.getByLabel("Home of Record")).toHaveValue(/TESTVILLE/);
  });
});

const PLANTED_PATTERN =
  /PLANTEDNAME|ALIASNAME|NESTEDNAME|987-65-432|1971-07-08|111-22-3333/;

// Every record in every IndexedDB database, as one JSON string.
async function dumpIndexedDb(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const out: unknown[] = [];
    const dbs = await indexedDB.databases();
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((resolve, reject) => {
          const req = db
            .transaction(store, "readonly")
            .objectStore(store)
            .getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        out.push({ db: info.name, store, rows });
      }
      db.close();
    }
    return JSON.stringify(out);
  });
}

function findPersonalObjects(node: unknown, found: unknown[] = []): unknown[] {
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "personal") found.push(value);
      findPersonalObjects(value, found);
    }
  }
  return found;
}

test.describe("ADR-009 decision F: a wrong model identifier is never shown, saved or logged", () => {
  test("planted identifiers under canonical, alias and nested keys, import with every identifier unticked", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(90000);
    const consoleText: string[] = [];
    page.on("console", (msg) => consoleText.push(msg.text()));
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDD214Analyzer", DD214_DIALOG);
    const dialog = page.locator(DD214_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DD214_FIXTURE_TEXT("E2E_PLANT_WRONG_IDENTIFIERS"));
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Analyze with AI/i }).click();
    await expect(dialog.getByText(/Analysis Complete/i)).toBeVisible({
      timeout: 20000,
    });

    await page.getByRole("button", { name: /Import Selected Fields/i }).click();
    await expect(
      page.getByRole("button", { name: /Import Selected Fields/i }),
    ).toBeHidden({ timeout: 20000 });

    await expect(dialog.getByLabel("Full Name")).toHaveValue(/TESTFIXTURE/);
    await expect(
      dialog.getByText(/Saved\. The fields you ticked went to your profile/),
    ).toBeVisible();
    await expect(
      dialog.getByText(/Nothing from this analysis has been saved yet/),
    ).toBeHidden();
    expect(await dialog.innerText()).not.toMatch(PLANTED_PATTERN);

    const dump = await dumpIndexedDb(page);
    expect(dump).not.toMatch(PLANTED_PATTERN);
    const personalObjects = findPersonalObjects(JSON.parse(dump));
    expect(personalObjects.length).toBeGreaterThan(0);
    const personal = JSON.stringify(personalObjects);
    expect(personal).not.toMatch(/TESTFIXTURE|6789|1990/);

    expect(consoleText.length).toBeGreaterThan(0);
    const logged = consoleText.join(" | ");
    expect(logged).not.toMatch(PLANTED_PATTERN);
    expect(logged).not.toMatch(/TESTFIXTURE|123 45 6789/);
  });
});

const CFILE_DIALOG = '[role="dialog"][aria-labelledby="cfile-analyzer-title"]';
const CFILE_CONSENT_DIALOG =
  '[role="dialog"][aria-labelledby="cfile-privacy-title"]';

const CFILE_FIXTURE_TEXT = (marker: string) =>
  `MEDICAL RECORD - PROGRESS NOTE\nDate: 2020-01-15\nPatient reports chronic ` +
  `tinnitus and lumbar spine pain following in-service noise exposure and a ` +
  `lifting injury. Diagnosis: Tinnitus, bilateral. Diagnosis: Lumbar strain. ` +
  `Treatment plan discussed with patient. Marker: ${marker}`;

async function startCFileAnalysis(page: Page): Promise<void> {
  const dialog = page.locator(CFILE_DIALOG);
  await dialog.getByRole("button", { name: /Analyze My C-File/i }).click();
  const consent = page.locator(CFILE_CONSENT_DIALOG);
  await consent.waitFor({ state: "visible", timeout: 10000 });
  await consent
    .getByRole("button", { name: /I Understand - Start Analysis/i })
    .click();
}

test.describe("ADR-009: C-File Analyzer document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud and the notice shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openCFileAnalyzer", CFILE_DIALOG);
    const dialog = page.locator(CFILE_DIALOG);
    const pdfBuffer = await makeTextPdfBuffer(CFILE_FIXTURE_TEXT(DOC_MARKER));
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "cfile-fixture.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    await startCFileAnalysis(page);

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 30000,
    });

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openCFileAnalyzer", CFILE_DIALOG);
    const dialog = page.locator(CFILE_DIALOG);
    await loadFakeOnDeviceAI(page);
    const pdfBuffer = await makeTextPdfBuffer(CFILE_FIXTURE_TEXT(DOC_MARKER));
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "cfile-fixture.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
    });
    await startCFileAnalysis(page);

    // D19-2 (fix/final19-document-features): a result with zero
    // potential_claims and no summary now correctly renders "No Conditions
    // Found" rather than "Analysis Complete" - see CFileAnalyzer.jsx's
    // _cfileFoundNothing. The deterministic fake engine's CFILE_JSON_MARKER
    // response is always empty-findings (tests/e2e/fakes/web-llm.fake.js),
    // so the on-device path here legitimately lands on that heading, not
    // "Analysis Complete". Either heading proves the real point: the tool
    // reached a terminal, non-error state instead of hanging or erroring.
    await expect(
      dialog.getByText(/Analysis Complete|No Conditions Found/i),
    ).toBeVisible({
      timeout: 30000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const BLUE_BUTTON_DIALOG =
  '[role="dialog"][aria-labelledby="blue-button-xray-title"]';

const BLUE_BUTTON_FIXTURE_TEXT = (marker: string) =>
  `VA BLUE BUTTON HEALTH SUMMARY\n\nProblem List:\n- Tinnitus, bilateral, chronic\n- Hypertension, essential\n\nNote: ${marker}\n`;

async function uploadBlueButtonFixture(
  page: Page,
  marker: string,
): Promise<void> {
  const dialog = page.locator(BLUE_BUTTON_DIALOG);
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "bluebutton-fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(BLUE_BUTTON_FIXTURE_TEXT(marker)),
  });
  await dialog.getByRole("button", { name: /AI Scan for Diagnoses/i }).click();
}

test.describe("ADR-009: Blue Button X-Ray document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openBlueButtonXRay", BLUE_BUTTON_DIALOG);
    await uploadBlueButtonFixture(page, DOC_MARKER);

    const dialog = page.locator(BLUE_BUTTON_DIALOG);
    await expect(dialog.getByText(/Found \d+ Conditions/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/was not sent to/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openBlueButtonXRay", BLUE_BUTTON_DIALOG);
    const dialog = page.locator(BLUE_BUTTON_DIALOG);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "bluebutton-fixture.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(BLUE_BUTTON_FIXTURE_TEXT(DOC_MARKER)),
    });
    await loadFakeOnDeviceAI(page);
    await dialog
      .getByRole("button", { name: /AI Scan for Diagnoses/i })
      .click();

    await expect(dialog.getByText(/Found \d+ Conditions/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const DECISION_DECODER_DIALOG =
  '[role="dialog"][aria-labelledby="decoder-title"]';

const DECISION_DECODER_FIXTURE_TEXT = (marker: string) =>
  `The Department of Veterans Affairs has denied your claim for service ` +
  `connection for tinnitus. The evidence does not establish a nexus between ` +
  `your current condition and your military service. Marker: ${marker}`;

test.describe("ADR-009: Decision Decoder document routing (pasted text)", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DECISION_DECODER_FIXTURE_TEXT(DOC_MARKER));
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/Full Denial/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog
      .locator("textarea")
      .first()
      .fill(DECISION_DECODER_FIXTURE_TEXT(DOC_MARKER));
    await loadFakeOnDeviceAI(page);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/Full Denial/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

// D19-9: the pasted-text describe block above never exercised Decision
// Decoder's OTHER input method - "📷 Drop-In File" (FileDropZone/
// FileDropInPanel, DecisionDecoder.jsx), a real PDF upload routed through
// the same OCR/text-extraction pipeline as C-File/Blue Button before
// `denialText` ever reaches `decodeDecision`. Uses the same
// `makeTextPdfBuffer` fixture helper C-File already relies on.
async function switchToFileDropTab(page: Page): Promise<void> {
  const dialog = page.locator(DECISION_DECODER_DIALOG);
  await dialog.getByRole("button", { name: /Drop-In File/i }).click();
}

async function uploadDecisionDecoderFixture(
  page: Page,
  marker: string,
): Promise<void> {
  const dialog = page.locator(DECISION_DECODER_DIALOG);
  const pdfBuffer = await makeTextPdfBuffer(
    DECISION_DECODER_FIXTURE_TEXT(marker),
  );
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "decision-letter-fixture.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });
}

test.describe("ADR-009: Decision Decoder document routing (file drop)", () => {
  test("cloud-only: the document never reaches the stubbed cloud, notice shows, local parser result shows", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    await switchToFileDropTab(page);
    await uploadDecisionDecoderFixture(page, DOC_MARKER);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/was not sent to/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog.getByText(/Full Denial/i)).toBeVisible();

    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the feature works", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    await openToolDialog(page, "openDecisionDecoder", DECISION_DECODER_DIALOG);
    await switchToFileDropTab(page);
    await uploadDecisionDecoderFixture(page, DOC_MARKER);
    await loadFakeOnDeviceAI(page);
    const dialog = page.locator(DECISION_DECODER_DIALOG);
    await dialog.getByRole("button", { name: /Decode This Decision/i }).click();

    await expect(dialog.getByText(/Full Denial/i)).toBeVisible({
      timeout: 20000,
    });

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});

const CONTEXT_MARKER = "ZZE2ECONTEXTMARKER9f3a";

test.describe("ADR-009: a context-classed call still reaches the stubbed cloud", () => {
  test("AI Assistant (context) reaches the stub cloud with the veteran's own question", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);

    await page.getByRole("button", { name: /Open AI Navigator/i }).click();
    const textarea = page.locator("textarea").last();
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    // ADR-008 section 2.9: a brand-new profile holds no name, so the input says
    // a typed name cannot be removed.
    await expect(
      page.getByText(/The app does not have your name saved/),
    ).toBeVisible();
    await textarea.fill(`What are my options regarding ${CONTEXT_MARKER}?`);
    await page.getByRole("button", { name: /Send message/i }).click();

    await expect
      .poll(() => cloud.bodies.length, { timeout: 20000 })
      .toBeGreaterThan(0);
    expect(cloud.bodies.some((b) => b.includes(CONTEXT_MARKER))).toBe(true);
  });
});

/**
 * Muster Call's import-time C-File analysis (buildSegmentedCFileResult ->
 * analyzeCFileWithAI, musterCallProcessor.js) only fires once
 * quickScanCFile() judges an uploaded document a genuinely consolidated
 * C-File (multiple detected document types, or 50+ pages) - reverse-
 * engineering a drag-and-drop fixture that reliably clears that bar (rather
 * than being classified DD214/DBQ/etc. directly, each with its own non-AI
 * parser) was disproportionate to this task's remaining scope. This drives
 * the same production function directly, inside the same real browser/real
 * fake-engine/real-network-stub harness as every other test in this file -
 * proving the routing boundary itself, not the classification heuristic.
 */
async function injectMusterCallModule(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import { buildSegmentedCFileResult } from "/src/utils/musterCallProcessor.js";
      import { quickScanCFile } from "/src/utils/cFileSegmentation.js";
      window.__mc = { buildSegmentedCFileResult, quickScanCFile };
    `,
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as Record<string, unknown>).__mc),
    null,
    {
      timeout: 15000,
    },
  );
}

async function runSegmentedCFileResult(
  page: Page,
  text: string,
): Promise<{ aiAnalysis: unknown; offDeviceNotice: string | null }> {
  return page.evaluate(async (fixtureText) => {
    const mc = (
      window as unknown as {
        __mc: {
          quickScanCFile: (t: string) => unknown;
          buildSegmentedCFileResult: (
            t: string,
            s: unknown,
          ) => Promise<{
            aiAnalysis: unknown;
            offDeviceNotice: string | null;
          }>;
        };
      }
    ).__mc;
    const summary = mc.quickScanCFile(fixtureText);
    return mc.buildSegmentedCFileResult(fixtureText, summary);
  }, text);
}

const MUSTER_CALL_FIXTURE_TEXT = (marker: string) =>
  `MEDICAL RECORD - PROGRESS NOTE\nDate: 2021-05-02\nPatient reports chronic ` +
  `knee pain and PTSD symptoms following an in-service incident. Diagnosis: ` +
  `Post-traumatic stress disorder. Diagnosis: Right knee strain. Marker: ${marker}`;

test.describe("ADR-009: Muster Call import-time C-File analysis document routing", () => {
  test("cloud-only: the document never reaches the stubbed cloud and the notice explains why", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await bootApp(page, { withCloudKey: true });
    const cloud = await stubCloudRoute(page);
    await injectMusterCallModule(page);

    const result = await runSegmentedCFileResult(
      page,
      MUSTER_CALL_FIXTURE_TEXT(DOC_MARKER),
    );

    expect(result.aiAnalysis).toBeNull();
    expect(result.offDeviceNotice).toMatch(/was not sent to/i);
    expect(cloud.bodies.some((b) => b.includes(DOC_MARKER))).toBe(false);
    expect(cloud.bodies.length).toBe(0);
  });

  test("on-device available: the fake engine receives the document and the analysis completes", async ({
    page,
  }, testInfo) => {
    skipOnDeviceOnMobileTier(testInfo);
    test.setTimeout(60000);
    await shimFakeGpuAdapter(page);
    await bootApp(page, { withCloudKey: false });

    // Muster Call's own "Load AI" button (FormationLineup.jsx) is the
    // established, already-proven way to get Warrant Council/the fake
    // engine ready (see muster-call-ai-panic.spec.ts) - isDiamondSwarmReady()
    // is global module state once loaded, so it applies equally to the
    // direct module call below regardless of which UI loaded it.
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("openMusterCall")),
    );
    await page
      .locator('[aria-labelledby="muster-call-title"]')
      .waitFor({ state: "visible", timeout: 10000 });
    await page.getByRole("button", { name: /load ai/i }).click();
    await page
      .getByText(/CW5 Auditor ready/i)
      .waitFor({ state: "visible", timeout: 20000 });

    await injectMusterCallModule(page);
    const result = await runSegmentedCFileResult(
      page,
      MUSTER_CALL_FIXTURE_TEXT(DOC_MARKER),
    );

    expect(result.offDeviceNotice).toBeNull();
    expect(result.aiAnalysis).not.toBeNull();

    const calls = await readFakeEngineCalls(page);
    expect(calls.some((c) => c.user.includes(DOC_MARKER))).toBe(true);
  });
});
