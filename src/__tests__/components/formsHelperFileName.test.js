/**
 * A downloaded draft is named for its own form: one "VA" prefix, and a
 * condition only when that form asks for one.
 */
import { describe, it, expect } from "vitest";
import { _draftFileName } from "../../components/FormsHelper.jsx";

const PERSONAL = { id: "personal-statement", formNumber: "VA Form 21-4138" };
const PTSD = { id: "ptsd-stressor", formNumber: "VA Form 21-0781" };

describe("Forms Helper download file name", () => {
  it("has the form number once and the condition the form asked for", () => {
    expect(_draftFileName(PERSONAL, { conditionName: "Lower back pain" })).toBe(
      "VA-Form-21-4138-Lower-back-pain",
    );
  });

  it("carries no condition left over from another form", () => {
    expect(_draftFileName(PTSD, { conditionName: "Tinnitus" })).toBe(
      "VA-Form-21-0781",
    );
  });

  it("is just the form when the condition was left empty", () => {
    expect(_draftFileName(PERSONAL, { conditionName: "  " })).toBe(
      "VA-Form-21-4138",
    );
    expect(_draftFileName(PERSONAL, {})).not.toMatch(/VA-VA|undefined/);
  });
});
