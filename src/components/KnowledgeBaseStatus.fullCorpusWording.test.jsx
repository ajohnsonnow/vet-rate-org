/**
 * With full-corpus grounding on, answers draw from the eCFR, M21-1, M21-5,
 * CAVC, Federal Circuit and OGC shards but never the BVA or M21-4 shards
 * (DKB_SHARD_IDS). The status panel must say that, not claim the complete
 * corpus is in use.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

vi.mock("../utils/dkbIndexedDB", () => ({
  isMobileDevice: vi.fn(() => true),
  isFullDKBCached: vi.fn(async () => false),
  downloadFullDKB: vi.fn(async () => ({ success: false })),
  getCachedEntryCount: vi.fn(async () => 0),
  getCachedSourceCounts: vi.fn(async () => ({})),
  FULL_DATABASE_COUNT: 130508,
}));

vi.mock("../hooks/useColorSchemas", () => ({
  useColorSchemas: () => ({}),
}));

import KnowledgeBaseStatus from "./KnowledgeBaseStatus";
import { DKB_SHARD_IDS } from "../utils/aiSystemPrompts";
import { LanguageProvider } from "../contexts/LanguageContext";

const renderStatus = (props) =>
  render(
    <LanguageProvider>
      <KnowledgeBaseStatus {...props} />
    </LanguageProvider>,
  );

const announceLocalAI = async (detail) => {
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await act(async () => {
    window.dispatchEvent(new CustomEvent("local-ai-status-change", { detail }));
  });
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ entries: [], full_database_count: 130508 }),
    })),
  );
});

describe("KnowledgeBaseStatus when full-corpus grounding is on", () => {
  it("the shards it names are the ones the grounding path queries, without bva or m21_4", () => {
    expect(DKB_SHARD_IDS).not.toContain("bva");
    expect(DKB_SHARD_IDS).not.toContain("m21_4");
    expect(DKB_SHARD_IDS).toEqual(
      expect.arrayContaining([
        "ecfr",
        "m21_1",
        "m21_5",
        "cavc",
        "fedcir",
        "ogc",
      ]),
    );
  });

  it("compact view does not claim the complete corpus and names what is left out", async () => {
    const { container } = renderStatus({ compact: true });
    await announceLocalAI({
      ready: true,
      modelId: "m",
      fullDKBAvailable: true,
    });

    const badge = container.querySelector("button");
    expect(badge).not.toBeNull();
    await act(async () => {
      badge.click();
    });

    const text = document.body.textContent;
    expect(text).not.toMatch(/complete/i);
    expect(text).not.toMatch(/all official sources/i);
    expect(text).not.toContain("FULL DKB");
    expect(text).toMatch(
      /BVA decisions and\s+the M21-4 manual are not searched/,
    );
  });

  it("full view labels the entry count as cached and names the left-out sources", async () => {
    renderStatus({});
    await announceLocalAI({
      ready: true,
      modelId: "m",
      fullDKBAvailable: true,
    });

    expect(
      await screen.findByText(
        /cached entries \(BVA and\s+M21-4 are not searched\)/,
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/complete/i);
  });
});
