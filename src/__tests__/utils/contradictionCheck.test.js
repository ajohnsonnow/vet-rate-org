import { describe, it, expect } from "vitest";
import {
  buildContradictionNote,
  findContradictions,
  flagContradictions,
} from "../../utils/contradictionCheck";
import quotes from "../../data/verifiedQuotes.json";

const rules = (text, topics, extra = {}) =>
  findContradictions(text, { topics, ...extra }).map((hit) => hit.rule);

describe("secondary service connection said to be impossible", () => {
  it.each([
    "There is no established medical mechanism in the VA rating schedule that links PTSD directly to the development of sleep apnea.",
    "Therefore, a nexus letter cannot establish a service connection for sleep apnea secondary to PTSD.",
    "Sleep apnea cannot be service-connected secondary to PTSD.",
    "A valid nexus letter must explain the medical mechanism; since no such mechanism exists between PTSD and sleep apnea, a clinician cannot provide a valid opinion on this connection.",
    "The medical mechanism required by 38 CFR § 3.310(a) is not supported by current medical consensus or the reference data provided.",
    "The VA rating criteria for DC 6847 does not list PTSD as a qualifying cause for the condition.",
    "A secondary claim for sleep apnea is not allowed under the schedule.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, ["secondary"])).toEqual(["secondary-barred"]);
  });

  it.each([
    "I cannot generate a nexus letter for you.",
    "I cannot provide a signed medical opinion or a nexus letter.",
    "Without your records I cannot determine if your sleep apnea is caused or aggravated by your service-connected PTSD.",
    "Sleep apnea cannot be service-connected secondary to PTSD without a medical opinion linking the two.",
    "Secondary service connection is possible when a clinician explains the link.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["secondary"])).toEqual([]);
  });
});

describe("a presumptive condition said to need proof", () => {
  it("flags a demand for in-service incurrence or a nexus", () => {
    const sentence =
      "While these conditions are presumptive under the PACT Act, establishing service connection still requires evidence of in-service incurrence or aggravation (per 38 CFR § 3.304) or a nexus linking the condition to service exposure.";
    const [hit] = findContradictions(sentence, { topics: ["herbicide"] });
    expect(hit.rule).toBe("presumptive-needs-proof");
    expect(hit.correction).toBe("presumptive-herbicide");
    expect(
      findContradictions(sentence, { topics: ["toxic-exposure"] })[0]
        .correction,
    ).toBe("presumptive-toxic");
  });

  it.each([
    "However, to be eligible for presumptive conditions, you need to demonstrate that you were exposed to toxic substances during your service.",
    "To be eligible under the PACT Act, you need to demonstrate that you were exposed to these toxic substances while serving in Iraq.",
  ])("flags a demand to prove exposure: %s", (sentence) => {
    expect(rules(sentence, ["toxic-exposure"])).toEqual([
      "presumptive-needs-exposure-proof",
    ]);
  });

  it.each([
    "Current Diagnosis: For non-presumptive claims, the veteran must show a current diagnosis and a nexus to service.",
    "For conditions not covered by the presumption, you would need to prove the condition was caused or aggravated by toxic exposure.",
    "If the presumption may not apply, you would need to prove traditional service connection with a nexus.",
    "A presumptive condition does not need a nexus letter.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["toxic-exposure", "herbicide"])).toEqual([]);
  });
});

describe("TDIU asserted from the percentages alone", () => {
  it.each([
    "Yes, you are eligible for TDIU.",
    "You are eligible for TDIU based on the combined rating of 80%.",
    "Given that there is only one condition and it meets the criteria for a 60% rating, you would indeed qualify for Total Disability Based on Individual Unemployability (TDIU).",
    "Your combined rating is approximately 99%, which qualifies you for a TDIU rating.",
    "However, based on the data you have, you are eligible for TDIU with your current 60% rating.",
  ])("flags: %s", (sentence) => {
    expect(rules(sentence, ["tdiu"], { hasConditions: true })).toEqual([
      "tdiu-from-percentages",
    ]);
  });

  it.each([
    "You are eligible for TDIU consideration under 38 CFR § 4.16(a).",
    "Yes, you likely qualify for TDIU.",
    "With a 70% rating, you may qualify for TDIU.",
    "Yes, you can qualify for TDIU with only one 60% mental health rating.",
    "Can you qualify for TDIU with only one 60% rating?",
    "You meet the rating percentage requirement for TDIU with a single 60% rating.",
    "If you have evidence of unemployability, you may be eligible for TDIU based on the single 60% rating.",
    "While your current rating qualifies you for TDIU, the actual determination of whether you are unable to work is made by VA.",
    "You are not eligible for TDIU.",
    "You are eligible for a Combined Rating of 80%.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, ["tdiu"], { hasConditions: true })).toEqual([]);
  });

  it("leaves a headline alone when the next sentence gives the work requirement", () => {
    const text =
      "Yes, you qualify for TDIU with a single 60% rating. Per 38 CFR § 4.16(a), a veteran is eligible for TDIU if they have one disability ratable at 60 percent or more and are unable to secure or follow a substantially gainful occupation.";
    expect(rules(text, ["tdiu"])).toEqual([]);
  });
});

describe("TDIU denied on the percentages", () => {
  const denial = "No, you cannot qualify for TDIU with only a 50% rating.";

  it("flags it when no structured conditions were supplied", () => {
    const [hit] = findContradictions(denial, { topics: ["tdiu"] });
    expect(hit.rule).toBe("tdiu-denied-on-percentages");
    expect(hit.correction).toBe("tdiu-extra-schedular");
  });

  it("leaves it to the calculator guard when the call carried conditions", () => {
    expect(rules(denial, ["tdiu"], { hasConditions: true })).toEqual([]);
  });

  it("leaves it alone when the answer already mentions extra-schedular referral", () => {
    expect(
      rules(
        `${denial} VA can still refer the case for extra-schedular consideration under § 4.16(b).`,
        ["tdiu"],
      ),
    ).toEqual([]);
  });

  it("leaves a denial that turns on the ability to work alone", () => {
    expect(
      rules(
        "If you are able to work, you are not eligible for TDIU even with a 60% rating.",
        ["tdiu"],
      ),
    ).toEqual([]);
  });
});

describe("filing instructions that name the wrong document or lane", () => {
  const REVIEW = ["decision-review"];

  it.each([
    [
      "If the VA denies the Supplemental Claim, the veteran then has one year to file a Statement of the Case (SOC) with the Board of Veterans' Appeals.",
      ["files-statement-of-the-case"],
    ],
    [
      "Submit a Statement of the Case (SOC) to the Board of Veterans' Appeals to request a higher-level review.",
      ["files-statement-of-the-case", "higher-level-review-at-the-board"],
    ],
    [
      "Send your Higher-Level Review request to the Board of Veterans' Appeals.",
      ["higher-level-review-at-the-board"],
    ],
    [
      "Fill out the form requesting an HLR, including any new evidence or arguments you wish to submit.",
      ["higher-level-review-new-evidence"],
    ],
    [
      "Gather new evidence and request a HLR.",
      ["higher-level-review-new-evidence"],
    ],
  ])("flags: %s", (sentence, expected) => {
    expect(rules(sentence, REVIEW)).toEqual(expected);
  });

  it.each([
    "In the legacy system, VA will send you a Statement of the Case after it reviews your disagreement.",
    "You can choose to appeal to the Board of Veterans' Appeals or request a higher-level review within the VA.",
    "File a Supplemental Claim (new evidence), request a Higher-Level Review (same evidence, new rater), or appeal to the Board of Veterans' Appeals.",
    "A Higher-Level Review does not accept new evidence.",
    "File a Notice of Disagreement with the Board of Veterans' Appeals on VA Form 10182.",
  ])("leaves alone: %s", (sentence) => {
    expect(rules(sentence, REVIEW)).toEqual([]);
  });
});

describe("findContradictions", () => {
  it("applies only the rules of the request's topics", () => {
    const text =
      "Yes, you are eligible for TDIU. Sleep apnea cannot be service-connected secondary to PTSD.";
    expect(rules(text, [])).toEqual([]);
    expect(rules(text, ["tdiu"])).toEqual(["tdiu-from-percentages"]);
    expect(rules(text, ["secondary"])).toEqual(["secondary-barred"]);
  });

  it("reports each rule once, with the first sentence that broke it", () => {
    const text =
      "Yes, you are eligible for TDIU. To repeat: you are eligible for TDIU.";
    const hits = findContradictions(text, { topics: ["tdiu"] });
    expect(hits).toHaveLength(1);
    expect(hits[0].sentence).toBe("Yes, you are eligible for TDIU.");
  });

  it("reads through markdown emphasis", () => {
    expect(rules("**Yes, you are eligible for TDIU.**", ["tdiu"])).toEqual([
      "tdiu-from-percentages",
    ]);
  });

  it("handles empty input", () => {
    expect(findContradictions("", { topics: ["tdiu"] })).toEqual([]);
    expect(findContradictions(undefined)).toEqual([]);
  });
});

describe("buildContradictionNote", () => {
  it("says what the answer said and quotes the one sentence in point", () => {
    const [hit] = findContradictions(
      "Sleep apnea cannot be service-connected secondary to PTSD.",
      { topics: ["secondary"] },
    );
    const note = buildContradictionNote(hit);
    expect(note).toBe(
      `Vet-Rate check: this answer says a secondary connection cannot be made. 38 CFR § 3.310(a) says: "${quotes.corrections.secondary.text}" Check this point with a Veterans Service Officer before relying on it.`,
    );
  });

  it("spells out an abbreviation the quotation uses", () => {
    const [hit] = findContradictions(
      "To be eligible under the PACT Act, you must prove that you were exposed.",
      { topics: ["toxic-exposure"] },
    );
    expect(buildContradictionNote(hit)).toContain(
      '"VA will presume BPOT exposure for any Veteran who served during the applicable timeframe in one of the locations as listed in the table below." (BPOT means burn pits and other toxins, including fine particulate matter)',
    );
  });
});

describe("flagContradictions", () => {
  const SECONDARY_PROMPT =
    "Generate a nexus letter linking my sleep apnea (secondary) to my service-connected PTSD.";
  const wrong =
    "Since no such mechanism exists between PTSD and sleep apnea, a clinician cannot provide a valid opinion on this connection.";

  it("puts the correction before the answer and leaves the answer unaltered below it", () => {
    const out = flagContradictions(
      { text: wrong, usedMode: "swarm" },
      { toolId: "nexus-builder" },
      SECONDARY_PROMPT,
    );
    expect(out.text).toBe(
      [
        "Vet-Rate check: part of the answer below conflicts with the regulation.",
        "",
        `The answer says: "${wrong}"`,
        `That says a secondary connection cannot be made. 38 CFR § 3.310(a) says: "${quotes.corrections.secondary.text}"`,
        "",
        "Check that part with a Veterans Service Officer before relying on it. The answer follows, unchanged.",
        "",
        wrong,
      ].join("\n"),
    );
    expect(out.text.endsWith(wrong)).toBe(true);
    expect(out.contradictionsFound).toEqual([
      { rule: "secondary-barred", sentence: wrong },
    ]);
    expect(out.validationWarnings).toEqual([
      "Answer contradicts the verified reference: secondary-barred",
    ]);
    expect(out.usedMode).toBe("swarm");
  });

  it("returns the same object when nothing contradicts", () => {
    const result = { text: "I can help you request a nexus letter." };
    expect(flagContradictions(result, {}, SECONDARY_PROMPT)).toBe(result);
  });

  it("does not apply a topic the request did not raise", () => {
    const result = { text: wrong };
    expect(flagContradictions(result, {}, "How do I claim tinnitus?")).toBe(
      result,
    );
  });

  it("leaves structured output, opted-out calls and calculator text alone", () => {
    const json = { text: `{"note": "${wrong}"}` };
    expect(flagContradictions(json, {}, SECONDARY_PROMPT)).toBe(json);
    const optedOut = { text: wrong };
    expect(
      flagContradictions(optedOut, { useDKB: false }, SECONDARY_PROMPT),
    ).toBe(optedOut);
    const calculatorText = { text: wrong, modelCalled: false };
    expect(flagContradictions(calculatorText, {}, SECONDARY_PROMPT)).toBe(
      calculatorText,
    );
  });

  it("checks a TDIU denial in a model answer whether or not the call carried conditions", () => {
    const denial = {
      text: "No, you cannot qualify for TDIU on these ratings.",
    };
    const conditions = [
      { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
    ];
    expect(
      flagContradictions(denial, { conditions }, "Can I get TDIU?")
        .contradictionsFound,
    ).toHaveLength(1);
    expect(
      flagContradictions(denial, {}, "Can I get TDIU?").contradictionsFound,
    ).toEqual([
      {
        rule: "tdiu-denied-on-percentages",
        sentence: "No, you cannot qualify for TDIU on these ratings.",
      },
    ]);
  });
});
