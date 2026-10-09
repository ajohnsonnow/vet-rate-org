/**
 * ADR-008 / owner decision D (2026-09-28): scrubPII is pattern-only and has
 * no way to catch a bare name, an ISO-format DOB ("1984-03-15", which none
 * of scrubPII's own dob patterns match - they're MM/DD/YYYY and
 * DD/MM/YYYY), a claim/file number in unlabeled prose, or a non-standard
 * address line. redactKnownValues/collectKnownIdentifierValues/
 * redactVeteranIdentifiers close that gap with known-VALUE redaction
 * instead of pattern matching. Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  redactKnownValues,
  collectKnownIdentifierValues,
  redactVeteranIdentifiers,
} from "./piiScrubber";

describe("redactKnownValues", () => {
  it("redacts a bare name token scrubPII cannot detect, case-insensitively and word-bounded", () => {
    const text = "Contact jordan faketon about the claim.";
    const out = redactKnownValues(text, [
      { value: "Jordan" },
      { value: "Faketon" },
    ]);
    expect(out).not.toMatch(/jordan/i);
    expect(out).not.toMatch(/faketon/i);
  });

  it("does not consume part of an unrelated word (word-bounded)", () => {
    const out = redactKnownValues("The annual review is due.", [
      { value: "Ann" },
    ]);
    expect(out).toBe("The annual review is due.");
  });

  it("redacts a value that starts/ends on punctuation without a false boundary failure", () => {
    const out = redactKnownValues("Lives at 742 Fictional Ave, unit 3.", [
      { value: "742 Fictional Ave," },
    ]);
    expect(out).not.toContain("742 Fictional Ave,");
    expect(out).toContain("[REDACTED]");
  });

  it("leaves a last-4 value alone when no context keyword is nearby", () => {
    const out = redactKnownValues("Rated at 6789% - just kidding, 30%.", [
      { value: "6789", context: /ssn|social\s*security/i },
    ]);
    expect(out).toContain("6789");
  });

  it("redacts a last-4 value only when its context keyword appears nearby", () => {
    const out = redactKnownValues("SSN (last 4): 6789", [
      { value: "6789", context: /ssn|social\s*security/i },
    ]);
    expect(out).not.toContain("6789");
  });
});

describe("collectKnownIdentifierValues", () => {
  it("splits a full name into individually-redactable tokens", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Jordan Q Faketon",
    });
    const names = values.map((v) => v.value);
    expect(names).toContain("Jordan");
    expect(names).toContain("Faketon");
  });

  it("expands an ISO DOB into common alternate formats", () => {
    const values = collectKnownIdentifierValues({ dateOfBirth: "1984-03-15" });
    const dates = values.map((v) => v.value);
    expect(dates).toContain("1984-03-15");
    expect(dates).toContain("03/15/1984");
    expect(dates.some((d) => d.includes("Mar"))).toBe(true);
  });

  it("gates SSN/file-number LAST-4 forms on context, but redacts the full number unconditionally", () => {
    const values = collectKnownIdentifierValues({
      ssn: "123456789",
      veteranFileNumber: "987654321",
    });
    const full = values.filter((v) => !v.context).map((v) => v.value);
    const gated = values.filter((v) => v.context);
    expect(full).toContain("123456789");
    expect(full).toContain("987654321");
    expect(gated.length).toBeGreaterThan(0);
  });

  it("also accepts the flat legacy profile shape (dob/vaFileNumber/street/city)", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Jordan Faketon",
      dob: "1984-03-15",
      vaFileNumber: "987654321",
      street: "742 Fictional Ave",
      city: "Nowhereville",
    });
    const raw = values.map((v) => v.value);
    expect(raw).toContain("742 Fictional Ave");
    expect(raw).toContain("Nowhereville");
    expect(raw).toContain("987654321");
  });
});

describe("redactVeteranIdentifiers: the single enforcement point", () => {
  const personal = {
    fullName: "Jordan Q Faketon",
    dateOfBirth: "1984-03-15",
    ssn: "123456789",
    veteranFileNumber: "987654321",
    email: "jordan.faketon@example.test",
    phone: "555-123-4567",
    address: {
      street: "742 Fictional Ave",
      city: "Nowhereville",
      state: "ZZ",
      zip: "00000",
    },
  };

  it("redacts every identifier category from a single free-text blob, keeping unrelated content", () => {
    const text = `Veteran: Jordan Q Faketon
DOB: 1984-03-15
SSN (last 4): 6789
Address: 742 Fictional Ave, Nowhereville, ZZ, 00000
Email: jordan.faketon@example.test
Phone: 555-123-4567
Claim #CL-2026-000999: denied
The claimed condition is Tinnitus, rated 10%.`;

    const out = redactVeteranIdentifiers(text, personal, ["CL-2026-000999"]);

    expect(out).not.toContain("Jordan");
    expect(out).not.toContain("Faketon");
    expect(out).not.toContain("1984-03-15");
    expect(out).not.toContain("742 Fictional Ave");
    expect(out).not.toContain("jordan.faketon@example.test");
    expect(out).not.toContain("555-123-4567");
    expect(out).not.toContain("CL-2026-000999");
    expect(out).toContain("Tinnitus, rated 10%");
  });

  it("does not touch an examiner/provider name - not the veteran's own identifier", () => {
    const text = "Examiner: Dr. Example Physician. Veteran: Jordan Q Faketon.";
    const out = redactVeteranIdentifiers(text, personal, []);
    expect(out).toContain("Dr. Example Physician");
    expect(out).not.toContain("Jordan");
  });

  it("is a safe no-op when no identifiers are known", () => {
    const text = "Nothing identifying here.";
    expect(redactVeteranIdentifiers(text, {}, [])).toBe(text);
    expect(redactVeteranIdentifiers(text, undefined, undefined)).toBe(text);
  });
});
