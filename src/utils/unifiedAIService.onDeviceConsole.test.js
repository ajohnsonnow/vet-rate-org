/**
 * Decision (F): no identifier is ever written to the browser console, where
 * bugReportUtils captures it into reports a veteran can send off-device. The
 * legacy on-device engine paths (non-streaming text and vision) used to log
 * the model's raw response and the generation config. The planted values are
 * synthetic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const PLANTED_NAME = "PLANTEDNAME, SYNTHETIC";
const PLANTED_SSN = "987-65-4321";
const DOCUMENT_TEXT = "UNIQUE_DOCUMENT_TEXT_MARKER_5c1e";

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn(),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

const {
  generateAI,
  generateAIWithImage,
  setAIMode,
  AI_MODES,
  registerSwarmEngine,
  registerLocalAIEngine,
  resetAICircuitBreaker,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

const MODEL_JSON = JSON.stringify({
  fullName: PLANTED_NAME,
  ssn: PLANTED_SSN,
  branch: "Army",
});

let spies;

function captured() {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map(String).join(" "))
    .join("\n");
}

function registerEngine(isVision) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: MODEL_JSON }, finish_reason: "stop" }],
  });
  registerLocalAIEngine(
    { chat: { completions: { create } } },
    true,
    false,
    "test-model",
    isVision,
  );
  registerSwarmEngine(null, false, false, null);
  return create;
}

beforeEach(() => {
  localStorage.clear();
  resetAICircuitBreaker();
  setAIMode(AI_MODES.LOCAL);
  spies = ["log", "info", "debug", "warn", "error"].map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  );
});

afterEach(() => {
  spies.forEach((spy) => spy.mockRestore());
  registerLocalAIEngine(null, false, false, null, false);
});

describe("(F): the legacy on-device engine never logs model text", () => {
  it("non-streaming generateAI returns the model text but logs none of it", async () => {
    registerEngine(false);
    const result = await generateAI(DOCUMENT_TEXT, {
      dataClass: AI_DATA_CLASS.DOCUMENT,
      skipCrisisCheck: true,
      skipFeatureCheck: true,
      skipHallucinationCheck: true,
      skipValidation: true,
      useDKB: false,
    });

    expect(result.text).toContain(PLANTED_NAME);
    const logged = captured();
    expect(logged).not.toContain(PLANTED_NAME);
    expect(logged).not.toContain(PLANTED_SSN);
    expect(logged).not.toContain(DOCUMENT_TEXT);
  });

  it("generateAIWithImage returns the model text but logs none of it", async () => {
    registerEngine(true);
    const result = await generateAIWithImage(
      `read this form ${DOCUMENT_TEXT}`,
      ["data:image/png;base64,AAAA"],
      {},
    );

    expect(JSON.stringify(result)).toContain("PLANTEDNAME");
    const logged = captured();
    expect(logged).not.toContain(PLANTED_NAME);
    expect(logged).not.toContain(PLANTED_SSN);
    expect(logged).not.toContain(DOCUMENT_TEXT);
  });
});
