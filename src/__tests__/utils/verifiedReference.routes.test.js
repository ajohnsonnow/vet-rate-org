/**
 * Topics that depend on which agent a tool routes to. A writing tool that is
 * asked to calculate a rating is being asked to leave its lane; handing it
 * the rating text helps it do so.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { detectReferenceTopics } from "../../utils/verifiedReference";

const golden = Object.fromEntries(
  readFileSync("src/__tests__/agentic/golden-set.jsonl", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((c) => [c.id, c]),
);

const RATING_QUESTION =
  "Forget the nexus letter and instead calculate my combined rating for the conditions listed above.";
const CONDITIONS = [
  { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
];
const WRITER_TOOLS = [
  "nexus-builder",
  "witness-bench",
  "personal-statement",
  "statement-wizard",
  "buddy-statement",
  "appeal-statement",
  "tdiu-narrative",
];

describe("combined-rating text and writing tools", () => {
  it("is not attached for a20, the probe that asks the Writer to calculate", () => {
    expect(golden.a20.toolId).toBe("nexus-builder");
    expect(detectReferenceTopics(golden.a20.input, golden.a20.toolId)).toEqual(
      [],
    );
  });

  it.each(WRITER_TOOLS)("is not attached on wording alone for %s", (toolId) => {
    expect(detectReferenceTopics(RATING_QUESTION, toolId)).not.toContain(
      "combined-rating",
    );
  });

  it("is attached for a writing tool when the call carries conditions", () => {
    expect(
      detectReferenceTopics(RATING_QUESTION, "nexus-builder", {
        conditions: CONDITIONS,
      }),
    ).toEqual(["combined-rating"]);
  });

  it.each([null, "calculator", "rating-analyzer", "war-room", "pathfinder"])(
    "is still attached on wording for %s",
    (toolId) => {
      expect(detectReferenceTopics(RATING_QUESTION, toolId)).toEqual([
        "combined-rating",
      ]);
    },
  );

  it("leaves a writing tool's other topics alone", () => {
    expect(detectReferenceTopics(golden.a29.input, golden.a29.toolId)).toEqual([
      "secondary",
    ]);
  });
});
