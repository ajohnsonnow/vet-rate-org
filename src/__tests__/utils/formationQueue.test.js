import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  saveFormationState,
  loadFormationState,
  clearFormationState,
  FORMATION_STATUS,
} from "../../utils/formationQueue";

const makeEntry = (overrides = {}) => ({
  id: "formation-1",
  file: { name: "cfile.pdf", size: 3_000_000, type: "application/pdf" },
  filename: "cfile.pdf",
  fileSize: 3_000_000,
  estimatedType: "C_FILE_MEDICAL",
  priority: 6,
  priorityLabel: "IMPORTANT",
  priorityColor: "yellow",
  priorityIcon: "🟡",
  status: FORMATION_STATUS.SAVED,
  addedAt: "2026-08-21T00:00:00.000Z",
  processedAt: "2026-08-21T00:01:00.000Z",
  error: null,
  ...overrides,
});

beforeEach(() => {
  clearFormationState();
});

describe("saveFormationState - resume ledger size", () => {
  it("drops a 3MB result.text so the serialized ledger stays under 20KB", () => {
    const bigText = "x".repeat(3 * 1024 * 1024);
    const formation = [
      makeEntry({
        result: {
          filename: "cfile.pdf",
          size: 3_000_000,
          status: "complete",
          text: bigText,
          rawText: bigText,
          classification: { type: "C_FILE_MEDICAL", confidence: 0.92 },
          extractedData: {
            type: "c_file",
            formType: "C-File",
            decisions: [{ condition: "left hip" }, { condition: "tinnitus" }],
            conditions: [{ name: "left hip" }],
            raw: bigText,
          },
          verifiedData: {
            verifiedData: { rawText: bigText, rating: 10 },
            saveToVKB: true,
            updateProfile: true,
          },
        },
      }),
    ];

    const saved = saveFormationState(formation);
    expect(saved).toBe(true);

    const raw = localStorage.getItem("vetrate_formation_state");
    expect(raw.length).toBeLessThan(20 * 1024);
  });

  it("round-trips status and filename through loadFormationState", () => {
    const formation = [
      makeEntry({
        result: {
          status: "complete",
          text: "some extracted text",
          classification: { type: "DBQ", confidence: 0.8 },
          extractedData: { type: "dbq", awards: [{ name: "medal" }] },
        },
      }),
    ];

    saveFormationState(formation);
    const restored = loadFormationState();

    expect(restored).toHaveLength(1);
    expect(restored[0].filename).toBe("cfile.pdf");
    expect(restored[0].status).toBe(FORMATION_STATUS.SAVED);
    expect(restored[0].result.status).toBe("complete");
    expect(restored[0].result.text).toBeUndefined();
    expect(restored[0].result.extractedData).toEqual({
      type: "dbq",
      awardsCount: 1,
    });
  });
});

describe("saveFormationState - nested fields and quota", () => {
  it("strips text fields nested inside verifiedData without losing other fields", () => {
    const formation = [
      makeEntry({
        result: {
          status: "complete",
          classification: { type: "RATING_DECISION", confidence: 0.75 },
          verifiedData: {
            verifiedData: { rawText: "full doc text", rating: 20 },
            saveToVKB: true,
            updateProfile: false,
          },
        },
      }),
    ];

    saveFormationState(formation);
    const restored = loadFormationState();

    expect(restored[0].result.verifiedData.saveToVKB).toBe(true);
    expect(restored[0].result.verifiedData.updateProfile).toBe(false);
    expect(restored[0].result.verifiedData.verifiedData).toEqual({
      rating: 20,
    });
  });

  it("names the failing size when localStorage quota is exceeded", () => {
    const setItemSpy = vi
      .spyOn(localStorage, "setItem")
      .mockImplementation(() => {
        const err = new Error("Quota exceeded");
        err.name = "QuotaExceededError";
        throw err;
      });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const formation = [makeEntry({ result: { status: "complete" } })];
      const saved = saveFormationState(formation);
      expect(saved).toBe(false);

      const [message] = errorSpy.mock.calls[0];
      expect(message.toLowerCase()).toContain("resume ledger was not saved");
      expect(message).toContain("bytes");
      expect(/\d/.test(message)).toBe(true);
    } finally {
      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
