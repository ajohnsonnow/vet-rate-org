// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  HF_MAX_PAGES,
  HF_ORGS,
  RUNTIME_PACKAGES,
  SourceError,
  cleanMessage,
  fetchHfOrg,
  fetchNpmLatest,
  gatherAll,
  parseAppModels,
  parseDeclaredVersions,
  parseHfPage,
  parseNpmLatest,
  parseSnapshot,
  parseWebLlmConfig,
} from "../../../../scripts/eval/lib/modelWatchSources.js";

const hostOf = (url) => new URL(url).hostname;

const here = (rel) => new URL(rel, import.meta.url);
const repo = (rel) =>
  readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8");
const fixture = (name) => readFileSync(here(`./fixtures/${name}`), "utf8");
const CONFIG = fixture("webllm-config.fixture.txt");
const ONNX = JSON.parse(fixture("hf-onnx-community.fixture.json"));
const MLC = JSON.parse(fixture("hf-mlc-ai.fixture.json"));
const NPM = JSON.parse(fixture("npm-latest.fixture.json"));

describe("parseWebLlmConfig", () => {
  it("reads ids, VRAM and model type from the recorded config", () => {
    const { models, rejected } = parseWebLlmConfig(CONFIG);
    expect(rejected).toBe(0);
    expect(models.length).toBeGreaterThanOrEqual(30);
    expect(
      models.find((m) => m.id === "Qwen2.5-3B-Instruct-q4f16_1-MLC"),
    ).toEqual({
      id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      vramMb: 2504.76,
      type: "LLM",
    });
    expect(
      models.find((m) => m.id === "Phi-3.5-vision-instruct-q4f16_1-MLC").type,
    ).toBe("VLM");
    expect(
      models.find((m) => m.id === "snowflake-arctic-embed-s-q0f32-MLC-b4"),
    ).toMatchObject({
      type: "embedding",
      vramMb: 238.71,
    });
  });

  it("fails loudly, naming the source, when the file no longer has the expected shape", () => {
    expect(() => parseWebLlmConfig("export const nothing = 1;")).toThrow(
      SourceError,
    );
    expect(() => parseWebLlmConfig("<html>rate limited</html>")).toThrow(
      /prebuiltAppConfig not found/,
    );
    const reformatted = CONFIG.replace(/^ {4}\{/gm, "{");
    try {
      parseWebLlmConfig(reformatted);
      throw new Error("expected a throw");
    } catch (err) {
      expect(err.source).toBe("webllm-config");
      expect(err.message).toMatch(/parsed 0 model entries/);
    }
  });

  it("fails when an entry is added in a form the parser cannot read", () => {
    const odd = CONFIG.replace(
      "  ],\n};",
      '  {\n    model_id: "Odd-q4f16_1-MLC",\n  },\n  ],\n};',
    );
    expect(() => parseWebLlmConfig(odd)).toThrow(/model_id fields/);
  });
});

describe("parseHfPage", () => {
  it("keeps only the validated fields from the recorded Hub responses", () => {
    const { models, rejected } = parseHfPage(
      ONNX,
      "huggingface:onnx-community",
    );
    expect(rejected).toBe(0);
    const ocr = models.find((m) => m.id === "onnx-community/OneJev-0.8B-ONNX");
    expect(ocr).toEqual({
      id: "onnx-community/OneJev-0.8B-ONNX",
      pipelineTag: "image-text-to-text",
      licence: "apache-2.0",
      createdAt: expect.stringMatching(/^2026-/),
      downloads: expect.any(Number),
    });
    expect(
      models.find((m) => m.id === "onnx-community/TinyStories-33M-ONNX")
        .licence,
    ).toBeNull();
    expect(Object.keys(ocr).sort()).toEqual([
      "createdAt",
      "downloads",
      "id",
      "licence",
      "pipelineTag",
    ]);
    expect(parseHfPage(MLC, "huggingface:mlc-ai").models).toHaveLength(4);
  });

  it("throws, naming the source, when the response is not an array", () => {
    expect(() =>
      parseHfPage({ error: "Rate limit" }, "huggingface:mlc-ai"),
    ).toThrow(SourceError);
  });
});

describe("parseNpmLatest", () => {
  it("reads the version from the recorded registry response", () => {
    expect(parseNpmLatest(NPM, "npm:@mlc-ai/web-llm")).toBe(NPM.version);
  });
  it("rejects a missing or odd version", () => {
    for (const bad of [
      {},
      { version: "1.0" },
      { version: "1.0.0; rm -rf /" },
      null,
    ]) {
      expect(() => parseNpmLatest(bad, "npm:x")).toThrow(SourceError);
    }
  });
});

describe("app models are read from the source files", () => {
  const files = () => ({
    detector: repo("src/utils/deviceCapabilityDetector.js"),
    florence: repo("src/workers/florence-ocr-worker.js"),
    smolvlm: repo("src/workers/smolvlm-worker.js"),
    legalRag: repo("src/services/legalRag.js"),
  });

  it("finds every tier's text models and the vision and embedding ids", () => {
    const models = parseAppModels(files());
    const ids = (pred) => models.filter(pred).map((m) => m.id);
    expect(ids((m) => m.tier === "laptop")).toEqual([
      "Qwen3.5-2B-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ]);
    expect(ids((m) => m.tier === "desktop-high")).toEqual([
      "Qwen3.5-4B-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f32_1-MLC",
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    ]);
    expect(ids((m) => m.tier === "desktop-mid")[0]).toBe(
      "Qwen3.5-4B-q4f16_1-MLC",
    );
    expect(ids((m) => m.kind === "vision")).toEqual([
      "onnx-community/Florence-2-base-ft",
      "HuggingFaceTB/SmolVLM-256M-Instruct",
    ]);
    expect(ids((m) => m.kind === "embedding")).toEqual([
      "Xenova/bge-small-en-v1.5",
    ]);
  });

  it("resolves a tier list written as a spread of an exported constant", () => {
    const detector = [
      'export const SHARED = ["A-MLC", "B-MLC"];',
      'case "desktop-high": return { recommendedModels: [...SHARED], x: 1 };',
      'case "desktop-mid": return { recommendedModels: ["C-MLC"] };',
      'case "laptop": return { recommendedModels: ["D-MLC"] };',
      'case "tablet": return { recommendedModels: ["E-MLC"] };',
      'case "mobile": default: return { recommendedModels: [] };',
    ].join("\n");
    const models = parseAppModels({ ...files(), detector });
    expect(
      models.filter((m) => m.tier === "desktop-high").map((m) => m.id),
    ).toEqual(["A-MLC", "B-MLC"]);
  });

  it("fails naming the file when a spread constant cannot be found", () => {
    const detector =
      'case "desktop-high": return { recommendedModels: [...GONE] };';
    expect(() => parseAppModels({ ...files(), detector })).toThrow(/GONE/);
  });

  it("fails naming the file when a constant moves", () => {
    expect(() =>
      parseAppModels({ ...files(), legalRag: "export const X = 1;" }),
    ).toThrow(/legalRag\.js|model id constant/);
    try {
      parseAppModels({ ...files(), florence: "" });
    } catch (err) {
      expect(err.source).toBe("app-models:florence-ocr-worker.js");
    }
    try {
      parseAppModels({ ...files(), detector: "" });
    } catch (err) {
      expect(err.source).toBe("app-models:deviceCapabilityDetector.js");
    }
  });

  it("reads the four runtime package ranges from package.json", () => {
    const declared = parseDeclaredVersions(repo("package.json"));
    expect(Object.keys(declared)).toEqual(RUNTIME_PACKAGES);
    expect(declared["@mlc-ai/web-llm"]).toMatch(/^\^?\d+\.\d+\.\d+/);
    expect(() => parseDeclaredVersions('{"dependencies":{}}')).toThrow(
      /not declared/,
    );
  });
});

describe("parseSnapshot", () => {
  it("returns canonical ids and refuses a malformed file", () => {
    expect([...parseSnapshot('{"models":["mlc-ai/A-MLC","org/b"]}')]).toEqual([
      "A-MLC",
      "org/b",
    ]);
    expect(() => parseSnapshot("{")).toThrow(SourceError);
    expect(() => parseSnapshot('{"models":["a b"]}')).toThrow(SourceError);
    expect(() => parseSnapshot("{}")).toThrow(SourceError);
  });
  it("the committed snapshot parses and lists the app's own models", () => {
    const ids = parseSnapshot(repo("scripts/eval/model-watch-snapshot.json"));
    expect(ids.size).toBeGreaterThan(100);
    expect(ids.has("Qwen2.5-3B-Instruct-q4f16_1-MLC")).toBe(true);
  });
});

const page = (items, link) =>
  new Response(JSON.stringify(items), {
    status: 200,
    headers: link ? { link: `<${link}>; rel="next"` } : {},
  });
const NOW = Date.parse("2026-10-05T00:00:00Z");
const item = (id, createdAt) => ({ id, createdAt, tags: [], downloads: 1 });

describe("fetchHfOrg paging", () => {
  it("follows the next link while a page is still inside the window", async () => {
    const urls = [];
    const next = "https://huggingface.co/api/models?cursor=abc";
    const fetchImpl = async (url) => {
      urls.push(url);
      return urls.length === 1
        ? page([item("o/a", "2026-10-04T00:00:00Z")], next)
        : page([item("o/b", "2026-08-01T00:00:00Z")]);
    };
    const { models } = await fetchHfOrg("o", { fetchImpl, now: NOW });
    expect(models.map((m) => m.id)).toEqual(["o/a", "o/b"]);
    expect(urls[1]).toBe(next);
    expect(urls[0]).toContain("author=o");
  });

  it("does not follow a next link that leaves the Hub", async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return page(
        [item("o/a", "2026-10-04T00:00:00Z")],
        "https://evil.example/steal",
      );
    };
    const { models } = await fetchHfOrg("o", { fetchImpl, now: NOW });
    expect(models).toHaveLength(1);
    expect(urls).toHaveLength(1);
  });

  it("fails rather than silently truncating when the window is never left", async () => {
    const fetchImpl = async () =>
      page(
        [item("o/a", "2026-10-04T00:00:00Z")],
        "https://huggingface.co/api/models?cursor=x",
      );
    await expect(fetchHfOrg("o", { fetchImpl, now: NOW })).rejects.toThrow(
      new RegExp(`after ${HF_MAX_PAGES} pages`),
    );
  });

  it("names the source for an HTTP error, a network error and a non-JSON body", async () => {
    const cases = [
      async () => new Response("nope", { status: 503 }),
      async () => {
        throw new Error("getaddrinfo ENOTFOUND huggingface.co");
      },
      async () => new Response("<html>", { status: 200 }),
    ];
    for (const fetchImpl of cases) {
      await expect(
        fetchHfOrg("o", { fetchImpl, now: NOW }),
      ).rejects.toMatchObject({
        source: "huggingface:o",
      });
    }
  });
});

describe("gatherAll", () => {
  const readText = (rel) =>
    rel.endsWith("model-watch-snapshot.json")
      ? '{"models":["Qwen2.5-3B-Instruct-q4f16_1-MLC"]}'
      : repo(rel);
  const okFetch = async (url) => {
    if (hostOf(url) === "raw.githubusercontent.com")
      return new Response(CONFIG);
    if (hostOf(url) === "huggingface.co") {
      return page(url.includes("author=mlc-ai") ? MLC : ONNX);
    }
    return new Response(JSON.stringify(NPM));
  };

  it("collects every source when all succeed", async () => {
    const out = await gatherAll({ fetchImpl: okFetch, readText, now: NOW });
    expect(out.errors).toEqual([]);
    expect(out.webllm.length).toBeGreaterThan(20);
    expect(out.hf).toHaveLength(MLC.length + ONNX.length);
    expect(Object.keys(out.latest)).toEqual(RUNTIME_PACKAGES);
    expect(out.sourcesOk).toContain("snapshot");
  });

  it.each([
    ["webllm-config", (u) => hostOf(u) === "raw.githubusercontent.com"],
    ["huggingface:mlc-ai", (u) => u.includes("author=mlc-ai")],
    ["huggingface:onnx-community", (u) => u.includes("author=onnx-community")],
    ["npm:tesseract.js", (u) => u.includes("tesseract.js")],
  ])(
    "names %s when only that source fails, and the rest still run",
    async (source, matches) => {
      const fetchImpl = async (url) =>
        matches(url) ? new Response("down", { status: 500 }) : okFetch(url);
      const out = await gatherAll({ fetchImpl, readText, now: NOW });
      expect(out.errors.map((e) => e.source)).toEqual([source]);
      expect(out.sourcesOk).toContain("snapshot");
    },
  );

  it("records a parse failure of the WebLLM config against its source", async () => {
    const fetchImpl = async (url) =>
      hostOf(url) === "raw.githubusercontent.com"
        ? new Response("export const prebuiltAppConfig = {}")
        : okFetch(url);
    const out = await gatherAll({ fetchImpl, readText, now: NOW });
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].source).toBe("webllm-config");
  });

  it("names the snapshot and the app source files when they cannot be read", async () => {
    const out = await gatherAll({
      fetchImpl: okFetch,
      readText: () => {
        throw new Error("ENOENT: no such file");
      },
      now: NOW,
    });
    expect(out.errors.map((e) => e.source).sort()).toEqual(
      ["app-models", "app-models:package.json", "snapshot"].sort(),
    );
  });

  it("queries exactly the documented orgs", () => {
    expect(HF_ORGS).toEqual(["mlc-ai", "onnx-community"]);
  });
});

describe("cleanMessage", () => {
  it("strips anything outside a plain character set and caps the length", () => {
    expect(cleanMessage("bad\n## heading `x` ${{ y }}")).not.toMatch(
      /[\n`${}#]/,
    );
    expect(cleanMessage("a".repeat(500))).toHaveLength(200);
  });
});

describe("fetchNpmLatest encodes every slash in the package name", () => {
  it("requests a name with two slashes with both encoded", async () => {
    let requested = "";
    const fetchImpl = async (url) => {
      requested = url;
      return new Response(JSON.stringify({ version: "1.2.3" }));
    };
    await fetchNpmLatest("@scope/pkg/extra", { fetchImpl });
    expect(new URL(requested).hostname).toBe("registry.npmjs.org");
    expect(requested).toBe(
      "https://registry.npmjs.org/@scope%2Fpkg%2Fextra/latest",
    );
  });
});
