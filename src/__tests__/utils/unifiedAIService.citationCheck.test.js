/**
 * The citation check runs on what generateAI returns: an answer that cites a
 * 38 CFR section that does not exist gets a notice under it and a marker on
 * the result.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../utils/aiSystemPrompts", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildDKBContext: vi.fn().mockResolvedValue("") };
});
vi.mock("../../utils/diamondSwarm", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSwarmReady: vi.fn().mockReturnValue(false),
    generateWithSwarm: vi.fn(),
    initializeSwarm: vi.fn(),
    switchAgent: vi.fn(),
    unloadSwarm: vi.fn(),
  };
});
vi.mock("../../utils/wllamaService", () => ({
  initializeWllama: vi.fn().mockResolvedValue(true),
  isWllamaAvailable: vi.fn().mockReturnValue(false),
  chatCompletion: vi.fn(),
  generateWithModel: vi.fn(),
  getWllamaStatus: vi.fn().mockReturnValue({ ready: false }),
  unloadWllama: vi.fn(),
  WLLAMA_MODELS: {},
}));
vi.mock("../../utils/deviceCapabilityDetector", () => ({
  detectDeviceCapabilities: vi.fn().mockResolvedValue({
    tier: "desktop",
    hasWebGPU: true,
    canUseWebLLM: true,
  }),
}));
vi.mock("../../utils/localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));
vi.mock("../../utils/crisisInterceptor", () => ({
  interceptBeforeAICall: vi.fn().mockResolvedValue({ shouldBlock: false }),
}));
vi.mock("../../utils/featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

import {
  generateAI,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  resetAICircuitBreaker,
} from "../../utils/unifiedAIService";
import * as diamondSwarm from "../../utils/diamondSwarm";
import { AI_DATA_CLASS } from "../../utils/aiDataClassPolicy";
import { buildCitationNotice } from "../../utils/citationCheck";
import { buildFormNotice } from "../../utils/formCheck";

// These calls stand for the assistant chat, an advice surface.
const callOptions = (overrides = {}) => ({
  answerChecks: true,
  dataClass: AI_DATA_CLASS.CONTEXT,
  skipCrisisCheck: true,
  skipFeatureCheck: true,
  skipHallucinationCheck: true,
  skipValidation: true,
  ...overrides,
});

const modelSays = (text) =>
  diamondSwarm.generateWithSwarm.mockResolvedValue({ text });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  registerSwarmEngine({}, true, false, "auditor");
  setAIMode(AI_MODES.SWARM);
});

afterEach(() => {
  localStorage.clear();
});

describe("generateAI citation check", () => {
  it("adds the notice and marker when the answer cites a section that does not exist", async () => {
    const answer =
      "Sleep apnea cannot be service connected secondary to PTSD under 38 CFR § 4.37.";
    modelSays(answer);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(`${answer}\n\n${buildCitationNotice(["4.37"])}`);
    expect(result.citationsUnverified).toEqual({ sections: ["4.37"] });
    expect(result.validationWarnings).toContain(
      "Answer cites 38 CFR sections that could not be verified: 4.37",
    );
  });

  it("returns an answer with real citations as the model wrote it", async () => {
    const answer =
      "Secondary service connection is governed by 38 CFR § 3.310(a).";
    modelSays(answer);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(answer);
    expect(result.citationsUnverified).toBeUndefined();
  });

  it("does not touch output the caller asked for as JSON", async () => {
    const json = '{"basis":"38 CFR § 4.37"}';
    modelSays(json);

    const result = await generateAI(
      "Explain my denial",
      callOptions({ responseFormat: { type: "json_object" } }),
    );

    expect(result.text).toBe(json);
    expect(result.citationsUnverified).toBeUndefined();
  });
});

describe("generateAI form check", () => {
  it("adds the notice and marker when the answer names a form number in neither list", async () => {
    const answer =
      "After the Intent to File (VA Form 21-0966), VA will issue the application (VA Form 22-5300).";
    modelSays(answer);

    const result = await generateAI(
      "What is an intent to file?",
      callOptions(),
    );

    expect(result.text).toBe(`${answer}\n\n${buildFormNotice(["22-5300"])}`);
    expect(result.formsUnverified).toEqual({ forms: ["22-5300"] });
  });

  it("puts it after the citation notice when both apply", async () => {
    modelSays("Under 38 CFR § 4.37, file VA Form 22-5388.");

    const result = await generateAI("Explain my denial", callOptions());

    expect(
      result.text.endsWith(
        `${buildCitationNotice(["4.37"])}\n\n${buildFormNotice(["22-5388"])}`,
      ),
    ).toBe(true);
  });

  it("leaves an answer with known forms as the model wrote it", async () => {
    const answer = "File a Supplemental Claim on VA Form 20-0995.";
    modelSays(answer);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(answer);
    expect(result.formsUnverified).toBeUndefined();
  });
});

describe("generateAI on a route that is not an advice surface", () => {
  const EVERYTHING_WRONG =
    "VA adds the ratings together under 38 CFR § 4.37, so file VA Form 22-5388.";
  const whatComesBack = async (options) => {
    modelSays(EVERYTHING_WRONG);
    const result = await generateAI(
      "Suggest text for this field",
      callOptions({ answerChecks: undefined, ...options }),
    );
    return {
      text: result.text,
      contradictions: result.contradictionsFound,
      citations: result.citationsUnverified,
      forms: result.formsUnverified,
    };
  };
  const AS_WRITTEN = {
    text: EVERYTHING_WRONG,
    contradictions: undefined,
    citations: undefined,
    forms: undefined,
  };

  it("checks that text on the chat, to show the three would fire", async () => {
    modelSays(EVERYTHING_WRONG);
    const result = await generateAI("How are ratings combined?", callOptions());
    expect(result.contradictionsFound.map((c) => c.rule)).toEqual([
      "ratings-added-together",
    ]);
    expect(result.citationsUnverified).toEqual({ sections: ["4.37"] });
    expect(result.formsUnverified).toEqual({ forms: ["22-5388"] });
  });

  it.each([
    "personal-statement",
    "buddy-statement",
    "appeal-statement",
    "nexus-builder",
    "tdiu-narrative",
    "statement-wizard",
    "witness-bench",
  ])("returns a %s result exactly as the model wrote it", async (toolId) => {
    expect(await whatComesBack({ toolId })).toEqual(AS_WRITTEN);
  });

  it("returns a result with no tool named exactly as written (Symptom Logger suggestion)", async () => {
    expect(await whatComesBack({})).toEqual(AS_WRITTEN);
  });

  it("does not let a writer tool opt in", async () => {
    expect(
      await whatComesBack({
        toolId: "personal-statement",
        answerChecks: true,
      }),
    ).toEqual(AS_WRITTEN);
  });

  it("still checks an advice tool that passes its id", async () => {
    modelSays(EVERYTHING_WRONG);
    const result = await generateAI(
      "How are ratings combined?",
      callOptions({ answerChecks: undefined, toolId: "war-room" }),
    );
    expect(result.contradictionsFound.map((c) => c.rule)).toEqual([
      "ratings-added-together",
    ]);
  });
});

describe("generateAI contradiction check", () => {
  const SECONDARY_QUESTION =
    "Generate a nexus letter linking my sleep apnea (secondary) to my service-connected PTSD.";
  const WRONG =
    "Since no such mechanism exists between PTSD and sleep apnea, a clinician cannot provide a valid opinion on this connection.";

  it("adds the correction and marker when the answer contradicts the verified text", async () => {
    modelSays(WRONG);

    const result = await generateAI(SECONDARY_QUESTION, callOptions());

    expect(
      result.text.startsWith(
        "Vet-Rate check: part of the answer below may not match the regulation.",
      ),
    ).toBe(true);
    expect(result.text).toContain(
      `The answer says: "${WRONG}"\nThis reads as if it says a secondary connection cannot be made. Compare it with 38 CFR § 3.310(a): "(a) General. Except as provided in § 3.300(c), disability which is proximately due to or the result of a service-connected disease or injury shall be service connected."`,
    );
    expect(result.text.endsWith(`\n\n${WRONG}`)).toBe(true);
    expect(result.contradictionsFound).toEqual([
      { rule: "secondary-barred", sentence: WRONG },
    ]);
  });

  it("leads with the correction and keeps the citation notice under the answer", async () => {
    const answer = `${WRONG} See 38 CFR § 4.37.`;
    modelSays(answer);

    const result = await generateAI(SECONDARY_QUESTION, callOptions());

    expect(result.text.indexOf("Vet-Rate check:")).toBe(0);
    expect(
      result.text.endsWith(`${answer}\n\n${buildCitationNotice(["4.37"])}`),
    ).toBe(true);
  });

  it("corrects the answer the live site gave, as the assistant chat calls it", async () => {
    const answer =
      "The short answer is: Generally, no. Under current VA regulations, sleep apnea cannot be rated as secondary to PTSD.";
    modelSays(answer);

    const result = await generateAI(
      "Can I get service connection for sleep apnea secondary to PTSD?",
      callOptions({ taskType: "assistant" }),
    );

    expect(result.onDevice).toBe(true);
    expect(result.contradictionsFound).toEqual([
      {
        rule: "secondary-barred",
        sentence:
          "Under current VA regulations, sleep apnea cannot be rated as secondary to PTSD.",
      },
    ]);
    expect(result.text.indexOf("Vet-Rate check:")).toBe(0);
    expect(result.text.endsWith(answer)).toBe(true);
  });

  it("does not add it inside the Nexus Builder, where the text is a draft", async () => {
    modelSays(WRONG);

    const result = await generateAI(
      SECONDARY_QUESTION,
      callOptions({ toolId: "nexus-builder" }),
    );

    expect(result.text).toBe(WRONG);
    expect(result.contradictionsFound).toBeUndefined();
  });

  it("leaves an answer on another topic alone", async () => {
    modelSays(WRONG);

    const result = await generateAI("Explain my denial", callOptions());

    expect(result.text).toBe(WRONG);
    expect(result.contradictionsFound).toBeUndefined();
  });
});
