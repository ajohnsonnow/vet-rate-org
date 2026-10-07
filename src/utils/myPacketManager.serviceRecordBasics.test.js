/**
 * F19 (final13 QA re-review, 2026-09-28): the same D13-7 empty-placeholder
 * defect (empty "()" / trailing " - " when an optional sub-field wasn't
 * extracted) was still live in _formatServiceRecordBasics's Rank/MOS
 * lines, a sibling AI-context formatter D13-7 didn't touch. Fixture values
 * are synthetic.
 */
import { describe, it, expect } from "vitest";
import { _formatServiceRecordBasics } from "./myPacketManager";

describe("_formatServiceRecordBasics: Rank/MOS lines omit empty parts", () => {
  it("omits the empty parens when a rank has no extracted pay grade", () => {
    const out = _formatServiceRecordBasics({ rank: "SGT" }, "dd214.pdf");
    expect(out).toContain("Rank: SGT\n");
    expect(out).not.toContain("()");
  });

  it("still shows the pay grade in parens when it was extracted", () => {
    const out = _formatServiceRecordBasics(
      { rank: "SGT", payGrade: "E-5" },
      "dd214.pdf",
    );
    expect(out).toContain("Rank: SGT (E-5)\n");
  });

  it("omits the trailing ' - ' when a MOS has no extracted title", () => {
    const out = _formatServiceRecordBasics({ mos: "92Y" }, "dd214.pdf");
    expect(out).toContain("MOS: 92Y\n");
    expect(out).not.toContain("92Y -");
  });

  it("still shows the MOS title when it was extracted", () => {
    const out = _formatServiceRecordBasics(
      { mos: "92Y", mosTitle: "Unit Supply Specialist" },
      "dd214.pdf",
    );
    expect(out).toContain("MOS: 92Y - Unit Supply Specialist\n");
  });
});
