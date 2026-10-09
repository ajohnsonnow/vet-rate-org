/**
 * D20-5 remainder: a typed name reaches an off-device body unredacted whenever
 * the app holds no name to recognise it by. In exactly that state the AI input
 * shows a one-line notice; otherwise it never appears. Holding some other
 * identifier (a date of birth, an email, a phone, the last four of an SSN) does
 * not count: none of them can recognise a typed name. The identifier check is
 * the real one (unifiedAIService); only the stored sources (the Knowledge Base
 * loader and the profile in localStorage) are set up here.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

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

const NOTICE = /The app does not have your name saved/;
const FAKE_NAME = "Jordan Faketon";
const PROFILE_KEY = "vet_rate_veteran_profile";

const renderNotice = () =>
  render(
    <LanguageProvider>
      <IdentifierSourceNotice />
    </LanguageProvider>,
  );

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
    renderNotice();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it("shows when the Knowledge Base loader fails and nothing else is stored", async () => {
    loadVKBMock.mockRejectedValue(new Error("VKB load failed"));
    renderNotice();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it("is absent when the Knowledge Base holds the name", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({ fullName: FAKE_NAME }));
    renderNotice();
    await settled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("is absent when only the saved profile holds the name", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ fullName: FAKE_NAME }));
    renderNotice();
    await settled();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe("IdentifierSourceNotice with an identifier but no name", () => {
  it.each([
    ["date of birth", { dateOfBirth: "1984-03-15" }],
    ["email", { email: "someone@example.test" }],
    ["phone", { phone: "5551234567" }],
    ["last four of the SSN", { ssnLast4: "6789" }],
  ])("still shows when the profile holds only a %s", async (_label, saved) => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
    renderNotice();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });

  it("goes away once a name is saved while the input is open", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    renderNotice();
    expect(await screen.findByText(NOTICE)).toBeTruthy();

    localStorage.setItem(PROFILE_KEY, JSON.stringify({ fullName: FAKE_NAME }));
    const box = document.body.appendChild(document.createElement("textarea"));
    fireEvent.focusIn(box);
    await waitFor(() => expect(screen.queryByText(NOTICE)).toBeNull());
    box.remove();
  });

  it("does not re-read the stores when a plain input gains focus", async () => {
    loadVKBMock.mockResolvedValue(vkbWith({}));
    renderNotice();
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    const readsOnMount = loadVKBMock.mock.calls.length;

    const field = document.body.appendChild(document.createElement("input"));
    fireEvent.focusIn(field);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loadVKBMock.mock.calls).toHaveLength(readsOnMount);
    field.remove();
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

  it("shows the notice next to the input only when no name is known", async () => {
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
