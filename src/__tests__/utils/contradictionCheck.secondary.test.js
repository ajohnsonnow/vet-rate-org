/**
 * "Sleep apnea cannot be rated as secondary to PTSD." On the live site the
 * desktop model said so to "Can I get service connection for sleep apnea
 * secondary to PTSD?" and no correction appeared: the rule knew "cannot be
 * service connected ... secondary" and not "cannot be rated as secondary".
 * 38 CFR 3.310(a) says a disability that is proximately due to a
 * service-connected one shall be service connected; whether this one is, is
 * a question of medical evidence, not a bar in the regulation.
 */
import { describe, it, expect } from "vitest";
import {
  findContradictions,
  flagContradictions,
} from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const QUESTION =
  "Can I get service connection for sleep apnea secondary to PTSD?";
const RULE = "secondary-barred";
const rules = (text) =>
  findContradictions(text, { topics: ["secondary"] }).map((hit) => hit.rule);

const PRODUCTION_MISSED =
  "The short answer is: Generally, no. Under current VA regulations, sleep apnea cannot be rated as secondary to PTSD.";
const PRODUCTION_CAUGHT =
  "Sleep apnea cannot be service connected secondary to PTSD.";

describe("a secondary connection said to be barred by regulation", () => {
  it.each([
    "Under current VA regulations, sleep apnea cannot be rated as secondary to PTSD.",
    PRODUCTION_CAUGHT,
    "No. Sleep apnea cannot be claimed as secondary to PTSD.",
    "VA does not allow sleep apnea to be claimed as secondary to PTSD.",
    "Sleep apnea cannot be granted as secondary to PTSD under VA rules.",
    "You cannot claim sleep apnea as secondary to PTSD.",
    "VA regulations do not permit sleep apnea as secondary to PTSD.",
    "VA does not recognize sleep apnea as secondary to PTSD.",
    "Sleep apnea cannot be secondary to PTSD.",
    "Sleep apnea does not qualify as secondary to PTSD under 38 CFR.",
    "Under 38 CFR, sleep apnea can't be service-connected as secondary to PTSD.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence)).toEqual([RULE]);
  });

  it("puts the correction above the production answer, quoting 38 CFR 3.310(a)", () => {
    const out = flagContradictions(
      { text: PRODUCTION_MISSED, onDevice: true },
      { answerChecks: true, taskType: "assistant", dataClass: "context" },
      QUESTION,
    );
    expect(out.contradictionsFound).toEqual([
      {
        rule: RULE,
        sentence:
          "Under current VA regulations, sleep apnea cannot be rated as secondary to PTSD.",
      },
    ]);
    expect(out.text).toContain(
      `This reads as if it says a secondary connection cannot be made. Compare it with 38 CFR § 3.310(a): "${quotes.corrections.secondary.text}"`,
    );
    expect(out.text.endsWith(PRODUCTION_MISSED)).toBe(true);
  });
});

describe("true sentences near that pattern", () => {
  it.each([
    "Your records do not show a link between sleep apnea and PTSD.",
    "A nexus opinion is needed to claim sleep apnea as secondary to PTSD.",
    "Sleep apnea cannot be rated as secondary to PTSD without a medical nexus opinion.",
    "Sleep apnea cannot be granted as secondary to PTSD unless a doctor links the two.",
    "Sleep apnea cannot be service connected as secondary to PTSD until PTSD itself is service connected.",
    "A condition cannot be service connected as secondary to a condition that is not service connected.",
    "Sleep apnea cannot be claimed as secondary to a non-service-connected condition.",
    "The same symptoms cannot be rated twice as secondary to two conditions; that is pyramiding.",
    "Sleep apnea cannot be rated separately as secondary to PTSD where its symptoms are already rated under PTSD.",
    "Tinnitus cannot be rated higher than 10 percent, whether direct or secondary to hearing loss.",
    "On the evidence in your file, sleep apnea cannot be granted as secondary to PTSD yet.",
    "VA does not allow an earlier effective date for a secondary condition.",
    "Sleep apnea can be rated as secondary to PTSD when a medical opinion links them.",
    "VA will need a medical opinion before it rates sleep apnea as secondary to PTSD.",
    "Myth: sleep apnea cannot be rated as secondary to PTSD.",
    "It is not true that sleep apnea cannot be claimed as secondary to PTSD.",
    "A common mistake is believing sleep apnea cannot be service connected as secondary to PTSD.",
    "Is it right that sleep apnea cannot be rated as secondary to PTSD?",
    "Your VSO told you that sleep apnea cannot be claimed as secondary to PTSD.",
    "Some forums say sleep apnea cannot be rated as secondary to PTSD.",
    "Sleep apnea is not presumed to be secondary to PTSD; it has to be shown.",
    "A claim for sleep apnea secondary to PTSD is decided on the medical evidence.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence)).toEqual([]);
  });

  it("is a rule for secondary questions only", () => {
    expect(
      findContradictions("Sleep apnea cannot be rated as secondary to PTSD.", {
        topics: ["tdiu"],
      }),
    ).toEqual([]);
  });
});
