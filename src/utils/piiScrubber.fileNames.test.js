/**
 * redactFileNames needs no known value: whatever is shaped like a file name
 * becomes a neutral token. A surname-first name can have many words, and the
 * formats a veteran can drop into any tool are not only the document ones.
 * Fixture names are synthetic.
 */
import { describe, it, expect } from "vitest";
import { redactFileNames } from "./piiScrubber";

const noIdentifier = (text) => {
  expect(text).not.toMatch(/faketon/i);
  expect(text).not.toContain("6789");
};

describe("a spaced file name with many words", () => {
  it.each([
    "Failed to process Faketon John DD214 Member Copy 4.pdf: x",
    "Processing John Quincy Faketon Junior DD214 Member 4 Copy 6789.pdf now",
    "Could not read Faketon Jordan Alex DD214 Certificate of Release or Discharge 6789.pdf (page 2)",
  ])("redacts every word of %j", (line) => {
    const out = redactFileNames(line);
    noIdentifier(out);
    expect(out).toContain("[file name]");
  });

  it("still leaves the text after the name alone", () => {
    expect(
      redactFileNames(
        "Failed to process Faketon John DD214 Member Copy 4.pdf: parse error",
      ),
    ).toMatch(/: parse error$/);
  });
});

describe("formats beyond the document ones", () => {
  it.each([
    "xml",
    "htm",
    "md",
    "jfif",
    "avif",
    "svg",
    "eml",
    "msg",
    "pages",
    "ppt",
    "pptx",
    "xps",
    "odp",
    "ods",
    "epub",
    "mp3",
    "wav",
    "m4a",
    "mp4",
    "mov",
  ])("redacts Faketon_6789.%s", (extension) => {
    const out = redactFileNames(`Skipping Faketon_6789.${extension} now`);
    noIdentifier(out);
    expect(out).toContain("[file name]");
  });

  it.each([
    "Failed to load module chunk-abc.js",
    "fetch /data/disabilityData.json failed",
    "page 6789 of 12 loaded",
  ])("leaves %j alone", (line) => {
    expect(redactFileNames(line)).toBe(line);
  });
});

describe("adversarial input stays fast", () => {
  const INPUTS = {
    "many short words, no extension": "a ".repeat(50000),
    "many short words, one extension at the end": "a ".repeat(50000) + "x.pdf",
    "one long token": "x".repeat(100000),
    "many extensions": "a.pdf ".repeat(20000),
    "many directory separators": "a/".repeat(50000),
    "many words then a separator": "w ".repeat(50000) + "/",
    "many spaced directories": "my docs/".repeat(12500),
    "many 99-character words":
      ("a" + "b".repeat(98) + " ").repeat(1000) + "z.pdf",
  };

  it.each(Object.entries(INPUTS))("%s", (_label, input) => {
    const started = Date.now();
    redactFileNames(input);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
