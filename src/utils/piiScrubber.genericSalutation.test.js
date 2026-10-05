/**
 * A greeting to a role is not a name. The first graded run of the
 * nexus-letter request came back "Dear [REDACTED]," because the send-time
 * scrub read "Doctor" in the app's own "Dear Doctor," as a surname, and the
 * model kept the marker. A greeting that does carry a name must still lose
 * it. Names here are invented.
 */
import { describe, it, expect } from "vitest";
import { redactSalutationNames, scrubPII } from "./piiScrubber";

describe("role greetings are left alone", () => {
  it.each([
    "Dear Doctor,",
    "Dear Doctor:",
    "Dear Healthcare Provider,",
    "Dear Physician,",
    "Dear Provider:",
    "Dear Clinician,",
    "Dear Examiner:",
  ])("%s", (greeting) => {
    const letter = `${greeting}\n\nI am asking whether you would write an opinion.`;
    expect(redactSalutationNames(letter)).toBe(letter);
    expect(scrubPII(letter, { aggressive: false }).scrubbedText).toBe(letter);
  });
});

describe("a name after a role word is still redacted", () => {
  it.each([
    ["Dear Doctor Okonkwo,", "Okonkwo"],
    ["Dear Dr. Okonkwo,", "Okonkwo"],
    ["Dear Provider Faketon:", "Faketon"],
    ["Dear Faketon:", "Faketon"],
  ])("%s", (greeting, name) => {
    const scrubbed = redactSalutationNames(`${greeting}\n\nBody.`);
    expect(scrubbed).not.toContain(name);
    expect(scrubbed).toContain("[REDACTED]");
  });
});
