import { describe, it, expect } from "vitest";
import { removePersonAndPlaceShapes } from "./dd214ModelTextScrub";
import { sanitizeModelOutput } from "./dd214ModelOutputGuards";

const prose = (text) => removePersonAndPlaceShapes(text, { bare: "prose" });
const short = (text) => removePersonAndPlaceShapes(text, { bare: "short" });
const NAME_PARTS = /Zorblax|Quindle|Vexroth|Núñez|José/;

describe("a name is removed however its words are separated or written", () => {
  it.each([
    ["a new line", "Signed by Zorblax\nQuindle today"],
    ["a carriage return and new line", "Signed by Zorblax\r\nQuindle today"],
    ["a no-break space", "Signed by Zorblax\u00A0Quindle today"],
    ["an em space", "Signed by Zorblax\u2003Quindle today"],
    ["an ideographic space", "Signed by Zorblax\u3000Quindle today"],
    ["a line separator", "Signed by Zorblax\u2028Quindle today"],
    ["full-width letters", "Signed by Ｚorblax Ｑuindle today"],
  ])("prose: %s", (_label, text) => {
    expect(prose(text)).not.toMatch(NAME_PARTS);
  });

  it("removes a titled name split by a line break", () => {
    expect(
      removePersonAndPlaceShapes("Reports to SGT\nZorblax\u00A0Quindle"),
    ).not.toMatch(NAME_PARTS);
  });

  it("removes accented names", () => {
    expect(prose("Signed by José Núñez today")).not.toMatch(NAME_PARTS);
    expect(short("Medal of José Núñez")).not.toMatch(NAME_PARTS);
    expect(removePersonAndPlaceShapes("Núñez, José A")).not.toMatch(NAME_PARTS);
  });

  it("removes a four-word name in short mode", () => {
    expect(short("Zorblax Michael Quindle Vexroth")).not.toMatch(NAME_PARTS);
    expect(short("Medal of Zorblax Michael Quindle Vexroth")).not.toMatch(
      NAME_PARTS,
    );
  });

  it("does not claim lowercase names: shape matching cannot see them", () => {
    expect(prose("signed by zorblax quindle today")).toContain("zorblax");
  });
});

describe("a city, state and ZIP are removed however they are written", () => {
  it.each([
    ["a new line after the comma", "Born in Springfield,\nIL today"],
    ["a no-break space after the comma", "Born in Springfield,\u00A0IL today"],
    ["a new line before the comma", "Born in Springfield\n, IL today"],
    ["no comma", "Born in Springfield IL today"],
  ])("city and state: %s", (_label, text) => {
    expect(removePersonAndPlaceShapes(text)).not.toContain("Springfield");
  });

  it.each([
    ["full-width digits", "Mailed to ６２７０４ today", "６２７０４"],
    [
      "full-width digits with plus four",
      "Mailed to ６２７０４-１２３４",
      "１２３４",
    ],
    ["a ZIP after a no-break space", "Mailed to IL\u00A062704", "62704"],
  ])("ZIP: %s", (_label, text, leaked) => {
    const out = removePersonAndPlaceShapes(text);
    expect(out).not.toContain(leaked);
    expect(out).not.toMatch(/62704|1234/);
  });

  it("keeps a real duty station and a platoon-or-squad phrase", () => {
    expect(removePersonAndPlaceShapes("Fort Bragg, NC")).toBe("Fort Bragg, NC");
    expect(removePersonAndPlaceShapes("Platoon OR Squad")).toBe(
      "Platoon OR Squad",
    );
  });
});

describe("the whole-output check applies the same normalising", () => {
  it("removes a split name and a full-width ZIP from every text key", () => {
    const out = sanitizeModelOutput({
      narrativeReason:
        "Request of Zorblax\nQuindle, Springfield,\u00A0IL ６２７０４",
      awards: [{ name: "Medal of Zorblax Michael Quindle Vexroth" }],
    });
    expect(JSON.stringify(out)).not.toMatch(
      /Zorblax|Quindle|Springfield|２７０４/,
    );
  });
});
