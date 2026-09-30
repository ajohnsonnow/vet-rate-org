/**
 * ADR-009 policy unit tests: loopback host detection (real URL parsing, not
 * substring matching - the two adversarial hostnames named in the brief),
 * the fail-closed data-class default, and the typed blocked error.
 */
import { describe, it, expect } from "vitest";
import {
  AI_DATA_CLASS,
  resolveDataClass,
  isLoopbackHost,
  assertDocumentCallAllowed,
  DocumentOffDeviceBlockedError,
  buildDocumentOffDeviceNotice,
} from "./aiDataClassPolicy";

describe("isLoopbackHost", () => {
  it.each([
    ["localhost", true],
    ["LOCALHOST", true],
    ["localhost:8080", true],
    ["http://localhost:8080", true],
    ["127.0.0.1", true],
    ["127.0.0.1:8080", true],
    ["127.5.5.5", true],
    ["http://127.0.0.1:8080/health", true],
    ["::1", true],
    ["[::1]", true],
    ["[::1]:8080", true],
  ])("treats %s as loopback", (host, expected) => {
    expect(isLoopbackHost(host)).toBe(expected);
  });

  it.each([
    // The two adversarial lookalikes named in the brief - a substring/
    // startsWith/endsWith check would wrongly accept both of these.
    ["localhost.evil.com", false],
    ["127.0.0.1.nip.io", false],
    ["evil-localhost", false],
    ["notlocalhost", false],
    ["127.0.0.1evil.com", false],
    ["0.0.0.0", false],
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture, not real infra
    ["192.168.1.5", false],
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture, not real infra
    ["10.0.0.5", false],
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture, not real infra
    ["fe80::1", false],
    ["127.999.0.1", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("rejects %s as NOT loopback", (host, expected) => {
    expect(isLoopbackHost(host)).toBe(expected);
  });
});

describe("resolveDataClass - fail closed", () => {
  it("returns CONTEXT only for the exact literal", () => {
    expect(resolveDataClass({ dataClass: AI_DATA_CLASS.CONTEXT })).toBe(
      AI_DATA_CLASS.CONTEXT,
    );
    expect(resolveDataClass({ dataClass: "context" })).toBe(
      AI_DATA_CLASS.CONTEXT,
    );
  });

  it("defaults to DOCUMENT when no dataClass is supplied", () => {
    expect(resolveDataClass({})).toBe(AI_DATA_CLASS.DOCUMENT);
    expect(resolveDataClass(undefined)).toBe(AI_DATA_CLASS.DOCUMENT);
  });

  it("defaults to DOCUMENT for any value other than the exact context literal (fail closed, not fail open)", () => {
    expect(resolveDataClass({ dataClass: "document" })).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
    expect(resolveDataClass({ dataClass: "Context" })).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
    expect(resolveDataClass({ dataClass: "" })).toBe(AI_DATA_CLASS.DOCUMENT);
    expect(resolveDataClass({ dataClass: null })).toBe(AI_DATA_CLASS.DOCUMENT);
    expect(resolveDataClass({ dataClass: "contextt" })).toBe(
      AI_DATA_CLASS.DOCUMENT,
    );
  });
});

describe("assertDocumentCallAllowed", () => {
  it("throws DocumentOffDeviceBlockedError for a DOCUMENT call to an off-device transport", () => {
    expect(() =>
      assertDocumentCallAllowed(AI_DATA_CLASS.DOCUMENT, {
        isOnDevice: false,
        providerLabel: "Cloud AI (Gemini)",
      }),
    ).toThrow(DocumentOffDeviceBlockedError);
  });

  it("does not throw for a DOCUMENT call to an on-device transport", () => {
    expect(() =>
      assertDocumentCallAllowed(AI_DATA_CLASS.DOCUMENT, {
        isOnDevice: true,
        providerLabel: null,
      }),
    ).not.toThrow();
  });

  it("never throws for a CONTEXT call, on-device or off", () => {
    expect(() =>
      assertDocumentCallAllowed(AI_DATA_CLASS.CONTEXT, {
        isOnDevice: false,
        providerLabel: "Cloud AI (Gemini)",
      }),
    ).not.toThrow();
    expect(() =>
      assertDocumentCallAllowed(AI_DATA_CLASS.CONTEXT, { isOnDevice: true }),
    ).not.toThrow();
  });

  it("DocumentOffDeviceBlockedError carries a catchable .code and the provider label", () => {
    try {
      assertDocumentCallAllowed(AI_DATA_CLASS.DOCUMENT, {
        isOnDevice: false,
        providerLabel: "Local Server (evil.example.com)",
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DocumentOffDeviceBlockedError);
      expect(err.code).toBe("DOCUMENT_OFF_DEVICE_BLOCKED");
      expect(err.providerLabel).toBe("Local Server (evil.example.com)");
    }
  });
});

describe("buildDocumentOffDeviceNotice", () => {
  it("names the provider and never claims the file was sent", () => {
    const notice = buildDocumentOffDeviceNotice("Cloud AI (Gemini)");
    expect(notice).toContain("Cloud AI (Gemini)");
    expect(notice).toContain("on-device AI");
    expect(notice).toMatch(/not sent/i);
  });

  it("falls back to a generic phrase when no provider label is known", () => {
    const notice = buildDocumentOffDeviceNotice(null);
    expect(notice).toMatch(/the configured AI/i);
  });
});
