import { describe, it, expect } from "vitest";
import {
  analyzeEngineRequest,
  buildCaseRecord,
  fingerprintPersonas,
  parseTranscript,
  runBaseName,
  runStamp,
  sha256Hex,
  validateModelId,
} from "../../../../scripts/eval/lib/goldenRecord.js";
import { SWARM_AGENTS } from "../../../utils/diamondSwarm";

const personas = {
  auditor: "AUDITOR PROMPT",
  writer: "WRITER PROMPT",
  rater: "RATER PROMPT",
};

const request = (userText, system = personas.rater) => ({
  messages: [
    { role: "system", content: system },
    { role: "user", content: userText },
  ],
  max_tokens: 512,
  temperature: 0.2,
});

describe("analyzeEngineRequest", () => {
  it("identifies the persona and fingerprints the system prompt", () => {
    const out = analyzeEngineRequest(request("hi"), personas);
    expect(out.actualAgent).toBe("rater");
    expect(out.systemPromptFingerprint).toBe(sha256Hex("RATER PROMPT"));
    expect(out.temperature).toBeCloseTo(0.2);
    expect(out.maxTokens).toBe(512);
    expect(out.kbContextInjected).toBe(false);
    expect(out.kbEntryCount).toBe(0);
    expect(out.computedResultInjected).toBe(false);
  });

  it("reports an unrecognised system prompt as unknown", () => {
    expect(
      analyzeEngineRequest(request("hi", "something else"), personas)
        .actualAgent,
    ).toBe("unknown");
  });

  it("counts knowledge-base entries from the DKB block", () => {
    const text =
      "q\n\n=== 💎 DIAMOND KNOWLEDGE BASE (DKB) CONTEXT ===\nx\n[4 relevant DKB entries provided from BVA]\n=== END DKB CONTEXT ===";
    const out = analyzeEngineRequest(request(text), personas);
    expect(out.kbContextInjected).toBe(true);
    expect(out.kbEntryCount).toBe(4);
    expect(out.kbShardCount).toBe(0);
    expect(out.kbContext).toMatch(
      /^=== .*CONTEXT ===\nx\n\[4 .*=== END DKB CONTEXT ===$/s,
    );
  });

  it("counts full-corpus passages from the flag-on block", () => {
    const text =
      "q\n\n=== 💎 DIAMOND KNOWLEDGE BASE (DKB) CONTEXT ===\nx\n[5 relevant knowledge base entries provided: 3 retrieved from the full corpus, 2 curated DKB entries]\n=== END DKB CONTEXT ===";
    const out = analyzeEngineRequest(request(text), personas);
    expect(out.kbEntryCount).toBe(5);
    expect(out.kbShardCount).toBe(3);
  });

  it("detects the computed-result block", () => {
    const text =
      "q\n\n=== COMPUTED RESULT (38 CFR § 4.25/4.26 - already calculated, do not recompute) ===\nCombined rating: 50%\n=== END COMPUTED RESULT ===";
    expect(
      analyzeEngineRequest(request(text), personas).computedResultInjected,
    ).toBe(true);
  });

  it("reads array-style message content", () => {
    const req = {
      messages: [
        { role: "system", content: [{ type: "text", text: "WRITER PROMPT" }] },
        { role: "user", content: "hi" },
      ],
    };
    expect(analyzeEngineRequest(req, personas).actualAgent).toBe("writer");
  });

  it("returns nulls, not guesses, when nothing was captured", () => {
    const out = analyzeEngineRequest(null, personas);
    expect(out.actualAgent).toBeNull();
    expect(out.kbContextInjected).toBeNull();
    expect(out.computedResultInjected).toBeNull();
  });

  it("fingerprints the real persona prompts the way agenticEval pins them", () => {
    const prompts = Object.fromEntries(
      Object.values(SWARM_AGENTS).map((a) => [a.id, a.systemPrompt]),
    );
    const fingerprints = fingerprintPersonas(prompts);
    expect(fingerprints.auditor).toBe(
      "322920644cccbb5c4384754930ba2d0b2d59b997719ace9eb2fd463de0bcb680",
    );
    const sent = analyzeEngineRequest(request("hi", prompts.writer), prompts);
    expect(sent.actualAgent).toBe("writer");
    expect(sent.systemPromptFingerprint).toBe(fingerprints.writer);
  });
});

describe("buildCaseRecord", () => {
  const caseDef = {
    id: "a11",
    toolId: "calculator",
    scenario: "s",
    input: "i",
    expectedAgent: "rater",
  };
  const run = {
    modelIdRequested: "M",
    modelIdLoaded: "M",
    temperature: 0,
    maxTokens: 100,
  };

  it("records every field the transcript promises", () => {
    const record = buildCaseRecord({
      caseDef,
      run,
      captured: request("hi"),
      personaPrompts: personas,
      response: "ok",
      latencyMs: 1234,
      error: null,
    });
    expect(record).toMatchObject({
      type: "case",
      id: "a11",
      expectedAgent: "rater",
      actualAgent: "rater",
      modelIdLoaded: "M",
      systemPromptFingerprint: sha256Hex("RATER PROMPT"),
      kbContextInjected: false,
      kbEntryCount: 0,
      computedResultInjected: false,
      temperature: 0.2,
      maxTokens: 512,
      response: "ok",
      latencyMs: 1234,
      error: null,
    });
  });

  it("falls back to the requested settings when no request was captured", () => {
    const record = buildCaseRecord({
      caseDef,
      run,
      captured: null,
      personaPrompts: personas,
      response: "",
      latencyMs: 5,
      error: "AI_TIMEOUT",
    });
    expect(record.temperature).toBe(0);
    expect(record.maxTokens).toBe(100);
    expect(record.error).toBe("AI_TIMEOUT");
    expect(record.actualAgent).toBeNull();
  });
});

describe("model id and file naming", () => {
  it("accepts WebLLM style ids", () => {
    expect(validateModelId("Qwen2.5-3B-Instruct-q4f16_1-MLC")).toBe(
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    );
  });

  it.each(["", "a b", "../x", "a/b", "x;rm", "-lead", "a".repeat(129), null])(
    "rejects %j",
    (bad) => {
      expect(() => validateModelId(bad)).toThrow(/invalid model id/);
    },
  );

  it("puts date and model id in the file name", () => {
    const date = new Date("2026-10-04T23:15:09Z");
    expect(runStamp(date)).toBe("2026-10-04_231509");
    expect(runBaseName("Qwen3-4B", date)).toBe(
      "run_2026-10-04_231509_Qwen3-4B",
    );
  });
});

describe("parseTranscript", () => {
  it("splits the meta line from case lines and names the bad line", () => {
    const text = [
      JSON.stringify({ type: "meta", engine: "e" }),
      JSON.stringify({ type: "case", id: "a01" }),
      "",
    ].join("\n");
    const out = parseTranscript(text);
    expect(out.meta.engine).toBe("e");
    expect(out.cases).toHaveLength(1);
    expect(() => parseTranscript("{}\nnot json")).toThrow(/line 2/);
  });
});
