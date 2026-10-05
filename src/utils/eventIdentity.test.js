/**
 * An event is identified by document, day and a canonical type that a keyword
 * rule chooses, so the model's wording of the type never changes identity.
 */
import { describe, it, expect } from "vitest";
import {
  CANONICAL_EVENT_TYPES,
  canonicalEventType,
  eventIdentity,
  isRealEventDate,
} from "./eventIdentity";

describe("canonicalEventType", () => {
  it.each([
    ["Claim Filed", "claim filed"],
    ["Original claim submitted", "claim filed"],
    ["Rating Decision", "decision issued"],
    ["Decision issued", "decision issued"],
    ["Claim denied", "decision issued"],
    ["C&P Exam", "exam"],
    ["Compensation and Pension examination", "exam"],
    ["NOD filed", "appeal filed"],
    ["Appeal", "appeal filed"],
    ["BVA decision", "appeal decided"],
    ["Appeal decided", "appeal decided"],
    ["Evidence submitted", "evidence submitted"],
    ["Lay statement", "evidence submitted"],
    ["Notice of VA letter", "notice sent"],
    ["Medical", "medical"],
    ["Something unrecognised", "other"],
    ["", "other"],
    [undefined, "other"],
  ])("maps %j to %j", (type, canonical) => {
    expect(canonicalEventType(type)).toBe(canonical);
  });

  it("only ever returns a type from the fixed set", () => {
    for (const type of ["x", "Service", "Hearing", "Award letter", "???"]) {
      expect(CANONICAL_EVENT_TYPES).toContain(canonicalEventType(type));
    }
  });

  it("gives one identity to differently worded types of one event", () => {
    const wordings = ["Rating Decision", "decision", "Decision issued"];
    const ids = new Set(
      wordings.map((eventType) =>
        eventIdentity({ date: "March 3, 2019", eventType }),
      ),
    );
    expect(ids.size).toBe(1);
    expect(eventIdentity({ date: "2019-03-03", eventType: "decision" })).toBe(
      [...ids][0],
    );
  });
});

describe("isRealEventDate", () => {
  it.each(["2019-03-03", "March 3, 2019", "2019-03-03T10:00:00Z", "2019"])(
    "accepts %j",
    (date) => {
      expect(isRealEventDate(date)).toBe(true);
    },
  );

  it.each(["", "   ", undefined, "unknown", "n/a", "2019-02-31", "2019-13-01"])(
    "rejects %j",
    (date) => {
      expect(isRealEventDate(date)).toBe(false);
    },
  );
});
