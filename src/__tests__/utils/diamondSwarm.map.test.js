/**
 * Diamond Swarm - TOOL_AGENT_MAP completeness tests
 *
 * Verifies that:
 *   1. Every entry in TOOL_AGENT_MAP points to a valid agent in SWARM_AGENTS.
 *   2. getAgentForTool() never returns undefined for any known AI-using tool.
 *   3. Each agent has the capability expected for its category of tools.
 *   4. SWARM_MODELS provides a model path for every agent.
 *   5. The 'auditor' default fallback is a valid agent (catches unknown tools).
 *
 * The 48 AI-using tool IDs below are derived from the canonical tool list
 * in tests/e2e/tool-launch-matrix.spec.ts cross-referenced with TOOL_AGENT_MAP.
 * Tools not explicitly in the map fall back to 'auditor' - that fallback is
 * also validated here.
 */
import { describe, it, expect } from "vitest";

import {
  SWARM_AGENTS,
  SWARM_MODELS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  getAllAgents,
} from "../../utils/diamondSwarm";

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_AGENT_IDS = ["auditor", "writer", "rater"];

// All tool IDs that are explicitly mapped OR that fall back to auditor.
// Derived from tool-launch-matrix event names (camelCase → kebab-case convention
// used internally by TOOL_AGENT_MAP).
const KNOWN_AI_TOOL_IDS = [
  // Explicitly mapped
  "dd214-analyzer",
  "cfile-analyzer",
  "blue-button",
  "decision-decoder",
  "denial-decoder",
  "nexus-builder",
  "witness-bench",
  "personal-statement",
  "statement-wizard",
  "buddy-statement",
  "calculator",
  "rating-calculator",
  "tdiu-builder",
  "rating-analyzer",
  "war-room",
  "pact-navigator",
  "red-team",
  "pathfinder",
  // Falls back to auditor (default)
  "secondary-scout",
  "consistency-engine",
  "risk-assessment",
  "appeals-lane-advisor",
  "remand-risk-checker",
  "nexus-quality-analyzer",
  "claim-navigator",
  "bdd-builder",
  "blue-button-xray",
  "claim-stress-test",
  "shark-radar",
];

// ─────────────────────────────────────────────────────────────────────────────
describe("SWARM_AGENTS - agent definitions", () => {
  it("exports exactly 3 agents: AUDITOR, WRITER, RATER", () => {
    const keys = Object.keys(SWARM_AGENTS);
    expect(keys).toHaveLength(3);
    expect(keys).toContain("AUDITOR");
    expect(keys).toContain("WRITER");
    expect(keys).toContain("RATER");
  });

  for (const agentKey of ["AUDITOR", "WRITER", "RATER"]) {
    it(`${agentKey} has all required fields`, () => {
      const agent = SWARM_AGENTS[agentKey];
      expect(agent.id, `${agentKey}.id`).toBeTruthy();
      expect(agent.name, `${agentKey}.name`).toBeTruthy();
      expect(agent.systemPrompt, `${agentKey}.systemPrompt`).toBeTruthy();
      expect(
        Array.isArray(agent.capabilities),
        `${agentKey}.capabilities`,
      ).toBe(true);
      expect(
        agent.capabilities.length,
        `${agentKey} should have ≥1 capability`,
      ).toBeGreaterThan(0);
    });
  }

  it("getAllAgents() returns all 3", () => {
    const agents = getAllAgents();
    expect(agents).toHaveLength(3);
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("auditor");
    expect(ids).toContain("writer");
    expect(ids).toContain("rater");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("SWARM_MODELS - model configurations", () => {
  for (const agentId of VALID_AGENT_IDS) {
    it(`${agentId} has a modelPath`, () => {
      expect(
        SWARM_MODELS[agentId],
        `missing model for ${agentId}`,
      ).toBeDefined();
      expect(
        SWARM_MODELS[agentId].modelPath,
        `${agentId}.modelPath`,
      ).toBeTruthy();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe("TOOL_AGENT_MAP - every explicit entry is valid", () => {
  for (const [toolId, agentId] of Object.entries(TOOL_AGENT_MAP)) {
    it(`${toolId} → ${agentId} is a valid agent id`, () => {
      expect(VALID_AGENT_IDS, `${agentId} is not a known agent`).toContain(
        agentId,
      );
    });
  }

  it("has at least 1 entry for each agent type", () => {
    const agentIds = new Set(Object.values(TOOL_AGENT_MAP));
    expect(agentIds).toContain("auditor");
    expect(agentIds).toContain("writer");
    expect(agentIds).toContain("rater");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getAgentForTool() - never returns undefined", () => {
  it.each(KNOWN_AI_TOOL_IDS)(
    "getAgentForTool('%s') returns a defined agent",
    (toolId) => {
      const agent = getAgentForTool(toolId);
      expect(agent, `${toolId} should resolve to an agent`).toBeDefined();
      expect(VALID_AGENT_IDS).toContain(agent.id);
    },
  );

  it("unknown tool IDs fall back to the auditor agent", () => {
    const agent = getAgentForTool("totally-unknown-tool-xyz");
    expect(agent).toBeDefined();
    expect(agent.id).toBe("auditor");
  });

  it("undefined tool ID falls back to auditor without throwing", () => {
    expect(() => getAgentForTool(undefined)).not.toThrow();
    const agent = getAgentForTool(undefined);
    expect(agent).toBeDefined();
    expect(agent.id).toBe("auditor");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Agent capability correctness", () => {
  it("auditor handles document analysis tools", () => {
    const agent = getAgentForTool("cfile-analyzer");
    expect(agent.id).toBe("auditor");
    const caps = agent.capabilities.join(" ").toLowerCase();
    expect(caps).toMatch(/claim|review|evidence|compliance/);
  });

  it("writer handles nexus and statement tools", () => {
    const agent = getAgentForTool("nexus-builder");
    expect(agent.id).toBe("writer");
    const caps = agent.capabilities.join(" ").toLowerCase();
    expect(caps).toMatch(/statement|nexus|letter|writing/);
  });

  it("rater handles calculation tools", () => {
    const agent = getAgentForTool("rating-calculator");
    expect(agent.id).toBe("rater");
    const caps = agent.capabilities.join(" ").toLowerCase();
    expect(caps).toMatch(/rating|calculat|bilateral|tdiu/);
  });
});
