/* eslint-disable no-console -- the interceptor under test wraps the console methods */
/**
 * A file name with no extension, or with one nobody listed, carries no shape the
 * scrubber can spot. Every file the veteran drops or picks is remembered by name
 * for the session, so any later console line or report that mentions it is
 * cleaned whatever the name looks like. Every test runs on a brand-new profile.
 * Fixture names are synthetic.
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

vi.mock("./veteranProfile", () => ({
  readVeteranProfileQuiet: () => ({
    status: "absent",
    ok: true,
    profile: {},
    raw: null,
    code: null,
  }),
}));

const { initializeErrorCapture, getConsoleErrors, formatBugReport } =
  await import("./bugReportUtils.js");

const STORAGE_KEY = "vet_rate_console_logs";
const realConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
};
const rawStored = () => sessionStorage.getItem(STORAGE_KEY) || "";

function drop(...names) {
  const event = new Event("drop", { bubbles: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { files: names.map((name) => new File(["x"], name)) },
  });
  document.body.dispatchEvent(event);
}

function pick(...names) {
  const input = document.createElement("input");
  input.type = "file";
  Object.defineProperty(input, "files", {
    value: names.map((name) => new File(["x"], name)),
  });
  document.body.appendChild(input);
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.remove();
}

const expectClean = (text) => {
  expect(text).not.toMatch(/faketon/i);
  expect(text).not.toContain("6789");
};

beforeAll(() => {
  initializeErrorCapture();
});

afterAll(() => {
  Object.assign(console, realConsole);
});

beforeEach(() => {
  sessionStorage.clear();
});

describe("a dropped or picked file name is cleaned wherever it is logged", () => {
  it.each(["Faketon_6789", "Faketon_6789.pdf2", "Faketon 6789.unknownext"])(
    "drop of %s",
    (name) => {
      drop(name);
      console.error(`Failed to process ${name}: parse error`);
      expectClean(rawStored());
      expectClean(JSON.stringify(getConsoleErrors()));
      expect(getConsoleErrors()[0].message).toContain("parse error");
    },
  );

  it("file picker", () => {
    pick("Faketon_6789.weird");
    console.warn("Skipping Faketon_6789.weird");
    expectClean(rawStored());
    expect(getConsoleErrors()[0].message).toContain("[file name]");
  });

  it("the report text, including what the veteran typed", () => {
    drop("Faketon_6789.zzz");
    const report = formatBugReport({
      userDescription: "Faketon_6789.zzz would not upload",
      stepsToReproduce: "",
      expectedBehavior: "",
      actualBehavior: "",
      additionalContext: "",
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
        hasError: false,
        errorMessage: null,
      },
      storageInfo: { localStorageAvailable: false, error: "n/a" },
      consoleErrors: [],
    });
    expectClean(report);
    expect(report).toContain("[file name]");
  });
});

describe("a name that was never dropped is left alone", () => {
  it("keeps an ordinary log line intact", () => {
    drop("Faketon_6789.zzz");
    console.error("Failed to load the rating table");
    expect(getConsoleErrors()[0].message).toBe(
      "Failed to load the rating table",
    );
  });
});
