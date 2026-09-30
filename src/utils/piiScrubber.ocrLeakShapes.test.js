/**
 * D16-5/D16-6: defense-in-depth for the shapes a verifier saw leak past
 * piiScrubber.js on the way to an off-device provider - label-on-one-row/
 * value-on-the-next-row (with OCR garbling), OCR-garbled SSNs and emails,
 * ZIP-anchored city-state-zip lines, labeled City:/State:/Zip code: blocks,
 * "Patient: NAME (NNNN)", VA-letter page footers, and salutations with no
 * courtesy title / embedded in a flattened OCR page.
 *
 * D16-6 narrowed several of the above after a second reviewer proved they
 * over-redacted ordinary clinical/legal prose (a no-ZIP city/state comma,
 * label-only DOB/SSN/address matching free text, '@' as clinical shorthand,
 * a free-text "Patient:" narrative, salutation gaps) - every pattern below
 * now carries BOTH a positive test (it still catches the real leak) and a
 * realistic negative test (it leaves ordinary prose alone), and the
 * over-redaction guard describe block collects the specific sentences a
 * verifier found broken.
 *
 * Fixture identifiers are synthetic.
 */
import { describe, it, expect } from "vitest";
import {
  scrubText,
  redactSalutationNames,
  redactLetterFooter,
  _testOnlyPatterns,
} from "./piiScrubber";

describe("D16-5: label-on-one-row, value-on-the-next (row-split OCR)", () => {
  it.each([
    [
      "SOCIAL SECURITY with a garbled 'NO.' suffix",
      "3. SOCIAL SECURITY.N\n123-45-6789",
      "123-45-6789",
    ],
    [
      "a bare 'SSN' label with no box number",
      "SSN\n123-45-6789",
      "123-45-6789",
    ],
    ["a bare 'DOB' label with no box number", "DOB\n03/15/1984", "03/15/1984"],
    [
      "a bare 'HOME OF RECORD' label with no box number",
      "HOME OF RECORD\nSpringfield, IL",
      "Springfield",
    ],
  ])("redacts the value when %s", (_label, text, valueFragment) => {
    const result = scrubText(text);
    expect(result).not.toContain(valueFragment);
  });

  it("D16-6: a numeric labeled value stops at its own line, not a following unlabeled digit line", () => {
    // The numeric value class allows digits/spaces/hyphens - `\s` (which
    // also matches "\n") would let it run straight through the line break
    // into the NEXT line's unrelated digits, over-redacting them too.
    const result = scrubText("SSN\n123-45-6789\n1985-01-01");
    expect(result).toContain("[REDACTED_SSN]");
    expect(result).toContain("1985-01-01");
  });
});

describe("D16-6: real DD-214 printed label text (trailing descriptor, OCR O/0 garble)", () => {
  it("redacts the value when 'HOME OF RECORD' carries its real trailing 'AT TIME OF ENTRY' plus the printed hint parenthetical", () => {
    const result = scrubText(
      "b. HOME OF RECORD AT TIME OF ENTRY (City and state, or complete address if known)\nANYTOWN TEXAS",
    );
    expect(result).not.toContain("ANYTOWN");
    expect(result).not.toContain("TEXAS");
  });

  it("redacts the value when 'MAILING ADDRESS' carries its real trailing 'AFTER SEPARATION' plus the printed hint parenthetical", () => {
    const result = scrubText(
      "19a. MAILING ADDRESS AFTER SEPARATION (Include ZIP Code)\nRR 2 ANYTOWN TEXAS",
    );
    expect(result).not.toContain("ANYTOWN");
  });

  it("recognizes 'S0CIAL SECURITY' with a Tesseract O-for-0 misread as the SSN label", () => {
    const result = scrubText("S0CIAL SECURITY NUMBER\n123-45-6789");
    expect(result).not.toContain("123-45-6789");
  });

  it("recognizes 'H0ME 0F REC0RD' with a Tesseract O-for-0 misread as the label", () => {
    const result = scrubText("H0ME 0F REC0RD\nSpringfield, IL");
    expect(result).not.toContain("Springfield");
  });

  it("recognizes an O-for-0 garbled 2-letter state code when a ZIP anchors it ('0R' for Oregon)", () => {
    const result = scrubText("Mail to ASHLAND, 0R 97520 please.");
    expect(result).not.toContain("ASHLAND");
  });
});

describe("D16-6: label-only DOB/SSN/address no longer over-redact ordinary prose", () => {
  it.each([
    [
      "'Dobutamine' (no word boundary previously let 'DOB' match mid-word)",
      "Dobutamine stress echocardiogram showed inducible ischemia.",
    ],
    [
      "a line-wrapped 'Social Security' mention with no digits following",
      "The veteran receives Social Security\ndisability benefits for PTSD and TBI since 2015.",
    ],
    [
      "a line-wrapped 'date of birth' mention with no date following",
      "...by date of birth\nand then evaluated tinnitus under DC 6260.",
    ],
    [
      "'home address' used in an ordinary sentence, not a form field",
      "Veteran confirmed home address unchanged; left knee flexion limited to 45 degrees, DC 5260, 10 percent.",
    ],
    [
      "'mailing address' used in an ordinary sentence",
      "We sent this letter to your mailing address. Your evaluation of post-traumatic stress disorder is 70 percent effective June 1, 2023 under 38 CFR 4.130.",
    ],
    [
      "'home of record' used in an ordinary sentence",
      "The home of record listed on file was updated last year. PTSD rating of 70 percent effective 2023.",
    ],
  ])("leaves %s untouched", (_label, text) => {
    const result = scrubText(text);
    expect(result).toBe(text);
  });

  it("does not re-match its own '[REDACTED_DOB]' placeholder as a bare 'DOB' label", () => {
    const result = scrubText(
      "DOB: 01/15/1985 Dx: PTSD, tinnitus, lumbar strain DC 5237",
    );
    expect(result).toBe(
      "[REDACTED_DOB] Dx: PTSD, tinnitus, lumbar strain DC 5237",
    );
  });
});

describe("D16-5: OCR-garbled SSNs", () => {
  it.each([
    ["O for 0 in the first group", "SSN: O23-45-6789"],
    ["l for 1 across two groups", "SSN: 12l-45-678l"],
    ["S for 5 in the middle group", "Member 123-4S-6789"],
    ["B for 8 in the last group", "Member 123-45-67B9"],
    ["a comma as the separator", "Member 123,45,6789"],
    ["a colon as the separator", "Member 123:45:6789"],
  ])("redacts an SSN garbled with %s", (_label, text) => {
    const result = scrubText(text);
    expect(result).toContain("[REDACTED_SSN]");
  });

  it("does not redact an ordinary short alphanumeric run that merely falls into a 3-2-4 shape", () => {
    const text = "The oil-to-fuel ratio was measured across three trials.";
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});

describe("D16-5/D16-6: OCR-garbled emails", () => {
  it("redacts an email with spaces around @ and the domain dot", () => {
    const result = scrubText("Contact john.smith @ gmail . com for records.");
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).not.toContain("gmail");
  });

  it("still redacts a normally-formatted email", () => {
    const result = scrubText("Contact john.smith@gmail.com for records.");
    expect(result).toContain("[REDACTED_EMAIL]");
  });

  it.each([
    [
      "a range-of-motion reading",
      "Left knee flexion limited @ 45. Extension full.",
    ],
    [
      "a medication timing note",
      "Metoprolol 25 mg @ bedtime. Patient reports dizziness.",
    ],
    ["a pain-scale reading", "Pain 7/10 @ worst. Sleeps poorly due to PTSD."],
    ["a vitals reading", "HR 72 @ rest. Tinnitus bilateral."],
  ])(
    "does not treat clinical '@' shorthand (%s) as an email - no real TLD follows",
    (_label, text) => {
      const result = scrubText(text);
      expect(result).toBe(text);
    },
  );
});

describe("D16-6: cityStateZip is ZIP-anchored, not a bare comma", () => {
  it.each([
    [
      "all-caps spelled-out state with ZIP",
      "Mail to ANYTOWN, CALIFORNIA 90210 please.",
    ],
    [
      "lowercase spelled-out state with ZIP",
      "Mail to anytown, california 90210 please.",
    ],
    ["lowercase 2-letter code with ZIP", "springfield, il 62704"],
  ])("redacts %s", (_label, text) => {
    const result = scrubText(text);
    expect(result).not.toContain("Anytown");
    expect(result).not.toMatch(/anytown/i);
  });

  it.each([
    [
      "a legal-prose comma-then-state-code with no ZIP ('Accordingly, VA')",
      "Accordingly, VA has determined that additional evidence is needed.",
    ],
    [
      "another legal-prose comma-then-state-code, mid-sentence ('However, VA')",
      "The examiner reviewed the claims file. However, VA must consider lay evidence.",
    ],
    [
      "a condition list ending in a state-code-shaped abbreviation ('PTSD, MS')",
      "Service connection for PTSD, MS, and diabetes mellitus is granted.",
    ],
    [
      "a real place name followed by a real state name, no ZIP (Camp Lejeune)",
      "The veteran was stationed at Camp Lejeune, North Carolina from 1975 to 1980.",
    ],
    [
      "a review-of-systems abbreviation ('GU')",
      "Review of systems: cardiovascular, GU, and neurological negative.",
    ],
    [
      "a problem-list abbreviation ('SC')",
      "Problem list: Tinnitus, SC; hypertension, stable.",
    ],
    [
      "ALL-CAPS rating-criteria wording (', OR')",
      "EVALUATION OF 30 PERCENT, OR HIGHER IS WARRANTED FOR ANKYLOSIS.",
    ],
    [
      "ALL-CAPS rating-criteria wording (', IN')",
      "INJURY TO RIGHT KNEE, IN LINE OF DUTY.",
    ],
    [
      "a country list containing a state-name-shaped country ('Georgia')",
      "Exposure to burn pits in Iraq, Kuwait, Georgia, and Afghanistan is presumed.",
    ],
    [
      "ordinary prose with a lowercase word colliding with a state code, no comma/ZIP anchor",
      "The results were consistent in or around the treatment window.",
    ],
  ])(
    "no longer redacts %s (no ZIP, no label - too weak an anchor)",
    (_label, text) => {
      const result = scrubText(text);
      expect(result).toBe(text);
    },
  );
});

describe("D16-5: labeled City:/State:/Zip code: blocks", () => {
  it("redacts each labeled field independently", () => {
    const text = "City: Springfield\nState: Illinois\nZip code: 62704";
    const result = scrubText(text);
    expect(result).not.toContain("Springfield");
    expect(result).not.toContain("Illinois");
    expect(result).not.toContain("62704");
  });

  it("redacts a partial block (City only, no State/Zip lines)", () => {
    const result = scrubText("City: Springfield\n");
    expect(result).not.toContain("Springfield");
  });

  it("D16-6: still redacts a 2-letter state code value", () => {
    const result = scrubText("State: IL");
    expect(result).not.toContain("IL");
  });

  it.each([
    [
      "an emotional-status field",
      "Emotional State: Anxious and depressed with passive ideation.",
    ],
    ["a mental-status field", "Mental state: depressed mood, flat affect."],
  ])(
    "D16-6: does not treat %s as a State: address field - the value isn't a real state",
    (_label, text) => {
      const result = scrubText(text);
      expect(result).toBe(text);
    },
  );
});

describe("D16-5/D16-6: 'Patient: NAME (NNNN)'", () => {
  it("redacts a patient header line", () => {
    const result = scrubText(
      "Patient: Doe, Jane (4821) presented for follow-up.",
    );
    expect(result).toContain("[REDACTED_PATIENT]");
    expect(result).not.toContain("Doe");
  });

  it("redacts an ALL-CAPS patient header line", () => {
    const result = scrubText("PATIENT: DOE JANE (4821) presented today.");
    expect(result).toContain("[REDACTED_PATIENT]");
    expect(result).not.toContain("DOE");
  });

  it("does not treat a clinical narrative ending in a parenthesized year as a patient header", () => {
    const text =
      "Patient: reports worsening lumbar radiculopathy since surgery (2019) with numbness.";
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});

describe("D16-5/D16-6: VA-letter page footers", () => {
  it("redacts the file-number-and-name span but keeps 'Page N' (direct helper)", () => {
    const text = "File Number: 12345678  DOE, JOHN M  Page 2";
    const result = redactLetterFooter(text);
    expect(result).not.toContain("DOE");
    expect(result).not.toContain("12345678");
    expect(result).toContain("Page 2");
  });

  it("redacts the footer through the REAL scrubText pipeline, not just the standalone helper", () => {
    const text = "File Number: 12345678  DOE, JOHN M  Page 2";
    const result = scrubText(text);
    expect(result).not.toContain("DOE");
    expect(result).not.toContain("12345678");
    expect(result).toContain("Page 2");
  });

  it("redacts a re-grouped (space-separated) file number in the footer", () => {
    const text = "File Number: C 12 345 678  DOE, JOHN M  Page 2";
    const result = scrubText(text);
    expect(result).not.toContain("DOE");
    expect(result).toContain("Page 2");
  });
});

describe("D16-5/D16-6: salutations without a courtesy title", () => {
  it("redacts 'Dear FIRST LAST:' with no title", () => {
    const result = redactSalutationNames(
      "Dear John Smith:\n\nWe are writing...",
    );
    expect(result).not.toContain("John Smith");
    expect(result).toContain("Dear ");
  });

  it("redacts a single bare surname with no title and no second word", () => {
    const result = redactSalutationNames("Dear Faketon:\n\nWe are writing...");
    expect(result).not.toContain("Faketon");
  });

  it("redacts a name with a middle initial", () => {
    const result = redactSalutationNames("Dear John A. Smith:");
    expect(result).not.toContain("Smith");
  });

  it("redacts an ALL-CAPS name", () => {
    const result = redactSalutationNames("Dear JOHN SMITH:");
    expect(result).not.toContain("SMITH");
  });

  it("redacts a surname with an inner capital ('McDonald') in full", () => {
    const result = redactSalutationNames("Dear John McDonald:");
    expect(result).not.toContain("Donald");
    expect(result).not.toContain("McDonald");
  });

  it("does not redact a generic templated greeting with no title", () => {
    const result = redactSalutationNames("Dear Veteran:\n\nWe are writing...");
    expect(result).toBe("Dear Veteran:\n\nWe are writing...");
  });

  it("does not redact 'Dear Sir or Madam:'", () => {
    const text = "Dear Sir or Madam:\n\nWe are writing...";
    const result = redactSalutationNames(text);
    expect(result).toBe(text);
  });
});

describe("D16-6: salutations with a military rank instead of a civilian courtesy title", () => {
  it("redacts the surname and leaves the rank abbreviation as the kept greeting", () => {
    const result = redactSalutationNames("Dear Sgt. Smith:");
    expect(result).not.toContain("Smith");
    expect(result).toContain("Sgt");
  });

  it("does not double-redact the leftover rank fragment as if it were itself a bare surname", () => {
    const result = redactSalutationNames("Dear Sgt. Smith:");
    // The rank word must survive untouched - only "Smith" is PII here.
    expect(result).toBe("Dear Sgt. [REDACTED]:");
  });
});

describe("D16-5: salutations inside a flattened one-line OCR page", () => {
  it("redacts a titled salutation embedded mid-line with no surrounding newlines", () => {
    const text =
      "DEPARTMENT OF VETERANS AFFAIRS March 15 2024 Dear Mr. Faketon: We have reviewed your claim Sincerely";
    const result = redactSalutationNames(text);
    expect(result).not.toContain("Faketon");
  });

  it("redacts a no-title salutation embedded mid-line with no surrounding newlines", () => {
    const text =
      "DEPARTMENT OF VETERANS AFFAIRS March 15 2024 Dear Jordan Faketon we have reviewed your claim Sincerely";
    const result = redactSalutationNames(text);
    expect(result).not.toContain("Jordan Faketon");
  });
});

describe("D16-5/D16-6: over-redaction guard - realistic medical/legal text survives", () => {
  it.each([
    [
      "a condition name and body part",
      "The veteran reports chronic lumbar spine pain with radiculopathy to the left leg.",
    ],
    ["a diagnostic code", "Tinnitus is rated under Diagnostic Code 6260."],
    [
      "a disability percentage",
      "The combined evaluation is 70% effective the date of claim.",
    ],
    [
      "an effective date",
      "The effective date of the increase is January 15, 2024.",
    ],
    [
      "a CFR citation",
      "This decision is made under 38 CFR § 4.130 and 38 U.S.C. § 1110.",
    ],
    [
      "a body part list",
      "Examination noted limited motion of the right shoulder and left knee.",
    ],
    [
      "rating-criteria prose using ', OR' between two thresholds",
      "Forward flexion of the thoracolumbar spine 30 degrees or less, OR favorable ankylosis of the entire spine.",
    ],
  ])("leaves %s untouched", (_label, text) => {
    const result = scrubText(text);
    expect(result).toBe(text);
  });
});

describe("D16-6/D19: no pattern (new, widened, or pre-existing) has a quadratic scan", () => {
  // Timed directly against `_testOnlyPatterns` rather than through
  // `scrubText()`, so each pattern's own cost is isolated.
  it("emailOcrSpaced does not blow up on a long run of '.'-and-word-character text", () => {
    const pathological = "a.".repeat(50000);
    const start = Date.now();
    pathological.match(_testOnlyPatterns.emailOcrSpaced);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("emailOcrSpaced does not blow up on a long run of 'word.' text", () => {
    const pathological = "word.".repeat(10000);
    const start = Date.now();
    pathological.match(_testOnlyPatterns.emailOcrSpaced);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("ssnOcrGarbled does not blow up on a long run of digit-and-separator text", () => {
    const pathological = "1 ".repeat(50000);
    const start = Date.now();
    pathological.match(_testOnlyPatterns.ssnOcrGarbled);
    expect(Date.now() - start).toBeLessThan(500);
  });

  // D19: the base `email` pattern used to be quadratic on this exact shape
  // (~6s for 80,000 chars) - every quantifier is now bounded (see the
  // pattern's own comment in piiScrubber.js), so this should run in
  // milliseconds instead.
  it("email (base pattern) does not blow up on a long run of '.'-heavy text", () => {
    const pathological = "a.".repeat(40000); // 80,000 chars
    const start = Date.now();
    pathological.match(_testOnlyPatterns.email);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("email (base pattern) still matches a normal address after the pathological run", () => {
    const text = `${"a.".repeat(40000)} contact veteran@example.com for records.`;
    const start = Date.now();
    const result = scrubText(text);
    expect(Date.now() - start).toBeLessThan(500);
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).not.toContain("veteran@example.com");
  });
});

describe("D19-3: ssnOcrGarbled leaves real-world digit lists alone", () => {
  // Isolated against the pattern itself, not the full `scrubText()`
  // pipeline - a full-pipeline run can still legitimately redact some of
  // these fixtures for an UNRELATED reason (e.g. a real MM/DD/YYYY date
  // matches the pre-existing, intentionally aggressive `dob` pattern; four
  // space-separated 4-digit groups match `creditCard`). This block only
  // proves `ssnOcrGarbled` itself no longer fires on any of them.
  it.each([
    [
      "a CFR citation list",
      "See 38 C.F.R. §§ 3.156, 20.203, 20.1103 for the applicable rules.",
    ],
    [
      "a USC citation list",
      "Benefits are authorized under 38 U.S.C. §§ 5107, 1110, and 1131.",
    ],
    ["an audiogram frequency/threshold row", "500 10 2000 Hz, right ear."],
    [
      "a full audiogram table",
      "Frequency (Hz): 500 1000 2000 3000 4000. Threshold (dB): 10 15 20 25 30.",
    ],
    ["a lab panel", "Glucose 95, Cholesterol 180, Triglycerides 150 mg/dL."],
    ["an MM/DD/YYYY date", "Seen on 03/15/1985 for a routine exam."],
    ["an MM-DD-YYYY date", "Seen on 03-15-1985 for a routine exam."],
  ])("ssnOcrGarbled does not match %s", (_label, text) => {
    expect(text.match(_testOnlyPatterns.ssnOcrGarbled)).toBeNull();
  });

  // The exact reported regression, through the full pipeline: the
  // citation list's OWN "20." prefix must survive too, not just avoid the
  // literal [REDACTED_SSN] token - and nothing else in the full aggressive
  // pipeline has a reason to touch plain citation numbers either.
  it("leaves a CFR citation list completely untouched end to end", () => {
    const text =
      "See 38 C.F.R. §§ 3.156, 20.203, 20.1103 for the applicable rules.";
    expect(scrubText(text)).toBe(text);
  });

  it("leaves an audiogram frequency/threshold row completely untouched end to end", () => {
    const text = "500 10 2000 Hz, right ear.";
    expect(scrubText(text)).toBe(text);
  });
});
