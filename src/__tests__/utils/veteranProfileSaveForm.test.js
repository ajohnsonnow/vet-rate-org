import { describe, it, expect, beforeEach } from "vitest";
import { saveForm, getSavedForms } from "../../utils/veteranProfile";

describe("veteranProfile: saveForm", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves a form with a recognized form type", () => {
    const id = saveForm({
      formType: "buddy-statement",
      formNumber: "21-10210",
      title: "Statement from SGT Jones",
    });
    expect(id).toMatch(/^form_/);
    expect(getSavedForms()).toHaveLength(1);
    expect(getSavedForms()[0].formType).toBe("buddy-statement");
  });

  it("rejects a form with no formType at all", () => {
    expect(saveForm({ title: "Untitled" })).toBeNull();
    expect(getSavedForms()).toEqual([]);
  });

  it("rejects a form with an unrecognized formType", () => {
    expect(saveForm({ formType: "not-a-real-form-type" })).toBeNull();
    expect(getSavedForms()).toEqual([]);
  });
});
