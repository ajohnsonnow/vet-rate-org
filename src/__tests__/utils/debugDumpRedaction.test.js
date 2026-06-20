import { describe, it, expect, beforeEach } from "vitest";
import { createDebugDump } from "../../utils/debugDump";

beforeEach(() => {
  localStorage.clear();
});

describe("debugDump — value redaction (CRYPTO-04 non-PII allowlist)", () => {
  it("redacts crypto material AND veteran PII; shows only non-PII config values", () => {
    // Crypto material
    localStorage.setItem("vet_rate_backup_key_x", "PLAINTEXT_DEK");
    localStorage.setItem("vet_rate_wrapped_key_x", "WRAPPED_DEK");
    localStorage.setItem("vetrate_gemini_key", "AIzaSyTOPSECRET");
    // Veteran PII — must NOT leak into a debug dump (the CRYPTO-04 fix)
    localStorage.setItem(
      "veteranProfile",
      '{"name":"John Veteran","ssn":"123-45-6789"}',
    );
    localStorage.setItem("vet_rate_ratings", '[{"condition":"PTSD","pct":70}]');
    localStorage.setItem("vetrate_pain_maps", '{"back":"severe"}');
    // Benign config — value may be shown for diagnostics
    localStorage.setItem("vet_rate_app_version", "9.9.9");
    localStorage.setItem("vet-rate-theme", "dark");

    const dump = createDebugDump();
    const dumped = dump.localStorage;

    for (const k of [
      "vet_rate_backup_key_x",
      "vet_rate_wrapped_key_x",
      "vetrate_gemini_key",
      "veteranProfile",
      "vet_rate_ratings",
      "vetrate_pain_maps",
    ]) {
      // Value redacted; key name + byte size retained for diagnostics.
      expect(dumped[k]).toContain("[REDACTED");
    }

    // No raw secret OR PII value leaks into the serialized dump.
    const serialized = JSON.stringify(dump);
    expect(serialized).not.toContain("PLAINTEXT_DEK");
    expect(serialized).not.toContain("WRAPPED_DEK");
    expect(serialized).not.toContain("AIzaSyTOPSECRET");
    expect(serialized).not.toContain("John Veteran");
    expect(serialized).not.toContain("123-45-6789");
    expect(serialized).not.toContain("severe");

    // Non-PII config values are still shown.
    expect(dumped["vet_rate_app_version"]).toBe("9.9.9");
    expect(dumped["vet-rate-theme"]).toBe("dark");
    expect(dump.storageInfo.totalKeys).toBe(8);
  });
});
