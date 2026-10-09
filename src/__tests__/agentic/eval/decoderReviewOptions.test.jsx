/**
 * Golden-set case t08 (a fictional mixed decision) through the real
 * decodeDecision with the model stubbed to give the wrong filing
 * instruction a graded run produced. What the veteran is shown as review
 * options must be the verified regulation text, whatever the model wrote.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGoldenSet } from "../../../../scripts/eval/lib/goldenSet.js";
import { TOOL_ENTRIES } from "../../../../scripts/eval/lib/toolEntries.js";
import DecisionReviewOptions, {
  FieldCorrections,
} from "../../../components/DecisionReviewOptions";
import { REVIEW_OPTIONS } from "../../../utils/reviewOptions";

vi.mock("../../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAnyAIAvailable: () => true,
    getAIStatus: () => ({ statusText: "Local AI" }),
    generateAI: vi.fn(),
  };
});
const { generateAI } = await import("../../../utils/unifiedAIService");
const { decodeDecision } = await import("../../../utils/aiStatementHelper");

const t08 = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
).find((c) => c.id === "t08");

const WRONG_OPTIONS =
  "You can submit a Statement of the Case (SOC) to the Board of Veterans' Appeals to request a higher-level review.";
const MODEL_REPLY = {
  decision_type: "Mixed Decision",
  favorable_findings: ["Tinnitus is granted at 10 percent"],
  plain_english: "VA granted tinnitus and denied the left knee strain.",
  va_reasoning: "No medical opinion links the knee strain to service.",
  missing_elements: ["A medical opinion linking the knee strain to service"],
  action_plan: [
    "Ask a clinician for a nexus opinion on the left knee.",
    "If the VA denies the Supplemental Claim, the veteran then has one year to file a Statement of the Case (SOC) with the Board of Veterans' Appeals.",
  ],
  appeal_options: WRONG_OPTIONS,
  deadline_warning: "You have one year from the date of this letter.",
};

async function decodeT08(reply = MODEL_REPLY) {
  generateAI.mockImplementation(async () => ({
    text: JSON.stringify(reply),
    mode: "swarm",
  }));
  const args = TOOL_ENTRIES.decodeDecision.args(t08.formInputs, {});
  return decodeDecision(...args);
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
});

describe("t08 through decodeDecision with a wrong filing instruction", () => {
  it("sends the fictional letter and no longer asks the model for appeal options", async () => {
    await decodeT08();

    const [prompt] = generateAI.mock.calls[0];
    expect(prompt).toContain(t08.match);
    expect(prompt).not.toContain("appeal_options");
    expect(prompt).toContain('"action_plan"');
  });

  it("drops the model's appeal options and returns the verified ones", async () => {
    const result = await decodeT08();

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("appeal_options");
    expect(JSON.stringify(result.data)).not.toContain(WRONG_OPTIONS);
    expect(result.data.review_options).toBe(REVIEW_OPTIONS);
    expect(result.data.action_plan).toEqual(MODEL_REPLY.action_plan);
  });

  it("notes the wrong instruction the model left in its action plan", async () => {
    const { data } = await decodeT08();

    expect(data.review_corrections.map((c) => c.rule)).toEqual([
      "files-statement-of-the-case",
    ]);
    expect(data.review_corrections[0].note).toContain(
      "tells you to file a Statement of the Case, which is not one of the review options",
    );
    expect(data.review_corrections[0].note).toContain(
      "Compare it with 38 CFR § 3.2500(a):",
    );
  });

  it("adds no correction when the model's plan names a real lane", async () => {
    const { data } = await decodeT08({
      ...MODEL_REPLY,
      action_plan: ["File a Supplemental Claim with the new nexus opinion."],
    });

    expect(data).not.toHaveProperty("review_corrections");
    expect(data.review_options).toBe(REVIEW_OPTIONS);
  });
});

describe("what the veteran sees for t08", () => {
  it("shows the three verified lanes with their forms, and the correction", async () => {
    const { data } = await decodeT08();
    render(<DecisionReviewOptions corrections={data.review_corrections} />);

    const section = screen.getByRole("region", {
      name: /your review options/i,
    });
    const shown = within(section);
    expect(
      shown.getByText(
        "VA Form 20-0996: Decision Review Request: Higher-Level Review",
      ),
    ).toBeTruthy();
    expect(
      shown.getByText(
        "VA Form 10182: Decision Review Request: Board Appeal (Notice of Disagreement)",
      ),
    ).toBeTruthy();
    expect(
      shown.getByText(
        "VA Form 20-0995: Decision Review Request: Supplemental Claim",
      ),
    ).toBeTruthy();
    expect(section.textContent).toContain(
      "Within one year from the date on which the agency of original jurisdiction issues a notice of a decision",
    );
    expect(section.textContent).toContain(
      "the higher-level adjudicator may not consider additional evidence",
    );
    expect(section.textContent).toContain(
      "At any time after VA issues notice of a decision on an issue within a claim, a claimant may file a supplemental claim",
    );
    expect(section.textContent).not.toContain(WRONG_OPTIONS);

    const corrections = shown.getByRole("list", {
      name: "Corrections to the plan above",
    });
    expect(corrections.textContent).toContain(
      "tells you to file a Statement of the Case, which is not one of the review options",
    );
  });

  it("shows the options with no corrections list when the plan was right", () => {
    render(<DecisionReviewOptions />);

    expect(
      screen.queryByRole("list", { name: "Corrections to the plan above" }),
    ).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("t08 with the deadline the 22:16 graded run gave", () => {
  const DEADLINE =
    "You have one year from the date of this letter to file a Supplemental Claim. If you do not file a Supplemental Claim within one year, you will likely lose the opportunity to appeal the denial of the knee strain.";
  const REPLY = {
    ...MODEL_REPLY,
    action_plan: ["File a Supplemental Claim (VA Form 20-0995)."],
    appeal_options: undefined,
    deadline_warning: DEADLINE,
  };

  it("ties the correction to the field that carried the wrong deadline", async () => {
    const { data } = await decodeT08(REPLY);

    expect(data.deadline_warning).toBe(DEADLINE);
    expect(data.review_corrections).toHaveLength(1);
    expect(data.review_corrections[0]).toMatchObject({
      field: "deadline_warning",
      rule: "supplemental-claim-deadline",
    });
    expect(data.review_corrections[0].note).toContain(
      'Compare it with 38 CFR § 3.2500(a)(2): "(2) At any time after VA issues notice of a decision on an issue within a claim, a claimant may file a supplemental claim under § 3.2501."',
    );
  });

  it("shows the correction beside that field and nowhere else", async () => {
    const { data } = await decodeT08(REPLY);
    render(
      <div>
        <p>{data.deadline_warning}</p>
        <FieldCorrections
          corrections={data.review_corrections}
          field="deadline_warning"
        />
        <FieldCorrections
          corrections={data.review_corrections}
          field="action_plan"
        />
      </div>,
    );

    const notes = screen.getAllByRole("note", {
      name: "Correction from Vet-Rate",
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain(
      "reads as if it puts a deadline on filing a Supplemental Claim",
    );
    expect(notes[0].textContent).toContain("At any time after VA issues");
  });

  it("lists it with the review options as well", async () => {
    const { data } = await decodeT08(REPLY);
    render(<DecisionReviewOptions corrections={data.review_corrections} />);

    expect(
      screen.getByRole("list", { name: "Corrections to the plan above" })
        .textContent,
    ).toContain("puts a deadline on filing a Supplemental Claim");
  });

  it("renders nothing beside a field with no correction", () => {
    const { container } = render(
      <FieldCorrections corrections={undefined} field="plain_english" />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("t08 with the missing list the final-build run gave", () => {
  const AGGRAVATION =
    "Evidence showing the knee condition worsened after the service event (aggravation)";
  const REPLY = {
    ...MODEL_REPLY,
    appeal_options: undefined,
    action_plan: ["File a Notice of Disagreement (VA Form 10182)."],
    missing_elements: [
      "Medical evidence or opinion linking the current left knee strain to the service training march",
      AGGRAVATION,
    ],
  };

  it("notes, beside the missing list, that the letter never mentions aggravation", async () => {
    const { data } = await decodeT08(REPLY);

    expect(data.missing_elements).toEqual(REPLY.missing_elements);
    expect(data.review_corrections).toEqual([
      {
        field: "missing_elements",
        rule: "missing-element-not-in-letter",
        note: `Vet-Rate check: this list names "${AGGRAVATION}" as missing, but the decision letter does not mention aggravation. Read the letter's reasons for the decision before gathering evidence for it.`,
      },
    ]);

    render(
      <FieldCorrections
        corrections={data.review_corrections}
        field="missing_elements"
      />,
    );
    expect(
      screen.getByRole("note", { name: "Correction from Vet-Rate" })
        .textContent,
    ).toContain("the decision letter does not mention aggravation");
  });
});
