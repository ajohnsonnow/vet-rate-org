/**
 * Every production generateAI call site names the tool it serves, so the
 * Warrant Council persona (auditor / writer / rater) and the capability
 * allowlist in agentBoundaries.js apply to it. This suite pins, for each
 * routed call site, the toolId it passes and that the id resolves to the
 * expected agent through both routing tables and the generateWithSwarm
 * capability check.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../../utils/unifiedAIService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateAI: vi.fn(),
    isAnyAIAvailable: vi.fn(() => true),
    getAIStatus: vi.fn(() => ({ statusText: "Local AI" })),
  };
});

const unifiedAIService = await import("../../utils/unifiedAIService");
const diamondSwarm = await import("../../utils/diamondSwarm");
const agentBoundaries = await import("../../utils/agentBoundaries");
const aiStatementHelper = await import("../../utils/aiStatementHelper");
const pathfinderEngine = await import("../../utils/pathfinderEngine");

const { TOOL_AGENT_MAP, generateWithSwarm } = diamondSwarm;
const {
  TOOL_REQUIRED_CAPABILITY,
  AGENT_CAPABILITIES,
  resolveAgentForTool,
  enforceAgentBoundary,
} = agentBoundaries;

const resolveThroughSwarm = async (toolId) => {
  const result = await generateWithSwarm("probe", { toolId });
  return result.agent;
};

describe("routing tables stay consistent", () => {
  it("TOOL_AGENT_MAP and TOOL_REQUIRED_CAPABILITY name the same tools", () => {
    expect(Object.keys(TOOL_AGENT_MAP).sort()).toEqual(
      Object.keys(TOOL_REQUIRED_CAPABILITY).sort(),
    );
  });

  it.each(Object.entries(TOOL_AGENT_MAP))(
    "%s maps to %s in both tables and passes the capability check in generateWithSwarm",
    async (toolId, agentId) => {
      expect(resolveAgentForTool(toolId, { strict: true })).toBe(agentId);
      expect(AGENT_CAPABILITIES[agentId]).toContain(
        TOOL_REQUIRED_CAPABILITY[toolId],
      );
      expect(() =>
        enforceAgentBoundary(agentId, TOOL_REQUIRED_CAPABILITY[toolId]),
      ).not.toThrow();
      await expect(resolveThroughSwarm(toolId)).resolves.toBe(agentId);
    },
  );

  it("the ids added for drafting calls resolve to the writer", () => {
    expect(TOOL_AGENT_MAP["appeal-statement"]).toBe("writer");
    expect(TOOL_REQUIRED_CAPABILITY["appeal-statement"]).toBe("draft-appeal");
    expect(TOOL_AGENT_MAP["tdiu-narrative"]).toBe("writer");
    expect(TOOL_REQUIRED_CAPABILITY["tdiu-narrative"]).toBe("draft-narrative");
  });
});

const ANSWERS = {
  relationship: "Spouse",
  knownDuration: "10 years",
  observations: "I have watched them struggle to get out of bed most mornings.",
  changesNoticed: "They used to be social and now avoid gatherings.",
  dailyImpact: "They can no longer manage household chores alone.",
  inServiceEvent: "Carried heavy loads during deployment.",
  specificExamples: "Cannot lift groceries without pain.",
  workImpact: "Missed several days of work each month.",
  stressorType: "Combat",
  eventDescription: "A convoy was struck by a roadside device.",
  currentSymptoms: "Nightmares and avoidance.",
};

const STATEMENT =
  "My back has hurt every day since basic training and I never got it checked out until now, so this is a full 50+ character statement.";

const lastCallToolId = () =>
  unifiedAIService.generateAI.mock.calls.at(-1)[1].toolId;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  unifiedAIService.generateAI.mockResolvedValue({
    text: JSON.stringify({
      overall_score: 80,
      weak_spots: [],
      opportunities: [],
    }),
    mode: "swarm",
  });
});

describe("aiStatementHelper call sites pass the tool they serve", () => {
  const CASES = [
    [
      "enhancePersonalStatement",
      () =>
        aiStatementHelper.enhancePersonalStatement(ANSWERS, "Lumbar strain"),
      "personal-statement",
      "writer",
    ],
    [
      "enhancePTSDStatement",
      () => aiStatementHelper.enhancePTSDStatement(ANSWERS),
      "personal-statement",
      "writer",
    ],
    [
      "enhanceBuddyStatement",
      () => aiStatementHelper.enhanceBuddyStatement(ANSWERS, "PTSD"),
      "buddy-statement",
      "writer",
    ],
    [
      "enhanceAppealStatement",
      () =>
        aiStatementHelper.enhanceAppealStatement({
          ...ANSWERS,
          whyIncorrect: "The decision did not consider my headache log.",
        }),
      "appeal-statement",
      "writer",
    ],
    [
      "generateNexusLetterRequest",
      () => aiStatementHelper.generateNexusLetterRequest(ANSWERS),
      "nexus-builder",
      "writer",
    ],
    [
      "generateFieldSuggestion",
      () => aiStatementHelper.generateFieldSuggestion("workImpact", "PTSD"),
      "personal-statement",
      "writer",
    ],
    [
      "stressTestStatement",
      () => aiStatementHelper.stressTestStatement(STATEMENT),
      "red-team",
      "auditor",
    ],
    [
      "decodeDecision",
      () =>
        aiStatementHelper.decodeDecision(
          "The Board grants service connection for the claimed condition.",
        ),
      "decision-decoder",
      "auditor",
    ],
  ];

  it.each(CASES)("%s", async (_name, run, toolId, agentId) => {
    await run();

    expect(unifiedAIService.generateAI).toHaveBeenCalledTimes(1);
    expect(lastCallToolId()).toBe(toolId);
    expect(TOOL_AGENT_MAP[toolId]).toBe(agentId);
    await expect(resolveThroughSwarm(toolId)).resolves.toBe(agentId);
  });
});

describe("pathfinderEngine call site", () => {
  it("analyzeStrategy passes the pathfinder tool, which resolves to the auditor", async () => {
    await pathfinderEngine.analyzeStrategy(
      null,
      [{ condition: "PTSD", rating: 50 }],
      "",
      { additionalContextIsDocument: false },
    );

    expect(lastCallToolId()).toBe("pathfinder");
    expect(TOOL_AGENT_MAP.pathfinder).toBe("auditor");
    await expect(resolveThroughSwarm("pathfinder")).resolves.toBe("auditor");
  });
});

const SOURCES = {
  "components/DD214Analyzer.jsx": [["dd214-analyzer", 1, "auditor"]],
  "components/MyPacket.jsx": [["dd214-analyzer", 1, "auditor"]],
  "components/BlueButtonXRay.jsx": [["blue-button", 2, "auditor"]],
  "components/DenialDecoder.jsx": [["denial-decoder", 1, "auditor"]],
  "components/WitnessBench.jsx": [["buddy-statement", 1, "writer"]],
  "utils/cfileAnalyzer.js": [["cfile-analyzer", 2, "auditor"]],
  "utils/musterCallProcessor.js": [["cfile-analyzer", 1, "auditor"]],
};

const readSource = (relative) =>
  readFileSync(resolve(process.cwd(), "src", relative), "utf8");

describe("call sites inside component and processor internals", () => {
  const rows = Object.entries(SOURCES).flatMap(([file, entries]) =>
    entries.map(([toolId, count, agentId]) => [file, toolId, count, agentId]),
  );

  it.each(rows)(
    "%s passes toolId %s in its generateAI options (%i call(s)) and it resolves to %s",
    async (file, toolId, count, agentId) => {
      const source = readSource(file);
      const matches = [
        ...source.matchAll(new RegExp(`toolId: "${toolId}"`, "g")),
      ];

      expect(matches).toHaveLength(count);
      for (const match of matches) {
        const preceding = source.slice(
          Math.max(0, match.index - 400),
          match.index,
        );
        expect(preceding).toMatch(/dataClass:/);
      }
      expect(TOOL_AGENT_MAP[toolId]).toBe(agentId);
      await expect(resolveThroughSwarm(toolId)).resolves.toBe(agentId);
    },
  );
});
