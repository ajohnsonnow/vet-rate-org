import { describe, it, expect } from "vitest";
import {
  AGENT_CAPABILITIES,
  AgentBoundaryViolation,
  TOOL_REQUIRED_CAPABILITY,
  enforceAgentBoundary,
  getAgentCapabilities,
  resolveAgentForTool,
} from "../../utils/agentBoundaries";

describe("agentBoundaries - declared contract", () => {
  it("freezes the capability tables", () => {
    expect(Object.isFrozen(AGENT_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(TOOL_REQUIRED_CAPABILITY)).toBe(true);
    expect(Object.isFrozen(AGENT_CAPABILITIES.auditor)).toBe(true);
  });

  it("declares disjoint capability sets across agents", () => {
    const seen = new Map();
    for (const [agent, caps] of Object.entries(AGENT_CAPABILITIES)) {
      for (const cap of caps) {
        expect(
          seen.has(cap),
          `${cap} declared by both ${agent} and ${seen.get(cap)}`,
        ).toBe(false);
        seen.set(cap, agent);
      }
    }
  });

  it("every TOOL_REQUIRED_CAPABILITY value resolves to exactly one agent", () => {
    for (const [toolId, cap] of Object.entries(TOOL_REQUIRED_CAPABILITY)) {
      const owning = Object.entries(AGENT_CAPABILITIES).filter(([, caps]) =>
        caps.includes(cap),
      );
      expect(
        owning.length,
        `tool ${toolId} requires ${cap} owned by ${owning.length} agents`,
      ).toBe(1);
    }
  });
});

describe("resolveAgentForTool - permissive (legacy)", () => {
  it("returns auditor when toolId is null/undefined", () => {
    expect(resolveAgentForTool(null)).toBe("auditor");
    expect(resolveAgentForTool(undefined)).toBe("auditor");
  });

  it("returns auditor for unknown toolId", () => {
    expect(resolveAgentForTool("not-a-real-tool")).toBe("auditor");
  });

  it("routes writer tools to writer", () => {
    expect(resolveAgentForTool("nexus-builder")).toBe("writer");
    expect(resolveAgentForTool("personal-statement")).toBe("writer");
    expect(resolveAgentForTool("buddy-statement")).toBe("writer");
  });

  it("routes rater tools to rater", () => {
    expect(resolveAgentForTool("calculator")).toBe("rater");
    expect(resolveAgentForTool("tdiu-builder")).toBe("rater");
  });

  it("routes auditor tools to auditor", () => {
    expect(resolveAgentForTool("dd214-analyzer")).toBe("auditor");
    expect(resolveAgentForTool("denial-decoder")).toBe("auditor");
  });
});

describe("resolveAgentForTool - strict", () => {
  it("throws when toolId is missing", () => {
    expect(() => resolveAgentForTool(null, { strict: true })).toThrow(
      AgentBoundaryViolation,
    );
    expect(() => resolveAgentForTool("", { strict: true })).toThrow(
      AgentBoundaryViolation,
    );
  });

  it("throws when toolId is unknown", () => {
    try {
      resolveAgentForTool("phantom-tool", { strict: true });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentBoundaryViolation);
      expect(err.toolId).toBe("phantom-tool");
    }
  });

  it("resolves cleanly for known tools", () => {
    expect(resolveAgentForTool("nexus-builder", { strict: true })).toBe(
      "writer",
    );
    expect(resolveAgentForTool("rating-calculator", { strict: true })).toBe(
      "rater",
    );
  });
});

describe("enforceAgentBoundary - runtime guard", () => {
  it("allows declared capabilities", () => {
    expect(() =>
      enforceAgentBoundary("auditor", "review-document"),
    ).not.toThrow();
    expect(() => enforceAgentBoundary("writer", "draft-nexus")).not.toThrow();
    expect(() =>
      enforceAgentBoundary("rater", "calculate-combined"),
    ).not.toThrow();
  });

  it("rejects cross-agent capability claims", () => {
    expect(() => enforceAgentBoundary("auditor", "draft-nexus")).toThrow(
      AgentBoundaryViolation,
    );
    expect(() => enforceAgentBoundary("writer", "calculate-rating")).toThrow(
      AgentBoundaryViolation,
    );
    expect(() => enforceAgentBoundary("rater", "review-evidence")).toThrow(
      AgentBoundaryViolation,
    );
  });

  it("rejects unknown agents", () => {
    expect(() => enforceAgentBoundary("ghost", "review-document")).toThrow(
      AgentBoundaryViolation,
    );
  });

  it("rejects unknown capabilities", () => {
    expect(() => enforceAgentBoundary("auditor", "do-anything")).toThrow(
      AgentBoundaryViolation,
    );
  });

  it("rejects missing arguments", () => {
    expect(() => enforceAgentBoundary("auditor", null)).toThrow(
      AgentBoundaryViolation,
    );
    expect(() => enforceAgentBoundary(null, "review-document")).toThrow(
      AgentBoundaryViolation,
    );
  });

  it("attaches diagnostic fields to the violation", () => {
    try {
      enforceAgentBoundary("writer", "calculate-rating");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AgentBoundaryViolation);
      expect(err.agentId).toBe("writer");
      expect(err.capability).toBe("calculate-rating");
    }
  });
});

describe("getAgentCapabilities", () => {
  it("returns each agent's declared list", () => {
    expect(getAgentCapabilities("auditor")).toContain("review-document");
    expect(getAgentCapabilities("writer")).toContain("draft-nexus");
    expect(getAgentCapabilities("rater")).toContain("calculate-combined");
  });

  it("returns empty for unknown agents", () => {
    expect(getAgentCapabilities("phantom")).toEqual([]);
  });
});
