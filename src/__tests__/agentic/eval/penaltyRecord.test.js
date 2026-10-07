import { describe, it, expect } from "vitest";
import {
  analyzeEngineRequest,
  buildCaseRecord,
} from "../../../../scripts/eval/lib/goldenRecord.js";

const personas = { rater: "RATER PROMPT" };
const sent = (extra = {}) => ({
  messages: [
    { role: "system", content: "RATER PROMPT" },
    { role: "user", content: "hi" },
  ],
  max_tokens: 512,
  temperature: 0.3,
  ...extra,
});

describe("the penalty actually sent is read from the captured request", () => {
  it("records frequency and presence penalty when present", () => {
    const out = analyzeEngineRequest(
      sent({ frequency_penalty: 0.3, presence_penalty: 0.1 }),
      personas,
    );
    expect(out.frequencyPenalty).toBeCloseTo(0.3);
    expect(out.presencePenalty).toBeCloseTo(0.1);
  });

  it("keeps a sent 0 as 0, not as missing", () => {
    const out = analyzeEngineRequest(sent({ frequency_penalty: 0 }), personas);
    expect(out.frequencyPenalty).toBe(0);
    expect(out.presencePenalty).toBeNull();
  });

  it("is null when the request did not carry one, or none was captured", () => {
    expect(analyzeEngineRequest(sent(), personas).frequencyPenalty).toBeNull();
    expect(analyzeEngineRequest(null, personas).frequencyPenalty).toBeNull();
    expect(analyzeEngineRequest(null, personas).presencePenalty).toBeNull();
  });

  it("is on every case record", () => {
    const record = buildCaseRecord({
      caseDef: { id: "a01", toolId: "t", scenario: "s", input: "i" },
      run: { modelIdRequested: "M", modelIdLoaded: "M" },
      captured: sent({ frequency_penalty: 0.3 }),
      personaPrompts: personas,
      response: "ok",
    });
    expect(record.frequencyPenalty).toBeCloseTo(0.3);
    expect(record.presencePenalty).toBeNull();
  });
});
