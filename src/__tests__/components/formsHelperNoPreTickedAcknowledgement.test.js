/**
 * A text document never shows an acknowledgement as ticked when the
 * veteran ticked nothing.
 */
import { describe, it, expect } from "vitest";
import { _generateFormsHelperContent } from "../../components/FormsHelper.jsx";

describe("individual representative appointment, fee rules", () => {
  const document = (formData) =>
    _generateFormsHelperContent({ id: "vso-appointment-individual" }, formData);

  it("shows every fee rule unticked when none was acknowledged", () => {
    const text = document({});

    expect(text).toContain("[ ] VA limits fees to 33.3% of past-due benefits");
    expect(text).not.toContain("[X]");
  });

  it("ticks only the rules the veteran acknowledged", () => {
    const text = document({
      feeUnderstanding: ["The fee agreement must be filed with the VA"],
    });

    expect(text.match(/\[X\]/g)).toHaveLength(1);
    expect(text).toContain("[X] The fee agreement must be filed with the VA");
  });
});

describe.each(["vso-appointment", "vso-appointment-individual"])(
  "%s authorization scope",
  (id) => {
    it("is shown unticked when the veteran chose none", () => {
      const text = _generateFormsHelperContent({ id }, {});

      expect(text).toContain("[ ] Access my VA records");
      expect(text).not.toContain("[X]");
    });
  },
);
