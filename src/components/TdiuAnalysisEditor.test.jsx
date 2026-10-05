/**
 * The TDIU analysis is edited in place: every text the veteran may need to
 * complete is a labelled field, and the save control says when blanks
 * remain. Fixture values are invented for these tests.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TdiuAnalysisEditor from "./TdiuAnalysisEditor";
import { buildTdiuAnalysisTemplate } from "../utils/writerTemplates";

const TEMPLATE = buildTdiuAnalysisTemplate([
  { condition: "Lumbar strain", symptoms: ["Cannot sit >30 minutes"] },
  { condition: "Migraines", symptoms: ["Light sensitivity"] },
]);
const FILLED = {
  limitations: TEMPLATE.limitations.map((item) => ({
    ...item,
    vocational_impact: "I have to stop and lie down several times a shift.",
  })),
  combined_effect: "Together they mean I cannot finish a working day.",
  summary_argument: "I cannot keep a job because of my back and migraines.",
  job_types_precluded: ["Medium", "Heavy"],
};

const renderEditor = (analysis, props = {}) => {
  const onChange = vi.fn();
  const onSave = vi.fn();
  render(
    <TdiuAnalysisEditor
      analysis={analysis}
      onChange={onChange}
      onSave={onSave}
      onCopy={() => {}}
      saveState={null}
      {...props}
    />,
  );
  return { onChange, onSave };
};

describe("TdiuAnalysisEditor fields", () => {
  it("gives every editable text a label", () => {
    renderEditor(TEMPLATE);

    expect(
      screen.getByLabelText("Statement for Box 18 (VA Form 21-8940)").value,
    ).toBe(TEMPLATE.summary_argument);
    expect(
      screen.getByLabelText(
        "How this limits your work: Lumbar strain, Cannot sit >30 minutes",
      ).value,
    ).toBe(TEMPLATE.limitations[0].vocational_impact);
    expect(
      screen.getByLabelText(
        "How this limits your work: Migraines, Light sensitivity",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("How your conditions combine to limit your work")
        .value,
    ).toBe(TEMPLATE.combined_effect);
    expect(
      screen.getByRole("group", { name: "Types of work you cannot do" }),
    ).toBeInTheDocument();
    for (const type of ["Sedentary", "Light", "Medium", "Heavy"]) {
      expect(
        screen.getByRole("checkbox", { name: `${type} work` }).checked,
      ).toBe(false);
    }
  });

  it("reports an edit to one limitation and leaves the rest alone", () => {
    const { onChange } = renderEditor(TEMPLATE);
    fireEvent.change(
      screen.getByLabelText(
        "How this limits your work: Migraines, Light sensitivity",
      ),
      { target: { value: "I cannot look at a screen for a full shift." } },
    );

    const next = onChange.mock.calls[0][0];
    expect(next.limitations[1].vocational_impact).toBe(
      "I cannot look at a screen for a full shift.",
    );
    expect(next.limitations[0]).toEqual(TEMPLATE.limitations[0]);
    expect(next.summary_argument).toBe(TEMPLATE.summary_argument);
  });

  it("reports edits to the Box 18 statement and the combined effect", () => {
    const { onChange } = renderEditor(TEMPLATE);
    fireEvent.change(
      screen.getByLabelText("Statement for Box 18 (VA Form 21-8940)"),
      { target: { value: "New summary." } },
    );
    fireEvent.change(
      screen.getByLabelText("How your conditions combine to limit your work"),
      { target: { value: "New combined." } },
    );
    expect(onChange.mock.calls[0][0].summary_argument).toBe("New summary.");
    expect(onChange.mock.calls[1][0].combined_effect).toBe("New combined.");
  });
});

describe("TdiuAnalysisEditor work types", () => {
  it("replaces the work-type blank with the types ticked, in a fixed order", () => {
    const { onChange } = renderEditor(TEMPLATE);
    fireEvent.click(screen.getByRole("checkbox", { name: "Heavy work" }));
    expect(onChange.mock.calls[0][0].job_types_precluded).toEqual(["Heavy"]);
  });

  it("shows ticked types and restores the blank when the last is cleared", () => {
    const { onChange } = renderEditor({
      ...FILLED,
      job_types_precluded: ["Heavy"],
    });
    expect(screen.getByRole("checkbox", { name: "Heavy work" }).checked).toBe(
      true,
    );
    expect(screen.getByRole("checkbox", { name: "Light work" }).checked).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Light work" }));
    expect(onChange.mock.calls[0][0].job_types_precluded).toEqual([
      "Light",
      "Heavy",
    ]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Heavy work" }));
    expect(onChange.mock.calls[1][0].job_types_precluded).toEqual(
      TEMPLATE.job_types_precluded,
    );
  });
});

describe("TdiuAnalysisEditor save control", () => {
  it("says in words how many blanks remain, next to the save button", () => {
    const { onSave } = renderEditor(TEMPLATE);
    const notice = screen.getByRole("status", { name: "Blanks to fill in" });
    expect(notice.textContent).toMatch(/5 blanks are still to be filled in/);
    expect(notice.textContent).toMatch(/left out of your saved insights/);

    fireEvent.click(screen.getByRole("button", { name: "Save to My Packet" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("uses the singular for one blank and says nothing when none remain", () => {
    renderEditor({ ...FILLED, combined_effect: TEMPLATE.combined_effect });
    expect(
      screen.getByRole("status", { name: "Blanks to fill in" }).textContent,
    ).toMatch(/1 blank is still to be filled in/);
  });

  it("has no blanks message when everything is filled in", () => {
    renderEditor(FILLED);
    expect(
      screen.queryByRole("status", { name: "Blanks to fill in" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["saved", "Saved to My Packet."],
    ["failed", "Could not save to My Packet. Please try again."],
  ])("reports a %s save in words", (saveState, message) => {
    renderEditor(FILLED, { saveState });
    expect(
      screen.getByRole("status", { name: "Save result" }).textContent,
    ).toBe(message);
  });

  it("gives controls a 44px touch target and a visible focus style", () => {
    renderEditor(TEMPLATE);
    const save = screen.getByRole("button", { name: "Save to My Packet" });
    const field = screen.getByLabelText(
      "Statement for Box 18 (VA Form 21-8940)",
    );
    expect(save.className).toMatch(/min-h-\[44px\]/);
    expect(save.className).toMatch(/focus-visible:ring/);
    expect(field.className).toMatch(/focus:ring/);
    expect(
      screen.getByRole("checkbox", { name: "Heavy work" }).closest("label")
        .className,
    ).toMatch(/min-h-\[44px\]/);
  });
});
