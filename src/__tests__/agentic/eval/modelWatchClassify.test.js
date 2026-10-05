// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  DESKTOP_MAX_VRAM_MB,
  LAPTOP_MAX_VRAM_MB,
  PHONE_MAX_VRAM_MB,
  buildEntries,
  canonicalId,
  compareRuntime,
  estimateVramMb,
  familyKey,
  findCandidates,
  isSafeModelId,
  licenceFromTags,
  licenceStatus,
  paramsBillionFromId,
  safeNumber,
  tierForVram,
} from "../../../../scripts/eval/lib/modelWatchClassify.js";
import {
  parseAppModels,
  parseWebLlmConfig,
} from "../../../../scripts/eval/lib/modelWatchSources.js";

const read = (rel) =>
  readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8");
const FIXTURE = readFileSync(
  new URL("./fixtures/webllm-config.fixture.txt", import.meta.url),
  "utf8",
);

describe("isSafeModelId", () => {
  it.each([
    "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    "onnx-community/Florence-2-base-ft",
    "Xenova/bge-small-en-v1.5",
  ])("accepts %s", (id) => expect(isSafeModelId(id)).toBe(true));

  it.each([
    "a/b/c",
    "a b",
    "x;rm -rf /",
    "$(whoami)",
    "`id`",
    "${{ secrets.GITHUB_TOKEN }}",
    "evil/../x",
    "../x",
    "..",
    "a\nb",
    "<script>alert(1)</script>",
    `x${String.fromCharCode(0x202e)}y`,
    "",
    "/leading",
    "trailing/",
    "a".repeat(101),
    null,
    42,
  ])("rejects %j", (id) => expect(isSafeModelId(id)).toBe(false));
});

describe("safeNumber", () => {
  it("keeps finite in-range numbers only", () => {
    expect(safeNumber(12.5)).toBe(12.5);
    expect(safeNumber("12")).toBeNull();
    expect(safeNumber(NaN)).toBeNull();
    expect(safeNumber(Infinity)).toBeNull();
    expect(safeNumber(-1)).toBeNull();
    expect(safeNumber(1e15)).toBeNull();
  });
});

describe("tier thresholds", () => {
  it("places VRAM figures by named ceiling", () => {
    expect(tierForVram(PHONE_MAX_VRAM_MB)).toBe("phone");
    expect(tierForVram(PHONE_MAX_VRAM_MB + 1)).toBe("laptop");
    expect(tierForVram(LAPTOP_MAX_VRAM_MB)).toBe("laptop");
    expect(tierForVram(LAPTOP_MAX_VRAM_MB + 1)).toBe("desktop");
    expect(tierForVram(DESKTOP_MAX_VRAM_MB)).toBe("desktop");
    expect(tierForVram(DESKTOP_MAX_VRAM_MB + 1)).toBe("too-large");
    expect(tierForVram(null)).toBeNull();
  });

  it("still covers the models the app loads today, from the real source files", () => {
    const app = parseAppModels({
      detector: read("src/utils/deviceCapabilityDetector.js"),
      florence: read("src/workers/florence-ocr-worker.js"),
      smolvlm: read("src/workers/smolvlm-worker.js"),
      legalRag: read("src/services/legalRag.js"),
    });
    const vram = new Map(
      parseWebLlmConfig(FIXTURE).models.map((m) => [m.id, m.vramMb]),
    );
    const ceilingFor = {
      laptop: LAPTOP_MAX_VRAM_MB,
      tablet: LAPTOP_MAX_VRAM_MB,
    };
    for (const m of app.filter((a) => a.kind === "text")) {
      const needed = vram.get(m.id);
      expect(needed, `${m.id} missing from fixture`).toBeGreaterThan(0);
      if (m.tier === "laptop" && m.id.includes("3B")) continue;
      expect(needed).toBeLessThanOrEqual(
        ceilingFor[m.tier] ?? DESKTOP_MAX_VRAM_MB,
      );
    }
  });

  it("estimates VRAM through the two reference models", () => {
    expect(estimateVramMb(1.5)).toBeCloseTo(1629.75, 1);
    expect(estimateVramMb(3)).toBeCloseTo(2504.76, 1);
  });
});

describe("id helpers", () => {
  it("reads the parameter count out of an id", () => {
    expect(paramsBillionFromId("Qwen3-4B-q0f16-MLC")).toBe(4);
    expect(paramsBillionFromId("mlc-ai/Qwen3-0.6B-q4f16_0-MLC")).toBeCloseTo(
      0.6,
      5,
    );
    expect(
      paramsBillionFromId("stablelm-2-zephyr-1_6b-q4f16_1-MLC"),
    ).toBeCloseTo(1.6, 5);
    expect(
      paramsBillionFromId("SmolLM2-360M-Instruct-q4f16_1-MLC"),
    ).toBeCloseTo(0.36, 5);
    expect(paramsBillionFromId("Phi-4-mini-instruct-q0f16-MLC")).toBeNull();
  });

  it("collapses quantizations of one family and size to one key", () => {
    const key = familyKey("Qwen2.5-3B-Instruct-q4f16_1-MLC");
    expect(key).toBe("qwen2.5-3b-instruct");
    expect(familyKey("Qwen2.5-3B-Instruct-q4f32_1-MLC")).toBe(key);
    expect(familyKey("mlc-ai/Qwen2.5-3B-Instruct-q0f16-MLC")).toBe(key);
    expect(familyKey("gemma-3-1b-it-q4bf16_1-MLC")).toBe(
      familyKey("gemma-3-1b-it-q0f16-MLC"),
    );
    expect(familyKey("Phi-3.5-mini-instruct-q4f16_1-MLC-1k")).toBe(
      familyKey("Phi-3.5-mini-instruct-q4f16_1-MLC"),
    );
    expect(familyKey("onnx-community/bge-small-en-v1.5-ONNX")).toBe(
      familyKey("Xenova/bge-small-en-v1.5"),
    );
  });

  it("keeps different sizes and families apart", () => {
    expect(familyKey("Qwen2.5-3B-Instruct-q4f16_1-MLC")).not.toBe(
      familyKey("Qwen2.5-1.5B-Instruct-q4f16_1-MLC"),
    );
    expect(familyKey("Qwen3-4B-q4f16_1-MLC")).not.toBe(
      familyKey("Qwen3.5-4B-q4f16_1-MLC"),
    );
  });

  it("treats an mlc-ai repo and the WebLLM id as the same model", () => {
    expect(canonicalId("mlc-ai/Qwen3-4B-q4f16_1-MLC")).toBe(
      "Qwen3-4B-q4f16_1-MLC",
    );
    expect(canonicalId("onnx-community/x")).toBe("onnx-community/x");
  });
});

describe("licence", () => {
  it("reads the licence tag and only passes Apache-2.0 and MIT as clear", () => {
    expect(licenceFromTags(["onnx", "license:Apache-2.0"])).toBe("apache-2.0");
    expect(licenceFromTags(["onnx"])).toBeNull();
    expect(licenceFromTags(["license:<img src=x onerror=1>"])).toBeNull();
    expect(licenceStatus("apache-2.0")).toBe("ok");
    expect(licenceStatus("mit")).toBe("ok");
    for (const l of ["other", "llama3.2", "gemma", "cc-by-nc-4.0", null]) {
      expect(licenceStatus(l)).toBe("review");
    }
  });
});

describe("compareRuntime", () => {
  it("flags a newer release and whether the declared range admits it", () => {
    expect(compareRuntime("a", "^3.8.1", "4.3.0")).toMatchObject({
      newer: true,
      inRange: false,
    });
    expect(compareRuntime("a", "^3.4.1", "3.8.1")).toMatchObject({
      newer: true,
      inRange: true,
    });
    expect(compareRuntime("a", "^0.2.80", "0.2.85")).toMatchObject({
      newer: true,
      inRange: true,
    });
    expect(compareRuntime("a", "^0.2.80", "0.3.0")).toMatchObject({
      newer: true,
      inRange: false,
    });
    expect(compareRuntime("a", "^7.0.0", "7.0.0").newer).toBe(false);
  });

  it("ignores a prerelease or garbage latest value", () => {
    expect(compareRuntime("a", "^1.0.0", "2.0.0-beta.1").newer).toBe(false);
    expect(compareRuntime("a", "^1.0.0", "latest").newer).toBe(false);
  });
});

const webllm = (id, vramMb, type = "LLM") => ({ id, vramMb, type });
const hf = (id, extra = {}) => ({
  id,
  pipelineTag: null,
  licence: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  downloads: 5,
  ...extra,
});
const app = [
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    kind: "text",
    role: "text",
    tier: "desktop-high",
  },
  {
    id: "onnx-community/Florence-2-base-ft",
    kind: "vision",
    role: "document OCR",
    tier: null,
  },
  {
    id: "Xenova/bge-small-en-v1.5",
    kind: "embedding",
    role: "embedding",
    tier: null,
  },
];

describe("findCandidates", () => {
  it("lists a new text model with its tier and the golden-set command", () => {
    const entries = buildEntries([webllm("Qwen3-1.7B-q4f16_1-MLC", 2036)], []);
    const { candidates } = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "Qwen3-1.7B-q4f16_1-MLC",
      kind: "text",
      tier: "laptop",
      vramMb: 2036,
      licenceStatus: "review",
      goldenSetCommand: "npm run eval:golden -- --model Qwen3-1.7B-q4f16_1-MLC",
      inWebllmPrebuiltList: true,
    });
  });

  it("is quiet for ids already in the snapshot, in either org spelling", () => {
    const entries = buildEntries(
      [webllm("Qwen3-1.7B-q4f16_1-MLC", 2036)],
      [hf("mlc-ai/Gemma-x-1b-q4f16_1-MLC")],
    );
    const snapshotIds = new Set([
      "mlc-ai/Qwen3-1.7B-q4f16_1-MLC",
      "Gemma-x-1b-q4f16_1-MLC",
    ]);
    const out = findCandidates({ entries, snapshotIds, appModels: app });
    expect(out.candidates).toEqual([]);
    expect(out.ignored).toEqual([]);
  });

  it("collapses quantizations of one new family into one row, smallest VRAM first", () => {
    const entries = buildEntries(
      [
        webllm("Foo-3B-Instruct-q4f32_1-MLC", 2900),
        webllm("Foo-3B-Instruct-q4f16_1-MLC", 2400),
        webllm("Foo-3B-Instruct-q0f16-MLC", 3900),
      ],
      [],
    );
    const { candidates } = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("Foo-3B-Instruct-q4f16_1-MLC");
    expect(candidates[0].variants.sort()).toEqual([
      "Foo-3B-Instruct-q0f16-MLC",
      "Foo-3B-Instruct-q4f32_1-MLC",
    ]);
  });

  it("drops a new quantization of a family the app or the snapshot already lists", () => {
    const entries = buildEntries(
      [
        webllm("Qwen2.5-3B-Instruct-q0f16-MLC", 3000),
        webllm("Bar-1B-q4f32_1-MLC", 1500),
      ],
      [],
    );
    const out = findCandidates({
      entries,
      snapshotIds: new Set(["Bar-1B-q4f16_1-MLC"]),
      appModels: app,
    });
    expect(out.candidates).toEqual([]);
    expect(out.ignored.map((i) => i.reason)).toEqual([
      "variant-of-listed",
      "variant-of-listed",
    ]);
  });
});

describe("findCandidates fit rules", () => {
  it("sets aside text models above the desktop ceiling and reports why", () => {
    const entries = buildEntries([webllm("Big-70B-q4f16_1-MLC", 31000)], []);
    const out = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(out.candidates).toEqual([]);
    expect(out.ignored).toEqual([
      { id: "Big-70B-q4f16_1-MLC", reason: "too-large" },
    ]);
  });

  it("places a Hugging Face-only mlc-ai model from the size in its id and marks it estimated", () => {
    const entries = buildEntries([], [hf("mlc-ai/Qwen3-4B-q0f16-MLC")]);
    const { candidates } = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(candidates[0]).toMatchObject({
      id: "Qwen3-4B-q0f16-MLC",
      tier: "desktop",
      vramEstimated: true,
      source: "huggingface:mlc-ai",
      inWebllmPrebuiltList: false,
    });
  });

  it("does not drop a text model with no size anywhere; it is reported unplaced", () => {
    const entries = buildEntries([], [hf("mlc-ai/Mystery-instruct-q0f16-MLC")]);
    const out = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(out.candidates).toEqual([]);
    expect(out.unplaced).toEqual(["Mystery-instruct-q0f16-MLC"]);
  });
});

describe("findCandidates by kind and licence", () => {
  it("matches kinds to the runtime the app uses for them", () => {
    const entries = buildEntries(
      [
        webllm("Some-VLM-q4f16_1-MLC", 3000, "VLM"),
        webllm("emb-q0f32-MLC-b4", 300, "embedding"),
      ],
      [
        hf("onnx-community/NewOCR-ONNX", {
          pipelineTag: "image-to-text",
          licence: "mit",
        }),
        hf("onnx-community/NewEmbed-ONNX", {
          pipelineTag: "feature-extraction",
          licence: "apache-2.0",
        }),
        hf("onnx-community/NewLLM-1B-ONNX", { pipelineTag: "text-generation" }),
        hf("onnx-community/Whisperish-ONNX", {
          pipelineTag: "automatic-speech-recognition",
        }),
      ],
    );
    const out = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(
      out.candidates.map((c) => [c.id, c.kind, c.goldenSetCommand]),
    ).toEqual([
      ["onnx-community/NewOCR-ONNX", "vision", null],
      ["onnx-community/NewEmbed-ONNX", "embedding", null],
    ]);
    expect(
      Object.fromEntries(out.ignored.map((i) => [i.id, i.reason])),
    ).toEqual({
      "Some-VLM-q4f16_1-MLC": "runtime-not-used",
      "emb-q0f32-MLC-b4": "runtime-not-used",
      "onnx-community/NewLLM-1B-ONNX": "runtime-not-used",
      "onnx-community/Whisperish-ONNX": "kind-not-used",
    });
    expect(out.candidates[0].licenceStatus).toBe("ok");
  });

  it("flags licences other than Apache-2.0 and MIT as review without dropping the row", () => {
    const entries = buildEntries(
      [],
      [
        hf("onnx-community/Gated-ONNX", {
          pipelineTag: "feature-extraction",
          licence: "gemma",
        }),
      ],
    );
    const { candidates } = findCandidates({
      entries,
      snapshotIds: new Set(),
      appModels: app,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      licence: "gemma",
      licenceStatus: "review",
    });
  });

  it("merges the Hugging Face record into the WebLLM entry for the same model", () => {
    const entries = buildEntries(
      [webllm("Qwen3-1.7B-q4f16_1-MLC", 2036)],
      [hf("mlc-ai/Qwen3-1.7B-q4f16_1-MLC", { licence: "apache-2.0" })],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ licence: "apache-2.0", vramMb: 2036 });
  });
});
