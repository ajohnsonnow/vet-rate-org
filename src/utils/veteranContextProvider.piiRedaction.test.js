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
 *
 * D14-1 / owner decision D (2026-09-28, ADR-008): the "separate, legitimate
 * question of the veteran's own structured identity" this file used to
 * flag as open (ADR-007) is now decided - no AI context may ever contain a
 * direct veteran identifier, full stop. The second describe block below
 * extends the SAME real, unmocked pipeline with the veteran's own VKB
 * personal block, a claim number, and a service-record document whose
 * fileName AND extractedData.fullName both carry the fixture identity,
 * rendered at every budget from 100 to 1,000,000 tokens.
 * Fixture PII strings are synthetic, not any real veteran's data.
 */
import { describe, it, expect, beforeEach } from "vitest";

const FAKE_NAME = "Jordan Q Faketon";
const FAKE_FIRST = "Jordan";
const FAKE_LAST = "Faketon";
const FAKE_ADDRESS = "742 Fictional Ave, Nowhereville, ZZ 00000";
const FAKE_STREET = "742 Fictional Ave";
const FAKE_CITY = "Nowhereville";
const FAKE_SSN = "000-00-0000";
const FAKE_VA_FILE_NUMBER = "123456789";
const FAKE_DOB = "1984-03-15";
const FAKE_EMAIL = "jordan.faketon@example.test";
const FAKE_PHONE = "555-123-4567";
const FAKE_CLAIM_NUMBER = "CL-2026-000999";

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
const { initializeVKB, saveVKB, generateLLMContext } =
  await import("./veteranKnowledgeBase.js");
const { PACKET_DOC_TYPES } = await import("./myPacketManager.js");

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

// ============================================================================
// D14-1 / owner decision D (2026-09-28, ADR-008): data minimisation for AI.
// A fixture veteran whose VKB personal block, a claim, a service-record
// document's fileName AND extractedData.fullName, and a claim letter's own
// free-text fields (evidenceNeeded/diagnosis/rationale/opinion) all carry the
// fixture identity. Rendered through every real AI-context builder at every
// real budget from 100 to 1,000,000 tokens.
// ============================================================================

function buildFixtureVkb() {
  const vkb = initializeVKB();
  vkb.personal.fullName = FAKE_NAME;
  vkb.personal.dateOfBirth = FAKE_DOB;
  vkb.personal.ssn = "6789"; // schema: last 4 only
  vkb.personal.veteranFileNumber = FAKE_VA_FILE_NUMBER;
  vkb.personal.email = FAKE_EMAIL;
  vkb.personal.phone = FAKE_PHONE;
  vkb.personal.address = {
    street: FAKE_STREET,
    city: FAKE_CITY,
    state: "ZZ",
    zip: "00000",
  };
  vkb.vaClaimsHistory.claims.push({
    claimNumber: FAKE_CLAIM_NUMBER,
    status: "denied",
    decisionDate: "2024-05-01",
    conditions: ["Tinnitus"],
  });
  vkb.evidenceTimeline.push({
    date: "2010-06-29",
    eventType: "service_separation",
    description: "Separated from service - Honorable discharge",
    source: `${FAKE_LAST}_${FAKE_FIRST}_9999_DD214.pdf`,
    significance: "service_milestone",
  });
  return vkb;
}

async function seedFixtureIdentityDocuments() {
  await saveDocumentToPacket({
    fileName: `${FAKE_LAST}_${FAKE_FIRST}_9999_DD214.pdf`,
    fileSize: 2000,
    classification: PACKET_DOC_TYPES.DD214,
    rawText: `DEPARTMENT OF DEFENSE\n${FAKE_NAME}\n${FAKE_ADDRESS}`,
    extractedData: {
      fullName: FAKE_NAME,
      branch: "Army",
      rank: "SGT",
      entryDate: "2004-06-22",
      separationDate: "2010-06-29",
      characterOfService: "Honorable",
    },
  });
  await saveDocumentToPacket({
    fileName: `${FAKE_LAST}_${FAKE_FIRST}_9999_claim_letter.pdf`,
    fileSize: 4000,
    classification: "va_correspondence",
    rawText: FAKE_CLAIM_LETTER_RAW,
    extractedData: {
      type: "claim_letter",
      claimNumber: FAKE_CLAIM_NUMBER,
      vaFileNumber: FAKE_VA_FILE_NUMBER,
      decisions: [{ issue: "Tinnitus", outcome: "denied" }],
      conditions: ["Tinnitus"],
      combinedRating: 10,
      status: "decided",
      evidenceNeeded: [`Contact ${FAKE_NAME}, DOB ${FAKE_DOB}.`],
      diagnosis: `Tinnitus confirmed for ${FAKE_NAME}, SSN ${FAKE_SSN}.`,
      rationale: `Nexus for ${FAKE_NAME}, file ${FAKE_VA_FILE_NUMBER}.`,
      opinion: `Tinnitus is service-connected.`,
      examiner: "Dr. Example Physician",
      provider: "VA Medical Center - Dr. Example Physician",
      raw: FAKE_CLAIM_LETTER_RAW.substring(0, 500),
    },
  });
}

function expectNoIdentifiers(ctx) {
  expectNoPii(ctx);
  expect(ctx).not.toContain(FAKE_FIRST);
  expect(ctx).not.toContain(FAKE_LAST);
  expect(ctx).not.toContain(FAKE_DOB);
  expect(ctx).not.toContain(FAKE_EMAIL);
  expect(ctx).not.toContain(FAKE_PHONE);
  expect(ctx).not.toContain(FAKE_CLAIM_NUMBER);
  expect(ctx).not.toContain("9999_DD214.pdf");
  expect(ctx).not.toMatch(/\bnull\b/i);
}

describe("D14-1: no direct veteran identifier ever enters an AI context (owner decision D)", () => {
  const BUDGETS = [100, 300, 500, 800, 1000, 4000, 50000, 1000000];

  beforeEach(async () => {
    await seedFixtureIdentityDocuments();
    await saveVKB(buildFixtureVkb());
  });

  it("generateLLMContext (direct, in-memory VKB) never leaks any fixture identifier", () => {
    const ctx = generateLLMContext(buildFixtureVkb());
    expectNoIdentifiers(ctx);
    // Safe, non-identifying facts still get through.
    expect(ctx).toContain("Tinnitus");
  });

  it.each(BUDGETS)(
    "getVeteranAIContext never leaks any fixture identifier at maxPacketTokens=%i",
    async (maxPacketTokens) => {
      const ctx = await getVeteranAIContext({ maxPacketTokens });
      expectNoIdentifiers(ctx);
    },
  );

  it.each(BUDGETS)(
    "generatePacketContext never leaks any fixture identifier at maxTokens=%i",
    async (maxTokens) => {
      const ctx = await generatePacketContext({ maxTokens });
      expectNoIdentifiers(ctx);
    },
  );

  it("buildSystemPrompt never leaks any fixture identifier", () => {
    expectNoIdentifiers(buildSystemPrompt());
  });

  it("keeps the examiner/provider name - it is not the veteran's own identifier", async () => {
    const ctx = await generatePacketContext({ maxTokens: 4000 });
    expect(ctx).toContain("Dr. Example Physician");
  });

  it("still surfaces safe claim facts (condition, rating, decision date) with no claim number", async () => {
    const ctx = await getVeteranAIContext({ maxPacketTokens: 4000 });
    expect(ctx).toContain("Tinnitus");
    expect(ctx).not.toContain("Claim #");
  });
});
