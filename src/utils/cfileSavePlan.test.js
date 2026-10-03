/**
 * validateConditionName: the name cleanup keeps it AND the condition
 * catalogue recognises it. Generic names only.
 */
import { describe, it, expect } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { validateConditionName, planCFileSave } =
  await import("./cfileSavePlan.js");

describe("validateConditionName", () => {
  it.each([
    ["Tinnitus", "Tinnitus"],
    ["sleep apnea", "sleep apnea"],
    ["PTSD", "PTSD"],
    ["Tinnitus effective date", "Tinnitus"],
    [
      "Knee strain (also claimed as knee pain)",
      "Knee strain (also claimed as knee pain)",
    ],
  ])("accepts %j as %j", (raw, expected) => {
    expect(validateConditionName(raw)).toBe(expected);
  });

  it.each([
    "Tuesday",
    "Weather",
    "Service connection",
    "Serviceconnection",
    "the veteran",
    "",
  ])("rejects %j", (raw) => {
    expect(validateConditionName(raw)).toBeNull();
  });

  it("accepts a name with a grounded diagnostic code", () => {
    expect(validateConditionName("Unlisted wording", "6260")).toBe(
      "Unlisted wording",
    );
  });
});

describe("planCFileSave", () => {
  it("lists a mental health diagnosis the catalogue does not know as left out", () => {
    const plan = planCFileSave(
      { mentalHealth: { diagnoses: ["PTSD", "Tuesday"] } },
      {},
    );
    expect(plan.conditions).toEqual(["PTSD"]);
    expect(plan.leftOut.map((l) => l.name)).toEqual(["Tuesday"]);
  });

  it("shows a name once when the claims and diagnoses both carry it", () => {
    const plan = planCFileSave(
      {
        potential_claims: [{ condition: "Tinnitus" }],
        mentalHealth: { diagnoses: ["tinnitus"] },
      },
      {},
    );
    expect(plan.conditions).toEqual(["Tinnitus"]);
  });

  it("leaves nothing out and writes nothing for an empty analysis", () => {
    const plan = planCFileSave({}, {});
    expect(plan.conditions).toEqual([]);
    expect(plan.leftOut).toEqual([]);
    expect(plan.timeline).toEqual([]);
  });
});
