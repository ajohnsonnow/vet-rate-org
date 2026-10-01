/**
 * D20-8: the C-File off-device fallback ran the rating-decision parsers'
 * header and "name ... NN%" scans over a whole letter, which also match
 * letter scaffolding. A finding named "Service connection", "Combined
 * evaluation", "Rating", "shows evaluation" or "the condition" is not a
 * condition, and a "(formerly evaluated as 30 percent)" tail is not part of a
 * name. Real conditions must survive, so the assertions are exact lists.
 */
import { describe, it, expect, vi } from "vitest";

globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

vi.mock("./unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    getAIStatus: vi.fn(() => ({ effectiveMode: "cloud" })),
    getDocumentAIRouting: vi.fn(() => ({
      onDeviceReady: false,
      onDeviceMode: null,
      blockedProviderLabel: "Cloud AI (Gemini)",
    })),
    isAnyAIAvailable: vi.fn(() => true),
  };
});

const { analyzeCFile } = await import("./cfileAnalyzer.js");

const SCAFFOLDED_LETTER = `
Rating Decision
Page 1 of 4

DECISION

1. Service connection for tinnitus is granted with an evaluation of 10 percent
disabling effective January 1, 2020.
2. Service connection for degenerative arthritis of the lumbar spine is
granted with an evaluation of 20 percent disabling effective March 3, 2019.
3. Service connection for obstructive sleep apnea is denied.
4. Evaluation of migraine headaches, which is currently 30 percent disabling,
is continued.
Your combined evaluation is 60 percent effective January 1, 2020.

Tinnitus ......... 10% effective date: January 1, 2020
Service connection - 50 percent effective date January 1, 2020
Combined evaluation - 60 percent effective date January 1, 2020
Rating: 70 percent effective date January 1, 2020
Prior decision dated June 5, 2018 shows evaluation: 30% . Effective date March 3, 2019

We determined that the following conditions were related to your military
service, so service connection has been granted: Medical Description
Percent (%) Assigned Effective Date Panic disorder 30% Jun 30, 2007
Lumbar strain 10% Jun 30, 2008
We have assigned a 50 percent evaluation for your post-traumatic stress disorder (formerly evaluated as 30 percent) based on:
Medical Description Percent (%) 20% 30%
Service connection for the condition is granted with an evaluation of 40 percent effective June 30, 2009.

EVIDENCE
Service treatment records from 2001 to 2005.
`;

const NO_DECISION_LANGUAGE = `
This statement describes a ride along a quiet road past a lake. The weather
was mild and the group stopped for lunch twice before returning home late in
the afternoon. Nothing in this paragraph concerns a claim, a rating or a
decision of any kind, and it is only here to make the document long enough to
analyze at all.
`;

async function conditionsFor(text) {
  const result = await analyzeCFile("fake-api-key", text, () => {}, null, {});
  return result.analysis.potential_claims.map((c) => c.condition);
}

describe("analyzeCFile off-device fallback: non-condition fragments are filtered", () => {
  it("returns exactly the real conditions, none of the scaffolding", async () => {
    expect(await conditionsFor(SCAFFOLDED_LETTER)).toEqual([
      "Tinnitus",
      "degenerative arthritis of the lumbar spine",
      "obstructive sleep apnea",
      "migraine headaches",
      "Panic disorder",
      "Lumbar strain",
      "post-traumatic stress disorder",
    ]);
  });

  it("finds nothing (and says so) in text without decision language", async () => {
    const result = await analyzeCFile(
      "fake-api-key",
      NO_DECISION_LANGUAGE,
      () => {},
      null,
      {},
    );
    expect(result.analysis.potential_claims).toEqual([]);
    expect(result.metadata.foundNothing).toBe(true);
  });
});
