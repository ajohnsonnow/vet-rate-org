/**
 * ADR-010 section 11 in the evaluation: on a small-class model the a-cases
 * record what the app shows, which is app text with no model call.
 */
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateVARating } from "../../../utils/vaCalculator";
import { resolveAgentForTool } from "../../../utils/agentBoundaries";
import { SWARM_AGENTS } from "../../../utils/diamondSwarm";
import { answerRatingQuestion } from "../../../utils/ratingQuestion";
import {
  OPEN_ADVICE_HELD_MESSAGE,
  openAdviceHeldAnswer,
} from "../../../utils/openAdviceHold";
import {
  AUTO_FAIL,
  AUTO_PASS,
  NOT_APPLICABLE,
  checkRouting,
} from "../../../../scripts/eval/lib/goldenChecks.js";
import { runSmallModelDryRun } from "../../../../scripts/eval/lib/dryRun.js";
import { loadGoldenSet } from "../../../../scripts/eval/lib/goldenSet.js";
import { assembleCaseRecord } from "../../../../scripts/eval/lib/caseRecord.js";
import { noModelAnswerer } from "../../../../scripts/eval/lib/noModelCases.js";

const GOLDEN = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
);
const byId = (id) => GOLDEN.find((c) => c.id === id);
const personaPrompts = Object.fromEntries(
  Object.values(SWARM_AGENTS).map((a) => [a.id, a.systemPrompt]),
);
const production = {
  resolveAgentForTool,
  answerRatingQuestion,
  openAdviceHeldAnswer,
};
const onSmall = noModelAnswerer({ ...production, smallModel: true });
const onLarger = noModelAnswerer({ ...production, smallModel: false });
const smallCtx = { calculateVARating, answerWithoutModel: onSmall };

const recordOf = (caseDef, outcome) =>
  assembleCaseRecord({
    caseDef,
    run: { modelIdRequested: "m", modelIdLoaded: "m", maxTokens: 1024 },
    personaPrompts,
    outcome,
  });
const heldOutcome = {
  ok: true,
  text: OPEN_ADVICE_HELD_MESSAGE,
  latencyMs: 1,
  captured: [],
  resultFlags: { openAdviceHeld: true, onDevice: true, modelCalled: false },
};

describe("which cases the app answers itself on a small-class model", () => {
  it("holds every open question sent straight to the assistant path", () => {
    for (const id of ["a01", "a06", "a15", "a20", "a21", "a30"]) {
      expect(onSmall(byId(id)), id).toEqual(openAdviceHeldAnswer());
    }
  });

  it("still answers rating questions from the calculator or asks for ratings", () => {
    expect(onSmall(byId("a11")).calculatorLead).toEqual({ expected: 80 });
    expect(onSmall(byId("a14")).needsRatings).toBe(true);
  });

  it("leaves an empty question and the tool cases alone", () => {
    expect(byId("a22").input.trim()).toBe("");
    expect(onSmall(byId("a22"))).toBeNull();
    expect(onSmall(byId("t01"))).toBeNull();
    expect(onSmall(byId("t07"))).toBeNull();
  });

  it("holds nothing on a larger model", () => {
    expect(onLarger(byId("a01"))).toBeNull();
    expect(onLarger(byId("a21"))).toBeNull();
    expect(onLarger(byId("a11")).calculatorLead).toEqual({ expected: 80 });
  });
});

describe("the record and the routing check for a held question", () => {
  const caseDef = byId("a01");

  it("records the marker, the fixed message and no request", () => {
    expect(recordOf(caseDef, heldOutcome)).toMatchObject({
      openAdviceHeld: true,
      modelCalled: false,
      engineRequests: 0,
      actualAgent: null,
      response: OPEN_ADVICE_HELD_MESSAGE,
    });
  });

  it("has no routing to check", () => {
    const out = checkRouting(caseDef, recordOf(caseDef, heldOutcome), smallCtx);
    expect(out.status).toBe(NOT_APPLICABLE);
    expect(out.detail).toBe(
      "small-class model: the app showed its fixed message, no model was called",
    );
  });

  it("fails routing when a small-class model was asked an open question", () => {
    const called = recordOf(caseDef, {
      ok: true,
      text: "A model answer.",
      latencyMs: 900,
      captured: [
        {
          messages: [
            { role: "system", content: personaPrompts.auditor },
            { role: "user", content: caseDef.input },
          ],
        },
      ],
      resultFlags: { mode: "swarm" },
    });
    expect(checkRouting(caseDef, called, smallCtx).status).toBe(AUTO_FAIL);
    expect(
      checkRouting(caseDef, called, {
        calculateVARating,
        answerWithoutModel: onLarger,
      }).status,
    ).toBe(AUTO_PASS);
  });
});

describe("the dry run's small-model pass", () => {
  const run = (answerWithoutModel) =>
    runSmallModelDryRun({
      cases: GOLDEN,
      personaPrompts,
      resolveAgentForTool,
      answerWithoutModel,
      settings: { temperature: 0, maxTokens: 1024 },
      ctx: { calculateVARating },
    });

  it("every a-case with a question is app text with no model call", () => {
    const out = run(onSmall);
    expect(out.problems).toEqual([]);
    expect(out.held).toBe(23);
    expect(out.calculator).toBe(5);
    expect(out.needsRatings).toBe(1);
  });

  it("reports a case that reached the model", () => {
    const leaky = (caseDef) => (caseDef.id === "a05" ? null : onSmall(caseDef));
    expect(run(leaky).problems).toEqual([
      "a05: a model was called on the small-model pass",
    ]);
  });
});
