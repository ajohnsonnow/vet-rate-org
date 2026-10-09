/**
 * S7740 regression: VoiceOrchestrator's constructor used to alias `this`
 * into the module-level `instance` singleton and short-circuit-return an
 * existing instance from `new VoiceOrchestrator()`. That logic is now
 * centralized in the static getInstance() only.
 */
import { describe, it, expect } from "vitest";
import { VoiceOrchestrator, getVoiceOrchestrator } from "./VoiceOrchestrator";

describe("VoiceOrchestrator singleton", () => {
  it("getInstance() (and the getVoiceOrchestrator() helper) always return the same instance", () => {
    const a = VoiceOrchestrator.getInstance();
    const b = VoiceOrchestrator.getInstance();
    const c = getVoiceOrchestrator();
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("initializes model headers on every instance", () => {
    const orchestrator = VoiceOrchestrator.getInstance();
    expect(orchestrator.modelHeaders.AUDITOR.en).toMatch(/evidence/i);
    expect(orchestrator.isEnabled).toBe(false);
  });
});
