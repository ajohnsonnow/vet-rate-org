import { describe, it, expect } from "vitest";
import { sanitizeModelOutput } from "./dd214ModelOutputGuards";
import { parseModelJsonReply } from "./dd214JsonReply";

const clean = (data, sources = []) => sanitizeModelOutput({ ...data }, sources);
const SSN = "123-45-6789";
const ADDRESS = "Zorblax Quindle, 12 Elm St, Springfield, IL 62704";

describe("a short code field cannot carry an identifier shape", () => {
  it.each([
    ["mos", SSN],
    ["mos", "123 45 6789"],
    ["mos", "QUINDL 11B"],
    ["separationAuthority", SSN],
    ["separationAuthority", ADDRESS],
    ["separationAuthority", "AR 635-200 Zorblax Quindle"],
    ["sglCoverage", "123456789"],
    ["sglCoverage", SSN],
    ["separationCode", SSN],
    ["reentryCode", SSN],
  ])("%s drops %s", (key, value) => {
    expect(clean({ [key]: value })[key]).toBeUndefined();
  });

  it.each([
    ["mos", "11B"],
    ["mos", "2A551"],
    ["mos", "3D1X2"],
    ["mos", "HM2"],
    ["mos", "153A"],
    ["mos", "HM"],
    ["separationAuthority", "AR 635-200, paragraph 5-3"],
    ["separationAuthority", "MILPERSMAN 1910-164"],
    ["sglCoverage", "$400,000"],
    ["sglCoverage", "400000"],
  ])("%s keeps %s", (key, value) => {
    expect(clean({ [key]: value })[key]).toBe(value);
  });

  it("drops a known birth date held in a code field", () => {
    const sources = [{ dateOfBirth: "1984-03-15" }];
    expect(
      clean({ separationAuthority: "AR 635-200 1984-03-15" }, sources),
    ).toEqual({});
  });
});

describe("a MOS code cannot be a date, an SSN fragment or a bare number", () => {
  it.each([
    "2010-01-01",
    "20100101",
    "2010 01 01",
    "01/02/2010",
    "6789",
    "1985",
    "123456",
    "12345678",
    "1234-5678",
    "0311",
  ])("drops %s", (value) => {
    expect(clean({ mos: value }).mos).toBeUndefined();
  });

  const cleanWithParserBranch = (data, branch) =>
    sanitizeModelOutput({ ...data }, [], { branch });

  it("keeps a four-digit Marine code only beside a Marine Corps branch the parser read", () => {
    expect(cleanWithParserBranch({ mos: "0311" }, "Marines").mos).toBe("0311");
    expect(cleanWithParserBranch({ mos: "0311" }, "Marine Corps").mos).toBe(
      "0311",
    );
    expect(cleanWithParserBranch({ mos: "0311" }, "Army").mos).toBeUndefined();
    expect(
      cleanWithParserBranch({ mos: "2010-01-01" }, "Marines").mos,
    ).toBeUndefined();
  });

  it.each(["6789", "1980", "0311"])(
    "drops %s when only the model wrote a Marine branch",
    (value) => {
      expect(clean({ branch: "Marine Corps", mos: value }).mos).toBeUndefined();
      expect(clean({ branch: "USMC", mos: value }).mos).toBeUndefined();
    },
  );
});

describe("a document count is a small whole number", () => {
  it.each([[1], [2], ["3"], [20]])("keeps %s", (value) => {
    expect(clean({ dd214Count: value }).dd214Count).toBe(Number(value));
    expect(clean({ documentCount: value }).documentCount).toBe(Number(value));
  });

  it.each([[0], [21], [1985], [20100101], [12345], ["6789"], [2.5], [-1]])(
    "drops %s",
    (value) => {
      expect(clean({ dd214Count: value }).dd214Count).toBeUndefined();
      expect(clean({ documentCount: value }).documentCount).toBeUndefined();
    },
  );
});

describe("real values the local parser may not have read are kept", () => {
  it.each([
    ["rank", "Petty Officer Third Class"],
    ["rank", "1LT"],
    ["rank", "2LT"],
    ["rank", "1SG"],
    ["rank", "SP4"],
    ["rank", "LtCol"],
    ["rank", "HM2"],
    ["branch", "USN"],
    ["branch", "USAF"],
    ["branch", "USCG"],
    ["branch", "USSF"],
    ["separationType", "Released from active duty"],
    ["separationType", "Discharged"],
    [
      "separationType",
      "Release from active duty and transfer to the Navy Reserve",
    ],
    ["component", "Regular Army"],
    ["payGrade", "O-3E"],
    ["reentryCode", "RE-R1"],
  ])("%s %s", (key, value) => {
    expect(clean({ [key]: value })[key]).toBe(value);
  });

  it.each([
    ["lastDutyAssignment", "USS Abraham Lincoln"],
    ["lastDutyAssignment", "Fort Bragg, NC"],
    ["lastDutyAssignment", "1st Cavalry Division, Fort Hood, TX"],
  ])("%s %s", (key, value) => {
    expect(clean({ [key]: value })[key]).toBe(value);
  });
});

describe("text names a known birth date written out in long form", () => {
  it.each(["March 15, 1984", "Mar 15 1984", "15 March 1984", "03/15/1984"])(
    "removes %s from every text key",
    (written) => {
      const out = clean(
        {
          lastDutyAssignment: `Unit as of ${written}`,
          mosTitle: `Rifleman ${written}`,
          narrativeReason: `Born ${written}`,
          awards: [{ name: `Medal ${written}` }],
        },
        [{ dateOfBirth: "1984-03-15" }],
      );
      expect(JSON.stringify(out)).not.toMatch(/1984|March|Mar |15 /);
    },
  );
});

describe("a reply that wraps the object", () => {
  it("in a JSON array still yields the object", () => {
    expect(parseModelJsonReply('[{"branch":"Army","mos":"11B"}]')).toEqual({
      branch: "Army",
      mos: "11B",
    });
  });

  it("with a bare JSON string is an error, not an empty reading", () => {
    expect(() => parseModelJsonReply('"hello"')).toThrow();
  });
});
