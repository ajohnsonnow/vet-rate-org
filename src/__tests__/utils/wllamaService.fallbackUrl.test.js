/**
 * Regression: WLLAMA_MODELS.fallbackUrl pointed at "ajohnsonnow/vetrate-*-v2-gguf" -
 * a HuggingFace repo that never existed (confirmed via a live 401/404 while
 * chasing wasm-mode's local-model-provisioning blocker). The real published
 * repos live under "Vet-Rate-org/Diamond-Swarm-*-7B-GGUF". Since wllama falls
 * back to fetching from HuggingFace whenever the local /models/*.gguf file
 * 404s, this bug meant the fallback path was permanently broken for every
 * user - not just this dev environment.
 *
 * Only the 7B production entries (auditor/writer/rater) are sharded and have
 * a HuggingFace fallback. The *3b test entries are single-file local-only
 * QLoRA candidates (see wllamaService.js comments) with no remote fallback,
 * so they're asserted separately below.
 */
import { describe, it, expect } from "vitest";
import { WLLAMA_MODELS } from "../../utils/wllamaService";

const shardedEntries = Object.entries(WLLAMA_MODELS).filter(
  ([agentId]) => !agentId.endsWith("3b"),
);
const singleFile3bEntries = Object.entries(WLLAMA_MODELS).filter(([agentId]) =>
  agentId.endsWith("3b"),
);

describe("WLLAMA_MODELS.fallbackUrl", () => {
  it.each(shardedEntries)(
    "%s points at the real Vet-Rate-org/Diamond-Swarm HuggingFace repo",
    (_agentId, config) => {
      expect(config.fallbackUrl).toContain(
        "huggingface.co/Vet-Rate-org/Diamond-Swarm-",
      );
      expect(config.fallbackUrl).toContain("-GGUF/resolve/main/");
      expect(config.fallbackUrl).not.toContain("ajohnsonnow");
    },
  );

  it.each(singleFile3bEntries)(
    "%s is a single local file with no remote HuggingFace fallback",
    (_agentId, config) => {
      expect(config.fallbackUrl).toBe(config.url);
      expect(config.fallbackUrl).not.toContain("huggingface.co");
      expect(config.fallbackUrl).toMatch(/^\/models\/.+\.gguf$/);
    },
  );
});

/**
 * Regression: wllama's loadModelFromUrl caps single-file loads at 2GB
 * ("Invalid typed array length" - ArrayBuffer size restriction). The
 * monolithic 4.4GB GGUFs were split into 512MB shards via llama-gguf-split;
 * url/fallbackUrl must point at shard 00001 so wllama auto-follows the rest.
 *
 * The *3b entries are ~1.9GB single files - under the 2GB cap - so they are
 * intentionally NOT sharded and must NOT match the shard filename pattern.
 */
describe("WLLAMA_MODELS url/fallbackUrl - 2GB shard split", () => {
  it.each(shardedEntries)(
    "%s's url and fallbackUrl point at the first of multiple shards",
    (_agentId, config) => {
      expect(config.url).toMatch(/-00001-of-000\d\d\.gguf$/);
      expect(config.fallbackUrl).toMatch(/-00001-of-000\d\d\.gguf$/);
    },
  );

  it.each(singleFile3bEntries)(
    "%s's url and fallbackUrl are a single unsharded file under the 2GB cap",
    (_agentId, config) => {
      expect(config.url).not.toMatch(/-\d{5}-of-\d{5}\.gguf$/);
      expect(config.fallbackUrl).not.toMatch(/-\d{5}-of-\d{5}\.gguf$/);
    },
  );
});
