/**
 * Opening the Symptom Logger must never replace the veteran's stored logs
 * with an empty list. The save effect used to run in the same commit as the
 * load effect, before the loaded logs were in state, so it wrote "[]" over
 * them; under React StrictMode's second effect pass the load then read that
 * "[]" back. All log values are invented.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import SymptomLogger from "../../components/SymptomLogger.jsx";

const KEY = "vetrate_symptom_logs";
const LOGS = [
  {
    id: "1001",
    type: "migraine",
    date: "2026-01-02",
    time: "08:15",
    severity: 7,
    duration: "2-4 hours",
    bodyLocation: "head",
    painScale: 7,
    activityImpact: "",
    prostrating: true,
    medication: false,
    triggers: "",
    weather: "",
    stressLevel: 4,
    notes: "invented entry one",
    createdAt: "2026-01-02T08:15:00.000Z",
  },
  {
    id: "1002",
    type: "migraine",
    date: "2026-01-09",
    time: "21:40",
    severity: 5,
    duration: "1-2 hours",
    bodyLocation: "head",
    painScale: 5,
    activityImpact: "",
    prostrating: false,
    medication: true,
    triggers: "",
    weather: "",
    stressLevel: 5,
    notes: "invented entry two",
    createdAt: "2026-01-09T21:40:00.000Z",
  },
];

function open({ strict }) {
  const tree = (
    <LanguageProvider>
      <SymptomLogger onClose={() => {}} />
    </LanguageProvider>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  ["without StrictMode", false],
  ["under StrictMode", true],
])("Symptom Logger stored logs, %s", (_name, strict) => {
  it("keeps stored logs when the tool is only opened", () => {
    localStorage.setItem(KEY, JSON.stringify(LOGS));
    open({ strict });
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(LOGS);
  });

  it("never writes an empty list over stored logs while opening", () => {
    localStorage.setItem(KEY, JSON.stringify(LOGS));
    const setItem = vi.spyOn(localStorage, "setItem");
    open({ strict });
    const writes = setItem.mock.calls.filter(([key]) => key === KEY);
    for (const [, value] of writes) {
      expect(JSON.parse(value)).toEqual(LOGS);
    }
  });

  it("shows the stored logs in the history tab", () => {
    localStorage.setItem(KEY, JSON.stringify(LOGS));
    open({ strict });
    fireEvent.click(screen.getByRole("button", { name: /History \(\d+\)/ }));
    expect(screen.getByText(/invented entry one/)).toBeTruthy();
    expect(screen.getByText(/invented entry two/)).toBeTruthy();
  });

  it("leaves unreadable stored text untouched instead of overwriting it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(KEY, "{not json");
    open({ strict });
    expect(localStorage.getItem(KEY)).toBe("{not json");
  });

  it("stores nothing when there was nothing stored and nothing was added", () => {
    open({ strict });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
