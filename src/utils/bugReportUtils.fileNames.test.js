/* eslint-disable no-console -- the interceptor under test wraps the console methods */
/**
 * D21 (decision F): after an import the bug report still carried the last
 * four digits and, before the profile knew the name, the surname - both from
 * file names. Anything shaped like a file name is replaced with a neutral token
 * before it is stored, with no known value needed. Every test runs on a
 * brand-new profile (nothing known). Fixture names are synthetic.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

vi.mock("./veteranProfile", () => ({ getVeteranProfile: () => ({}) }));

const {
  initializeErrorCapture,
  getConsoleErrors,
  logConsoleError,
  formatBugReport,
} = await import("./bugReportUtils.js");
const { redactFileNames } = await import("./piiScrubber.js");

const STORAGE_KEY = "vet_rate_console_logs";
const realConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
};
const rawStored = () => sessionStorage.getItem(STORAGE_KEY) || "";

const FILE_NAMES = [
  "Faketon_Jordan_6789.pdf",
  "Faketon Jordan DD214 6789.PDF",
  "scan-6789-faketon.jpeg",
  "C:\\Users\\Jordan Faketon\\Documents\\dd214 6789.pdf",
  "/home/jordan faketon/records/6789.png",
  "faketon.docx",
];

function expectNoIdentifier(text) {
  expect(text).not.toMatch(/faketon/i);
  expect(text).not.toContain("6789");
}

beforeAll(() => {
  initializeErrorCapture();
});

afterAll(() => {
  Object.assign(console, realConsole);
});

beforeEach(() => {
  sessionStorage.clear();
});

describe("redactFileNames", () => {
  it.each(FILE_NAMES)("replaces %s with a neutral token", (name) => {
    const out = redactFileNames(`Could not read ${name} (page 2)`);
    expectNoIdentifier(out);
    expect(out).toContain("[file name]");
    expect(out).toContain("(page 2)");
  });

  it.each([
    "Failed to load module chunk-abc.js",
    "fetch /data/disabilityData.json failed",
    "at http://localhost:5173/src/components/DD214Analyzer.jsx:12:3",
    "page 6789 of 12 loaded",
  ])("leaves %j alone", (line) => {
    expect(redactFileNames(line)).toBe(line);
  });

  it("stays fast on long input with no extension", () => {
    const started = Date.now();
    redactFileNames("a ".repeat(10000) + "x/".repeat(5000));
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("console interceptor: file names never reach storage or a report", () => {
  it.each(FILE_NAMES)("console.error with %s", (name) => {
    console.error(`Failed to process ${name}: parse error`);

    expectNoIdentifier(rawStored());
    expectNoIdentifier(JSON.stringify(getConsoleErrors()));
    expect(getConsoleErrors()[0].message).toContain("parse error");
  });

  it("console.warn, a keyword console.log and the stack/url of a logged entry", () => {
    console.warn("Skipping Faketon_Jordan_6789.pdf");
    console.log("import failed for Faketon Jordan DD214 6789.pdf");
    logConsoleError({
      type: "error",
      message: "boom",
      stack: "Error: boom\n    at read (Faketon_Jordan_6789.pdf:1:1)",
      url: "https://example.test/files/Faketon_Jordan_6789.pdf",
    });

    expect(getConsoleErrors()).toHaveLength(3);
    expectNoIdentifier(rawStored());
    expectNoIdentifier(JSON.stringify(getConsoleErrors()));
  });

  it("cleans an entry stored before this scrubber existed, on read", () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          type: "error",
          message: "old line Faketon_Jordan_6789.pdf",
          stack: null,
          url: "https://example.test/",
        },
      ]),
    );

    expectNoIdentifier(JSON.stringify(getConsoleErrors()));
  });

  it("formatBugReport cleans console lines, the app error and the veteran's own text", () => {
    const report = formatBugReport({
      userDescription: "Import of Faketon_Jordan_6789.pdf hung",
      stepsToReproduce: "1. drop C:\\scans\\Faketon 6789.pdf",
      expectedBehavior: "ok",
      actualBehavior: "stuck",
      additionalContext: "file faketon.docx",
      module: "DD214Analyzer",
      severity: { emoji: "x", label: "Low" },
      category: "Bug",
      systemInfo: {},
      appState: {
        currentView: "v",
        searchTerm: "(none)",
        resultCount: 0,
        activeModals: [],
        selectedCondition: null,
        userConditionsCount: 0,
        nexusBuilderActive: false,
        nexusBuilderCondition: null,
        hasError: true,
        errorMessage: "Cannot read Faketon_Jordan_6789.pdf",
      },
      storageInfo: { localStorageAvailable: false, error: "n/a" },
      consoleErrors: [
        {
          type: "error",
          timestamp: "t",
          message: "bad Faketon_Jordan_6789.pdf",
          url: "https://example.test/Faketon_Jordan_6789.pdf",
          stack: "at Faketon_Jordan_6789.pdf:1:1",
        },
        { type: "log", timestamp: "t", message: "ok faketon.docx" },
      ],
    });

    expectNoIdentifier(report);
    expect(report).toContain("[file name]");
  });
});
