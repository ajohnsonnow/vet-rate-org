/**
 * Order and relevance of the calculator's answer: a TDIU question is answered
 * right after the combined rating, and the bilateral factor is not mentioned
 * when no entry has a side and the question does not ask about it.
 */
import { describe, it, expect } from "vitest";
import { calculateVARating } from "../../utils/vaCalculator";
import {
  buildCalculatorExplanation,
  buildReplacementNotice,
  buildTdiuThresholdParagraph,
  checkRaterResponse,
} from "../../utils/raterGrounding";
import { enforceCalculatorOnResult } from "../../utils/unifiedAIService";
import { GOLDEN, gradedIntegratedCase } from "./recordedAnswers";

const calcOf = (id) => calculateVARating(GOLDEN[id].conditions);
const NO_PAIR = "No bilateral pair applies.";
const METHOD = "VA does not add ratings together.";
const TDIU_LEAD = "About your question on individual unemployability (TDIU):";
const order = (text, ...parts) => parts.map((part) => text.indexOf(part));
const ascending = (indexes) =>
  indexes.every((v, i) => v >= 0 && (i === 0 || v > indexes[i - 1]));

describe("a TDIU question is answered right after the combined rating", () => {
  const calc = calcOf("a13");
  const text = buildCalculatorExplanation(calc, {
    tdiu: true,
    question: GOLDEN.a13.input,
  });

  it("combined rating, then the threshold paragraph, then the working", () => {
    expect(
      ascending(
        order(
          text,
          "Your combined rating is 80%.",
          TDIU_LEAD,
          METHOD,
          "Step 1: 60% combined with 20% = 68%",
          "Check these figures with a Veterans Service Officer",
        ),
      ),
    ).toBe(true);
    expect(text).toContain(
      `Your combined rating is 80%.\n\n${buildTdiuThresholdParagraph(calc)}\n\n${METHOD}`,
    );
  });

  it("the recorded a13 answer had the paragraph after a bilateral note that did not apply", () => {
    const shown = gradedIntegratedCase("a13").response;
    expect(ascending(order(shown, NO_PAIR, TDIU_LEAD))).toBe(true);
    expect(text).not.toContain(NO_PAIR);
  });

  it("without a TDIU question the order is as before and there is no paragraph", () => {
    const plain = buildCalculatorExplanation(calcOf("a11"));
    expect(plain).not.toContain(TDIU_LEAD);
    expect(
      ascending(order(plain, "Your combined rating is 80%.", METHOD, NO_PAIR)),
    ).toBe(true);
  });
});

describe("the bilateral factor is mentioned only when it is relevant", () => {
  it.each([
    ["a13", "no sided entry, a TDIU question"],
    ["a11", "no sided entry, a combined-rating question"],
    ["a24", "one unsided rating"],
    ["a25", "one unsided rating, a TDIU question"],
  ])("%s (%s): nothing about the bilateral factor", (id) => {
    const text = buildCalculatorExplanation(calcOf(id), {
      question: GOLDEN[id].input,
    });
    expect(text).not.toContain(NO_PAIR);
    expect(text).not.toMatch(/bilateral/i);
  });

  it("a12: the pair the calculator formed is always described", () => {
    const text = buildCalculatorExplanation(calcOf("a12"), {
      question: "What is my combined rating?",
    });
    expect(text).toContain("The bilateral factor applies to Left knee");
  });

  it("says no pair applies when the question asks about the bilateral factor", () => {
    const text = buildCalculatorExplanation(calcOf("a11"), {
      question: "Does the bilateral factor change my combined rating?",
    });
    expect(text).toContain(NO_PAIR);
  });

  it("says no pair applies when an entry has a side but nothing pairs with it", () => {
    const calc = calculateVARating([
      { name: "Left knee", rating: 10, side: "left", bodyPart: "knee" },
      { name: "PTSD", rating: 50, side: "none", bodyPart: "mental" },
    ]);
    const text = buildCalculatorExplanation(calc, {
      question: "What is my combined rating?",
    });
    expect(text).toContain(NO_PAIR);
  });

  it("says it when the question is not known, as before", () => {
    expect(buildCalculatorExplanation(calcOf("a11"))).toContain(NO_PAIR);
  });

  it("the wording of the 4.26 note is unchanged", () => {
    expect(buildCalculatorExplanation(calcOf("a11"))).toContain(
      'No bilateral pair applies. The bilateral factor needs "partial disability of compensable degree in each of 2 paired extremities, or paired skeletal muscles" (38 CFR § 4.26(c)), that is both arms or both legs, one on each side. "Arms" and "legs" mean the upper and lower extremities as a whole, so a right thigh and a left foot are a pair (38 CFR § 4.26(a)). Two conditions on the same side are not a pair, and the two highest ratings are not automatically a pair.',
    );
  });
});

describe("the notice can be left off without cutting the text", () => {
  it("withNotice false starts at the combined rating", () => {
    const calc = calcOf("a11");
    const text = buildCalculatorExplanation(calc, { withNotice: false });
    expect(text.startsWith("Your combined rating is 80%.")).toBe(true);
    expect(buildCalculatorExplanation(calc)).toBe(
      `${buildReplacementNotice()}\n\n${text}`,
    );
  });

  it.each(["a11", "a12", "a13", "a24", "a25"])(
    "the reordered text for %s still passes the calculator check",
    (id) => {
      const calc = calcOf(id);
      const text = buildCalculatorExplanation(calc, {
        tdiu: true,
        question: GOLDEN[id].input,
      });
      expect(checkRaterResponse(text, calc).ok).toBe(true);
    },
  );
});

describe("through the guard", () => {
  it("a13: the veteran's question decides the order and what is left out", () => {
    const out = enforceCalculatorOnResult(
      { text: "" },
      { conditions: GOLDEN.a13.conditions },
      GOLDEN.a13.input,
    );
    expect(
      ascending(
        order(out.text, "Your combined rating is 80%.", TDIU_LEAD, METHOD),
      ),
    ).toBe(true);
    expect(out.text).not.toContain(NO_PAIR);
  });

  it("a replaced draft gets the same order under its notice", () => {
    const out = enforceCalculatorOnResult(
      { text: "You are not eligible for TDIU. Your combined rating is 80%." },
      { conditions: GOLDEN.a13.conditions },
      GOLDEN.a13.input,
    );
    expect(
      out.text.startsWith("The AI's draft answer gave a TDIU conclusion"),
    ).toBe(true);
    expect(
      ascending(
        order(out.text, "Your combined rating is 80%.", TDIU_LEAD, METHOD),
      ),
    ).toBe(true);
    expect(out.text).not.toContain(NO_PAIR);
  });
});

describe("a draft that got the pairing wrong", () => {
  it("is answered with the no-pair finding even when the question did not ask", () => {
    const out = enforceCalculatorOnResult(
      {
        text: "PTSD (Left Brain) + Tinnitus (Right Ear) is a valid bilateral pair.",
      },
      { conditions: GOLDEN.a11.conditions },
      "What is my combined rating?",
    );
    expect(out.text).toContain(
      "described a bilateral pairing that did not match",
    );
    expect(out.text).toContain(NO_PAIR);
  });
});
