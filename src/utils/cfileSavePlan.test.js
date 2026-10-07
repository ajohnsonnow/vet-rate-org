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

const { getAllConditions } = await import("../services/knowledgeQuery.js");

describe("validateConditionName", () => {
  it("accepts every condition name the rating schedule lists", () => {
    const names = getAllConditions().map((d) => d.conditionName);
    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((n) => !validateConditionName(n))).toEqual([]);
  });

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

  it("is decided by the name alone, never by a code the model attached", () => {
    expect(validateConditionName("Tuesday", "6260")).toBeNull();
    expect(validateConditionName("Paperwork", 99999)).toBeNull();
    const plan = planCFileSave(
      {
        potential_claims: [
          { condition: "Tuesday", diagnosticCode: "6260" },
          { condition: "Tinnitus", diagnosticCode: "6260" },
        ],
      },
      {},
    );
    expect(plan.conditions).toEqual(["Tinnitus"]);
    expect(plan.leftOut.map((l) => l.name)).toEqual(["Tuesday"]);
  });

  it.each([
    "Hearing",
    "Back pay",
    "Combat",
    "Stress",
    "Surgery",
    "Medication",
    "Burn pit",
    "Injury",
  ])(
    "rejects the everyday word %j that only occurs inside condition names",
    (raw) => {
      expect(validateConditionName(raw)).toBeNull();
    },
  );

  it.each([
    "Ulnar nerve, paralysis of",
    "Teeth, loss of",
    "Kidney, removal of",
    "Bladder, calculus in",
  ])("accepts the schedule's own wording %j", (raw) => {
    expect(validateConditionName(raw)).toBe(raw);
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

  it("keeps a ticked not-recognised name listed, so it can be unticked", () => {
    const analysis = { potential_claims: [{ condition: "Tuesday" }] };
    const [item] = planCFileSave(analysis, {}).leftOut;
    const ticked = planCFileSave(analysis, {}, { ticked: [item.key] });
    expect(ticked.conditions).toEqual(["Tuesday"]);
    expect(ticked.leftOut).toEqual([{ ...item, ticked: true }]);
  });

  it("leaves nothing out and writes nothing for an empty analysis", () => {
    const plan = planCFileSave({}, {});
    expect(plan.conditions).toEqual([]);
    expect(plan.leftOut).toEqual([]);
    expect(plan.timeline).toEqual([]);
  });
});
