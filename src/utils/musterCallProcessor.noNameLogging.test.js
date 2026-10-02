/**
 * Multi-DD-214 selection and the short-first-name warning used to write the
 * veteran's surname, first name and the file name to the console. Runs a real
 * import (extraction is the only fake) and fails if any of them appears in any
 * console method.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeIndexedDB } from "../__tests__/helpers/fakeIndexedDB";
import { inspect } from "node:util";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

// Saving is part of every import now: without a store the document is reported
// as not saved, so these extraction tests give it a working one.
vi.stubGlobal("indexedDB", createFakeIndexedDB().indexedDB);

vi.mock("./documentAnalyzer", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

const { analyzeDocument } = await import("./documentAnalyzer");
const { processFormationDocument } = await import("./musterCallProcessor");

const SECRETS = ["QUILLFEATHER", "ZQ", "FILENAMEMARKER", "ZXQ-MARKER-9981"];

const page = (n, first) => `--- PAGE ${n} ---
DD FORM 214 CERTIFICATE OF RELEASE OR DISCHARGE FROM ACTIVE DUTY
1. NAME (LAST, FIRST, MIDDLE):
QUILLFEATHER, ${first} MORTIMER
2. DEPARTMENT, COMPONENT AND BRANCH: ARMY/ACTIVE
4A. GRADE, RATE OR RANK: SGT
12A. DATE ENTERED ACTIVE DUTY THIS PERIOD: 20020305
12B. SEPARATION DATE THIS PERIOD: 20100615
24. CHARACTER OF SERVICE: HONORABLE
18. REMARKS: ZXQ-MARKER-9981
`;

function spyAll() {
  return ["log", "info", "warn", "error", "debug"].map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
}

function loggedText(spies) {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map((a) => inspect(a, { depth: 8 })).join(" "))
    .join("\n");
}

async function runImport(text) {
  analyzeDocument.mockResolvedValue({
    text,
    pageCount: 2,
    method: "text",
    ocrUsed: false,
  });
  const spies = spyAll();
  const file = new File(["x"], "QUILLFEATHER-FILENAMEMARKER-dd214.pdf", {
    type: "application/pdf",
  });
  const result = await processFormationDocument(file, () => {});
  return { result, output: loggedText(spies) };
}

function expectNoSecrets(output) {
  for (const secret of SECRETS) {
    expect(output, `console output contains "${secret}"`).not.toContain(secret);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("name-bearing console logs", () => {
  it("multi-DD214 selection logs no surname or file name", async () => {
    const { result, output } = await runImport(
      page(1, "ZEPHANIA") + page(2, "ZEPHANIA"),
    );
    expect(result.status).toBe("complete");
    expect(output).toContain("Multiple DD214s found");
    expectNoSecrets(output);
  });

  it("the short-first-name warning does not print the first name", async () => {
    const { result, output } = await runImport(page(1, "ZQ"));
    expect(result.status).toBe("complete");
    expect(output).toContain("Short first name detected");
    expectNoSecrets(output);
  });
});
