/**
 * Decision B: VKBViewer's "Clear All Data" must delete everything the app's
 * full data delete deletes (reuse AtomicWipe's wipeAllLocalData - not a
 * VKB-only clear), never redirect to the decoy site (Quick Exit keeps that
 * job), and propagate to every open tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const wipeAllLocalData = vi.fn(async () => {});
const forceReloadWithCacheBypass = vi.fn();
const broadcastDataWipe = vi.fn();

vi.mock("../../components/AtomicWipe.jsx", () => ({
  wipeAllLocalData: (...args) => wipeAllLocalData(...args),
  forceReloadWithCacheBypass: (...args) => forceReloadWithCacheBypass(...args),
}));

vi.mock("../../utils/dataWipeChannel.js", () => ({
  broadcastDataWipe: (...args) => broadcastDataWipe(...args),
}));

import VKBViewer from "../../components/VKBViewer.jsx";
import { initializeVKB } from "../../utils/veteranKnowledgeBase.js";

async function openViewerAndFindClearButton() {
  render(<VKBViewer isOpen onClose={() => {}} />);
  return screen.findByRole("button", { name: /clear all data/i });
}

describe("VKBViewer Clear All Data", () => {
  beforeEach(() => {
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify(initializeVKB().personal),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    wipeAllLocalData.mockClear();
    forceReloadWithCacheBypass.mockClear();
    broadcastDataWipe.mockClear();
    localStorage.clear();
  });

  it("does nothing if the veteran cancels the confirm", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const clearButton = await openViewerAndFindClearButton();

    fireEvent.click(clearButton);

    expect(wipeAllLocalData).not.toHaveBeenCalled();
    expect(broadcastDataWipe).not.toHaveBeenCalled();
    expect(forceReloadWithCacheBypass).not.toHaveBeenCalled();
  });

  it("the confirm text states the full delete-my-data scope, not a VKB-only subset", async () => {
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const clearButton = await openViewerAndFindClearButton();

    fireEvent.click(clearButton);

    const confirmText = confirmSpy.mock.calls[0][0];
    for (const phrase of [
      "profile",
      "service history",
      "My Packet",
      "knowledge base",
      "timeline",
      "does not redirect",
    ]) {
      expect(confirmText).toContain(phrase);
    }
  });

  it("on confirm, wipes everything the full data delete deletes, broadcasts to other tabs, and reloads without a decoy redirect", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const clearButton = await openViewerAndFindClearButton();

    fireEvent.click(clearButton);

    await waitFor(() => expect(wipeAllLocalData).toHaveBeenCalledTimes(1));
    expect(broadcastDataWipe).toHaveBeenCalledTimes(1);
    expect(forceReloadWithCacheBypass).toHaveBeenCalledTimes(1);
  });

  it("still broadcasts and reloads even if wipeAllLocalData throws, so a partial failure never leaves the app looking cleared when it isn't", async () => {
    wipeAllLocalData.mockImplementationOnce(async () => {
      throw new Error("indexedDB delete failed");
    });
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const clearButton = await openViewerAndFindClearButton();

    fireEvent.click(clearButton);

    await waitFor(() =>
      expect(forceReloadWithCacheBypass).toHaveBeenCalledTimes(1),
    );
    expect(broadcastDataWipe).toHaveBeenCalledTimes(1);
  });
});
