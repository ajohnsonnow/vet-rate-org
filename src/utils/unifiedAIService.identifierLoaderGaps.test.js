/**
 * D20-5: `_redactPiecesForSend` used to trust whatever the identifier loader
 * returned. A loader that threw before any successful load, or that returned
 * an EMPTY identifier set without throwing, sent a typed ISO DOB (and any
 * other pattern-detectable value) to the off-device body, because known-value
 * redaction had nothing to match and the aggressive scrubber only ran on a
 * throw. An empty or unavailable identifier set is now a failure for
 * off-device sends: every source is consulted (VKB personal, flat profile,
 * last known in-session copy) and, if still nothing, the aggressive scrubber
 * runs and a warning is recorded.
 *
 * A name this app has never seen has no shape and cannot be recognised; that
 * limit is documented in ADR-008 and pinned by the last test here.
 *
 * Fixtures are synthetic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FAKE_NAME = "Jordan Faketon";
const ISO_DOB = "1984-03-15";

const loadVKBMock = vi.fn();

vi.mock("./localServerClient", () => ({
  checkServerHealth: vi.fn().mockResolvedValue({ available: false }),
  chatCompletion: vi.fn().mockResolvedValue("local server response"),
  getServerConfig: vi.fn(() => ({ host: "localhost", port: 8080 })),
}));

vi.mock("./veteranKnowledgeBase", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadVKB: loadVKBMock };
});

const {
  generateAI,
  setAIMode,
  AI_MODES,
  resetAICircuitBreaker,
  resetLastKnownGoodRedactionProfile,
} = await import("./unifiedAIService.js");
const { AI_DATA_CLASS } = await import("./aiDataClassPolicy.js");

function mockCloudFetchOk() {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    }),
  });
}

async function sendContextCall(text) {
  await generateAI(text, {
    dataClass: AI_DATA_CLASS.CONTEXT,
    systemPrompt: "You are a helpful assistant.",
    skipCrisisCheck: true,
    skipFeatureCheck: true,
    skipHallucinationCheck: true,
    skipValidation: true,
    useDKB: false,
  });
}

function lastBody() {
  return fetch.mock.calls.at(-1)[1].body;
}

function redactionWarned(warnSpy) {
  return warnSpy.mock.calls.some((args) =>
    String(args[0]).includes("_redactPiecesForSend"),
  );
}

let warnSpy;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetAICircuitBreaker();
  resetLastKnownGoodRedactionProfile();
  vi.stubGlobal("fetch", vi.fn());
  setAIMode(AI_MODES.CLOUD);
  localStorage.setItem(
    "vetrate_gemini_key",
    "AIzaSyValidKey12345678901234567890123",
  );
  mockCloudFetchOk();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe("D20-5: loader throws before any successful load", () => {
  it("scrubs a labeled ISO DOB and records a warning", async () => {
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));

    await sendContextCall(`I was born ${ISO_DOB}, please review my case.`);

    expect(lastBody()).not.toContain(ISO_DOB);
    expect(redactionWarned(warnSpy)).toBe(true);
  });

  it("still uses the flat profile when only the VKB loader failed", async () => {
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify({ fullName: FAKE_NAME }),
    );

    await sendContextCall(`My name is ${FAKE_NAME}, please review my case.`);

    expect(lastBody()).not.toContain(FAKE_NAME);
  });
});

describe("D20-5: loader returns an empty identifier set without throwing", () => {
  it("scrubs a labeled ISO DOB and records a warning", async () => {
    loadVKBMock.mockResolvedValue({
      personal: {},
      vaClaimsHistory: { claims: [] },
    });

    await sendContextCall(`DOB: ${ISO_DOB}. Please review my case.`);

    expect(lastBody()).not.toContain(ISO_DOB);
    expect(redactionWarned(warnSpy)).toBe(true);
  });

  it("falls back to the last known in-session copy for a name", async () => {
    loadVKBMock.mockResolvedValue({
      personal: { fullName: FAKE_NAME },
      vaClaimsHistory: { claims: [] },
    });
    await sendContextCall("What are my options for my upcoming appeal?");

    loadVKBMock.mockResolvedValue({ personal: {} });
    await sendContextCall(`My name is ${FAKE_NAME}, born ${ISO_DOB}.`);

    expect(lastBody()).not.toContain(FAKE_NAME);
    expect(lastBody()).not.toContain(ISO_DOB);
    expect(redactionWarned(warnSpy)).toBe(true);
  });
});

describe("D20-5: after a successful load", () => {
  it("redacts the stored name and DOB without any fallback warning", async () => {
    loadVKBMock.mockResolvedValue({
      personal: { fullName: FAKE_NAME, dateOfBirth: ISO_DOB },
      vaClaimsHistory: { claims: [] },
    });

    await sendContextCall(`My name is ${FAKE_NAME}, born ${ISO_DOB}.`);

    expect(lastBody()).not.toContain(FAKE_NAME);
    expect(lastBody()).not.toContain(ISO_DOB);
    expect(redactionWarned(warnSpy)).toBe(false);
  });
});

describe("D20-5: documented limit", () => {
  it("a name this app has never seen is not recognised when nothing is stored", async () => {
    loadVKBMock.mockResolvedValue({ personal: {} });

    await sendContextCall(`My name is ${FAKE_NAME}, please review my case.`);

    expect(lastBody()).toContain(FAKE_NAME);
  });
});
