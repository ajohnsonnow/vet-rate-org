import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  buildCitationNotice,
  findUnverifiedCitations,
  flagUnverifiedCitations,
} from "../../utils/citationCheck";
import { extractCfrSections } from "../../utils/cfrCitations";
import { extractCfrSections as evalExtract } from "../../../scripts/eval/lib/legalSections.js";

describe("findUnverifiedCitations", () => {
  it("passes citations to sections that exist", () => {
    expect(
      findUnverifiedCitations(
        "Under 38 CFR § 3.310(a) and 38 C.F.R. 4.16(b), see also 38 CFR §§ 4.25, 4.26 and 4.71a.",
      ),
    ).toEqual([]);
  });

  it("returns Part 3 and Part 4 sections that do not exist", () => {
    expect(
      findUnverifiedCitations(
        "38 CFR § 3.310 applies, as do 38 CFR § 4.37 and 38 CFR 3.9999(b).",
      ),
    ).toEqual(["4.37", "3.9999"]);
  });

  it("names each missing section once", () => {
    expect(
      findUnverifiedCitations("38 CFR § 4.37 ... again 38 CFR 4.37(a)"),
    ).toEqual(["4.37"]);
  });

  it("leaves other parts of title 38 alone", () => {
    expect(
      findUnverifiedCitations(
        "38 CFR § 20.1303, 38 CFR § 17.38, 38 CFR 21.9999 and 38 CFR § 19.5",
      ),
    ).toEqual([]);
  });

  it("does not flag reserved section numbers", () => {
    expect(findUnverifiedCitations("38 CFR § 4.110 and 38 CFR § 3.18")).toEqual(
      [],
    );
  });

  it("ignores section numbers that are not written as 38 CFR citations", () => {
    expect(
      findUnverifiedCitations(
        "Part 4 is the schedule. § 4.999 alone, version 4.37, and 38 U.S.C. 1110.",
      ),
    ).toEqual([]);
  });

  it("handles empty input", () => {
    expect(findUnverifiedCitations("")).toEqual([]);
    expect(findUnverifiedCitations(undefined)).toEqual([]);
  });
});

describe("buildCitationNotice", () => {
  it("names the one citation that could not be verified", () => {
    const notice = buildCitationNotice(["4.37"]);
    expect(notice).toContain("38 CFR § 4.37");
    expect(notice).toMatch(/could not verify a citation/);
    expect(notice).toMatch(/Veterans Service Officer/);
  });

  it("names every citation when there are several", () => {
    const notice = buildCitationNotice(["4.37", "3.9999", "4.90"]);
    expect(notice).toContain("38 CFR § 4.37, § 3.9999 and § 4.90");
    expect(notice).toMatch(/could not verify citations/);
  });
});

describe("flagUnverifiedCitations", () => {
  const answer = "Your claim falls under 38 CFR § 4.37.";

  it("appends the notice and marks the result without rewriting the answer", () => {
    const out = flagUnverifiedCitations({ text: answer, usedMode: "swarm" });
    expect(out.text.startsWith(answer)).toBe(true);
    expect(out.text).toBe(`${answer}\n\n${buildCitationNotice(["4.37"])}`);
    expect(out.citationsUnverified).toEqual({ sections: ["4.37"] });
    expect(out.validationWarnings).toEqual([
      "Answer cites 38 CFR sections that could not be verified: 4.37",
    ]);
    expect(out.usedMode).toBe("swarm");
  });

  it("keeps warnings that were already on the result", () => {
    const out = flagUnverifiedCitations({
      text: answer,
      validationWarnings: ["earlier"],
    });
    expect(out.validationWarnings).toHaveLength(2);
    expect(out.validationWarnings[0]).toBe("earlier");
  });

  it("returns the same object when every citation checks out", () => {
    const result = { text: "See 38 CFR § 4.25." };
    expect(flagUnverifiedCitations(result)).toBe(result);
  });

  it("leaves structured output alone", () => {
    const json = { text: '{"basis": "38 CFR § 4.37"}' };
    expect(flagUnverifiedCitations(json)).toBe(json);
    const fenced = { text: '```json\n{"basis": "38 CFR § 4.37"}\n```' };
    expect(flagUnverifiedCitations(fenced)).toBe(fenced);
    const formatted = { text: answer };
    expect(
      flagUnverifiedCitations(formatted, {
        responseFormat: { type: "json_object" },
      }),
    ).toBe(formatted);
  });

  it("leaves a result with no text alone", () => {
    const empty = { text: "" };
    expect(flagUnverifiedCitations(empty)).toBe(empty);
    const missing = {};
    expect(flagUnverifiedCitations(missing)).toBe(missing);
  });
});

describe("cfrCitations", () => {
  it("is the extractor the evaluation runner uses", () => {
    expect(evalExtract).toBe(extractCfrSections);
  });
});

const TRANSCRIPT_DIR = "llm-compiler/logs/golden-set-results";
// Runs recorded after this one have not had their flags reviewed by hand.
const LAST_REVIEWED_RUN = "run_2026-10-05_141236";

function recordedAnswers() {
  return readdirSync(TRANSCRIPT_DIR)
    .filter((name) => name.endsWith(".jsonl"))
    .filter(
      (name) => name.slice(0, LAST_REVIEWED_RUN.length) <= LAST_REVIEWED_RUN,
    )
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) =>
      readFileSync(path.join(TRANSCRIPT_DIR, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((record) => record.type === "case")
        .map((record) => ({ name, id: record.id, response: record.response })),
    );
}

describe("citation check over the recorded evaluation answers", () => {
  const answers = recordedAnswers();

  it("reads the recorded answers", () => {
    expect(answers).toHaveLength(464);
  });

  it("flags only the citations to sections that do not exist", () => {
    const flagged = answers.flatMap((a) =>
      findUnverifiedCitations(a.response).map(
        (section) => `${a.name.slice(4, 21)} ${a.id} ${section}`,
      ),
    );
    expect(flagged).toEqual([
      "2026-10-05_122217 a04 4.37",
      "2026-10-05_123216 a04 4.37",
      "2026-10-05_135040 a05 4.71b",
      "2026-10-05_135908 a03 4.90",
    ]);
  });
});
