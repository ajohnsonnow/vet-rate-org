/**
 * D22-3: a hostile model puts a name, a birth date, an SSN-shaped string, a
 * city and ZIP and prompt placeholders into every key of the DD-214 schema.
 * Through the real parse, merge, import dialog and the three stores, nothing
 * identifier-bearing may be displayed, pre-ticked or written, on a fresh
 * profile and on one that already holds the veteran's identifiers in the
 * profile, the knowledge base or My Packet. Fixture values are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));
const stores = vi.hoisted(() => ({
  addDocumentToVKB: vi.fn(),
  mergeDD214IntoVKB: vi.fn(),
  saveDocumentToPacket: vi.fn(),
  loadVKB: vi.fn(),
  getAllExtractedData: vi.fn(),
}));
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  addDocumentToVKB: stores.addDocumentToVKB,
  mergeDD214IntoVKB: stores.mergeDD214IntoVKB,
  saveVKB: vi.fn().mockResolvedValue(undefined),
  loadVKB: stores.loadVKB,
}));
vi.mock("../utils/myPacketManager", async (importOriginal) => ({
  ...(await importOriginal()),
  saveDocumentToPacket: stores.saveDocumentToPacket,
  getAllExtractedData: stores.getAllExtractedData,
}));

const { default: ProfileImportConfirmModal } =
  await import("./ProfileImportConfirmModal.jsx");
const {
  _parseDd214Json,
  _applyRegexSafetyNet,
  _prepareAndShowProfileImport,
  _saveDd214ToProfile,
  _saveDd214ToVkb,
  _saveDd214ToPacket,
} = await import("./DD214Analyzer.jsx");
const { loadKnownIdentifierSources } =
  await import("../utils/dd214KnownIdentifierSources");
const { dateKeys } = await import("../utils/dd214EnumeratedFields");
const { sourcesForImportRows } = await import("../utils/dd214ValueSources");

const t = () => "parse error";
const NAME = "Zorblax Quindle";
const DOB = "1984-03-15";
const SSN = "123-45-6789";
const PLACE = "Springfield, IL 62704";
const LEAK = /zorblax|quindle|springfield|62704|123-45-6789|123456789/i;
const KNOWN_LEAK = /vexroth|plumbly/i;
const noKnownName = /^$/;

const NO_BOXES_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
`;
const PARSER_DOB_TEXT = `${NO_BOXES_TEXT}
1. NAME: FAKETON, JORDAN
3. SOCIAL SECURITY: 987 65 4321
5. DATE OF BIRTH: 1984 03 15
`;

const HOSTILE_MODEL = {
  documentCount: 1,
  documentTypes: [NAME, "DD214"],
  masterRecordDate: DOB,
  masterRecordType: NAME,
  component: NAME,
  componentFull: NAME,
  branch: NAME,
  rank: NAME,
  payGrade: NAME,
  dateOfRank: DOB,
  mos: NAME,
  mosTitle: `SGT ${NAME}`,
  lastDutyAssignment: `${NAME}, ${PLACE}`,
  commandTransferredTo: `Reports to ${NAME} at ${PLACE}`,
  sglCoverage: NAME,
  entryDate: "19840315",
  separationDate: "03/15/1984",
  netActiveService: { years: NAME, months: SSN, days: PLACE },
  totalPriorActiveService: { years: 0, months: 0, days: NAME },
  totalPriorInactiveService: NAME,
  yearsService: NAME,
  monthsService: SSN,
  daysService: PLACE,
  reserveObligationDate: DOB,
  daysLost: NAME,
  foreignService: NAME,
  foreignServiceDetails: `Lived with ${NAME} in ${PLACE}, SSN ${SSN}`,
  seaService: { years: NAME },
  militaryEducation: [`Course taught by SGT ${NAME}`, "Quindle, Zorblax A"],
  separationAuthority: NAME,
  separationCode: NAME,
  separationProgramDesignator: NAME,
  reentryCode: NAME,
  separationType: NAME,
  characterOfService: NAME,
  narrativeReason: `Separated at the request of ${NAME}, ${PLACE}`,
  giBlStatus: NAME,
  memberRequests: `Requested ${NAME} as counsel, mother Zorblax A. Quindle, ward Vexroth`,
  awards: [
    {
      name: `Medal of ${NAME}`,
      abbreviation: NAME,
      sourceDocument: "Quindle_Zorblax_DD214.pdf",
      devices: [NAME],
    },
  ],
  combatService: {
    hasVerifiedCombat: true,
    indicators: [`SGT ${NAME}`],
    deployments: [PLACE],
  },
  specialQualifications: [`${NAME} Award`],
  securityClearance: NAME,
  reenlisted: NAME,
  dd214Count: NAME,
  extractionNotes: [`${NAME} ${SSN}`, "number", "Unit and major command"],
};

const SCENARIOS = [
  {
    label: "fresh profile, birth date read only by the local parser",
    text: PARSER_DOB_TEXT,
    profile: {},
    vkbPersonal: {},
    packet: [],
  },
  {
    label: "birth date and name only in the saved profile",
    text: NO_BOXES_TEXT,
    profile: { dateOfBirth: "03/15/1984", fullName: "Vexroth Plumbly" },
    knownName: KNOWN_LEAK,
    vkbPersonal: {},
    packet: [],
  },
  {
    label: "birth date only in the knowledge base",
    text: NO_BOXES_TEXT,
    profile: {},
    vkbPersonal: { dateOfBirth: DOB },
    packet: [],
  },
  {
    label: "birth date only in a My Packet document",
    text: NO_BOXES_TEXT,
    profile: {},
    vkbPersonal: {},
    packet: [{ extractedData: { dateOfBirth: "15 Mar 1984" } }],
  },
];

const SERVICE_DATE_KEYS = [
  "masterRecordDate",
  "dateOfRank",
  "entryDate",
  "separationDate",
  "reserveObligationDate",
];

async function analyse({ text, profile, vkbPersonal, packet }) {
  localStorage.clear();
  localStorage.setItem("vet_rate_veteran_profile", JSON.stringify(profile));
  stores.loadVKB.mockResolvedValue({ personal: vkbPersonal });
  stores.getAllExtractedData.mockResolvedValue({ dd214s: packet });
  const sources = await loadKnownIdentifierSources();
  const parsed = _parseDd214Json(JSON.stringify(HOSTILE_MODEL), t, sources);
  let analysis;
  _applyRegexSafetyNet(
    parsed,
    text,
    (value) => {
      analysis = value;
    },
    sources,
  );
  return analysis;
}

function openDialog(analysis) {
  let importData;
  _prepareAndShowProfileImport(
    analysis,
    (data) => {
      importData = data;
    },
    () => {},
  );
  const onConfirm = vi.fn();
  render(
    <ProfileImportConfirmModal
      extractedData={importData}
      fieldSources={sourcesForImportRows(analysis.fieldSources, importData)}
      currentProfile={{}}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return { importData, onConfirm };
}

// The test shim keeps data in a closed-over Map, so spreading localStorage
// yields only its methods; read every key through the Storage API.
const dumpLocalStorage = () =>
  JSON.stringify(
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, i) => {
        const key = localStorage.key(i);
        return [key, localStorage.getItem(key)];
      }),
    ),
  );

const shownText = () =>
  [
    document.body.textContent,
    ...screen.getAllByRole("textbox").map((input) => input.value),
  ].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  stores.addDocumentToVKB.mockResolvedValue({
    success: true,
    documentId: "d1",
  });
  stores.saveDocumentToPacket.mockResolvedValue({ success: true });
});

describe.each(SCENARIOS)("hostile model output: $label", (scenario) => {
  it("shows and pre-ticks nothing identifier-bearing", async () => {
    const analysis = await analyse(scenario);
    expect(JSON.stringify(analysis)).not.toMatch(LEAK);
    expect(JSON.stringify(analysis)).not.toMatch(
      scenario.knownName ?? noKnownName,
    );
    for (const key of SERVICE_DATE_KEYS) {
      const keys = dateKeys(String(analysis[key] ?? ""));
      expect(keys).not.toContain(DOB);
    }

    const { onConfirm } = openDialog(analysis);
    expect(shownText()).not.toMatch(LEAK);
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    const preTicked = Object.keys(onConfirm.mock.calls[0][0]);
    for (const key of [
      "lastDutyAssignment",
      "commandTransferredTo",
      "mosTitle",
      "militaryEducation",
      "specialQualifications",
      "narrativeReason",
      "memberRequests",
      "foreignServiceDetails",
    ]) {
      expect(preTicked).not.toContain(key);
    }
  });

  it("writes nothing identifier-bearing after tick-all and Import", async () => {
    const analysis = await analyse(scenario);
    const { onConfirm } = openDialog(analysis);
    fireEvent.click(screen.getByRole("button", { name: /Select All/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Import Selected Fields/ }),
    );
    const [fields, meta] = onConfirm.mock.calls[0];

    _saveDd214ToProfile(analysis, scenario.text, fields, meta, []);
    await _saveDd214ToVkb(analysis, scenario.text, [], fields);
    await _saveDd214ToPacket(analysis, scenario.text, [], fields);

    const storage = dumpLocalStorage();
    expect(storage).toContain("vet_rate_veteran_profile");
    const stored = JSON.stringify({
      vkb: [
        stores.addDocumentToVKB.mock.calls,
        stores.mergeDD214IntoVKB.mock.calls,
      ],
      packet: stores.saveDocumentToPacket.mock.calls,
    });
    expect(storage).not.toMatch(LEAK);
    expect(stored).not.toMatch(LEAK);
    expect(stored).not.toMatch(scenario.knownName ?? noKnownName);
    expect(stores.saveDocumentToPacket).toHaveBeenCalled();
    expect(stores.addDocumentToVKB).toHaveBeenCalled();
  });
});
