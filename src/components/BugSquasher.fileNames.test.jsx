/**
 * Decision (F): no identifier inside a file name leaves the report. The formatted
 * report was already cleaned; the copy stored in My Tickets and the fields posted
 * off-device took the veteran's own text and the app error straight from the
 * form. Both sinks are exercised with the real report builders; only storage and
 * the network are faked. Fixture names are synthetic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const storage = vi.hoisted(() => ({
  saveBugReport: vi.fn(),
  saveToLocalStorage: vi.fn(),
}));
vi.mock("../utils/bugReportStorage", () => storage);
vi.mock("../utils/veteranProfile", () => ({ getVeteranProfile: () => ({}) }));

const { _saveBugReportLocally, _sendBugReportRemote } =
  await import("./BugSquasher.jsx");

const NAME = "Faketon_John_6789.pdf";
const formData = {
  severity: { value: "low", label: "Low" },
  category: "Bug",
  module: "DD214Analyzer",
  diagnosticCode: "",
  userDescription: `${NAME} would not upload`,
  stepsToReproduce: `1. drop C:\\scans\\${NAME}`,
  expectedBehavior: `${NAME} reads`,
  actualBehavior: `error on ${NAME}`,
  additionalContext: `file ${NAME}`,
  includeSystemInfo: false,
  includeAppState: true,
  includeStorageInfo: false,
  includeConsoleErrors: false,
  veteranEmail: "",
};
const appState = { error: `Cannot read ${NAME}` };

const clean = (value) => {
  const text = JSON.stringify(value);
  expect(text).not.toMatch(/faketon/i);
  expect(text).not.toContain("6789");
};

beforeEach(() => {
  vi.clearAllMocks();
  storage.saveBugReport.mockResolvedValue(undefined);
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
});

describe("the copy stored in My Tickets", () => {
  it("has no file name in the veteran's text or the app error", async () => {
    await _saveBugReportLocally("BUG-1", formData, appState);
    const saved = storage.saveBugReport.mock.calls[0][0];
    clean(saved);
    expect(saved.userDescription).toContain("would not upload");
    expect(saved.appState.errorMessage).toContain("[file name]");
  });

  it("has none in the localStorage fallback either", async () => {
    storage.saveBugReport.mockRejectedValue(new Error("no IndexedDB"));
    await _saveBugReportLocally("BUG-1", formData, appState);
    const saved = storage.saveToLocalStorage.mock.calls[0][0];
    clean(saved);
    expect(saved.userDescription).toContain("would not upload");
  });
});

describe("the report posted off-device", () => {
  it("has no file name in any field", async () => {
    await _sendBugReportRemote("BUG-1", formData, "formatted report");
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    clean(body);
    expect(body.description).toContain("would not upload");
  });
});
