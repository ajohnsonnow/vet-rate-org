/**
 * ADR-007 end-to-end consistency check: a correction applied through ANY of
 * the real editors (VKB viewer, My Packet's Service tab, FormsHelper,
 * Muster Call's Verify & Save) reaches the SAME canonical period, and every
 * downstream consumer (the AI system prompt, the VKB projection - top-level
 * fields/period row/timeline event/LLM context - getVeteranAIContext, the
 * dossier, the Service tab summary, the duty-stations label, the flat
 * profile mirror, dd214Data, FormsHelper's own prefill, and the My Packet
 * AI-context "Entry:" line) agrees with it, both mid-chain and after a
 * later, disagreeing document import or an unedited re-import. Fixture
 * values are synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  persistFormationDocument: vi.fn().mockResolvedValue(undefined),
  autoPopulateProfile: vi.fn().mockResolvedValue(undefined),
  parseServiceRecord: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

// The VKB harness (§13 pattern): loadVKB/saveVKB route through the REAL
// _applyServiceEntryProjection against a module-level store, so every
// consumer below sees the true projection engine, not a hand-built fixture.
let store = null;
vi.mock("../utils/veteranKnowledgeBase.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadVKB: vi.fn(async () =>
      actual._applyServiceEntryProjection(
        structuredClone(store ?? actual.initializeVKB()),
      ),
    ),
    saveVKB: vi.fn(async (vkb) => {
      await actual._applyServiceEntryProjection(vkb);
      store = structuredClone(vkb);
      return { success: true };
    }),
  };
});

const {
  upsertServicePeriod,
  setServiceEntryDate,
  getServiceEntry,
  getServicePeriods,
  getServiceHistory,
  getVeteranProfile,
  summarizeServicePeriods,
} = await import("../utils/veteranProfile.js");
const { loadVKB, saveVKB, generateLLMContext } =
  await import("../utils/veteranKnowledgeBase.js");
const { getVeteranAIContext } =
  await import("../utils/veteranContextProvider.js");
const { buildSystemPrompt } = await import("../utils/aiSystemPrompts.js");
const { generateDossierHTML } = await import("../utils/dossierExport.js");
const { _formatServiceRecordBasics } =
  await import("../utils/myPacketManager.js");
const { formatPeriodLabel } =
  await import("../components/DutyStationsSection.jsx");
const { saveVkbViewerEdits } = await import("../components/VKBViewer.jsx");
const { _updateServicePeriodField } =
  await import("../components/MyPacket.jsx");
const { buildFormsHelperPrefillDefaults } =
  await import("../components/FormsHelper.jsx");
const { _saveDd214ToProfile } = await import("../components/DD214Analyzer.jsx");
const { persistVerifiedDocument } =
  await import("../hooks/useSequentialFormationFlow.js");

const PROFILE_KEY = "vet_rate_veteran_profile";
const NGB22_FILE = "ngb22-synthetic.pdf";
const END_DATE = "2010-06-15";
const t = (...keys) => keys.join(".");

function seedNgb22() {
  return upsertServicePeriod(
    {
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
      serviceEndDate: END_DATE,
      formType: "NGB22",
      branch: "Army National Guard",
    },
    { sourceDocument: NGB22_FILE, confidence: 60 },
  );
}

beforeEach(() => {
  localStorage.clear();
  store = null;
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
      size: 100,
      extractedData: {
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

function assertProfileAndPeriodConsumers(expected, entry, period) {
  expect(period.serviceStartDate).toBe(expected.date);
  expect(period.serviceStartDateDerived).toBe(expected.derived);

  const summary = summarizeServicePeriods(getServicePeriods());
  expect(summary.serviceSpan).toMatchObject({
    start: expected.date,
    startDerived: expected.derived,
    startSource: expected.source,
  });

  const label = formatPeriodLabel(period, t);
  expect(label).toContain(expected.date);
  expect(label.includes("myPacketSection.calculatedFromNetService")).toBe(
    expected.derived,
  );

  const profile = getVeteranProfile();
  expect(profile.serviceStartDate).toBe(expected.date);
  expect(profile.serviceStartDateDerived).toBe(expected.derived);

  const basics = _formatServiceRecordBasics(
    { serviceStartDate: "2002-03-05" },
    NGB22_FILE,
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

async function assertConsistent(expected, { checkDd214 = false } = {}) {
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
  assertProfileAndPeriodConsumers(expected, entry, period);
  await assertVkbConsumers(expected, entry);

  if (checkDd214) {
    expect(getServiceHistory().dd214Data?.entryDate).toBe(expected.date);
  }
}

describe("ADR-007: service entry date consistency across all editors and consumers", () => {
  it("stays consistent through VKB viewer, My Packet, FormsHelper, Muster Call re-verify, a disagreeing DD-214 import, and an unedited re-import", async () => {
    seedNgb22();
    await primeVkbSeparationDate();
    await assertConsistent({
      date: "2002-03-05",
      derived: true,
      source: "calculated",
    });

    await correctViaVkbViewer("2002-02-10");
    await assertConsistent({
      date: "2002-02-10",
      derived: false,
      source: "veteran",
    });

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

    // An UNEDITED re-import of the ORIGINAL calculated NGB-22 must not
    // silently regress the veteran's correction either (re-import
    // idempotence).
    seedNgb22();
    await assertConsistent(
      { date: "2002-02-25", derived: false, source: "veteran" },
      { checkDd214: true },
    );
  });
});
