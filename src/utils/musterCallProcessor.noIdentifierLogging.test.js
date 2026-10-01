/**
 * D20-4: an import logged the profile updates (name, file number, full SSN)
 * and other parsed values to the browser console, where bug reports and
 * screenshots capture them. Running a real import of a generic DD-214
 * fixture through processFormationDocument (extraction is the only fake)
 * must write no fixture identifier and no document text to any console
 * method; counts and field names are fine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { inspect } from "node:util";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./documentAnalyzer", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

const { analyzeDocument } = await import("./documentAnalyzer");
const { processFormationDocument, extractIntelligenceBriefingData } =
  await import("./musterCallProcessor");

const SECRETS = [
  "QUILLFEATHER",
  "ZEPHANIA",
  "987-65-4321",
  "987 65 4321",
  "987654321",
  "C 55443322",
  "55443322",
  "SPRINGFIELDTOWN",
  "ZXQ-MARKER-9981",
];

const DD214_TEXT = `
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (LAST, FIRST, MIDDLE): QUILLFEATHER, ZEPHANIA MORTIMER
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
3. SOCIAL SECURITY NUMBER: 987-65-4321
4A. GRADE, RATE OR RANK: SGT
5. DATE OF BIRTH: 1971 02 03
7B. HOME OF RECORD AT TIME OF ENTRY: SPRINGFIELDTOWN, ST
11. PRIMARY SPECIALTY: 11B INFANTRYMAN
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
VA FILE NUMBER: C 55443322
24. CHARACTER OF SERVICE: HONORABLE
18. REMARKS: ZXQ-MARKER-9981 generic remark text
`;

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"];

function loggedText(spies) {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map((a) => inspect(a, { depth: 8 })).join(" "))
    .join("\n");
}

function expectNoSecrets(output) {
  for (const secret of SECRETS) {
    expect(output, `console output contains "${secret}"`).not.toContain(secret);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  analyzeDocument.mockResolvedValue({
    text: DD214_TEXT,
    pageCount: 1,
    method: "text",
    ocrUsed: false,
  });
});

describe("a real import writes no identifier or document text to the console", () => {
  it("processFormationDocument (extraction, parsing, saving, profile auto-fill)", async () => {
    const spies = CONSOLE_METHODS.map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const file = new File([DD214_TEXT], "dd214-generic.pdf", {
      type: "application/pdf",
    });

    const result = await processFormationDocument(file, () => {});

    expect(result.status).toBe("complete");
    expect(result.extractedData?.type).toBe("service_record");
    expect(JSON.stringify(result.extractedData)).toContain("QUILLFEATHER");

    const output = loggedText(spies);
    expect(output.length).toBeGreaterThan(0);
    expectNoSecrets(output);
  });

  it("extractIntelligenceBriefingData", async () => {
    const spies = CONSOLE_METHODS.map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    extractIntelligenceBriefingData([
      {
        status: "complete",
        filename: "dd214-generic.pdf",
        extractedData: {
          type: "service_record",
          veteranName: "QUILLFEATHER, ZEPHANIA MORTIMER",
          ssn: "987-65-4321",
          fullName: "QUILLFEATHER, ZEPHANIA MORTIMER",
          branch: "Army",
          0: { branch: "Army" },
        },
      },
    ]);
    expectNoSecrets(loggedText(spies));
  });
});
