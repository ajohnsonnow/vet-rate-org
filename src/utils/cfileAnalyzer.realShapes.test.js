/**
 * Final-23 item 4: the shapes the off-device (cloud-only) fallback still
 * left unclean on a scanned C-File, rebuilt with generic stand-in terms. Each
 * fixture keeps the layout quirks: glued words, a table cell wrapped
 * over visual lines, a doubled "(also claimed as" with one closing bracket.
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

const { analyzeCFile, _cleanConditionName } =
  await import("./cfileAnalyzer.js");

const GLUED_SERVICE_CONNECTION = `Rating Decision
We made the following decision.
1.   Service   connection   for   eye   strain   is   denied.
Reasons for decision
Service connection may be granted for a disability which began in military service or was
caused by some event or experience in service.
Service connection is denied because eye strain is not considered an actually
disabling condition.
2.   Service   connection   for   hair   loss.
You   raised   a   claim   for   hairloss.   This   is   a   symptom   of a   primarycondition
and   is   considered   in   the   evaluation   criteria of your   migraine headaches.
Serviceconnection   may   be granted   for   a   disability   whichbegan   in   military   serviceor was
caused by some   event   or   experience   in   service.
Serviceconnection   is   denied   because   hair loss   is   not   considered   an   actually
disabling   condition.
Service   connection   for   hairloss   is   denied   since   thiscondition   neither   occurred
in   nor was   caused by   service.
`;

const WRAPPED_TABLE_ROW = `Rating Decision
What We Decided
We determined that the following conditions were related to your military service, so service
connection has been granted:
Medical Description   Percent (%)
Assigned
Effective Date
Lumbar strain without   10%   Jan 5, 2010
sinusitis and left knee
sprain mild
severe (LKS)
Radiculopathy (also claimed as   20%   Feb 6, 2011
sciatica and foot drop
neuropathy)
An examination will be scheduled at a future date to evaluate the severity of your service
connected Lumbar strain without sinusitis and left knee sprain mild severe
(LKS).
We determined that the following conditions were not related to your military service, so
service connection
`;

const ONE_LINE_ROW = `Rating Decision
What We Decided
We determined that the following conditions were related to your military service, so service
connection has been granted:
Medical Description   Percent (%)
Assigned
Effective Date
Lumbar strain without sinusitis and left knee sprain mild severe (LKS) 10% Jan 5, 2010
Radiculopathy (also claimed as sciatica and foot drop neuropathy) 20% Feb 6, 2011
An examination will be scheduled at a future date to evaluate the severity of your service
connected condition.
`;

const SPACED_DENIAL = `Rating Decision
1. Service connection for hair loss is denied.
Service connection for hair loss is denied as this condition neither occurred
in nor was caused by service.
`;

const DOUBLED_ALSO_CLAIMED = `Your Benefit Information:
l   Evaluation of plantar fasciitis (formerly evaluated as
bunion without hammertoe), which is currently 10 percent
disabling, is increased to 20 percent effective March 3, 2019.
l   Evaluation of bunion (also claimed as(also claimed as hallux valgus
and foot pain and left foot) , which is
currently 10 percent disabling, is continued.
l   Service connection for tinnitus is granted with an evaluation of 10
percent effective March 3, 2019.
`;

async function conditionsOf(text) {
  const result = await analyzeCFile("fake-api-key", text, () => {}, null, {});
  return result.analysis.potential_claims.map((c) => c.condition);
}

const lower = (names) => names.map((n) => n.toLowerCase());

describe("analyzeCFile off-device fallback: the five real failing shapes", () => {
  it("drops a glued 'Serviceconnection' heading but keeps the real denials", async () => {
    const names = await conditionsOf(GLUED_SERVICE_CONNECTION);
    expect(lower(names)).not.toContain("serviceconnection");
    expect(lower(names)).toContain("eye strain");
    expect(names.filter((n) => /^hair ?loss$/i.test(n))).toHaveLength(1);
    expect(names.some((n) => /^service\s?connection$/i.test(n))).toBe(false);
  });

  it("drops a table row name cut after the first visual line", async () => {
    const names = await conditionsOf(WRAPPED_TABLE_ROW);
    expect(names).not.toContain("Lumbar strain without");
  });

  it("drops a row name that begins at the previous row's closing bracket", async () => {
    const names = await conditionsOf(WRAPPED_TABLE_ROW);
    expect(names.filter((n) => /^LKS\)/.test(n))).toEqual([]);
    expect(names.filter((n) => /\(also$|\(also\)/.test(n))).toEqual([]);
  });

  it("keeps the whole wrapped name once when another copy has it on one line", async () => {
    const names = await conditionsOf(`${WRAPPED_TABLE_ROW}\n${ONE_LINE_ROW}`);
    const whole = names.filter((n) =>
      /^Lumbar strain without sinusitis and left knee sprain mild severe \(LKS\)$/.test(
        n,
      ),
    );
    expect(whole).toHaveLength(1);
    expect(names).not.toContain("Lumbar strain without");
    expect(names.filter((n) => /^LKS\)/.test(n))).toEqual([]);
  });

  it("lists a denial glued by OCR and the same denial spaced as one condition", async () => {
    const names = await conditionsOf(
      `${GLUED_SERVICE_CONNECTION}\n${SPACED_DENIAL}`,
    );
    expect(lower(names)).not.toContain("hairloss");
    expect(names.filter((n) => nameIs(n, "hair loss"))).toEqual(["hair loss"]);
  });

  it("collapses a doubled '(also claimed as' and its single closing bracket", async () => {
    const names = await conditionsOf(DOUBLED_ALSO_CLAIMED);
    expect(names.filter((n) => /^bunion \(/.test(n))).toEqual([
      "bunion (also claimed as hallux valgus and foot pain and left foot)",
    ]);
    expect(names.filter((n) => /\(also claimed as\(/.test(n))).toEqual([]);
  });
});

function nameIs(name, expected) {
  return (
    name.toLowerCase().replaceAll(/[^a-z]/g, "") ===
    expected.replaceAll(/[^a-z]/g, "")
  );
}

describe("_cleanConditionName: the real shapes in isolation", () => {
  it.each([
    ["Serviceconnection"],
    ["Service connection"],
    ["Lumbar strain without"],
    ["LKS) Radiculopathy (also claimed as"],
  ])("drops %j", (raw) => {
    expect(_cleanConditionName(raw)).toBeNull();
  });

  it("collapses a doubled annotation opener", () => {
    expect(
      _cleanConditionName(
        "bunion (also claimed as(also claimed as hallux valgus and foot pain) , which is",
      ),
    ).toBe("bunion (also claimed as hallux valgus and foot pain)");
  });

  it.each([
    "tinnitus (also claimed as ringing in ears)",
    "knee strain (LKS)",
    "Lumbar strain with sinusitis",
    "hair loss",
    "Radiculopathy",
  ])("keeps %j", (name) => {
    expect(_cleanConditionName(name)).toBe(name);
  });
});
