/**
 * D13-4 (final13 QA): myPacketManager.js's _formatOtherDocsSection used to
 * embed JSON.stringify(doc.extractedData).substring(0, 500) verbatim -
 * every musterCallProcessor.js parser bakes a `raw: text.substring(0, N)`
 * field straight into extractedData (a claim letter's letterhead, which is
 * the veteran's own name/home address/VA file number), and an
 * unclassified document type resolves to ONLY that raw field
 * (parseDocumentByType's default branch).
 *
 * F7/F15 (final13 QA re-review, 2026-09-28): the original version of this
 * test replaced generatePacketContext with a hand-rolled reimplementation
 * that only called _groupDocsByType/_formatOtherDocsSection, and passed
 * includeVKB: false - so a leak through _formatServiceRecordSection,
 * _formatCFileSection, truncation, or the VKB half of getVeteranAIContext
 * would have passed it. Rewritten to seed real documents into a fake
 * window.indexedDB (jsdom has none) via the real saveDocumentToPacket, and
 * render the REAL, unmocked getVeteranAIContext/generatePacketContext/
 * buildSystemPrompt at every budget a live caller actually passes,
 * including the default (800), the largest known live caller
 * (AIAssistant.jsx: 1000), and generatePacketContext's own default (4000).
 * The VKB is deliberately left empty (no personal.fullName seeded) so
 * these assertions test the DOCUMENT-derived leak D13-4 targets, not the
 * separate, legitimate question of the veteran's own structured identity
 * appearing in their own AI context (buildPersonalContext) - see
 * ADR-007 open issues for that question, flagged for a product decision.
 * Fixture PII strings are synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_ADDRESS = "742 Fictional Ave, Nowhereville, ZZ 00000";
const FAKE_SSN = "000-00-0000";
const FAKE_VA_FILE_NUMBER = "123456789";

const FAKE_CLAIM_LETTER_RAW = `DEPARTMENT OF VETERANS AFFAIRS
${FAKE_NAME}
${FAKE_ADDRESS}
In reply refer to: ${FAKE_VA_FILE_NUMBER}
SSN: ${FAKE_SSN}
Dear ${FAKE_NAME},
We have completed the review of your claim.`;

// Minimal fake IndexedDB - same pattern as
// serviceEntryConsistency.integration.test.jsx's createFakeIndexedDB,
// duplicated per this codebase's own convention (veteranKnowledgeBase.
// clearVKB.test.js keeps its own local copy too) rather than extracting a
// shared test utility for a single extra caller.
function makeRequest(run) {
  const request = {};
  queueMicrotask(() => {
    request.result = run();
    request.onsuccess?.();
  });
  return request;
}

function makeTransaction(storesByName) {
  const tx = { pending: 0, oncomplete: null };
  const track = (fn) => {
    tx.pending += 1;
    return makeRequest(() => {
      const result = fn();
      tx.pending -= 1;
      if (tx.pending === 0) queueMicrotask(() => tx.oncomplete?.());
      return result;
    });
  };
  tx.objectStore = (name) => {
    if (!storesByName.has(name)) storesByName.set(name, new Map());
    const rows = storesByName.get(name);
    return {
      get: (key) => track(() => rows.get(key)),
      put: (value) => track(() => rows.set(value.id, value)),
      delete: (key) => track(() => rows.delete(key)),
      getAll: () => track(() => Array.from(rows.values())),
      clear: () => track(() => rows.clear()),
      index: () => ({ getAll: () => track(() => Array.from(rows.values())) }),
    };
  };
  return tx;
}

const fakeDatabases = new Map();
window.indexedDB = {
  open: (dbName) => {
    if (!fakeDatabases.has(dbName)) fakeDatabases.set(dbName, new Map());
    const storesByName = fakeDatabases.get(dbName);
    return makeRequest(() => ({
      objectStoreNames: { contains: () => true },
      createObjectStore: (name) => {
        if (!storesByName.has(name)) storesByName.set(name, new Map());
        return { createIndex: () => {} };
      },
      transaction: () => makeTransaction(storesByName),
    }));
  },
};

const { getVeteranAIContext } = await import("./veteranContextProvider.js");
const { generatePacketContext, saveDocumentToPacket, clearPacket } =
  await import("./myPacketManager.js");
const { buildSystemPrompt } = await import("./aiSystemPrompts.js");

async function seedFixtureDocuments() {
  await saveDocumentToPacket({
    fileName: "decision_letter.pdf",
    fileSize: 4000,
    classification: "va_correspondence",
    rawText: FAKE_CLAIM_LETTER_RAW,
    extractedData: {
      type: "claim_letter",
      claimNumber: "CL-2026-000111",
      vaFileNumber: FAKE_VA_FILE_NUMBER,
      claimDate: "2026-01-15",
      letterDate: "2026-02-01",
      decisionDate: "2026-02-01",
      decisions: [{ issue: "Tinnitus", outcome: "granted" }],
      conditions: ["Tinnitus"],
      combinedRating: 10,
      evidenceNeeded: [],
      responseDeadlineDays: null,
      status: "decided",
      raw: FAKE_CLAIM_LETTER_RAW.substring(0, 500),
    },
  });
  await saveDocumentToPacket({
    fileName: "unclassified_scan.pdf",
    fileSize: 3000,
    classification: "other",
    rawText: FAKE_CLAIM_LETTER_RAW,
    // parseDocumentByType's default branch: nothing but the raw fallback.
    extractedData: { raw: FAKE_CLAIM_LETTER_RAW.substring(0, 1000) },
  });
}

beforeEach(async () => {
  localStorage.clear();
  await clearPacket();
  await seedFixtureDocuments();
});

function expectNoPii(ctx) {
  expect(ctx).not.toContain(FAKE_NAME);
  expect(ctx).not.toContain(FAKE_ADDRESS);
  expect(ctx).not.toContain(FAKE_SSN);
  expect(ctx).not.toContain(FAKE_VA_FILE_NUMBER);
}

describe("getVeteranAIContext: no document PII leaks at any real-caller budget", () => {
  // 300/500/800(default)/1000(largest live caller, AIAssistant.jsx)/4000
  // (generatePacketContext's own default) - includeVKB defaults to true,
  // exercising the real full pipeline, not just the packet half.
  it.each([300, 500, 800, 1000, 4000])(
    "never surfaces the fake name/address/SSN/VA file number at maxPacketTokens=%i",
    async (maxPacketTokens) => {
      const ctx = await getVeteranAIContext({ maxPacketTokens });
      expectNoPii(ctx);
    },
  );

  it("still surfaces the safe, whitelisted claim facts", async () => {
    const ctx = await getVeteranAIContext({ maxPacketTokens: 1000 });
    expect(ctx).toContain("combinedRating");
    expect(ctx).toContain("Tinnitus");
  });
});

describe("generatePacketContext/buildSystemPrompt: no document PII leaks, real path", () => {
  it("generatePacketContext (real, default budget) never leaks the raw letterhead", async () => {
    const ctx = await generatePacketContext();
    expectNoPii(ctx);
  });

  it("buildSystemPrompt (real, auto-loads veteran data) never leaks the raw letterhead", () => {
    expectNoPii(buildSystemPrompt());
  });
});
