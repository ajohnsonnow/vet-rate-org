import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const ai = vi.hoisted(() => ({ reply: null, status: null }));
vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  generateAI: vi.fn(async () => ai.reply),
  getAIStatus: () => ai.status,
}));

const { default: AIAssistant } = await import("./AIAssistant.jsx");
const { LanguageProvider } = await import("../contexts/LanguageContext");
const { HelperModeProvider } = await import("../contexts/HelperModeContext");
const { MODEL_ANSWER_CAVEAT } = await import("../utils/modelAnswerCaveat");

const LARGER = {
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model: "Qwen3.5-4B-q4f16_1-MLC" },
};

async function ask() {
  render(
    <LanguageProvider>
      <HelperModeProvider>
        <AIAssistant currentTool="Home" onClose={() => {}} />
      </HelperModeProvider>
    </LanguageProvider>,
  );
  const box = await screen.findByPlaceholderText(/Ask me anything/i);
  fireEvent.change(box, {
    target: { value: "Can I file a supplemental claim?" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  ai.status = LARGER;
});

describe("the fixed caveat under a model-written answer in the assistant", () => {
  it("shows under an answer an on-device model that is not small-class wrote", async () => {
    ai.reply = { text: "You can file one.", mode: "swarm", onDevice: true };
    await ask();
    await screen.findByText("You can file one.");
    expect(MODEL_ANSWER_CAVEAT).toBe(
      "Written by an AI model on your device. It can be wrong about VA law and about your case. Check anything you will act on with an accredited Veterans Service Officer.",
    );
    expect(screen.getByText(MODEL_ANSWER_CAVEAT)).toBeTruthy();
  });

  it("does not show under the fixed open-advice message", async () => {
    ai.reply = {
      text: "This device runs a small on-device AI model.",
      openAdviceHeld: true,
      onDevice: true,
      modelCalled: false,
    };
    await ask();
    await screen.findByText(/small on-device AI model/);
    expect(screen.queryByText(MODEL_ANSWER_CAVEAT)).toBeNull();
  });

  it("does not show under a calculator answer, which no model wrote", async () => {
    ai.reply = {
      text: "Your combined rating is 70%.",
      onDevice: true,
      modelCalled: false,
    };
    await ask();
    await screen.findByText(/combined rating is 70%/);
    expect(screen.queryByText(MODEL_ANSWER_CAVEAT)).toBeNull();
  });

  it("leaves a cloud answer as it was: no line from this commit", async () => {
    ai.status = { effectiveMode: "cloud", cloudAvailable: true };
    ai.reply = { text: "A cloud answer.", mode: "cloud", onDevice: false };
    await ask();
    await screen.findByText("A cloud answer.");
    expect(screen.queryByText(MODEL_ANSWER_CAVEAT)).toBeNull();
  });

  it("does not show twice for the welcome message or errors", async () => {
    ai.reply = { text: "x", mode: "swarm", onDevice: true };
    render(
      <LanguageProvider>
        <HelperModeProvider>
          <AIAssistant currentTool="Home" onClose={() => {}} />
        </HelperModeProvider>
      </LanguageProvider>,
    );
    await waitFor(() =>
      expect(screen.queryByText(MODEL_ANSWER_CAVEAT)).toBeNull(),
    );
  });
});
