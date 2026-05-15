/**
 * Agentic regression harness for the Diamond Swarm (Auditor / Writer /
 * Rater). The full 7B GGUF models cannot run in CI, so this harness
 * tests the *deterministic contract* of each agentic call — not the
 * output text quality. Specifically it snapshots:
 *
 *   1. Routing: every golden case must resolve to the expected agent.
 *   2. Capability: the resolved agent must declare the expected
 *      capability (catches "auditor silently used for nexus" drift).
 *   3. System-prompt fingerprint: SHA-256 of the agent's static system
 *      prompt is stable. If someone edits the prompt, the snapshot
 *      flips and the diff is the review.
 *   4. Required safety clauses: each agent's prompt contains its
 *      contract-critical clauses (citation rule, no-fabrication rule,
 *      etc.) verbatim.
 *
 * Quality of generated text is reviewed manually using the rubric at
 * src/__tests__/agentic/JUDGE_RUBRIC.md when a real model is loaded.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  AGENT_CAPABILITIES,
  enforceAgentBoundary,
  resolveAgentForTool,
} from "../../utils/agentBoundaries";
import { SWARM_AGENTS } from "../../utils/diamondSwarm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN = readFileSync(join(__dirname, "golden-set.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

function sha256Hex(s) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("Agentic harness — golden set integrity", () => {
  it("loaded at least 30 cases", () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(30);
  });

  it("every case has the required fields", () => {
    for (const c of GOLDEN) {
      expect(c.id, `case missing id`).toBeTruthy();
      expect(c.toolId, `${c.id} missing toolId`).toBeTruthy();
      expect(c.expectedAgent, `${c.id} missing expectedAgent`).toBeTruthy();
      expect(
        c.expectedCapability,
        `${c.id} missing expectedCapability`,
      ).toBeTruthy();
      expect(c.scenario, `${c.id} missing scenario`).toBeTruthy();
      expect(typeof c.input, `${c.id} input not a string`).toBe("string");
    }
  });

  it("covers all three agents", () => {
    const agents = new Set(GOLDEN.map((c) => c.expectedAgent));
    expect(agents).toEqual(new Set(["auditor", "writer", "rater"]));
  });

  it("includes at least one prompt-injection probe per agent", () => {
    const probes = GOLDEN.filter((c) => /^Injection probe/.test(c.scenario));
    const agentsCovered = new Set(probes.map((c) => c.expectedAgent));
    expect(agentsCovered.size).toBe(3);
  });
});

describe("Agentic harness — routing contract", () => {
  it.each(GOLDEN)(
    "$id ($toolId) routes to $expectedAgent",
    ({ toolId, expectedAgent }) => {
      expect(resolveAgentForTool(toolId)).toBe(expectedAgent);
    },
  );

  it.each(GOLDEN)(
    "$id ($toolId) resolved agent owns $expectedCapability",
    ({ expectedAgent, expectedCapability }) => {
      expect(AGENT_CAPABILITIES[expectedAgent]).toContain(expectedCapability);
    },
  );
});

describe("Agentic harness — capability boundary", () => {
  it.each(GOLDEN)(
    "$id enforceAgentBoundary($expectedAgent, $expectedCapability) does not throw",
    ({ expectedAgent, expectedCapability }) => {
      expect(() =>
        enforceAgentBoundary(expectedAgent, expectedCapability),
      ).not.toThrow();
    },
  );

  it("every wrong-agent × capability pair throws", () => {
    const allAgents = Object.keys(AGENT_CAPABILITIES);
    for (const c of GOLDEN) {
      for (const otherAgent of allAgents) {
        if (otherAgent === c.expectedAgent) continue;
        expect(
          () => enforceAgentBoundary(otherAgent, c.expectedCapability),
          `${otherAgent} should NOT have ${c.expectedCapability}`,
        ).toThrow();
      }
    }
  });
});

describe("Agentic harness — system-prompt fingerprints", () => {
  // Pin the SHA-256 of each agent's static system prompt. Editing the
  // prompt flips the fingerprint and the diff is the review trigger.
  // To intentionally rotate: run the suite, copy the actual hash from
  // the failure message, and update the table below.
  const EXPECTED = {
    auditor: "421f8082c4993be13d3de4907e050087ddd7df4356c91cd1043faa4cdc2aec66",
    writer: "97c52df9d11a554fa2e754c93f65c9083a6017cbcacb2e5b75057e5f257c633a",
    rater: "158bf9127d60dea1abcdfae7c5e5b2bc916e00f1170b5ab09cb5b6361af04100",
  };

  it("auditor prompt fingerprint is stable", () => {
    const actual = sha256Hex(SWARM_AGENTS.AUDITOR.systemPrompt);
    expect(actual, "if intentional, update EXPECTED.auditor").toBe(
      EXPECTED.auditor,
    );
  });

  it("writer prompt fingerprint is stable", () => {
    const actual = sha256Hex(SWARM_AGENTS.WRITER.systemPrompt);
    expect(actual, "if intentional, update EXPECTED.writer").toBe(
      EXPECTED.writer,
    );
  });

  it("rater prompt fingerprint is stable", () => {
    const actual = sha256Hex(SWARM_AGENTS.RATER.systemPrompt);
    expect(actual, "if intentional, update EXPECTED.rater").toBe(
      EXPECTED.rater,
    );
  });
});

describe("Agentic harness — contract clauses present in prompts", () => {
  // Each agent's system prompt must carry its contract-critical clauses
  // verbatim, even if the prompt is rewritten otherwise. These are the
  // promises the rest of the system relies on.
  it("auditor cites 38 CFR and refuses fabrication", () => {
    const p = SWARM_AGENTS.AUDITOR.systemPrompt;
    expect(p).toMatch(/38 CFR/);
    expect(p).toMatch(/Never fabricate/i);
  });

  it("writer writes first-person and avoids fabrication", () => {
    const p = SWARM_AGENTS.WRITER.systemPrompt;
    expect(p).toMatch(/first person/i);
    expect(p).toMatch(/factual accuracy/i);
  });

  it("rater uses the VA combined-ratings formula", () => {
    const p = SWARM_AGENTS.RATER.systemPrompt;
    expect(p).toMatch(/bilateral factor/i);
    expect(p).toMatch(/38 CFR Part 4/);
  });
});
