/**
 * The four store readers swallow their own errors and return an empty value,
 * so the known-identifier set must ask each for a strict read: an unreadable
 * store then makes the set incomplete (the caller fails closed) instead of
 * reading as "nothing known". These run the real readers, not mocks of them.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { loadKnownIdentifierSourcesChecked } from "./dd214KnownIdentifierSources";
import { getVeteranProfile, getServiceHistory } from "./veteranProfile";
import { getAllExtractedData } from "./myPacketManager";
import { loadVKB } from "./veteranKnowledgeBase";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a store that cannot be read makes the known set incomplete", () => {
  it("when the browser database is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { complete } = await loadKnownIdentifierSourcesChecked();
    expect(complete).toBe(false);
  });

  it("when local storage cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unreadable");
    });
    const { complete } = await loadKnownIdentifierSourcesChecked();
    expect(complete).toBe(false);
  });
});

describe("each reader throws on request and stays quiet by default", () => {
  const failStorage = () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage unreadable");
    });
  };

  it("the profile", () => {
    failStorage();
    expect(getVeteranProfile()).toEqual({});
    expect(() => getVeteranProfile({ strict: true })).toThrow();
  });

  it("the service history", () => {
    failStorage();
    expect(getServiceHistory().deployments).toEqual([]);
    expect(() => getServiceHistory({ strict: true })).toThrow();
  });

  it("the My Packet documents", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getAllExtractedData()).dd214s).toEqual([]);
    await expect(getAllExtractedData({ strict: true })).rejects.toThrow();
  });

  it("the knowledge base", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(loadVKB({ strict: true })).rejects.toThrow();
  });
});
