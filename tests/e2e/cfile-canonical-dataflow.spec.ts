/**
 * C-File → canonical VKB dataflow (Wave 1 + 2a regression spec).
 *
 * Drives the app's REAL write path — saveAnalysisResults() with the exact
 * vkbMergeData the production CFileAnalyzer builds via buildVkbMergeFromCFile()
 * — then asserts, from observed IndexedDB + AI-context output + the MyPacket UI
 * (not code inference), that C-File-extracted data reaches the CANONICAL VKB
 * schema, the AI-tool context, and the read-only MyPacket document views.
 *
 * REQUIRED:
 *  1. After save, the canonical schema fields are populated.
 *  2. getVeteranAIContext() contains the marker WITH the veteran name unset
 *     (fullName-gate → content-gate regression).
 *  3. The marker renders under a "CLAIMED CONDITIONS" / "EVIDENCE TIMELINE"
 *     header, not only inside a truncated "Data:{…}" packet blob.
 *  4. The MyPacket Documents tab shows the marker; the Claims tab shows the
 *     read-only "Identified in your C-File" section; the claim-stat counters
 *     are unchanged (C-File suggestions are never counted).
 *
 * Marker: ZZMARKERTINNITUS (synthetic, no PII).
 *
 * Note: modules are injected via an inline <script type="module"> tag (allowed
 * by the app CSP's 'unsafe-inline') because the CSP blocks eval/new Function,
 * and Playwright's bypassCSP option was observed to make the app's IndexedDB
 * opens hang in this environment.
 */
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const APP_VERSION: string = JSON.parse(
  readFileSync("package.json", "utf-8"),
).version;

const MARKER = "ZZMARKERTINNITUS";

interface SchemaCounts {
  medicalConditionsCurrent: number;
  evidenceTimeline: number;
  cFiles: number;
  missingEvidence: number;
  environmental: number;
  legacyClaims: number;
  currentHasMarker: boolean;
}

interface AiContextReport {
  llmCtxHasMarker: boolean;
  markerUnderCanonicalHeader: boolean;
  aiCtxNoNameHasMarker: boolean;
}

interface TabReport {
  tab: string;
  hasMarker: boolean;
  hasIdentifiedSection: boolean;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version }: { version: string }) => {
      localStorage.setItem("vet-rate-tos-accepted", "true");
      localStorage.setItem("vet_rate_last_seen_version", version);
      localStorage.setItem("vetrate-tour-completed", "true");
      localStorage.setItem("vetrate_disclaimer-acknowledged", "true");
      localStorage.setItem("vetrate_affiliation-prompt-seen", "true");
    },
    { version: APP_VERSION },
  );
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
}

async function injectMods(page: Page): Promise<void> {
  await page.addScriptTag({
    type: "module",
    content: `
      import * as provider from "/src/utils/veteranContextProvider.js";
      import * as vkbMod from "/src/utils/veteranKnowledgeBase.js";
      import * as pktMod from "/src/utils/myPacketManager.js";
      window.__verifyMods = { provider, vkbMod, pktMod };
    `,
  });
  await page.waitForFunction(() => Boolean(window.__verifyMods), null, {
    timeout: 60_000,
  });
}

// Pre-create the two target DBs on a static same-origin page BEFORE the app
// boots: creating a NEW IndexedDB database while the DKB bulk write runs was
// observed to stall indefinitely. Schemas replicate the app's onupgradeneeded
// handlers exactly, so they become no-ops afterwards.
async function precreateDatabases(page: Page): Promise<void> {
  await page.goto("/support.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const buildVkb = (db: IDBDatabase) => {
      if (db.objectStoreNames.contains("knowledge_base")) return;
      const s = db.createObjectStore("knowledge_base", { keyPath: "id" });
      s.createIndex("lastUpdated", "metadata.lastUpdated", { unique: false });
    };
    const buildPacket = (db: IDBDatabase) => {
      if (!db.objectStoreNames.contains("documents")) {
        const s = db.createObjectStore("documents", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
        s.createIndex("uploadDate", "uploadDate", { unique: false });
        s.createIndex("fileName", "fileName", { unique: false });
      }
      if (!db.objectStoreNames.contains("document_index")) {
        const s = db.createObjectStore("document_index", { keyPath: "id" });
        s.createIndex("classification", "classification", { unique: false });
      }
    };
    const specs = [
      { name: "VetRateVKB", version: 1, build: buildVkb },
      { name: "VetRateMyPacket", version: 2, build: buildPacket },
    ];
    for (const spec of specs) {
      // Flat handler assignment keeps nesting under 4 levels (no wrapper fn).
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(spec.name, spec.version);
        req.onupgradeneeded = () => spec.build(req.result);
        req.onsuccess = () => resolve(req.result.close());
        req.onerror = () => resolve();
        setTimeout(resolve, 20_000);
      });
    }
  });
}

// The desktop first-boot DKB auto-download caches ~130K entries into IndexedDB;
// while that write runs, opens creating new DBs stall. Give it a fixed budget to
// finish, pre-warm both connections, then let the auto-backup settle before the
// save's VKB writes race a concurrent VetRateVKB transaction.
async function waitForDkbSettled(page: Page): Promise<void> {
  await page.waitForTimeout(60_000);
  // Pre-warm both IndexedDB connections so the save path is not racing a cold
  // open; tolerate a slow open without failing.
  await page.evaluate(async () => {
    const mods = window.__verifyMods;
    const race = (pr: Promise<unknown>, ms: number) =>
      Promise.race([pr, new Promise((r) => setTimeout(r, ms))]);
    await race(mods.vkbMod.loadVKB(), 30_000);
    await race(mods.pktMod.getAllPacketDocuments(), 30_000);
  });
  await page.waitForTimeout(5000);
}

function syntheticAnalysis(marker: string) {
  return {
    summary: `Synthetic C-File summary mentioning ${marker} and Tinnitus.`,
    potential_claims: [
      {
        condition: marker,
        evidence: "Synthetic audiology note dated 2020-01-15",
        diagnosticCode: "6260",
        missing_element: "Nexus letter linking to service",
        recommendation: "Obtain a nexus opinion from an audiologist",
        likelihood: "high",
      },
      {
        condition: "Tinnitus",
        evidence: "Ringing in ears documented in STRs",
        diagnosticCode: "6260",
      },
    ],
    timeline: [
      {
        date: "2020-01-15",
        category: "medical_visit",
        description: `Audiology consult documenting ${marker}`,
        significance: "high",
      },
    ],
    exposures: [`Noise exposure ${marker}`],
    actionItems: [`File claim for ${marker}`],
  };
}

async function runSave(page: Page, marker: string): Promise<string> {
  return page.evaluate(
    async ({ mk, analysis }) => {
      const { provider } = window.__verifyMods;
      const extraction = { method: "text", ocrUsed: false, confidence: 0.99 };
      const savePromise = provider.saveAnalysisResults({
        toolName: "C-File Analyzer",
        classification: provider.PACKET_DOC_TYPES.C_FILE,
        rawText: `SYNTHETIC C-FILE RAW TEXT. Veteran reports ${mk}.`,
        extractedData: analysis,
        fileName: "canonical-dataflow-cfile.pdf",
        pageCount: 3,
        vkbDocument: {
          classification: "c_file",
          rawText: `SYNTHETIC C-FILE RAW TEXT. Veteran reports ${mk}.`,
          extractedData: analysis,
          source: "CFileAnalyzer",
        },
        vkbMergeData: provider.buildVkbMergeFromCFile(analysis, extraction),
      });
      await Promise.race([
        savePromise,
        new Promise((_, rej) =>
          setTimeout(
            () => rej(new Error("saveAnalysisResults hung >180s")),
            180_000,
          ),
        ),
      ]);
      return "completed";
    },
    { mk: marker, analysis: syntheticAnalysis(marker) },
  );
}

async function readSchemaCounts(
  page: Page,
  marker: string,
): Promise<SchemaCounts> {
  return page.evaluate(async (mk) => {
    // Read through the app's own loader (no raw-IDB callback pyramid).
    const v: Record<string, unknown> =
      await window.__verifyMods.vkbMod.loadVKB();
    const len = (path: unknown): number =>
      Array.isArray(path) ? path.length : -1;
    const mc = v?.medicalConditions as { current?: unknown } | undefined;
    const doc = v?.documentation as { cFiles?: unknown } | undefined;
    const ins = v?.aiInsights as { missingEvidence?: unknown } | undefined;
    const exp = v?.exposures as { environmental?: unknown } | undefined;
    return {
      medicalConditionsCurrent: len(mc?.current),
      evidenceTimeline: len(v?.evidenceTimeline),
      cFiles: len(doc?.cFiles),
      missingEvidence: len(ins?.missingEvidence),
      environmental: len(exp?.environmental),
      legacyClaims: len(v?.claims),
      currentHasMarker: JSON.stringify(mc?.current ?? []).includes(mk),
    };
  }, marker);
}

async function readAiContext(
  page: Page,
  marker: string,
): Promise<AiContextReport> {
  return page.evaluate(async (mk) => {
    const { provider, vkbMod } = window.__verifyMods;
    const vkb = await vkbMod.loadVKB();
    const llmCtx: string = vkbMod.generateLLMContext(vkb);
    const aiCtxNoName: string = await provider.getVeteranAIContext();
    const sectionHas = (ctx: string, header: string): boolean => {
      const start = ctx.indexOf(header);
      if (start === -1) return false;
      const rest = ctx.slice(start + header.length);
      const end = rest.indexOf("\n--- ");
      const body = end === -1 ? rest : rest.slice(0, end);
      return body.includes(mk);
    };
    return {
      llmCtxHasMarker: llmCtx.includes(mk),
      markerUnderCanonicalHeader:
        sectionHas(llmCtx, "--- CLAIMED CONDITIONS ---") ||
        sectionHas(llmCtx, "--- EVIDENCE TIMELINE ---"),
      aiCtxNoNameHasMarker: aiCtxNoName.includes(mk),
    };
  }, marker);
}

async function readClaimStatTotal(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const mod = await import("/src/utils/claimsStorage.js");
    return mod.getClaimStats().total as number;
  });
}

async function walkMyPacketTabs(page: Page): Promise<TabReport[]> {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 60_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("openMyPacket")),
  );
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, "MyPacket modal should open").toBeVisible({
    timeout: 15_000,
  });

  const tabButtons = dialog.locator('nav[aria-label="Tabs"] button');
  const count = await tabButtons.count();
  const reports: TabReport[] = [];
  for (let i = 0; i < count; i++) {
    const btn = tabButtons.nth(i);
    const label = (await btn.innerText().catch(() => `tab${i}`)).replace(
      /\s+/g,
      " ",
    );
    await btn.click().catch(() => {});
    await page.waitForTimeout(700);
    const text = await dialog.innerText().catch(() => "");
    reports.push({
      tab: label,
      hasMarker: text.includes(MARKER),
      hasIdentifiedSection: text.includes("Identified in your C-File"),
    });
  }
  return reports;
}

test.describe("C-File canonical dataflow (Wave 1 + 2a)", () => {
  test("save → canonical VKB schema, AI context, and read-only MyPacket views", async ({
    page,
  }) => {
    test.setTimeout(600_000);

    await precreateDatabases(page);
    await boot(page);
    await injectMods(page);
    await waitForDkbSettled(page);

    // ── STEP 1: real write path via the production mapper.
    const saveResult = await runSave(page, MARKER);
    expect(saveResult).toBe("completed");

    // ── Assertion 1: canonical schema fields populated (dual-write intact).
    const counts = await readSchemaCounts(page, MARKER);
    expect(
      counts.medicalConditionsCurrent,
      "medicalConditions.current should hold >=2 source-tagged suggestions",
    ).toBeGreaterThanOrEqual(2);
    expect(counts.evidenceTimeline).toBeGreaterThanOrEqual(1);
    expect(counts.cFiles).toBeGreaterThanOrEqual(1);
    expect(counts.missingEvidence).toBeGreaterThanOrEqual(1);
    expect(counts.legacyClaims).toBeGreaterThanOrEqual(2);
    expect(counts.currentHasMarker).toBe(true);

    // ── Assertions 2 + 3: AI context with NAME UNSET, under a canonical header.
    const ai = await readAiContext(page, MARKER);
    expect(ai.llmCtxHasMarker).toBe(true);
    expect(
      ai.aiCtxNoNameHasMarker,
      "getVeteranAIContext must include VKB content with no fullName set",
    ).toBe(true);
    expect(
      ai.markerUnderCanonicalHeader,
      "marker must render under CLAIMED CONDITIONS / EVIDENCE TIMELINE",
    ).toBe(true);

    // ── Assertion 4: read-only MyPacket views + counters unchanged.
    // C-File suggestions live in VKB, never the localStorage claim store, so the
    // claim-stat total must stay at zero (no user-filed claims were created).
    const claimTotalBefore = await readClaimStatTotal(page);
    expect(claimTotalBefore, "C-File suggestions must not be counted").toBe(0);

    const tabs = await walkMyPacketTabs(page);
    const documentsTab = tabs.find((tabRep) => /Documents/i.test(tabRep.tab));
    expect(documentsTab, "Documents tab should exist").toBeTruthy();
    expect(
      documentsTab?.hasMarker,
      "Documents tab should render the C-File marker",
    ).toBe(true);

    const claimsWithSection = tabs.find(
      (tabRep) => tabRep.hasIdentifiedSection,
    );
    expect(
      claimsWithSection,
      "a tab should show the 'Identified in your C-File' section",
    ).toBeTruthy();
    expect(claimsWithSection?.hasMarker).toBe(true);

    // Counter unchanged after browsing the UI.
    const claimTotalAfter = await readClaimStatTotal(page);
    expect(claimTotalAfter).toBe(claimTotalBefore);
  });
});
