/**
 * The official form PDF is filled from the copy the app ships. The page's
 * Content Security Policy does not allow a fetch to www.vba.va.gov, so the
 * app must not attempt one.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { getFormFieldNames } from "../../utils/pdfFormFiller";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("official form PDF source", () => {
  it.each([
    ["21-4138", "/forms/VBA-21-4138-ARE.pdf"],
    ["21-0781", "/forms/VBA-21-0781-ARE.pdf"],
    ["21-10210", "/forms/vba-21-10210-are.pdf"],
    ["21-22", "/forms/VBA-21-22-ARE.pdf"],
  ])(
    "form %s is requested from the app's own copy only",
    async (form, path) => {
      const fetchMock = vi.fn(async () => ({ ok: false }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(getFormFieldNames(form)).rejects.toThrow(/Could not load/);
      expect(fetchMock.mock.calls).toEqual([[path]]);
    },
  );
});
