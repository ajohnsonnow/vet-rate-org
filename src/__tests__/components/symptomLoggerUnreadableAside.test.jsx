/**
 * Stored Symptom Logger data that cannot be read must never be replaced
 * without a copy being kept first, the veteran must be told in plain words,
 * and the copy must go with every other piece of data on a wipe. All values
 * are invented.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import SymptomLogger from "../../components/SymptomLogger.jsx";
import { wipeAllLocalData } from "../../components/AtomicWipe.jsx";

vi.mock("../../utils/veteranContextProvider", () => ({
  getVeteranAIContext: vi.fn().mockResolvedValue(""),
  saveAnalysisResults: vi.fn().mockResolvedValue(undefined),
  PACKET_DOC_TYPES: { MEDICAL_RECORD: "medical_record" },
}));

const KEY = "vetrate_symptom_logs";
const BACKUP_KEY = "vetrate_symptom_logs_unreadable_backup";

function open() {
  return render(
    <React.StrictMode>
      <LanguageProvider>
        <SymptomLogger onClose={() => {}} />
      </LanguageProvider>
    </React.StrictMode>,
  );
}

function addOneEntry() {
  fireEvent.click(screen.getByRole("button", { name: "1-4 hours" }));
  fireEvent.click(screen.getByRole("button", { name: /Log This Attack/ }));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  ["unreadable text", "{not json at all"],
  ["valid JSON that is not a list", '{"id":"1","note":"invented"}'],
])("Symptom Logger with %s stored", (_name, raw) => {
  it("tells the veteran on opening and writes nothing", () => {
    localStorage.setItem(KEY, raw);
    const setItem = vi.spyOn(localStorage, "setItem");
    open();
    expect(screen.getByRole("status").textContent).toMatch(
      /older entries could not be read/i,
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("keeps the original aside before the first add replaces it, and says so", () => {
    localStorage.setItem(KEY, raw);
    open();
    addOneEntry();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw);
    expect(Array.isArray(JSON.parse(localStorage.getItem(KEY)))).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY))).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toMatch(
      /kept aside on this device/i,
    );
  });

  it("does not overwrite a backup that already exists", () => {
    localStorage.setItem(KEY, raw);
    localStorage.setItem(BACKUP_KEY, "an earlier invented backup");
    open();
    addOneEntry();
    expect(localStorage.getItem(BACKUP_KEY)).toBe("an earlier invented backup");
    expect(JSON.parse(localStorage.getItem(KEY))).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toMatch(/was not replaced/i);
  });

  it("does not replace the stored value when the copy cannot be made", () => {
    localStorage.setItem(KEY, raw);
    open();
    const real = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === BACKUP_KEY) throw new Error("QuotaExceededError");
      return real(key, value);
    });
    addOneEntry();
    expect(localStorage.getItem(KEY)).toBe(raw);
    expect(screen.getByRole("alert").textContent).toMatch(/was not saved/i);
  });

  it("is deleted by the data wipe along with everything else", async () => {
    localStorage.setItem(KEY, raw);
    open();
    addOneEntry();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(raw);
    await act(async () => {
      await wipeAllLocalData();
    });
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
