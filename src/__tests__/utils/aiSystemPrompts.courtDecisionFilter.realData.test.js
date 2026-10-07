/**
 * The court-decision filter against the real curated file, with the two
 * evaluation questions whose keyword block carried court decisions in the
 * recorded runs: a buddy statement about "John" (a23, which drew Johnson v.
 * McDonald and Johnston v. Brown) and a TDIU question (a25, which drew
 * Bradford v. Nicholson).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { GOLDEN, recordedCases } from "./recordedAnswers";

const DATA = "public/data/diamond_knowledge.json";
const raw = existsSync(DATA) ? readFileSync(DATA, "utf8") : "";
const available = raw.startsWith("{");

const COURT_ENTRY = /Q: (?:What did the Court decide in|What is [^\n]* v\. )/;
const ON_DEVICE = {
  maxEntries: 6,
  maxChars: 4000,
  excludeBoardDecisions: true,
};

describe("court decisions in the recorded keyword blocks", () => {
  it("26 of the 391 recorded keyword blocks carried one, all for cases a23 and a25", () => {
    const blocks = recordedCases().filter((c) => c.kbContext);
    const withCourt = blocks.filter((c) => COURT_ENTRY.test(c.kbContext));
    expect(blocks).toHaveLength(391);
    expect(withCourt).toHaveLength(26);
    expect([...new Set(withCourt.map((c) => c.id))].sort()).toEqual([
      "a23",
      "a25",
    ]);
  });
});

describe.skipIf(!available)(
  "excludeCourtDecisions on the real curated file",
  () => {
    let buildDKBContext;
    let isCourtDecisionEntry;
    let entries;

    beforeAll(async () => {
      entries = JSON.parse(raw).entries;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ entries }) })),
      );
      vi.spyOn(console, "log").mockImplementation(() => {});
      ({ buildDKBContext, isCourtDecisionEntry } =
        await import("../../utils/aiSystemPrompts"));
    }, 60000);

    afterAll(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("tags 257 CAVC and 101 Federal Circuit entries", () => {
      const court = entries.filter(isCourtDecisionEntry);
      const count = (source) =>
        court.filter((e) => e.metadata.source === source).length;
      expect(count("CAVC")).toBe(257);
      expect(count("FEDERAL_CIRCUIT")).toBe(101);
    });

    it.each(["a23", "a25"])(
      "keeps court decisions out of the block for case %s and still fills it",
      async (id) => {
        const question = GOLDEN[id].input;
        const before = await buildDKBContext(question, ON_DEVICE);
        const after = await buildDKBContext(question, {
          ...ON_DEVICE,
          excludeCourtDecisions: true,
        });
        expect(before).toMatch(COURT_ENTRY);
        expect(after).not.toMatch(COURT_ENTRY);
        expect(after).not.toMatch(/Vet\. App\.|F\.3d/);
        expect(after).toMatch(/\[[1-6] reference entries provided from /);
      },
      60000,
    );
  },
);
