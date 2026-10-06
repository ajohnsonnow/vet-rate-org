/**
 * A TDIU answer says the result in one plain sentence before anything else,
 * and its closing sentence names what was answered.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  ASK_SEPARATELY_SENTENCE,
  TDIU_ASK_SEPARATELY_SENTENCE,
  buildCalculatorAnswer,
} from "../../utils/raterGrounding";
import { GOLDEN } from "./recordedAnswers";

const answer = (id) =>
  buildCalculatorAnswer(
    calculateVARating(GOLDEN[id].conditions),
    GOLDEN[id].input,
  );

const MET =
  "On these ratings, the percentage thresholds for TDIU in 38 CFR § 4.16(a) are met. Meeting them is not by itself entitlement to TDIU: VA must also find that you are unable to secure or follow a substantially gainful occupation because of your service-connected disabilities.";
const NOT_MET =
  "On these ratings, the percentage thresholds for TDIU in 38 CFR § 4.16(a) are not met. That does not by itself rule TDIU out: 38 CFR § 4.16(b) provides for extra-schedular consideration of veterans who are unemployable because of service-connected disabilities but do not meet the percentages.";

describe("the opening of a TDIU answer", () => {
  it.each([
    ["a13", 80],
    ["a25", 60],
  ])(
    "%s: result sentence, then the combined rating, then the thresholds",
    (id, combined) => {
      expect(
        answer(id).startsWith(
          `${MET}\n\nYour combined rating is ${combined}%.\n\nAbout your question on individual unemployability (TDIU):`,
        ),
      ).toBe(true);
    },
  );

  it("says so when the thresholds are not met", () => {
    const calc = calculateVARating([
      { name: "PTSD", rating: 30 },
      { name: "Back", rating: 20 },
    ]);
    const text = buildCalculatorAnswer(calc, "Do I qualify for TDIU?");
    expect(text.startsWith(`${NOT_MET}\n\nYour combined rating is 40%.`)).toBe(
      true,
    );
    expect(text).not.toContain("are met.");
  });

  it("keeps the working after the threshold paragraph", () => {
    const text = answer("a13");
    expect(text.indexOf("Vet-Rate cannot determine that.")).toBeLessThan(
      text.indexOf("VA does not add ratings together."),
    );
  });

  it("is absent from an answer that is not about TDIU", () => {
    for (const id of ["a11", "a12", "a24"]) {
      expect(answer(id).startsWith("Your combined rating is")).toBe(true);
      expect(answer(id)).not.toContain("percentage thresholds for TDIU");
    }
  });
});

describe("the closing sentence fits what was answered", () => {
  it("on a TDIU answer names the rating and the thresholds, not unemployability", () => {
    expect(TDIU_ASK_SEPARATELY_SENTENCE).toBe(
      "This answer covers your combined rating and the 38 CFR § 4.16(a) percentage thresholds. It does not say whether you are unemployable, which VA decides. If you also asked about something else, such as how to apply or monthly pay, please ask it as a separate question.",
    );
    for (const id of ["a13", "a25"]) {
      expect(answer(id).endsWith(`\n\n${TDIU_ASK_SEPARATELY_SENTENCE}`)).toBe(
        true,
      );
      expect(answer(id)).not.toContain(ASK_SEPARATELY_SENTENCE);
    }
  });

  it("on any other answer stays as it was", () => {
    for (const id of ["a11", "a12", "a24"]) {
      expect(answer(id).endsWith(`\n\n${ASK_SEPARATELY_SENTENCE}`)).toBe(true);
      expect(answer(id)).not.toContain(TDIU_ASK_SEPARATELY_SENTENCE);
    }
  });
});
