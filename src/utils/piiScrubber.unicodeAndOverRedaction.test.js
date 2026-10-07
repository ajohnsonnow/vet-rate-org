/**
 * ADR-008 follow-up fixes (final14 QA review, 2026-09-28):
 *
 * 1. `\b` is ASCII-only in JS - a known name value that starts or ends on a
 *    non-ASCII Unicode letter (José, Zoë, Ångström, Élodie) never satisfied
 *    it and silently survived redaction. Fixed with \p{L}/\p{N} lookarounds.
 * 2. Bare name tokens with no minimum-length/stoplist filtering redacted
 *    generational suffixes ("III"/"Jr") and short compound-surname particles
 *    ("De"/"La") unconditionally, corrupting medical terms elsewhere in the
 *    same context ("Stage III chronic kidney disease", "de novo").
 * 3. Hyphenated compound names and apostrophe variants (straight/curly, or
 *    dropped entirely) weren't matched when text used only part of the name.
 * 4. A full SSN's own last-4 digits, and a non-ISO stored DOB, produced zero
 *    redactable variants.
 * 5. No service-number collector existed at all; the legacy profile's
 *    firstName/lastName were never read when fullName/name was absent.
 *
 * Fixture values are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  redactKnownValues,
  collectKnownIdentifierValues,
  redactVeteranIdentifiers,
} from "./piiScrubber";

describe("redactKnownValues: Unicode name boundaries", () => {
  it("redacts a name that starts with a non-ASCII letter (José)", () => {
    const out = redactKnownValues("Please have José submit a DBQ.", [
      { value: "José" },
    ]);
    expect(out).not.toContain("José");
  });

  it("redacts a name where BOTH ends are non-ASCII (Zoë Ångström)", () => {
    const out = redactKnownValues("Zoë Ångström reports pain.", [
      { value: "Zoë" },
      { value: "Ångström" },
    ]);
    expect(out).not.toContain("Zoë");
    expect(out).not.toContain("Ångström");
  });

  it("redacts every occurrence of a name ending in a non-ASCII letter (Élodie)", () => {
    const out = redactKnownValues("Élodie Nuñez, Élodie", [
      { value: "Élodie" },
      { value: "Nuñez" },
    ]);
    expect(out).not.toContain("Élodie");
    expect(out).not.toContain("Nuñez");
  });
});

describe("redactKnownValues: hyphenated and apostrophe name variants", () => {
  it("redacts one half of a hyphenated compound name used alone", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Mary-Kate O'Brien",
    });
    const out = redactKnownValues("Mary reports; contact O'Brien.", values);
    expect(out).not.toContain("Mary ");
    expect(out).not.toContain("O'Brien");
  });

  it("redacts a name with an apostrophe dropped or curly", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Mary-Kate O'Brien",
    });
    const dropped = redactKnownValues("Contact OBrien today.", values);
    const curly = redactKnownValues("Contact O’Brien today.", values);
    expect(dropped).not.toContain("OBrien");
    expect(curly).not.toContain("O’Brien");
  });
});

describe("collectKnownIdentifierValues: over-redaction guard", () => {
  it("excludes generational suffixes from standing alone as a known value", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Jordan Faketon III",
    });
    const tokens = values.map((v) => v.value);
    expect(tokens).not.toContain("III");
    expect(tokens).toContain("Jordan");
    expect(tokens).toContain("Faketon");
  });

  it("does not over-redact 'Stage III' when the veteran's suffix is III", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Jordan Faketon III",
    });
    const out = redactKnownValues(
      "Stage III chronic kidney disease diagnosed.",
      values,
    );
    expect(out).toContain("Stage III chronic kidney disease");
  });

  it("excludes short compound-surname particles from standing alone", () => {
    const values = collectKnownIdentifierValues({
      fullName: "Carlos De La Cruz",
    });
    const out = redactKnownValues(
      "Diagnosed with de Quervain tenosynovitis.",
      values,
    );
    expect(out).toContain("de Quervain tenosynovitis");
    expect(out).not.toContain("Cruz");
  });
});

describe("collectKnownIdentifierValues: legacy profile name/service number", () => {
  it("builds a name from firstName/lastName when fullName/name is absent", () => {
    const values = collectKnownIdentifierValues({
      firstName: "Jordan",
      lastName: "Faketon",
    });
    const tokens = values.map((v) => v.value);
    expect(tokens).toContain("Jordan");
    expect(tokens).toContain("Faketon");
  });

  it("collects a service number as a known identifier", () => {
    const values = collectKnownIdentifierValues({
      serviceNumber: "RA28345671",
    });
    const full = values.filter((v) => !v.context).map((v) => v.value);
    expect(full).toContain("RA28345671");
  });

  it("redacts a service number embedded in free text", () => {
    const out = redactVeteranIdentifiers(
      "Name: FAKETON, JORDAN. Service #: RA28345671, Branch: Army",
      { firstName: "Jordan", lastName: "Faketon", serviceNumber: "RA28345671" },
    );
    expect(out).not.toContain("RA28345671");
    expect(out).not.toContain("FAKETON");
  });
});

describe("collectKnownIdentifierValues: DOB/SSN/file-number variants", () => {
  it("expands a non-ISO stored DOB into the ISO form too", () => {
    const values = collectKnownIdentifierValues({ dob: "03/15/1984" });
    const dates = values.map((v) => v.value);
    expect(dates).toContain("1984-03-15");
  });

  it("redacts the military DD-Mon-YYYY and compact DDMonYYYY DOB forms", () => {
    const out = redactVeteranIdentifiers("Born 15 Mar 1984 (15MAR1984).", {
      dateOfBirth: "1984-03-15",
    });
    expect(out).not.toContain("15 Mar 1984");
    expect(out).not.toContain("15MAR1984");
  });

  it("redacts a full SSN's own last-4 digits when referenced separately", () => {
    const out = redactVeteranIdentifiers("SSN ending 6789 on file.", {
      ssn: "123456789",
    });
    expect(out).not.toContain("6789");
  });

  it("redacts a spaced-out file number ('28 345 671')", () => {
    const out = redactVeteranIdentifiers("VA file number 28 345 671 noted.", {
      veteranFileNumber: "28345671",
    });
    expect(out).not.toContain("28 345 671");
  });
});
