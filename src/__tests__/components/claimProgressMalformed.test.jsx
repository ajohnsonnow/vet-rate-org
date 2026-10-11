/**
 * The Readiness Gauge in My Packet must never throw on a claim record with
 * missing or wrong-typed fields, or on saved claims that are not a list of
 * well-formed records. It renders what is valid and labels what is not.
 * All values are invented.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ClaimProgress from "../../components/ClaimProgress.jsx";

const CLAIMS_KEY = "vet_rate_saved_claims";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ClaimProgress with a malformed claim record", () => {
  it.each([
    ["no code and no name", {}],
    ["null code and name", { conditionCode: null, conditionName: null }],
    ["empty strings", { conditionCode: "", conditionName: "" }],
    ["whitespace only", { conditionCode: "  ", conditionName: "   " }],
    ["a numeric name", { conditionName: 5000 }],
    ["a numeric code", { conditionCode: 9411 }],
    ["an object name", { conditionName: { text: "Tinnitus" } }],
    ["an array code", { conditionCode: ["9411"] }],
    ["a boolean name", { conditionName: true }],
    ["a function name", { conditionName: () => "x" }],
  ])("does not throw for %s", (_label, props) => {
    expect(() => render(<ClaimProgress {...props} />)).not.toThrow();
    expect(screen.getByText("Claim Readiness")).toBeTruthy();
  });

  it("says a condition is needed when none is usable", () => {
    render(<ClaimProgress conditionCode={null} conditionName={{}} />);
    expect(screen.getByText("Select a condition to begin")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("still shows a valid name and its three missing items", () => {
    render(<ClaimProgress conditionCode="9999" conditionName="Tinnitus" />);
    expect(screen.getByText("Tinnitus")).toBeTruthy();
    expect(screen.getByText("Medical Diagnosis/Symptoms")).toBeTruthy();
    expect(screen.getByText("Nexus Letter Draft")).toBeTruthy();
  });

  it("shows a numeric code's own name field as text, not as a crash", () => {
    render(<ClaimProgress conditionCode={9411} conditionName="Tinnitus" />);
    expect(screen.getByText("Tinnitus")).toBeTruthy();
  });
});

describe("ClaimProgress with malformed saved claims", () => {
  const withSaved = (raw) => localStorage.setItem(CLAIMS_KEY, raw);
  const open = () =>
    render(<ClaimProgress conditionCode="9999" conditionName="Tinnitus" />);

  it.each([
    ["unreadable text", "{not json"],
    ["an object instead of a list", '{"conditionName":"Tinnitus"}'],
    ["a number", "42"],
    ["null", "null"],
    ["a list of non-records", '[null, 7, "x", true, [], {}]'],
    [
      "records with wrong-typed names",
      '[{"conditionName":5},{"conditionName":{"a":1}},{"conditionName":null}]',
    ],
  ])("does not throw for %s", (_label, raw) => {
    withSaved(raw);
    expect(() => open()).not.toThrow();
    expect(screen.getByText("Medical Diagnosis/Symptoms")).toBeTruthy();
  });

  it("counts the valid record even when others around it are malformed", () => {
    withSaved(
      JSON.stringify([
        null,
        { conditionName: 5 },
        { conditionName: "TINNITUS" },
        "x",
      ]),
    );
    open();
    expect(screen.getByText("Medical Diagnosis/Symptoms")).toBeTruthy();
    expect(screen.getByText(/Still Needed:/)).toBeTruthy();
    expect(screen.getByText("✅ Completed:")).toBeTruthy();
  });

  it("counts stored diagnosis text beside malformed claims", () => {
    localStorage.setItem("9999_diagnosis", "x".repeat(60));
    open();
    expect(screen.getByText("✅ Completed:")).toBeTruthy();
  });
});
