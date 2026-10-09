import { describe, it, expect, vi } from "vitest";

// The two semantic engines are mocked so we can assert the facade DELEGATES to
// them (their real retrieval behavior is covered by legalRag/dkbShardedRag
// tests). Structured accessors are untouched by these mocks.
vi.mock("../../services/legalRag.js", () => ({
  query: vi.fn(async (text, opts) => ({ delegated: "legal", text, opts })),
}));
vi.mock("../../services/dkbShardedRag.js", () => ({
  queryShards: vi.fn(async (text, opts) => ({
    delegated: "corpus",
    text,
    opts,
  })),
}));

import disabilityData from "../../data/disabilityData.json";
import dbqLogicMap from "../../data/dbq_logic_map.json";
import pactActData from "../../data/pactActData.json";
import {
  searchDisabilityData,
  getSearchSuggestions,
} from "../../utils/searchUtils.js";
import { findSecondaryClaims } from "../../utils/secondaryClaimsEngine.js";
import { query as legalRagQuery } from "../../services/legalRag.js";
import { queryShards } from "../../services/dkbShardedRag.js";
import * as kb from "../../services/knowledgeQuery.js";

describe("knowledgeQuery - conditions", () => {
  it("count matches the raw dataset length", () => {
    expect(kb.getConditionCount()).toBe(disabilityData.disabilities.length);
  });

  it("getAllConditions returns the raw disabilities array", () => {
    expect(kb.getAllConditions()).toHaveLength(
      disabilityData.disabilities.length,
    );
    expect(kb.getAllConditions()[0]).toEqual(disabilityData.disabilities[0]);
  });

  it("getConditionByCode resolves the matching diagnosticCode", () => {
    const sample = disabilityData.disabilities[5];
    const found = kb.getConditionByCode(sample.diagnosticCode);
    expect(found?.diagnosticCode).toBe(sample.diagnosticCode);
    // numeric coercion resolves the same string-keyed entry
    expect(
      kb.getConditionByCode(Number(sample.diagnosticCode))?.diagnosticCode,
    ).toBe(sample.diagnosticCode);
  });

  it("getConditionByCode returns undefined for a nonexistent / null code", () => {
    expect(kb.getConditionByCode("ZZZZ-nope")).toBeUndefined();
    expect(kb.getConditionByCode(null)).toBeUndefined();
  });

  it("searchConditions matches searchUtils bound to the same dataset", () => {
    const term = "ptsd";
    expect(kb.searchConditions(term)).toEqual(
      searchDisabilityData(term, disabilityData),
    );
  });

  it("getConditionSuggestions matches getSearchSuggestions bound to the same dataset", () => {
    const term = "knee";
    expect(kb.getConditionSuggestions(term, 8)).toEqual(
      getSearchSuggestions(term, disabilityData, 8),
    );
  });
});

describe("knowledgeQuery - secondary conditions", () => {
  it("delegates to the 38 CFR 3.310 engine", () => {
    const input = ["PTSD", "Tinnitus"];
    expect(kb.findSecondaryConditions(input)).toEqual(
      findSecondaryClaims(input),
    );
  });
});

describe("knowledgeQuery - DBQ logic", () => {
  it("returns an entry by its map key", () => {
    const key = Object.keys(dbqLogicMap)[0];
    expect(kb.getDbqLogic(key)).toBe(dbqLogicMap[key]);
  });

  it("resolves an entry by its diagnostic_code field", () => {
    const key = Object.keys(dbqLogicMap).find(
      (k) => dbqLogicMap[k]?.diagnostic_code,
    );
    if (key) {
      const dc = dbqLogicMap[key].diagnostic_code;
      expect(kb.getDbqLogicByDiagnosticCode(dc)).toBe(dbqLogicMap[key]);
    }
    expect(kb.getDbqLogicByDiagnosticCode(null)).toBeUndefined();
  });
});

describe("knowledgeQuery - PACT Act", () => {
  it("returns the whole dataset and a per-code mapping", () => {
    expect(kb.getPactActData()).toBe(pactActData);
    const codes = Object.keys(pactActData.diagnosticCodePactMapping || {});
    if (codes.length) {
      expect(kb.getPactMappingByCode(codes[0])).toBe(
        pactActData.diagnosticCodePactMapping[codes[0]],
      );
    }
    expect(kb.getPactMappingByCode(null)).toBeUndefined();
  });
});

describe("knowledgeQuery - multinational / OCONUS", () => {
  it("returns the four category files, per-category provisions, and search hits", () => {
    const categories = kb.getMultinationalContent();
    expect(categories.map((c) => c.category)).toEqual([
      "presumptive_exposure_overseas",
      "foreign_medical_program",
      "oconus_filing",
      "allied_service_credit",
    ]);
    const fmp = kb.getMultinationalCategory("foreign_medical_program");
    expect(fmp.length).toBeGreaterThan(0);
    expect(fmp.every((p) => p.category === "foreign_medical_program")).toBe(
      true,
    );
    expect(kb.queryMultinational("Enewetak").length).toBeGreaterThan(0);
    expect(kb.queryMultinational("zzz-no-such-term")).toEqual([]);
  });
});

describe("knowledgeQuery - regulations", () => {
  it("returns both reference documents", () => {
    const regs = kb.getRegulations();
    expect(regs.cfr3).toBe(kb.getCfr3Regulations());
    expect(regs.title38).toBe(kb.getTitle38Regulations());
  });
});

describe("knowledgeQuery - semantic retrieval delegation", () => {
  it("queryLegal delegates to legalRag.query", async () => {
    const out = await kb.queryLegal("38 CFR 4.71a", { topK: 3 });
    expect(legalRagQuery).toHaveBeenCalledWith("38 CFR 4.71a", { topK: 3 });
    expect(out.delegated).toBe("legal");
  });

  it("queryCorpus delegates to dkbShardedRag.queryShards", async () => {
    const out = await kb.queryCorpus("tinnitus rating", { topK: 5 });
    expect(queryShards).toHaveBeenCalledWith("tinnitus rating", { topK: 5 });
    expect(out.delegated).toBe("corpus");
  });
});
