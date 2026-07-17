/**
 * Regression: WLLAMA_MODELS.fallbackUrl pointed at "ajohnsonnow/vetrate-*-v2-gguf" —
 * a HuggingFace repo that never existed (confirmed via a live 401/404 while
 * chasing wasm-mode's local-model-provisioning blocker). The real published
 * repos live under "Vet-Rate-org/Diamond-Swarm-*-7B-GGUF". Since wllama falls
 * back to fetching from HuggingFace whenever the local /models/*.gguf file
 * 404s, this bug meant the fallback path was permanently broken for every
 * user — not just this dev environment.
 */
import { describe, it, expect } from "vitest";
import { WLLAMA_MODELS } from "../../utils/wllamaService";

describe("WLLAMA_MODELS.fallbackUrl", () => {
  it.each(Object.entries(WLLAMA_MODELS))(
    "%s points at the real Vet-Rate-org/Diamond-Swarm HuggingFace repo",
    (_agentId, config) => {
      expect(config.fallbackUrl).toContain(
        "huggingface.co/Vet-Rate-org/Diamond-Swarm-",
      );
      expect(config.fallbackUrl).toContain("-GGUF/resolve/main/");
      expect(config.fallbackUrl).not.toContain("ajohnsonnow");
    },
  );
});

/**
 * Regression: wllama's loadModelFromUrl caps single-file loads at 2GB
 * ("Invalid typed array length" — ArrayBuffer size restriction). The
 * monolithic 4.4GB GGUFs were split into 512MB shards via llama-gguf-split;
 * url/fallbackUrl must point at shard 00001 so wllama auto-follows the rest.
 */
describe("WLLAMA_MODELS url/fallbackUrl — 2GB shard split", () => {
  it.each(Object.entries(WLLAMA_MODELS))(
    "%s's url and fallbackUrl point at the first of multiple shards",
    (_agentId, config) => {
      expect(config.url).toMatch(/-00001-of-000\d\d\.gguf$/);
      expect(config.fallbackUrl).toMatch(/-00001-of-000\d\d\.gguf$/);
    },
  );
});
