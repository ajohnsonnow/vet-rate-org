/**
 * ADR-007 end-to-end consistency check: a correction applied through ANY of
 * the real editors (VKB viewer, My Packet's Service tab, FormsHelper,
 * Muster Call's Verify & Save) reaches the SAME canonical period, and every
 * downstream consumer (the AI system prompt, the VKB projection - top-level
 * fields/period row/timeline event/LLM context - getVeteranAIContext, the
 * dossier, the Service tab summary/span/total/period count, the
 * duty-stations label, the flat profile mirror, dd214Data, FormsHelper's own
 * prefill, and BOTH timelines - the VKB's own evidenceTimeline and
 * EvidenceTimeline.jsx's separate localStorage store) agrees with it, both
 * mid-chain and after a later, disagreeing document import or an unedited
 * re-import.
 *
 * final13 QA: musterCallProcessor AND veteranKnowledgeBase are no longer
 * mocked - every "document" step below (NGB-22, code sheet, printed DD-214)
 * calls the REAL persistFormationDocument/persistVerifiedDocument ingest
 * path this app's own Muster Call flow uses, and that path's own real
 * IndexedDB writes (addDocumentToVKB, My Packet's archiveDocumentInPacket)
 * now run for real too, against a hand-built fake `window.indexedDB`
 * (jsdom has none) instead of a module-mock that only intercepted
 * loadVKB/saveVKB's own top-level exports - a vi.mock re-export can't
 * intercept a call the REAL module makes to itself internally
 * (addDocumentToVKB calling its own module's loadVKB), so those writes used
 * to fail against a real, unavailable `indexedDB` global and get silently
 * swallowed, with the failure never surfacing as a test failure. Only
 * documentAnalyzer/smolVLMService (OCR/vision, never reached once a
 * pre-built extraction result is supplied directly) are substituted.
 * Fixture values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// musterCallProcessor/documentAnalyzer/smolVLMService all transitively
// import pdfjs-dist, which references canvas globals jsdom doesn't provide -
// same recipe as MyPacket.serviceSpan.test.jsx / DD214Analyzer's own test.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

// Minimal fake IndexedDB (same pattern as
// veteranKnowledgeBase.clearVKB.test.js's createFakeIndexedDB, extended
// with getAll/clear/index support for My Packet's two-store, indexed
// PACKET_STORE_NAME/PACKET_INDEX_STORE usage) backed by one persistent
// in-memory Map per (dbName, storeName) - installed once at module load, so
// the module-level connection caches inside veteranKnowledgeBase.js
// (vkbDB) and myPacketManager.js (its own openPacketDB cache) stay valid
// across every test in this file. Per-test isolation comes from calling
// the real clearVKB()/clearPacket() in beforeEach, not from swapping this
// fake out.
function makeRequest(run, onError) {
  const request = {};
  queueMicrotask(() => {
    try {
      request.result = run();
      request.onsuccess?.();
    } catch (error) {
      request.error = error;
      onError?.(error);
      request.onerror?.();
    }
  });
  return request;
}

function makeTransaction(storesByName) {
  const tx = { pending: 0, oncomplete: null, onerror: null, error: null };
  const track = (fn) => {
    tx.pending += 1;
    return makeRequest(
      () => {
        const result = fn();
        tx.pending -= 1;
        if (tx.pending === 0) queueMicrotask(() => tx.oncomplete?.());
        return result;
      },
      (error) => {
        tx.error = error;
        tx.pending -= 1;
        queueMicrotask(() => tx.onerror?.());
      },
    );
  };
  tx.objectStore = (name) => {
    if (!storesByName.has(name)) storesByName.set(name, new Map());
    const rows = storesByName.get(name);
    return {
      get: (key) => track(() => rows.get(key)),
      put: (value) =>
        track(() => {
          rows.set(value.id, value);
          return value.id;
        }),
      delete: (key) => track(() => rows.delete(key)),
      getAll: () => track(() => Array.from(rows.values())),
      clear: () => track(() => rows.clear()),
      index: (field) => ({
        getAll: (value) => track(() => filterByField(rows, field, value)),
      }),
    };
  };
  return tx;
}

function filterByField(rows, field, value) {
  return Array.from(rows.values()).filter((r) => r[field] === value);
}

function createFakeIndexedDB() {
  const databases = new Map();
  return {
    open: (dbName) => {
      if (!databases.has(dbName)) databases.set(dbName, new Map());
      const storesByName = databases.get(dbName);
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
}
window.indexedDB = createFakeIndexedDB();

const {
  setServiceEntryDate,
  getServiceEntry,
  getServicePeriods,
  getServiceHistory,
  getVeteranProfile,
  summarizeServicePeriods,
  getTimelineEvents,
  saveServiceHistory,
} = await import("../utils/veteranProfile.js");
const { loadVKB, saveVKB, generateLLMContext, clearVKB } =
  await import("../utils/veteranKnowledgeBase.js");
const { getVeteranAIContext } =
  await import("../utils/veteranContextProvider.js");
const { buildSystemPrompt } = await import("../utils/aiSystemPrompts.js");
const { generateDossierHTML } = await import("../utils/dossierExport.js");
const { _formatServiceRecordBasics, clearPacket, getAllPacketDocuments } =
  await import("../utils/myPacketManager.js");
const { formatPeriodLabel } =
  await import("../components/DutyStationsSection.jsx");
const { saveVkbViewerEdits } = await import("../components/VKBViewer.jsx");
const { _updateServicePeriodField, _saveProfileTab } =
  await import("../components/MyPacket.jsx");
const { buildFormsHelperPrefillDefaults } =
  await import("../components/FormsHelper.jsx");
const { _saveDd214ToProfile } = await import("../components/DD214Analyzer.jsx");
const { persistVerifiedDocument } =
  await import("../hooks/useSequentialFormationFlow.js");
const { persistFormationDocument } =
  await import("../utils/musterCallProcessor.js");
const EvidenceTimeline = (await import("../components/EvidenceTimeline.jsx"))
  .default;
const { LanguageProvider } = await import("../contexts/LanguageContext.jsx");

const PROFILE_KEY = "vet_rate_veteran_profile";
const NGB22_FILE = "ngb22-synthetic.pdf";
const END_DATE = "2010-06-15";
const t = (...keys) => keys.join(".");

// Shared shape every "document" step below feeds to the REAL
// persistFormationDocument, matching what processSingleDocument would have
// produced from a real parse - see buildDD214ProfileUpdate/
// _savePrimaryServicePeriod (musterCallProcessor.js) for the exact fields
// each one reads.
// parseServiceRecord()'s own extractedData shape uses serviceStartDate/
// serviceEndDate/serviceStartDateDerived (buildDD214ProfileUpdate is what
// translates those into entryDate/separationDate/entryDateDerived for the
// profile-shaped "candidate" _savePrimaryServicePeriod then upserts).
function serviceRecordFixture({
  formType,
  fileName,
  serviceStartDate,
  serviceStartDateDerived = false,
  serviceEndDate = END_DATE,
  branch = "Army National Guard",
  confidence = 60,
  additionalPeriods,
}) {
  return [
    { name: fileName, size: 5000 },
    {
      filename: fileName,
      text: "",
      classification: { type: formType, confidence },
      extractedData: {
        type: "service_record",
        formType,
        serviceStartDate,
        serviceStartDateDerived,
        serviceEndDate,
        branch,
        ...(additionalPeriods ? { additionalPeriods } : {}),
      },
      pageCount: 1,
    },
  ];
}

async function ingestServiceRecord(overrides) {
  const [file, result] = serviceRecordFixture(overrides);
  await persistFormationDocument(file, result);
  return result;
}

async function seedNgb22() {
  await ingestServiceRecord({
    formType: "NGB22",
    fileName: NGB22_FILE,
    serviceStartDate: "2002-03-05",
    serviceStartDateDerived: true,
  });
}

async function ingestCodeSheet(fileName, overrides = {}) {
  await persistFormationDocument(
    { name: fileName, size: 3000 },
    {
      filename: fileName,
      text: "",
      classification: { type: "C_FILE_MEDICAL", confidence: 90 },
      extractedData: {
        ratingSource: "code_sheet",
        servicePeriods: [
          {
            entryDate: "2002-03-05",
            separationDate: END_DATE,
            branch: "Army National Guard",
            characterOfDischarge: "Honorable",
            ...overrides,
          },
        ],
      },
      pageCount: 1,
    },
  );
}

// D16-1: a code sheet listing several periods at once (one per Box-18
// window it separately confirms), not just the single enlistment-level
// period ingestCodeSheet above always sends.
async function ingestCodeSheetPeriods(fileName, servicePeriods) {
  await persistFormationDocument(
    { name: fileName, size: 3000 },
    {
      filename: fileName,
      text: "",
      classification: { type: "C_FILE_MEDICAL", confidence: 90 },
      extractedData: { ratingSource: "code_sheet", servicePeriods },
      pageCount: 1,
    },
  );
}

beforeEach(async () => {
  localStorage.clear();
  await clearVKB();
  await clearPacket();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
});

// generateLLMContext's "Service:" line only renders once the VKB's own
// top-level separationDate is known - a real VKB already has it from the
// same NGB-22 extraction; seed it here rather than only after the first
// VKB viewer edit, so consumers are checked starting from the calculated
// baseline too, not just after the first correction.
async function primeVkbSeparationDate() {
  const vkb = await loadVKB();
  vkb.serviceHistory.separationDate = END_DATE;
  await saveVKB(vkb);
}

async function correctViaVkbViewer(date) {
  const loaded = await loadVKB();
  const edited = structuredClone(loaded);
  edited.serviceHistory.entryDate = date;
  edited.serviceHistory.separationDate = END_DATE;
  const result = await saveVkbViewerEdits({ edited, loaded });
  expect(result.ok).toBe(true);
}

function correctViaMyPacket(date) {
  const periods = getServicePeriods();
  const idx = periods.findIndex((p) => p.id === getServiceEntry().periodId);
  _updateServicePeriodField(
    { servicePeriods: periods },
    () => {},
    idx,
    "serviceStartDate",
    date,
  );
}

function correctViaFormsHelper(date) {
  const result = setServiceEntryDate({ date, via: "forms_helper" });
  expect(result.ok).toBe(true);
}

async function correctViaMusterCallReverify(date) {
  await persistVerifiedDocument(
    {
      filename: NGB22_FILE,
      size: 5000,
      classification: { type: "NGB22", confidence: 60 },
      extractedData: {
        type: "service_record",
        formType: "NGB22",
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: false,
        serviceEndDate: END_DATE,
        branch: "Army National Guard",
      },
    },
    {
      verifiedData: {},
      saveToVKB: true,
      updateProfile: true,
      serviceEntryCorrection: {
        date,
        documentStartDate: "2002-03-05",
        documentEndDate: END_DATE,
      },
    },
  );
}

function importFollowupDd214(printedDate) {
  _saveDd214ToProfile(
    {
      dd214Count: 1,
      entryDate: printedDate,
      separationDate: END_DATE,
      branch: "Army National Guard",
    },
    "combined text",
    {},
    {},
    [{ filename: "dd214-followup-synthetic.pdf" }],
  );
}

function stubCanvasContext() {
  return new Proxy({}, { get: () => vi.fn() });
}

// D13-2 (this same pass): EvidenceTimeline.jsx's OWN localStorage store is
// NOT part of the VKB - it only follows the projection through its own
// silent mount-time sync (plus, since final13's store-level fix, every
// saveServiceHistory call). A fresh mount is required per check (the
// component sync runs once per instance).
//
// F6/F12 (final13 QA re-review, 2026-09-28): the marker check below can't
// tell a stale DATE apart from a fresh one once a correction is no longer
// the derived-to-corrected transition (every correction after the first,
// and every code-sheet period, which is never derived) - the description
// text doesn't change either in that case. The date is now checked
// directly against the STORE, and BEFORE this function ever mounts
// EvidenceTimeline - mounting runs its own separate sync, which would
// paper over a regression in the store-level sync this same date check is
// meant to guard (saveServiceHistory's
// _syncTimelineEventsWithServiceEntryProjection, veteranProfile.js). Only
// checked once the store already holds a copy - the very first call has
// nothing yet (only a mount's own first-open auto-import creates one).
async function assertEvidenceTimelineAgrees(expected) {
  const beforeMount = getTimelineEvents();
  if (beforeMount.length > 0) {
    const serviceEntryEvent = beforeMount.find((e) =>
      ["guard_enlistment", "service_entry"].includes(e.eventType),
    );
    expect(serviceEntryEvent?.date).toBe(expected.date);
  }

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    stubCanvasContext(),
  );
  const { unmount, findByText, queryByText } = render(
    <LanguageProvider>
      <EvidenceTimeline onClose={() => {}} />
    </LanguageProvider>,
  );
  // "Enlisted (...)" vs "Entered active duty (...)" is a separate,
  // legitimate label choice (buildServiceEntryTimelineEvent, keyed off
  // formType/derived) - this only asserts the "(calculated)" marker itself
  // agrees with every other consumer's provenance.
  await findByText(/📋 Timeline Events/);
  if (expected.derived) {
    expect(queryByText(/\(calculated\)/)).toBeInTheDocument();
  } else {
    expect(queryByText(/\(calculated\)/)).not.toBeInTheDocument();
  }
  unmount();
}

function assertProfileAndPeriodConsumers(
  expected,
  entry,
  period,
  fileName,
  documentOwnDate,
) {
  expect(period.serviceStartDate).toBe(expected.date);
  expect(period.serviceStartDateDerived).toBe(expected.derived);

  const summary = summarizeServicePeriods(getServicePeriods());
  expect(summary.serviceSpan).toMatchObject({
    start: expected.date,
    startDerived: expected.derived,
    startSource: expected.source,
  });
  expect(summary.totalTimeInService).toBeTruthy();

  const label = formatPeriodLabel(period, t);
  expect(label).toContain(expected.date);
  expect(label.includes("myPacketSection.calculatedFromNetService")).toBe(
    expected.derived,
  );

  const profile = getVeteranProfile();
  expect(profile.serviceStartDate).toBe(expected.date);
  expect(profile.serviceStartDateDerived).toBe(expected.derived);

  const basics = _formatServiceRecordBasics(
    { serviceStartDate: documentOwnDate },
    fileName,
  );
  expect(basics).toContain(`Entry: ${expected.date}`);
}

async function assertVkbConsumers(expected, entry) {
  const vkb = await loadVKB();
  expect(vkb.serviceHistory.entryDate).toBe(expected.date);
  expect(!!vkb.serviceHistory.entryDateDerived).toBe(expected.derived);

  const row = vkb.serviceHistory.servicePeriods.find(
    (r) => r.canonicalPeriodId === entry.periodId,
  );
  expect(row.serviceStartDate).toBe(expected.date);
  expect(!!row.serviceStartDateDerived).toBe(expected.derived);

  const timelineEvent = vkb.evidenceTimeline.find(
    (e) =>
      e.eventType === "guard_enlistment" || e.eventType === "service_entry",
  );
  expect(timelineEvent.date).toBe(expected.date);
  expect(!!timelineEvent.derived).toBe(expected.derived);

  const note = expected.derived ? " (calculated from net service)" : "";
  const line = `Service: ${expected.date}${note} to`;
  expect(generateLLMContext(vkb)).toContain(line);
  expect(await getVeteranAIContext()).toContain(line);
}

async function assertConsistent(
  expected,
  {
    checkDd214 = false,
    fileName = NGB22_FILE,
    documentOwnDate = "2002-03-05",
  } = {},
) {
  const entry = getServiceEntry();
  expect(entry).toMatchObject({
    date: expected.date,
    derived: expected.derived,
    source: expected.source,
  });

  const note = expected.derived ? " (calculated from net service)" : "";
  expect(buildSystemPrompt()).toContain(`Entry Date: ${expected.date}${note}`);
  expect(generateDossierHTML()).toContain(`${expected.date}${note}`);

  const formsDefault = expected.derived ? "" : expected.date;
  expect(buildFormsHelperPrefillDefaults().serviceStartDate).toBe(formsDefault);

  const period = getServicePeriods().find((p) => p.id === entry.periodId);
  assertProfileAndPeriodConsumers(
    expected,
    entry,
    period,
    fileName,
    documentOwnDate,
  );
  await assertVkbConsumers(expected, entry);
  await assertEvidenceTimelineAgrees(expected);

  if (checkDd214) {
    expect(getServiceHistory().dd214Data?.entryDate).toBe(expected.date);
  }
}

async function seedAndAssertBaseline() {
  await seedNgb22();
  await primeVkbSeparationDate();
  await assertConsistent({
    date: "2002-03-05",
    derived: true,
    source: "calculated",
  });
  expect(getServicePeriods()).toHaveLength(1);
}

// Standing decision (A): a correction more than isSameServicePeriod's
// 7-day tolerance away from the calculated guess (2002-02-10 is 23 days
// off) must update the SAME period via periodId, never create a second
// one (D12-2) - every one of these four editors routes through it.
async function runEditorCorrectionChain() {
  await correctViaVkbViewer("2002-02-10");
  await assertConsistent({
    date: "2002-02-10",
    derived: false,
    source: "veteran",
  });
  expect(getServicePeriods()).toHaveLength(1);

  correctViaMyPacket("2002-02-15");
  await assertConsistent({
    date: "2002-02-15",
    derived: false,
    source: "veteran",
  });

  correctViaFormsHelper("2002-02-20");
  await assertConsistent({
    date: "2002-02-20",
    derived: false,
    source: "veteran",
  });

  await correctViaMusterCallReverify("2002-02-25");
  await assertConsistent({
    date: "2002-02-25",
    derived: false,
    source: "veteran",
  });
}

async function assertDisagreeingImportNeverReverts() {
  // A later, DISAGREEING DD-214 for a brand-new document (3 days off -
  // within the same-enlistment merge tolerance) must never revert the
  // veteran's own correction - only record the disagreement.
  importFollowupDd214("2002-02-22");
  await assertConsistent(
    { date: "2002-02-25", derived: false, source: "veteran" },
    { checkDd214: true },
  );
  const entryAfterImport = getServiceEntry();
  const periodAfterImport = getServicePeriods().find(
    (p) => p.id === entryAfterImport.periodId,
  );
  expect(
    periodAfterImport.fieldConflicts.some(
      (c) =>
        c.field === "serviceStartDate" && c.conflictingValue === "2002-02-22",
    ),
  ).toBe(true);
}

async function assertEveryDocumentReimportIsIdempotent() {
  // Re-import EVERY document type, unedited/disagreeing, after the full
  // correction chain - none may revert the veteran's own correction, and
  // none may duplicate the period (re-import idempotence).
  await seedNgb22();
  await ingestCodeSheet("codesheet-synthetic.pdf");
  await assertConsistent(
    { date: "2002-02-25", derived: false, source: "veteran" },
    { checkDd214: true },
  );
  expect(getServicePeriods()).toHaveLength(1);
}

describe("ADR-007: service entry date consistency across all editors and consumers", () => {
  it("stays consistent through VKB viewer, My Packet, FormsHelper, Muster Call re-verify, a disagreeing DD-214 import, and an unedited re-import", async () => {
    await seedAndAssertBaseline();
    await runEditorCorrectionChain();
    await assertDisagreeingImportNeverReverts();
    await assertEveryDocumentReimportIsIdempotent();
  });
});

describe("ADR-007: real IndexedDB writes and the item-3 classification bug's actual reproduction order", () => {
  // F13 (final13 QA re-review, 2026-09-28): the previously-mocked
  // veteranKnowledgeBase.js meant addDocumentToVKB/archiveDocumentInPacket
  // ran for real but against a real, unavailable `indexedDB` global -
  // their errors were caught and logged, never surfaced as a test
  // failure. Now backed by a real fake IndexedDB, so both writes can
  // actually be verified to have succeeded.
  it("archives the ingested document into both My Packet's IndexedDB store and the VKB's own documentation, for real", async () => {
    await seedNgb22();

    const packetDocs = await getAllPacketDocuments();
    expect(packetDocs.some((d) => d.fileName === NGB22_FILE)).toBe(true);

    const vkb = await loadVKB();
    expect(vkb.metadata.documentCount).toBeGreaterThanOrEqual(1);
  });

  // F14/item 3 (final13 QA re-review, 2026-09-28): the full correction
  // chain elsewhere in this file only re-imports a code sheet AFTER the
  // period is already veteran-corrected, so it never actually reaches the
  // item-3 bug's real reproduction order - an uncorrected NGB-22 period
  // relabeled by a code sheet import. Exercised directly here.
  it("a code sheet merging onto an uncorrected NGB-22 period never flips its projected timeline event to service_entry", async () => {
    await seedNgb22();
    await primeVkbSeparationDate();
    await ingestCodeSheet("codesheet-synthetic.pdf");

    const vkb = await loadVKB();
    const timelineEvent = vkb.evidenceTimeline.find(
      (e) =>
        e.eventType === "guard_enlistment" || e.eventType === "service_entry",
    );
    expect(timelineEvent.eventType).toBe("guard_enlistment");
  });
});

describe("ADR-007: additional real-ingest scenarios (Box-18 windows, printed DD-214, code-sheet dedup, stale Save Profile)", () => {
  it("Box-18 sub-periods (windows) stay excluded from entry candidacy; every consumer agrees on the enlistment-level date", async () => {
    await ingestServiceRecord({
      formType: "NGB22",
      fileName: "ngb22-windows-synthetic.pdf",
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      additionalPeriods: [
        {
          serviceStartDate: "2000-06-01",
          serviceEndDate: "2000-08-15",
          component: "Inactive Duty Training",
        },
        {
          serviceStartDate: "2003-06-01",
          serviceEndDate: "2003-12-01",
          component: "Active Duty",
        },
      ],
    });
    await primeVkbSeparationDate();

    const periods = getServicePeriods();
    expect(periods).toHaveLength(3);
    expect(periods.filter((p) => p.periodScope === "window")).toHaveLength(2);

    await assertConsistent(
      { date: "2002-03-05", derived: true, source: "calculated" },
      { fileName: "ngb22-windows-synthetic.pdf" },
    );
  });

  it("a printed (non-derived) DD-214 enlistment is consistent across every consumer", async () => {
    await ingestServiceRecord({
      formType: "DD214",
      fileName: "dd214-printed-synthetic.pdf",
      serviceStartDate: "2005-09-01",
      serviceStartDateDerived: false,
      serviceEndDate: "2009-08-31",
    });
    const vkb = await loadVKB();
    vkb.serviceHistory.separationDate = "2009-08-31";
    await saveVKB(vkb);

    await assertConsistent(
      { date: "2005-09-01", derived: false, source: "printed" },
      {
        fileName: "dd214-printed-synthetic.pdf",
        documentOwnDate: "2005-09-01",
      },
    );
  });

  it("code-sheet dedup: importing the same code sheet twice never duplicates the period", async () => {
    await seedNgb22();
    await primeVkbSeparationDate();

    await ingestCodeSheet("codesheet-synthetic.pdf");
    expect(getServicePeriods()).toHaveLength(1);
    await assertConsistent({
      date: "2002-03-05",
      derived: false,
      source: "code_sheet",
    });

    // Re-processing (Verify & Save on the same document) must merge in
    // place, not append a second row for the same period.
    await ingestCodeSheet("codesheet-synthetic.pdf");
    expect(getServicePeriods()).toHaveLength(1);
    await assertConsistent({
      date: "2002-03-05",
      derived: false,
      source: "code_sheet",
    });
  });
});

describe("ADR-007: My Packet's Save Profile never reverts a proven correction with a stale local snapshot", () => {
  it("keeps the VKB viewer's correction after a stale Profile-tab save", async () => {
    await seedNgb22();
    await primeVkbSeparationDate();

    // A stale snapshot, captured BEFORE the VKB viewer's correction below -
    // matching a Profile tab left open in another component instance while
    // the correction happened elsewhere.
    const staleProfile = { ...getVeteranProfile() };
    expect(staleProfile.serviceStartDate).toBe("2002-03-05");

    await correctViaVkbViewer("2002-02-10");
    await assertConsistent({
      date: "2002-02-10",
      derived: false,
      source: "veteran",
    });

    // ADR-007 §2.4: saveVeteranProfile's chokepoint replaces the payload's
    // start-date fields with the current projection regardless of what this
    // stale caller supplies.
    const saveResult = _saveProfileTab(staleProfile);
    expect(saveResult).toBe(true);
    await assertConsistent({
      date: "2002-02-10",
      derived: false,
      source: "veteran",
    });
  });
});

// D16-1 (final16 regression, 2026-09-29): a period-count + timeline-count
// assertion so a future change to either number fails loudly, per the D16-1
// fix notes (musterCallProcessor.servicePeriodMerge.test.js has the
// matching-logic-level regression tests; this file adds the real-ingest,
// real-VKB-timeline-projection check the ADR-007 suite is for). The
// fixture: an NGB-22 with 3 Box-18 windows (one coinciding exactly with the
// primary enlistment - final16's own demotion-prevention case), a code
// sheet listing all 3 windows (one of them 3 days off, within
// isSameServicePeriod's 7-day tolerance), and a DD-214 for one specific
// window. Only the primary enlistment is periodScope !== "window", so
// exactly one "Enlisted"/"Entered active duty" timeline event is ever
// projected (veteranKnowledgeBase.js's _buildProjectedEntryEvents filters
// window periods out) - a phantom duplicate period from the regression
// this guards against is always non-window-scoped (a code sheet/DD-214
// period never carries periodScope: "window" itself), so it always
// inflates this count too. Fixture values are synthetic.
const D16_NGB22_FILE = "ngb22-d16-synthetic.pdf";
const D16_CODESHEET_FILE = "codesheet-d16-synthetic.pdf";
const D16_DD214_FILE = "dd214-window-d16-synthetic.pdf";
const D16_PRIMARY_START = "2002-03-05";
const D16_PRIMARY_END = "2010-06-15";
const D16_IADT_START = "2000-06-01";
const D16_IADT_END = "2000-08-15";
const D16_AD2003_START = "2003-06-01";
const D16_AD2003_END = "2003-08-01";

async function ingestD16Ngb22(fileName = D16_NGB22_FILE) {
  await ingestServiceRecord({
    formType: "NGB22",
    fileName,
    serviceStartDate: D16_PRIMARY_START,
    serviceStartDateDerived: false,
    serviceEndDate: D16_PRIMARY_END,
    additionalPeriods: [
      {
        serviceStartDate: D16_IADT_START,
        serviceEndDate: D16_IADT_END,
        component: "Inactive Duty Training",
      },
      {
        serviceStartDate: D16_AD2003_START,
        serviceEndDate: D16_AD2003_END,
        component: "Active Duty",
      },
      // Coincides EXACTLY with the primary above.
      {
        serviceStartDate: D16_PRIMARY_START,
        serviceEndDate: D16_PRIMARY_END,
        component: "Active Duty",
      },
    ],
  });
}

async function ingestD16CodeSheet(fileName = D16_CODESHEET_FILE) {
  await ingestCodeSheetPeriods(fileName, [
    { entryDate: D16_PRIMARY_START, separationDate: D16_PRIMARY_END },
    { entryDate: D16_IADT_START, separationDate: D16_IADT_END },
    // 3 days off the NGB-22's own 2003-06-01 window start - still within
    // isSameServicePeriod's 7-day tolerance.
    { entryDate: "2003-06-04", separationDate: D16_AD2003_END },
  ]);
}

async function ingestD16Dd214ForWindow(fileName = D16_DD214_FILE) {
  await ingestServiceRecord({
    formType: "DD214",
    fileName,
    serviceStartDate: D16_IADT_START,
    serviceStartDateDerived: false,
    serviceEndDate: D16_IADT_END,
  });
}

// The VKB's own evidenceTimeline (what My Packet's Timeline tab reads) is
// re-projected from the FULL current servicePeriods[] on every NGB-22/
// DD-214 import (projectServiceEntryIntoVkb -> _projectTimeline,
// veteranKnowledgeBase.js) - unlike EvidenceTimeline.jsx's own separate
// localStorage store, which only gets its first copy once that component
// has actually been mounted (see assertEvidenceTimelineAgrees above), so
// it isn't a reliable check here without also rendering the component.
async function serviceEntryTimelineEvents() {
  const vkb = await loadVKB();
  return vkb.evidenceTimeline.filter((e) =>
    ["guard_enlistment", "service_entry"].includes(e.eventType),
  );
}

async function expectD16CountsAreStable() {
  expect(getServicePeriods()).toHaveLength(4);
  expect(
    getServicePeriods().filter((p) => p.periodScope === "window"),
  ).toHaveLength(3);
  expect(await serviceEntryTimelineEvents()).toHaveLength(1);
}

async function d16RealImportOrder() {
  await ingestD16Ngb22();
  await ingestD16CodeSheet();
  await ingestD16Dd214ForWindow();
  await primeVkbSeparationDate();

  await expectD16CountsAreStable();
}

async function d16ReverseImportOrder() {
  await ingestD16Dd214ForWindow();
  await ingestD16CodeSheet();
  await ingestD16Ngb22();
  await primeVkbSeparationDate();

  await expectD16CountsAreStable();
}

async function d16EveryDocumentSavedTwice() {
  await ingestD16Ngb22();
  await ingestD16Ngb22();
  await ingestD16CodeSheet();
  await ingestD16CodeSheet();
  await ingestD16Dd214ForWindow();
  await ingestD16Dd214ForWindow();
  await primeVkbSeparationDate();

  await expectD16CountsAreStable();
}

async function d16ReimportAfterCorrection() {
  await ingestD16Ngb22();
  await ingestD16CodeSheet();
  await primeVkbSeparationDate();

  const primary = getServicePeriods().find(
    (p) =>
      p.periodScope !== "window" && p.serviceStartDate === D16_PRIMARY_START,
  );
  const correction = setServiceEntryDate({
    date: "2002-03-08",
    via: "my_packet",
    periodId: primary.id,
  });
  expect(correction.ok).toBe(true);

  await ingestD16Ngb22();
  await ingestD16CodeSheet();

  await expectD16CountsAreStable();
  const primaryAfter = getServicePeriods().find((p) => p.id === primary.id);
  expect(primaryAfter.serviceStartDate).toBe("2002-03-08");
  expect(primaryAfter.serviceStartDateSource).toBe("veteran");
}

function d16RawPeriod({ id, start, end, scope, sourceDocument, formType }) {
  return {
    id,
    serviceStartDate: start,
    serviceEndDate: end,
    periodScope: scope || null,
    formType,
    sourceDocument,
    confidence: 70,
    sources: [{ sourceDocument, formType }],
  };
}

// A profile already holding a stored 5-period state - built directly via
// saveServiceHistory, bypassing upsertServicePeriod's own (now-fixed)
// matching entirely, since routing this seed through the FIXED matching
// logic would just merge the phantom row away immediately instead of
// reproducing the pre-fix stored shape.
function seedD16FivePeriodState() {
  saveServiceHistory({
    deployments: [],
    awards: [],
    dd214Data: null,
    serviceInfo: null,
    servicePeriods: [
      d16RawPeriod({
        id: "d16-iadt",
        start: D16_IADT_START,
        end: D16_IADT_END,
        scope: "window",
        sourceDocument: D16_NGB22_FILE,
        formType: "NGB22",
      }),
      d16RawPeriod({
        id: "d16-ad2003",
        start: D16_AD2003_START,
        end: D16_AD2003_END,
        scope: "window",
        sourceDocument: D16_NGB22_FILE,
        formType: "NGB22",
      }),
      d16RawPeriod({
        id: "d16-coinciding",
        start: D16_PRIMARY_START,
        end: D16_PRIMARY_END,
        scope: "window",
        sourceDocument: D16_NGB22_FILE,
        formType: "NGB22",
      }),
      d16RawPeriod({
        id: "d16-primary",
        start: D16_PRIMARY_START,
        end: D16_PRIMARY_END,
        scope: null,
        sourceDocument: D16_NGB22_FILE,
        formType: "NGB22",
      }),
      // The pre-existing phantom: an old, buggy merge's near-date
      // code-sheet duplicate that never found its Box-18 window.
      d16RawPeriod({
        id: "d16-cs-near-dup",
        start: "2003-06-04",
        end: D16_AD2003_END,
        scope: null,
        sourceDocument: D16_CODESHEET_FILE,
        formType: "Code Sheet",
      }),
    ],
    unmatchedServiceRecords: [],
    dutyStations: [],
    documentPeriodCounts: { [D16_NGB22_FILE]: 4, [D16_CODESHEET_FILE]: 1 },
    schemaVersion: 4,
  });
}

// A brand-new document (never seen before, so it can't rely on pass 1's
// same-scope match the way the code-sheet re-import does) confirming the
// AD-2003 window a few days off how the NGB-22 itself dated it still has
// to merge cross-scope into that window, not create a 6th row - the
// specific gap a stored pre-fix profile still needs the fix for, post-
// upgrade. 2003-05-26 is deliberately within isSameServicePeriod's 7-day
// tolerance of the real window (2003-06-01, 6 days) but outside it for the
// pre-existing phantom (2003-06-04, 9 days), so it can only match the
// window, not the phantom.
async function d16IngestFollowupForAd2003Window() {
  await ingestServiceRecord({
    formType: "DD214",
    fileName: "dd214-ad2003-followup-d16-synthetic.pdf",
    serviceStartDate: "2003-05-26",
    serviceStartDateDerived: false,
    serviceEndDate: D16_AD2003_END,
  });
  expect(getServicePeriods()).toHaveLength(5);
  const ad2003Window = getServicePeriods().find((p) => p.id === "d16-ad2003");
  expect(ad2003Window.sources.map((s) => s.sourceDocument)).toContain(
    "dd214-ad2003-followup-d16-synthetic.pdf",
  );
}

// "Upgrade": loading/upgrading must never itself change the stored count -
// there is no migration that retroactively collapses pre-existing
// duplicates - and a subsequent re-import must not grow it further, since
// the fix's idempotency guarantee applies going forward.
//
// D16-5 (final16 QA re-review, 2026-09-29): "matches pre-regression
// (39d73d40) behaviour" is NOT a universal invariant to hold this fixture
// to - it only holds here because this fixture's phantom is a genuine
// duplicate (same document, same dates, nothing legitimately distinct
// about the two rows). For an NGB-22 whose Box-18 window EXACTLY
// coincides with its own 12a/12b primary (see
// musterCallProcessor.servicePeriodMerge.test.js's "Box-18 window
// demotion" suite), 39d73d40 demotes the primary into the window - one
// FEWER period and no entry timeline event, which is the exact bug
// final15's no-demotion rule exists to prevent. A future change (or
// verifier) that finds this fixture's counts diverge from
// 39d73d40-by-exactly-the-difference-above should treat that as a real
// regression; one that finds a genuinely coinciding-window fixture NOT
// diverge from 39d73d40 by +1 period/+1 event should treat THAT as the
// regression instead - matching pre-regression counts is the bug there,
// not the acceptance bar.
async function d16UpgradeFromStoredFivePeriodState() {
  seedD16FivePeriodState();
  await primeVkbSeparationDate();
  expect(getServiceHistory().servicePeriods).toHaveLength(5);

  // A later, unrelated re-import of the code sheet must not grow the count
  // further - only the fixture's own already-linked periods may absorb it.
  await ingestD16CodeSheet();
  expect(getServicePeriods()).toHaveLength(5);

  await d16IngestFollowupForAd2003Window();
}

describe("ADR-007: D16-1 regression guard - Box-18 code-sheet/DD-214 merges keep the period count and timeline count fixed", () => {
  it(
    "stays at 4 periods / 1 service-entry timeline event in the app's real import order",
    d16RealImportOrder,
  );
  it(
    "stays at 4 periods / 1 timeline event in the reverse import order",
    d16ReverseImportOrder,
  );
  it(
    "stays at 4 periods / 1 timeline event when every document is saved twice",
    d16EveryDocumentSavedTwice,
  );
  it(
    "stays at 4 periods / 1 timeline event on an unedited re-import after a veteran correction",
    d16ReimportAfterCorrection,
  );
  it(
    "upgrade from a stored 5-period state: loading and a subsequent re-import never change the count",
    d16UpgradeFromStoredFivePeriodState,
  );
});

// D16-1 QA re-review (final16, 2026-09-29): the "5-period state" fixture
// above is already POST-fix shaped (periodScope/sources fields populated
// on every row, including a pre-existing phantom this branch's fix would
// never itself produce). No DEPLOYED (main 0ed0fdd4) profile has ever had
// that shape - main never wrote periodScope OR sources at all. This seeds
// the REAL deployed shape instead: raw localStorage, bypassing both
// saveServiceHistory's save-time sanitize AND upsertServicePeriod's own
// (now-fixed) matching, so every period genuinely has no periodScope key
// and no sources key at all until the very first read seeds them
// (_seedSourcesIfMissing, `__seededSources: true`, one fabricated
// `sources` entry naming the NGB-22) - the exact shape
// _isSoleFreshSibling's `__seededSources` guard exists for.
function d16LegacyRawPeriod({ id, start, end, sourceDocument, formType }) {
  return {
    id,
    serviceStartDate: start,
    serviceEndDate: end,
    formType,
    sourceDocument,
    confidence: 70,
  };
}

function seedD16GenuineLegacyProductionShape() {
  localStorage.setItem(
    "vet_rate_service_history",
    JSON.stringify({
      deployments: [],
      awards: [],
      dd214Data: null,
      serviceInfo: null,
      servicePeriods: [
        d16LegacyRawPeriod({
          id: "legacy-primary",
          start: D16_PRIMARY_START,
          end: D16_PRIMARY_END,
          sourceDocument: D16_NGB22_FILE,
          formType: "NGB22",
        }),
        d16LegacyRawPeriod({
          id: "legacy-iadt",
          start: D16_IADT_START,
          end: D16_IADT_END,
          sourceDocument: D16_NGB22_FILE,
          formType: "NGB22",
        }),
        d16LegacyRawPeriod({
          id: "legacy-ad2003",
          start: D16_AD2003_START,
          end: D16_AD2003_END,
          sourceDocument: D16_NGB22_FILE,
          formType: "NGB22",
        }),
      ],
      unmatchedServiceRecords: [],
      dutyStations: [],
      documentPeriodCounts: {},
      schemaVersion: 4,
    }),
  );
}

async function d16UpgradeFromGenuineLegacyShape() {
  seedD16GenuineLegacyProductionShape();
  await primeVkbSeparationDate();
  expect(getServiceHistory().servicePeriods).toHaveLength(3);

  // Re-running Formation on the SAME NGB-22 + code sheet a real deployed
  // veteran already had saved must self-heal the missing periodScope on
  // BOTH pre-existing windows, not just the first one processed (D16-1's
  // own re-review gap: a save after the first window's own upsert
  // re-sanitizes every OTHER still-legacy row too, before its own turn to
  // be matched ever comes) - and it must not fork a phantom sibling for
  // either window, or move the resolved entry date onto a window's own
  // start (the exact symptom every consumer agreed on in the reviewer's
  // repro). The NGB-22's own THIRD, coinciding-with-primary window is
  // deliberately excluded from this legacy seed (no deployed profile
  // could have one merged into its primary - final15's demotion fix
  // predates any release) and correctly always earns its own new row.
  await ingestD16Ngb22();
  await ingestD16CodeSheet();

  expect(getServicePeriods()).toHaveLength(4);
  expect(
    getServicePeriods().filter((p) => p.periodScope === "window"),
  ).toHaveLength(3);

  // The entry stays the primary's own date - never a window's (the exact
  // symptom the reviewer's repro found: the resolved date moving onto a
  // Box-18 IADT window's start). The code sheet's own entry for these same
  // dates legitimately re-confirms the primary at a higher-ranked source
  // (code_sheet outranks printed) - a real, intentional promotion, not a
  // regression.
  const entry = getServiceEntry();
  expect(entry.date).toBe(D16_PRIMARY_START);
  expect(entry.source).toBe("code_sheet");
}

// D16-3 (final16 QA re-review, 2026-09-29): My Packet's Service tab lists
// and edits every period, windows included (getVeteranProfile returns all
// servicePeriods). Correcting a WINDOW's start by more than
// isSameServicePeriod's 7-day tolerance used to strand its own code
// sheet/DD-214 re-import: _findCorrectionAliasIndex was scope-gated
// (window vs the incoming non-window record), so a later re-save of that
// exact same code sheet/DD-214 could never re-find the corrected window
// through startDateCorrection.documentDate, and instead created a
// brand-new, non-window phantom period at the ORIGINAL (pre-correction)
// date - which then counted as its own enlistment and re-asserted the
// very date the veteran corrected away.
async function d16CorrectWindowThenReimport() {
  await ingestD16Ngb22();
  await ingestD16CodeSheet();
  await ingestD16Dd214ForWindow();
  await primeVkbSeparationDate();

  const periods = getServicePeriods();
  const windowIdx = periods.findIndex(
    (p) => p.periodScope === "window" && p.serviceStartDate === D16_IADT_START,
  );
  expect(windowIdx).toBeGreaterThanOrEqual(0);
  const windowId = periods[windowIdx].id;

  // More than isSameServicePeriod's 7-day tolerance away from
  // D16_IADT_START ("2000-06-01").
  _updateServicePeriodField(
    { servicePeriods: periods },
    () => {},
    windowIdx,
    "serviceStartDate",
    "2000-05-01",
  );

  await ingestD16CodeSheet();
  await ingestD16Dd214ForWindow();

  expect(getServicePeriods()).toHaveLength(4);
  const correctedWindow = getServicePeriods().find((p) => p.id === windowId);
  expect(correctedWindow).toBeDefined();
  expect(correctedWindow.serviceStartDate).toBe("2000-05-01");
  expect(correctedWindow.serviceStartDateSource).toBe("veteran");
  expect(correctedWindow.periodScope).toBe("window");
}

describe("ADR-007: D16-1/D16-3 QA re-review fixes - genuinely legacy data and a corrected window survive re-import", () => {
  it(
    "D16-1: a genuinely legacy (main-era, no periodScope/sources) profile self-heals instead of forking a phantom",
    d16UpgradeFromGenuineLegacyShape,
  );
  it(
    "D16-3: re-saving a corrected window's own code sheet/DD-214 never creates a phantom period at the pre-correction date",
    d16CorrectWindowThenReimport,
  );
});
