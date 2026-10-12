/**
 * A stored list that holds something other than log entries (a null, text, a
 * number) used to stop the Symptom Logger from opening at all. It must open
 * and show the valid entries, write nothing on open, and only drop the bad
 * entries on a real save after the original text was kept aside. All values
 * are invented.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import SymptomLogger from "../../components/SymptomLogger.jsx";

vi.mock("../../utils/veteranContextProvider", () => ({
  getVeteranAIContext: vi.fn().mockResolvedValue(""),
  saveAnalysisResults: vi.fn().mockResolvedValue(undefined),
  PACKET_DOC_TYPES: { MEDICAL_RECORD: "medical_record" },
}));

const KEY = "vetrate_symptom_logs";
const BACKUP_KEY = "vetrate_symptom_logs_unreadable_backup";
const entry = (id, notes) => ({
  id,
  type: "migraine",
  date: "2026-01-02",
  time: "08:15",
  severity: 6,
  duration: "1-4 hours",
  bodyLocation: "head",
  painScale: 6,
  activityImpact: "",
  prostrating: false,
  medication: false,
  triggers: "",
  weather: "",
  stressLevel: 3,
  notes,
  createdAt: "2026-01-02T08:15:00.000Z",
});
const RAW = JSON.stringify([
  entry("2001", "invented first"),
  null,
  "stray text",
  7,
  [1, 2],
  entry("2002", "invented second"),
]);

function open() {
  return render(
    <React.StrictMode>
      <LanguageProvider>
        <SymptomLogger onClose={() => {}} />
      </LanguageProvider>
    </React.StrictMode>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Symptom Logger with non-entry items in the stored list", () => {
  it("opens, shows the valid entries and writes nothing", () => {
    localStorage.setItem(KEY, RAW);
    const setItem = vi.spyOn(localStorage, "setItem");
    open();
    fireEvent.click(screen.getByRole("button", { name: /History \(2\)/ }));
    expect(screen.getByText(/invented first/)).toBeTruthy();
    expect(screen.getByText(/invented second/)).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(RAW);
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("drops the bad items only on a real save, after keeping the original aside", () => {
    localStorage.setItem(KEY, RAW);
    open();
    fireEvent.click(screen.getByRole("button", { name: "1-4 hours" }));
    fireEvent.click(screen.getByRole("button", { name: /Log This Attack/ }));
    expect(localStorage.getItem(BACKUP_KEY)).toBe(RAW);
    const saved = JSON.parse(localStorage.getItem(KEY));
    expect(saved).toHaveLength(3);
    expect(saved.every((e) => e && typeof e === "object")).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/kept aside/i);
  });

  it("leaves a fully valid list alone: no notice, no backup", () => {
    localStorage.setItem(KEY, JSON.stringify([entry("2003", "invented")]));
    open();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1-4 hours" }));
    fireEvent.click(screen.getByRole("button", { name: /Log This Attack/ }));
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});
