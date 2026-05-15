import { describe, it, expect } from "vitest";
import {
  detectCrisisLanguage,
  CRISIS_RESOURCES,
  interceptBeforeAICall,
} from "../../utils/crisisInterceptor";

describe("crisisInterceptor", () => {
  describe("detectCrisisLanguage", () => {
    it("returns no crisis for normal text", () => {
      const result = detectCrisisLanguage("I need help with my VA claim");
      expect(result.isCrisis).toBe(false);
      expect(result.severity).toBeNull();
    });

    it("detects critical self-harm language", () => {
      const result = detectCrisisLanguage("I want to end my life");
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("critical");
    });

    it("detects high severity suicidal ideation", () => {
      const result = detectCrisisLanguage("I have been thinking about suicide");
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("high");
    });

    it("detects medium severity distress", () => {
      const result = detectCrisisLanguage("I feel worthless");
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("medium");
    });

    it("handles null/undefined input safely", () => {
      expect(detectCrisisLanguage(null).isCrisis).toBe(false);
      expect(detectCrisisLanguage(undefined).isCrisis).toBe(false);
      expect(detectCrisisLanguage("").isCrisis).toBe(false);
    });

    it("is case-insensitive", () => {
      const result = detectCrisisLanguage("I WANT TO KILL MYSELF");
      expect(result.isCrisis).toBe(true);
    });
  });

  describe("CRISIS_RESOURCES", () => {
    it("has correct 988 crisis line", () => {
      expect(CRISIS_RESOURCES.phone.primary).toBe("988");
      expect(CRISIS_RESOURCES.phone.extension).toBe("1");
    });

    it("has text support number", () => {
      expect(CRISIS_RESOURCES.text.number).toBe("838255");
    });

    it("has chat URL", () => {
      expect(CRISIS_RESOURCES.chat.url).toContain("veteranscrisisline.net");
    });
  });

  describe("interceptBeforeAICall", () => {
    it("blocks AI calls when crisis detected", () => {
      const result = interceptBeforeAICall("I want to end it all");
      expect(result.shouldBlock).toBe(true);
      expect(result.crisisDetected).toBe(true);
    });

    it("allows normal AI calls", () => {
      const result = interceptBeforeAICall("What is my combined rating?");
      expect(result.shouldBlock).toBe(false);
      expect(result.crisisDetected).toBe(false);
    });
  });
});
