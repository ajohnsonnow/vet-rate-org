/**
 * C-File → canonical VKB dataflow (Wave 1 regression spec).
 *
 * Drives the app's REAL write path — saveAnalysisResults() with the exact
 * vkbMergeData the production CFileAnalyzer builds via buildVkbMergeFromCFile()
 * — then asserts, from observed IndexedDB + AI-context output (not code
 * inference), that C-File-extracted data reaches the CANONICAL VKB schema and
 * the AI-tool context.
 *
 * REQUIRED (Wave 1):
 *  1. After save, the canonical schema fields are populated
 *     (medicalConditions.current >= 2, evidenceTimeline >= 1,
 *      documentation.cFiles >= 1, aiInsights.missingEvidence >= 1).
 *  2. getVeteranAIContext() contains the marker WITH the veteran name unset
 *     (fullName-gate → content-gate regression).
 *  3. The marker renders under a "CLAIMED CONDITIONS" / "EVIDENCE TIMELINE"
 *     header, not only inside a truncated "Data:{…}" packet blob.
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

async function boot(page: Page): Promise<void> {
  await page.addInitScript(
    ({ version }) => {
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
  await page.waitForFunction(() => !!(window as any).__verifyMods, null, {
    timeout: 60_000,
  });
}

test.describe("C-File canonical dataflow (Wave 1)", () => {
  test("C-File save populates canonical VKB schema + AI context (no name)", async ({
    page,
  }) => {
    test.setTimeout(480_000);
    const consoleLines: string[] = [];
    page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
    page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

    // Pre-create the two target DBs on a static same-origin page BEFORE the app
    // boots: creating a NEW IndexedDB database while the DKB bulk write runs was
    // observed to stall indefinitely. Schemas replicate the app's
    // onupgradeneeded handlers exactly, so they become no-ops afterwards.
    await page.goto("/support.html", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const openWith = (
        name: string,
        version: number,
        upgrade: (db: IDBDatabase) => void,
      ) =>
        new Promise<string>((resolve, reject) => {
          const req = indexedDB.open(name, version);
          req.onupgradeneeded = (e: any) => upgrade(e.target.result);
          req.onsuccess = () => {
            req.result.close();
            resolve(`${name}@v${version} created`);
          };
          req.onerror = () => reject(req.error);
          setTimeout(() => resolve(`${name} precreate TIMEOUT`), 20_000);
        });
      await openWith("VetRateVKB", 1, (db) => {
        if (!db.objectStoreNames.contains("knowledge_base")) {
          const s = db.createObjectStore("knowledge_base", { keyPath: "id" });
          s.createIndex("lastUpdated", "metadata.lastUpdated", {
            unique: false,
          });
        }
      });
      await openWith("VetRateMyPacket", 2, (db) => {
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
      });
    });

    await boot(page);
    await injectMods(page);

    // The desktop first-boot DKB auto-download caches ~130K entries into
    // IndexedDB; while that write runs, opens creating new DBs stall. Wait it out.
    {
      const deadline = Date.now() + 300_000;
      while (
        Date.now() < deadline &&
        !consoleLines.some(
          (l) =>
            l.includes("[DKB] ✅ Cached") ||
            l.includes("[DKB] ❌") ||
            l.toLowerCase().includes("dkb] failed"),
        )
      ) {
        await page.waitForTimeout(1000);
      }
    }

    // Pre-warm both IndexedDB connections so the save path does not race a
    // cold/slow open.
    await page.evaluate(async () => {
      const mods = (window as any).__verifyMods;
      const race = (pr: Promise<unknown>, label: string, ms: number) =>
        Promise.race([
          pr.then(() => `${label}: ok`),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve(`${label}: HUNG >${ms}ms`), ms),
          ),
        ]);
      for (let attempt = 1; attempt <= 3; attempt++) {
        const out = [
          await race(mods.vkbMod.loadVKB(), "loadVKB", 30_000),
          await race(
            mods.pktMod.getAllPacketDocuments(),
            "getAllPacketDocuments",
            30_000,
          ),
        ];
        if (!out.some((l) => l.includes("HUNG"))) break;
      }
    });

    // Let the first-boot auto-backup / DKB cache settle so the save's VKB
    // writes do not deadlock against a concurrent VetRateVKB transaction.
    await page.waitForTimeout(5000);

    // ── STEP 1: real write path via buildVkbMergeFromCFile (production mapper).
    const saveResult = await page
      .evaluate(async (marker) => {
        const { provider } = (window as any).__verifyMods;

        const analysis = {
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
        const fakeRawText = `SYNTHETIC C-FILE RAW TEXT. Veteran reports ${marker}. Page 1 of 3.`;
        const extraction = { method: "text", ocrUsed: false, confidence: 0.99 };

        const savePromise = provider.saveAnalysisResults({
          toolName: "C-File Analyzer",
          classification: provider.PACKET_DOC_TYPES.C_FILE,
          rawText: fakeRawText,
          extractedData: analysis,
          fileName: "canonical-dataflow-cfile.pdf",
          pageCount: 3,
          vkbDocument: {
            classification: "c_file",
            rawText: fakeRawText.slice(0, 5000),
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
        return "saveAnalysisResults completed without throwing";
      }, MARKER)
      .catch((e) => {
        console.log(
          "STEP1_FAILED_CONSOLE_TAIL:",
          JSON.stringify(consoleLines.slice(-30), null, 2),
        );
        throw e;
      });
    console.log("STEP1_SAVE:", saveResult);
    expect(saveResult).toContain("completed");

    // ── STEP 2: read IndexedDB, count canonical schema fields.
    const idbReport = await page.evaluate(async (marker) => {
      const dump = (dbName: string, storeName: string) =>
        new Promise<unknown>((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(storeName)) {
              db.close();
              resolve({ __error: `store ${storeName} missing` });
              return;
            }
            const all = db
              .transaction(storeName, "readonly")
              .objectStore(storeName)
              .getAll();
            all.onsuccess = () => {
              db.close();
              resolve(all.result);
            };
            all.onerror = () => {
              db.close();
              reject(all.error);
            };
          };
          req.onerror = () => reject(req.error);
        });

      const vkbRecords = (await dump("VetRateVKB", "knowledge_base")) as {
        id?: string;
      }[];
      const vkbMain = Array.isArray(vkbRecords)
        ? (vkbRecords.find((r) => r.id === "main") as Record<string, any> | null)
        : null;
      const v = vkbMain;

      const num = (x: unknown) => (typeof x === "number" ? x : -1);
      return {
        medicalConditionsCurrent: num(v?.medicalConditions?.current?.length),
        evidenceTimeline: num(v?.evidenceTimeline?.length),
        cFiles: num(v?.documentation?.cFiles?.length),
        missingEvidence: num(v?.aiInsights?.missingEvidence?.length),
        presumptive: num(v?.medicalConditions?.presumptive?.length),
        environmental: num(v?.exposures?.environmental?.length),
        // Off-schema legacy arrays must still be written (dual-write).
        legacyClaims: num(v?.claims?.length),
        legacyEvidence: num(v?.evidence?.length),
        currentNames: Array.isArray(v?.medicalConditions?.current)
          ? v!.medicalConditions.current.map((c: any) => c.name)
          : [],
        currentHasMarker: JSON.stringify(
          v?.medicalConditions?.current ?? [],
        ).includes(marker),
      };
    }, MARKER);
    console.log("STEP2_IDB:", JSON.stringify(idbReport, null, 2));

    // ── REQUIRED assertion 1: canonical schema fields populated after save.
    expect(
      idbReport.medicalConditionsCurrent,
      "medicalConditions.current should hold >=2 source-tagged suggestions",
    ).toBeGreaterThanOrEqual(2);
    expect(idbReport.evidenceTimeline).toBeGreaterThanOrEqual(1);
    expect(idbReport.cFiles).toBeGreaterThanOrEqual(1);
    expect(idbReport.missingEvidence).toBeGreaterThanOrEqual(1);
    // Dual-write: the legacy arrays getLoadableConditions reads must survive.
    expect(idbReport.legacyClaims).toBeGreaterThanOrEqual(2);
    expect(idbReport.currentHasMarker).toBe(true);

    // ── STEP 3: AI context builders (name unset, then set).
    const aiReport = await page.evaluate(async (marker) => {
      const { provider, vkbMod } = (window as any).__verifyMods;

      const vkb = await vkbMod.loadVKB();
      const llmCtx: string = vkbMod.generateLLMContext(vkb);
      const aiCtxNoName: string = await provider.getVeteranAIContext();

      const sectionHas = (ctx: string, header: string): boolean => {
        const start = ctx.indexOf(header);
        if (start === -1) return false;
        const rest = ctx.slice(start + header.length);
        const end = rest.indexOf("\n--- ");
        const body = end === -1 ? rest : rest.slice(0, end);
        return body.includes(marker);
      };

      return {
        llmCtxHasMarker: llmCtx.includes(marker),
        markerUnderCanonicalHeader:
          sectionHas(llmCtx, "--- CLAIMED CONDITIONS ---") ||
          sectionHas(llmCtx, "--- EVIDENCE TIMELINE ---"),
        aiCtxNoNameHasMarker: aiCtxNoName.includes(marker),
        aiCtxNoNameLength: aiCtxNoName.length,
        llmCtxFull: llmCtx.slice(0, 4000),
      };
    }, MARKER);
    console.log(
      "STEP3_AICTX:",
      JSON.stringify({ ...aiReport, llmCtxFull: undefined }, null, 2),
    );
    console.log("STEP3_LLMCTX_FULL:\n" + aiReport.llmCtxFull);

    // ── REQUIRED assertion 2: marker reaches AI context with NAME UNSET.
    expect(aiReport.llmCtxHasMarker, "generateLLMContext must contain marker").toBe(
      true,
    );
    expect(
      aiReport.aiCtxNoNameHasMarker,
      "getVeteranAIContext must include VKB content even with no fullName set",
    ).toBe(true);

    // ── REQUIRED assertion 3: marker under a canonical header, not a blob.
    expect(
      aiReport.markerUnderCanonicalHeader,
      "marker must render under CLAIMED CONDITIONS / EVIDENCE TIMELINE",
    ).toBe(true);
  });
});
