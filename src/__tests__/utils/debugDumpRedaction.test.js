import { describe, it, expect, beforeEach } from "vitest";
import { createDebugDump } from "../../utils/debugDump";

beforeEach(() => {
  localStorage.clear();
});

describe("debugDump — secret redaction (S16 commit F)", () => {
  it("redacts key material + the Gemini key, keeps benign keys", () => {
    localStorage.setItem("vet_rate_backup_key_x", "PLAINTEXT_DEK");
    localStorage.setItem("vet_rate_wrapped_key_x", "WRAPPED_DEK");
    localStorage.setItem("vet_rate_kek_meta", '{"v":1,"salt":"abc"}');
    localStorage.setItem("vet_rate_kek_verifier", "VERIFIER_BLOB");
    localStorage.setItem("vet_rate_kek_rotating", "ROTATION_MARKER");
    localStorage.setItem("vet_rate_rotating_key_x", "TEMP_WRAPPED");
    localStorage.setItem("vetrate_gemini_key", "AIzaSyTOPSECRET");
    localStorage.setItem("vet_rate_app_version", "9.9.9"); // benign

    const dump = createDebugDump();
    const dumped = dump.localStorage;

    for (const k of [
      "vet_rate_backup_key_x",
      "vet_rate_wrapped_key_x",
      "vet_rate_kek_meta",
      "vet_rate_kek_verifier",
      "vet_rate_kek_rotating",
      "vet_rate_rotating_key_x",
      "vetrate_gemini_key",
    ]) {
      expect(dumped[k]).toBe("[REDACTED]");
    }

    // No raw secret value leaks into the serialized dump.
    const serialized = JSON.stringify(dump);
    expect(serialized).not.toContain("PLAINTEXT_DEK");
    expect(serialized).not.toContain("WRAPPED_DEK");
    expect(serialized).not.toContain("AIzaSyTOPSECRET");

    // Benign keys still present and accounted for.
    expect(dumped["vet_rate_app_version"]).toBe("9.9.9");
    expect(dump.storageInfo.totalKeys).toBe(8);
  });
});
