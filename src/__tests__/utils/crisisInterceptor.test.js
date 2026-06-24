import { describe, it, expect } from "vitest";
import {
  detectCrisisLanguage,
  CRISIS_RESOURCES,
  interceptBeforeAICall,
  scanDocumentForCrisis,
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

    // AIS-04: obfuscation, modern slang, and non-English coverage
    it("detects no-space obfuscation (iwanttodie)", () => {
      expect(detectCrisisLanguage("iwanttodie").isCrisis).toBe(true);
    });

    it("detects leetspeak obfuscation (w4nt to die)", () => {
      expect(detectCrisisLanguage("w4nt to die").isCrisis).toBe(true);
    });

    it("detects modern self-harm slang (kms, unalive)", () => {
      expect(detectCrisisLanguage("honestly kms at this point").isCrisis).toBe(
        true,
      );
      expect(detectCrisisLanguage("i might unalive").isCrisis).toBe(true);
    });

    it("does NOT false-positive on 'kms' inside a distance (20kms)", () => {
      expect(detectCrisisLanguage("I marched 20kms today").isCrisis).toBe(
        false,
      );
    });

    it("detects non-English ideation (Spanish: quiero morir)", () => {
      expect(detectCrisisLanguage("ya no aguanto, quiero morir").isCrisis).toBe(
        true,
      );
    });

    // C-H09: Afghan SIV/interpreter languages. Pashto was entirely uncovered;
    // Dari only partially (shared Farsi words). Both must now trigger.
    it("detects Pashto ideation (ps crisis keyword)", () => {
      const result = detectCrisisLanguage("زه ډیر خفه یم او ځان وژنه غواړم");
      expect(result.isCrisis).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.matchedPattern).toBe("multilingual:ps");
    });

    it("detects Dari ideation (خودکشی)", () => {
      expect(detectCrisisLanguage("من به خودکشی فکر می‌کنم").isCrisis).toBe(
        true,
      );
    });

    it("ignores broad 'universal' keywords like 'no point' (handled by precise English patterns)", () => {
      expect(
        detectCrisisLanguage("there's no point in appealing this").isCrisis,
      ).toBe(false);
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

    it("blocks a Pashto crisis message (C-H09 multilingual coverage)", () => {
      const result = interceptBeforeAICall("زه ډیر خفه یم او ځان وژنه غواړم");
      expect(result.shouldBlock).toBe(true);
      expect(result.crisisDetected).toBe(true);
    });
  });

  describe("scanDocumentForCrisis (AIS-05, non-blocking)", () => {
    it("returns true and fires a passive crisis-resources event on a hit", () => {
      let fired = false;
      const handler = () => {
        fired = true;
      };
      window.addEventListener("vetrate:crisis-resources", handler);
      const result = scanDocumentForCrisis(
        "Patient has a documented history of suicidal thoughts.",
      );
      window.removeEventListener("vetrate:crisis-resources", handler);
      expect(result).toBe(true);
      expect(fired).toBe(true);
    });

    it("returns false and fires nothing for benign document text", () => {
      let fired = false;
      const handler = () => {
        fired = true;
      };
      window.addEventListener("vetrate:crisis-resources", handler);
      const result = scanDocumentForCrisis(
        "Veteran has tinnitus, knee pain, and sleep apnea.",
      );
      window.removeEventListener("vetrate:crisis-resources", handler);
      expect(result).toBe(false);
      expect(fired).toBe(false);
    });
  });
});
