import { describe, it, expect } from "vitest";
import {
  createSanitizedReport,
  detectPII,
  sanitizeErrorPayload,
  maskForDisplay,
} from "../../utils/bugSanitizer";

describe("detectPII", () => {
  it("detects SSN patterns as truthy", () => {
    const result = detectPII("My SSN is 123-45-6789");
    expect(result).toBeTruthy();
  });

  it("detects email addresses", () => {
    const result = detectPII("Contact vet@gmail.com");
    expect(result).toBeTruthy();
  });

  it("returns no PII for clean text", () => {
    const result = detectPII("No personal info here");
    expect(result.hasPII).toBe(false);
  });
});

describe("createSanitizedReport", () => {
  it("returns an object", () => {
    const result = createSanitizedReport({ description: "Bug found" });
    expect(typeof result).toBe("object");
  });

  it("redacts PII from description", () => {
    const result = createSanitizedReport({ description: "SSN: 123-45-6789" });
    expect(JSON.stringify(result)).not.toContain("123-45-6789");
  });
});

describe("sanitizeErrorPayload", () => {
  it("handles string input", () => {
    const result = sanitizeErrorPayload("Error with SSN 123-45-6789");
    expect(typeof result).toBe("string");
    expect(result).not.toContain("123-45-6789");
  });
});

describe("maskForDisplay", () => {
  it("masks sensitive data", () => {
    const result = maskForDisplay("123-45-6789");
    expect(result).not.toBe("123-45-6789");
  });
});
