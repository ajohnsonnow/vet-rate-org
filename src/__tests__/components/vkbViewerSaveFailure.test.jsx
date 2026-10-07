/**
 * Regression: saveVkbViewerEdits (VKBViewer.jsx) awaited saveVKB(fresh) but
 * never checked its result, so a quota/IndexedDB failure (saveVKB resolves
 * {success: false}, it never throws) was reported back to the caller as
 * {ok: true} - handleSave then exited edit mode and showed the veteran's
 * unsaved edits as saved. Fixture values are synthetic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../utils/veteranKnowledgeBase.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    saveVKB: vi.fn(async () => ({
      success: false,
      error: "storage quota exceeded",
    })),
  };
});

import { saveVkbViewerEdits } from "../../components/VKBViewer.jsx";
import { initializeVKB } from "../../utils/veteranKnowledgeBase.js";

const PROFILE_KEY = "vet_rate_veteran_profile";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ fullName: "Jordan Sample" }),
  );
  vi.spyOn(globalThis, "alert").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("saveVkbViewerEdits: a failed saveVKB must not be reported as a success", () => {
  it("returns {ok: false} and alerts instead of discarding the edit silently", async () => {
    const loaded = initializeVKB();
    loaded.serviceHistory.entryDate = "2002-03-05";
    const edited = structuredClone(loaded);
    edited.personal.fullName = "Jordan Q. Sample";

    const result = await saveVkbViewerEdits({ edited, loaded });

    expect(result).toEqual({ ok: false });
    expect(globalThis.alert).toHaveBeenCalledWith(
      expect.stringContaining("storage quota exceeded"),
    );
  });
});
