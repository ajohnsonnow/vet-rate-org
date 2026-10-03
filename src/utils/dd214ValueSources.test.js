import { describe, it, expect } from "vitest";
import {
  applyParserValues,
  buildValueSources,
  countBySource,
  describeSourceCounts,
  parserValueFor,
  sourcesForImportRows,
} from "./dd214ValueSources";

describe("parserValueFor", () => {
  it("treats empty lists, empty text and an empty combat object as nothing read", () => {
    const fields = {
      awards: [],
      militaryEducation: [],
      narrativeReason: "",
      combatService: {
        hasVerifiedCombat: false,
        indicators: [],
        deployments: [],
      },
      foreignService: false,
    };
    expect(parserValueFor(fields, "awards")).toBeUndefined();
    expect(parserValueFor(fields, "militaryEducation")).toBeUndefined();
    expect(parserValueFor(fields, "narrativeReason")).toBeUndefined();
    expect(parserValueFor(fields, "combatService")).toBeUndefined();
    expect(parserValueFor(fields, "foreignService")).toBe(false);
  });

  it("reads the parser's own name for sea service", () => {
    const sea = { years: 1, months: 2, days: 3 };
    expect(parserValueFor({ seaServiceTime: sea }, "seaService")).toBe(sea);
  });
});

describe("applyParserValues", () => {
  it("replaces the model's value with the parser's and leaves the rest", () => {
    const data = { entryDate: "2003-02-02", rank: "SGT", mos: "11B" };
    const applied = applyParserValues(data, { entryDate: "2002-03-05" });
    expect(applied).toEqual(["entryDate"]);
    expect(data).toEqual({
      entryDate: "2002-03-05",
      rank: "SGT",
      mos: "11B",
    });
  });
});

describe("buildValueSources", () => {
  it("credits the parser where both read a key and the model where only it did", () => {
    const data = { entryDate: "2002-03-05", rank: "SGT", documentCount: 1 };
    const sources = buildValueSources(data, {
      modelKeys: new Set(["entryDate", "rank", "documentCount"]),
      parserKeys: new Set(["entryDate"]),
    });
    expect(sources).toEqual({ entryDate: "parser", rank: "model" });
  });

  it("skips a key whose value ended up empty", () => {
    const sources = buildValueSources(
      { rank: "" },
      { modelKeys: new Set(["rank"]), parserKeys: new Set() },
    );
    expect(sources).toEqual({});
  });
});

describe("rows and counts", () => {
  it("maps the dialog's date rows back to the analysis keys", () => {
    expect(
      sourcesForImportRows(
        { entryDate: "parser", separationDate: "model", rank: "model" },
        { serviceStartDate: "x", serviceEndDate: "y", rank: "z" },
      ),
    ).toEqual({
      serviceStartDate: "parser",
      serviceEndDate: "model",
      rank: "model",
    });
  });

  it("says plainly how many values came from each source", () => {
    const counts = countBySource({ a: "parser", b: "model", c: "model" });
    expect(counts).toEqual({ parser: 1, model: 2, veteran: 0 });
    expect(describeSourceCounts(counts)).toBe(
      "1 value read by the app's own parser, 2 values read by the AI",
    );
    expect(describeSourceCounts({ parser: 0, model: 0, veteran: 2 })).toContain(
      "2 values typed by you",
    );
  });
});
