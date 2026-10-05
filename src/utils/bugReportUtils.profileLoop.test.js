/* eslint-disable no-console -- the interceptor under test wraps the console methods */
/**
 * D24-1: a saved profile that cannot be read froze the tab. The console
 * capture read the profile on every captured line, the failed read logged an
 * error, the capture read the profile again: 786,391 identical errors in 20
 * minutes. These tests run the real capture against the real profile reader
 * with a profile that cannot be read, in each way it can fail.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const PROFILE_KEY = "vet_rate_veteran_profile";
const LOG_KEY = "vet_rate_console_logs";
const SSN = "512-34-9876";

const UNREADABLE = [
  [
    "a value that is not JSON",
    () => localStorage.setItem(PROFILE_KEY, "{oops"),
  ],
  [
    "a JSON value of the wrong type (number)",
    () => localStorage.setItem(PROFILE_KEY, "5"),
  ],
  [
    "a JSON value of the wrong type (array)",
    () => localStorage.setItem(PROFILE_KEY, "[1]"),
  ],
  ["a JSON null", () => localStorage.setItem(PROFILE_KEY, "null")],
  [
    "a storage whose getter throws",
    () =>
      vi.spyOn(localStorage, "getItem").mockImplementation((key) => {
        if (key === PROFILE_KEY) throw new Error("denied");
        return null;
      }),
  ],
];

let sink;
let capture;
let profileModule;

const storedLogs = () => JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");

async function bootCapture(breakProfile) {
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
  breakProfile();
  sink = {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  };
  Object.assign(console, sink);
  profileModule = await import("./veteranProfile");
  capture = await import("./bugReportUtils.js");
  capture.initializeErrorCapture();
  await capture.refreshKnownIdentifiers();
}

const realConsole = {
  error: console.error,
  warn: console.warn,
  log: console.log,
  info: console.info,
};

afterEach(() => {
  Object.assign(console, realConsole);
  vi.restoreAllMocks();
});

describe.each(UNREADABLE)(
  "an unreadable saved profile: %s",
  (_name, breakIt) => {
    beforeEach(() => bootCapture(breakIt));

    it("does not loop: a burst of captured lines produces a bounded number of console writes", () => {
      for (let i = 0; i < 300; i += 1) console.error(`distinct line ${i}`);

      expect(sink.error.mock.calls.length).toBeLessThanOrEqual(310);
      expect(storedLogs().length).toBeLessThanOrEqual(50);
    });

    it("reports the unreadable profile once, with a neutral code and no stored value", () => {
      const first = profileModule.getVeteranProfile();
      for (let i = 0; i < 200; i += 1) profileModule.getVeteranProfile();

      expect(first).toEqual({});
      const reports = sink.error.mock.calls.filter(([text]) =>
        String(text).includes("saved profile could not be read"),
      );
      expect(reports).toHaveLength(1);
      expect(JSON.stringify(reports)).not.toMatch(/oops|denied/);
    });

    it("never reads the profile through anything that can log while capturing", () => {
      const before = sink.error.mock.calls.length;

      for (let i = 0; i < 100; i += 1) console.warn(`a warning ${i}`);

      expect(sink.error.mock.calls).toHaveLength(before);
    });

    it("stores lines with pattern scrubbing only and marks them", () => {
      console.error(`lookup failed for ${SSN}`);

      const [entry] = storedLogs();
      expect(entry.message).not.toContain(SSN);
      expect(entry.scrubMode).toBe("pattern-only");
      expect(JSON.stringify(capture.getConsoleErrors())).not.toContain(SSN);
    });

    it("leaves lines that were only pattern-scrubbed out of a bug report, and says why", () => {
      console.error("Veteran Zebulon Quartermain lookup failed");

      const report = capture.formatBugReport({
        userDescription: "it broke",
        severity: capture.BUG_SEVERITY.LOW,
        systemInfo: capture.getSystemInfo(),
        appState: capture.getAppState(),
        storageInfo: capture.getStorageInfo(),
        consoleErrors: capture.getConsoleErrors(),
      });

      expect(report).not.toContain("Zebulon");
      expect(report).toContain("saved profile could not be read");
    });
  },
);

describe("the console interceptor itself", () => {
  beforeEach(() => bootCapture(() => {}));

  it("never re-captures a line logged while a line is being captured", () => {
    const reentrant = {
      get trap() {
        console.error("emitted while capturing");
        return "x";
      },
    };

    console.error("outer", reentrant);

    const messages = storedLogs().map((entry) => entry.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("outer");
    expect(sink.error).toHaveBeenCalledWith("outer", reentrant);
    expect(sink.error).toHaveBeenCalledWith("emitted while capturing");
  });

  it("collapses identical consecutive lines into one entry with a count", () => {
    for (let i = 0; i < 200; i += 1) console.error("same failure");
    console.error("a different line");

    const entries = storedLogs();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ message: "same failure", count: 200 });
    expect(entries[1].count).toBeUndefined();
  });

  it("keeps at most 50 entries however many distinct lines arrive", () => {
    for (let i = 0; i < 400; i += 1) console.warn(`distinct ${i}`);

    const entries = storedLogs();
    expect(entries).toHaveLength(50);
    expect(entries.at(-1).message).toBe("distinct 399");
  });

  it("does not read the saved profile once per captured line", () => {
    const reads = vi.spyOn(localStorage, "getItem");

    for (let i = 0; i < 100; i += 1) console.warn(`line ${i}`);

    const profileReads = reads.mock.calls.filter(
      ([key]) => key === PROFILE_KEY,
    );
    expect(profileReads.length).toBeLessThanOrEqual(2);
  });

  it("marks nothing when the known values were available", () => {
    console.error("an ordinary failure");

    expect(storedLogs()[0].scrubMode).toBeUndefined();
  });

  it("picks up a profile that was saved after capture started", async () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Zebulon Quillfeather" }),
    );

    console.error("save failed for Zebulon Quillfeather");
    await capture.refreshKnownIdentifiers();

    expect(JSON.stringify(capture.getConsoleErrors())).not.toContain(
      "Quillfeather",
    );
  });
});
