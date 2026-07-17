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
