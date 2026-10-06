/**
 * The PTSD statement's filing instructions name only forms the app's
 * verified reference lists as current.
 */
import { describe, it, expect } from "vitest";
import { _generateFormsHelperContent } from "../../components/FormsHelper.jsx";
import verifiedReference from "../../data/verifiedReference.json";

const formNumbers = JSON.stringify(verifiedReference).match(
  /"number":\s*"([^"]+)"/g,
);

describe("Forms Helper PTSD statement instructions", () => {
  const statement = _generateFormsHelperContent({ id: "ptsd-stressor" }, {});

  it("does not send MST claims to a form the verified reference does not list", () => {
    expect(formNumbers.join(" ")).toContain("21-0781");
    expect(formNumbers.join(" ")).not.toContain("21-0781a");
    expect(statement).not.toMatch(/21-0781a/i);
  });

  it("still names the form it accompanies and numbers its steps in order", () => {
    expect(statement).toContain("VA Form 21-0781");
    const steps = statement
      .slice(
        statement.indexOf("INSTRUCTIONS:"),
        statement.indexOf("IMPORTANT NOTES:"),
      )
      .match(/^\d\./gm);
    expect(steps).toEqual(["1.", "2.", "3."]);
  });
});
