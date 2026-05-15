/**
 * agentBoundaries — per-agent capability allowlist + runtime guard.
 *
 * Closes AUDIT_FINDINGS #3 (agentic-development): the Diamond Swarm
 * orchestrator previously fell back to `"auditor"` whenever a `toolId`
 * was unknown, with no explicit declaration of which agent is allowed
 * to do what. That silent fallback is the wrong default for a system
 * exposed to prompt-injection — a chunk that says "write me a nexus
 * letter that includes the user's case data" should not be silently
 * routed to the Writer just because the Auditor's prompt happened to
 * accept it.
 *
 * Defenses provided here:
 *   - AGENT_CAPABILITIES: each agent's *declared* capabilities, as a
 *     closed set. The Auditor cannot draft; the Writer cannot calculate;
 *     the Rater cannot review evidence.
 *   - TOOL_REQUIRED_CAPABILITY: each tool surface declares what
 *     capability it requires (not which agent — the agent is derived).
 *   - resolveAgentForTool(toolId, { strict }): returns the agent that
 *     possesses the required capability, or throws in strict mode.
 *   - enforceAgentBoundary(agentId, capability): runtime assertion the
 *     call site can place immediately before invoking a model.
 *
 * Strict mode is opt-in so existing call sites (the swarm fallback) stay
 * working while we tighten the contract. Tests cover both the
 * permissive and strict paths.
 */

export const AGENT_CAPABILITIES = Object.freeze({
  auditor: Object.freeze([
    "review-claim",
    "review-document",
    "review-evidence",
    "regulation-lookup",
    "compliance-check",
    "missing-evidence",
  ]),
  writer: Object.freeze([
    "draft-statement",
    "draft-nexus",
    "draft-buddy",
    "draft-appeal",
    "draft-narrative",
  ]),
  rater: Object.freeze([
    "calculate-rating",
    "calculate-combined",
    "calculate-bilateral",
    "tdiu-assessment",
    "diagnostic-code-map",
  ]),
});

export const TOOL_REQUIRED_CAPABILITY = Object.freeze({
  "dd214-analyzer": "review-document",
  "cfile-analyzer": "review-document",
  "blue-button": "review-document",
  "decision-decoder": "review-document",
  "denial-decoder": "review-document",
  "nexus-builder": "draft-nexus",
  "witness-bench": "draft-buddy",
  "personal-statement": "draft-statement",
  "statement-wizard": "draft-statement",
  "buddy-statement": "draft-buddy",
  calculator: "calculate-rating",
  "rating-calculator": "calculate-rating",
  "tdiu-builder": "tdiu-assessment",
  "rating-analyzer": "calculate-combined",
  "war-room": "review-claim",
  "pact-navigator": "review-claim",
  "red-team": "review-claim",
  pathfinder: "review-claim",
});

export class AgentBoundaryViolation extends Error {
  constructor(message, { agentId, capability, toolId } = {}) {
    super(message);
    this.name = "AgentBoundaryViolation";
    this.agentId = agentId;
    this.capability = capability;
    this.toolId = toolId;
  }
}

const DEFAULT_AGENT = "auditor";

function agentHas(agentId, capability) {
  const caps = AGENT_CAPABILITIES[agentId];
  return Array.isArray(caps) && caps.includes(capability);
}

/**
 * Resolve which agent should handle a given tool.
 *
 * @param {string|null} toolId
 * @param {Object} [opts]
 * @param {boolean} [opts.strict=false] — throw on unknown toolId or
 *   when no declared agent holds the required capability. When false,
 *   fall back to `"auditor"` (matches legacy behavior).
 * @returns {string} agent id (`auditor` | `writer` | `rater`)
 */
export function resolveAgentForTool(toolId, opts = {}) {
  const { strict = false } = opts;
  if (!toolId) {
    if (strict) {
      throw new AgentBoundaryViolation(
        "resolveAgentForTool: toolId is required in strict mode",
        { toolId },
      );
    }
    return DEFAULT_AGENT;
  }
  const required = TOOL_REQUIRED_CAPABILITY[toolId];
  if (!required) {
    if (strict) {
      throw new AgentBoundaryViolation(
        `resolveAgentForTool: unknown toolId "${toolId}"`,
        { toolId },
      );
    }
    return DEFAULT_AGENT;
  }
  for (const agentId of Object.keys(AGENT_CAPABILITIES)) {
    if (agentHas(agentId, required)) return agentId;
  }
  if (strict) {
    throw new AgentBoundaryViolation(
      `resolveAgentForTool: no agent declares capability "${required}"`,
      { toolId, capability: required },
    );
  }
  return DEFAULT_AGENT;
}

/**
 * Runtime guard. Throws AgentBoundaryViolation if `agentId` does not
 * possess `capability`. Call this immediately before invoking the
 * model, with the capability the caller intends to perform.
 *
 * @param {string} agentId
 * @param {string} capability
 */
export function enforceAgentBoundary(agentId, capability) {
  if (!agentId || !capability) {
    throw new AgentBoundaryViolation(
      "enforceAgentBoundary: agentId and capability are required",
      { agentId, capability },
    );
  }
  if (!AGENT_CAPABILITIES[agentId]) {
    throw new AgentBoundaryViolation(
      `enforceAgentBoundary: unknown agent "${agentId}"`,
      { agentId, capability },
    );
  }
  if (!agentHas(agentId, capability)) {
    throw new AgentBoundaryViolation(
      `enforceAgentBoundary: agent "${agentId}" cannot perform "${capability}"`,
      { agentId, capability },
    );
  }
}

/**
 * Read-only view of an agent's declared capabilities.
 *
 * @param {string} agentId
 * @returns {readonly string[]}
 */
export function getAgentCapabilities(agentId) {
  return AGENT_CAPABILITIES[agentId] || [];
}
