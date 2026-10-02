/**
 * D20-5 remainder: a typed name reaches an off-device body unredacted only
 * when no identifier source has ever loaded. In exactly that state the AI
 * input shows a one-line notice; otherwise it never appears. The identifier
 * check is the real one (unifiedAIService); only the stored sources (the
 * Knowledge Base loader and the profile in localStorage) are set up here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const loadVKBMock = vi.hoisted(() => vi.fn());
vi.mock("../utils/veteranKnowledgeBase", async (importOriginal) => ({
  ...(await importOriginal()),
  loadVKB: loadVKBMock,
}));

const { default: IdentifierSourceNotice } =
  await import("./IdentifierSourceNotice.jsx");
const { default: AIAssistant } = await import("./AIAssistant.jsx");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { HelperModeProvider } = await import("../contexts/HelperModeContext");
const { resetLastKnownGoodRedactionProfile } =
  await import("../utils/unifiedAIService");
const { initializeVKB } = await import("../utils/veteranKnowledgeBase");

const vkbWith = (personal) => ({ ...initializeVKB(), personal });

const NOTICE =
  /Your profile has not loaded, so the app cannot remove your name/;
const FAKE_NAME = "Jordan Faketon";

async function settled() {
  await waitFor(() => expect(loadVKBMock).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  localStorage.clear();
  resetLastKnownGoodRedactionProfile();
});

describe("IdentifierSourceNotice", () => {
  it("shows when no identifier source holds anything", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    render(<IdentifierSourceNotice />);
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it("shows when the Knowledge Base loader fails and nothing else is stored", async () => {
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    render(<IdentifierSourceNotice />);
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it("is absent when the Knowledge Base holds the name", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({ fullName: FAKE_NAME }));
    render(<IdentifierSourceNotice />);
    await settled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("is absent when only the saved profile holds the name", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    localStorage.setItem(
      "vet_rate_veteran_profile",
      JSON.stringify({ fullName: FAKE_NAME }),
    );
    render(<IdentifierSourceNotice />);
    await settled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe("the AI assistant input", () => {
  const renderAssistant = () =>
    render(
      <LanguageProvider>
        <HelperModeProvider>
          <AIAssistant onClose={vi.fn()} onOpenAISettings={vi.fn()} />
        </HelperModeProvider>
      </LanguageProvider>,
    );

  it("shows the notice next to the input only when no identifier source loaded", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    renderAssistant();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("does not show it once the profile holds a name", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({ fullName: FAKE_NAME }));
    renderAssistant();
    await screen.findByRole("textbox");
    await settled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});
