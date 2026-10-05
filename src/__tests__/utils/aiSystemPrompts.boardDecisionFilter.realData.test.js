/**
 * The Board-decision filter against the real curated file: decision-shaped
 * "decode my denial" prompts must not pull individual Board decisions into
 * the block, and the budget must still fill from the next-ranked entries.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const DATA = "public/data/diamond_knowledge.json";
const raw = existsSync(DATA) ? readFileSync(DATA, "utf8") : "";
const available = raw.startsWith("{");

const DECODE_PROMPTS = [
  "Decode this rating decision and explain why my tinnitus was denied.",
  "VA denied 3 of my 5 conditions. Decode each denial reason.",
];

describe.skipIf(!available)(
  "excludeBoardDecisions on the real curated file",
  () => {
    let buildDKBContext;
    let isBoardDecisionEntry;
    let entries;

    beforeAll(async () => {
      entries = JSON.parse(raw).entries;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ entries }) })),
      );
      vi.spyOn(console, "log").mockImplementation(() => {});
      ({ buildDKBContext, isBoardDecisionEntry } =
        await import("../../utils/aiSystemPrompts"));
    }, 60000);

    afterAll(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("tags Board decisions as metadata.source BVA, and they are the bulk of the file", () => {
      const board = entries.filter(isBoardDecisionEntry);
      expect(board.length).toBeGreaterThan(entries.length / 2);
      expect(
        board.every((e) =>
          e.instruction.startsWith("What was the BVA decision"),
        ),
      ).toBe(true);
    });

    it.each(DECODE_PROMPTS)(
      "keeps Board decisions out of the block for: %s",
      async (prompt) => {
        const unfiltered = await buildDKBContext(prompt, {
          maxEntries: 6,
          maxChars: 4000,
        });
        const filtered = await buildDKBContext(prompt, {
          maxEntries: 6,
          maxChars: 4000,
          excludeBoardDecisions: true,
        });

        expect(unfiltered).toContain("What was the BVA decision");
        expect(filtered).not.toContain("What was the BVA decision");
        expect(filtered).not.toMatch(/BVA (DENIED|GRANTED|REMANDED)/);
        expect(filtered).not.toContain("BVA decisions");
        expect(filtered).toMatch(/\[[1-6] reference entries provided from /);
      },
      60000,
    );
  },
);
