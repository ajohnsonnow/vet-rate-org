import { describe, it, expect } from "vitest";
import { removePersonAndPlaceShapes } from "./dd214ModelTextScrub";
import {
  sanitizeModelOutput,
  scrubModelFreeText,
} from "./dd214ModelOutputGuards";

const prose = (text) => removePersonAndPlaceShapes(text, { bare: "prose" });
const short = (text) => removePersonAndPlaceShapes(text, { bare: "short" });

describe("person, city and ZIP shapes are removed", () => {
  it.each([
    ["a titled name", "Reports to SGT Zorblax Quindle daily", "Quindle"],
    ["a title in capitals", "Signed by CPT ZORBLAX QUINDLE", "QUINDLE"],
    ["last name first", "Name reads Quindle, Zorblax A", "Quindle"],
    ["a middle initial", "Counsel Zorblax A. Quindle attended", "Quindle"],
    ["a city and state code", "Born in Springfield, IL", "Springfield"],
    ["a city and state name", "Born in Springfield, Illinois", "Springfield"],
    ["a ZIP", "Mailed to 62704 and 62704-1234", "62704"],
  ])("%s", (_label, text, leaked) => {
    expect(removePersonAndPlaceShapes(text)).not.toContain(leaked);
  });

  it("removes a bare two-word name in prose and in a short list item", () => {
    expect(prose("Separated at the request of Zorblax Quindle.")).not.toMatch(
      /Zorblax|Quindle/,
    );
    expect(short("Medal of Zorblax Quindle")).not.toMatch(/Zorblax|Quindle/);
    expect(short("Zorblax Quindle Award")).toBe("[REDACTED] Award");
  });
});

describe("real unit, award and school text is left alone", () => {
  it.each([
    "Alpha Company, 3rd Battalion, 75th Ranger Regiment",
    "HHC 1-5 INF // TRANSFERRED TO USAR (CONTROL GROUP)",
    "Fort Hood Texas Army Medical Center",
    "Headquarters, Marine Corps",
    "Completion of required active service",
  ])("prose keeps %s", (text) => {
    expect(prose(text)).toBe(text);
  });

  it.each([
    "Bronze Star Medal",
    "Army Achievement Medal",
    "Combat Infantryman Badge",
    "Good Conduct Medal",
    "Primary Leadership Development Course",
    "Airborne School",
    "Operation Iraqi Freedom",
    "Global War on Terrorism Service Medal",
  ])("short keeps %s", (text) => {
    expect(short(text)).toBe(text);
  });
});

describe("the guards apply them to every model-written text key", () => {
  it("scrubs unit, award, school, qualification and deployment text", () => {
    const data = {
      lastDutyAssignment: "Zorblax Quindle, Springfield, IL 62704",
      mosTitle: "SGT Zorblax Quindle",
      militaryEducation: ["Quindle, Zorblax A"],
      specialQualifications: ["Zorblax Quindle Award"],
      awards: [{ name: "Medal of Zorblax Quindle" }],
      combatService: { deployments: ["Springfield, IL 62704"] },
    };
    sanitizeModelOutput(data, []);
    expect(JSON.stringify(data)).not.toMatch(
      /Zorblax|Quindle|Springfield|62704/,
    );
  });

  it("scrubModelFreeText removes a city and ZIP the model text carries", () => {
    const data = { narrativeReason: "Moved to Springfield, IL 62704" };
    scrubModelFreeText(data, []);
    expect(data.narrativeReason).not.toMatch(/Springfield|62704/);
  });
});
