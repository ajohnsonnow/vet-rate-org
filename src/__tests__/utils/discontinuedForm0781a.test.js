// @vitest-environment node
/**
 * VA Form 21-0781a was discontinued on June 28, 2024: personal assault and
 * MST are reported on VA Form 21-0781, which has its own section for them.
 * The app's list of valid forms, its glossary and its manual do not offer
 * the discontinued form.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import validForms from "../../data/validVAForms.json";
import { VA_GLOSSARY, getDefinition } from "../../utils/vaGlossary";

describe("VA Form 21-0781a", () => {
  it("is not in the list of valid forms, and 21-0781 is", () => {
    const listed = JSON.stringify(validForms);

    expect(listed).not.toMatch(/21-0781a/i);
    expect(listed).toContain('"21-0781"');
  });

  it("has no glossary entry of its own", () => {
    expect(Object.keys(VA_GLOSSARY).join(" ")).not.toMatch(/21-0781a/i);
    expect(getDefinition("VA Form 21-0781")).toMatch(/PTSD/);
  });

  it("is not what the manual sends MST claims to", () => {
    const manual = readFileSync("src/components/UserManual.jsx", "utf8");

    expect(manual).not.toMatch(/21-0781a/i);
    expect(manual).toMatch(
      /Personal assault \(MST\) - also on VA Form 21-0781/,
    );
  });
});
