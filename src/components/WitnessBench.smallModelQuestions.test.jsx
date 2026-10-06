/**
 * Witness Bench interview questions. When the model that would answer is a
 * small on-device one, no model is asked for questions: the built-in set is
 * used and one line says so. A larger on-device model or the cloud is asked
 * as before. All values are invented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";

const ai = vi.hoisted(() => ({ status: {} }));

vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => true,
  getAIStatus: () => ai.status,
  generateAI: vi.fn(),
}));
vi.mock("../utils/veteranContextProvider", async (importOriginal) => ({
  ...(await importOriginal()),
  getVeteranAIContext: vi.fn(async () => ""),
}));

const { generateAI } = await import("../utils/unifiedAIService");
const { default: WitnessBench } = await import("./WitnessBench.jsx");

const onDevice = (model) => ({
  statusText: "Local AI",
  effectiveMode: "swarm",
  swarmAvailable: true,
  swarmStatus: { model },
});
const SMALL = "Qwen3.5-2B-q4f16_1-MLC";
const LARGER = "Qwen3.5-9B-q4f16_1-MLC";
const CLOUD = { statusText: "Cloud AI", effectiveMode: "cloud" };
const note = () =>
  screen.queryByRole("note", { name: "About these questions" });

async function startInterview() {
  render(
    <LanguageProvider>
      <WitnessBench onClose={() => {}} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /spouse \/ partner/i }));
  fireEvent.change(
    screen.getByPlaceholderText(
      "e.g., PTSD, Lower Back Pain, Tinnitus, Sleep Apnea",
    ),
    { target: { value: "Tinnitus" } },
  );
  fireEvent.change(screen.getByPlaceholderText("e.g., Jane Smith, John Doe"), {
    target: { value: "Odalys Fenwick" },
  });
  fireEvent.click(screen.getByRole("button", { name: /start interview/i }));
  await screen.findByRole("button", { name: /^next/i });
}

beforeEach(() => {
  localStorage.clear();
  generateAI.mockReset();
  generateAI.mockResolvedValue({
    text: JSON.stringify([
      { id: "ai1", question: "A question the model wrote?", hint: "A hint." },
    ]),
  });
});

describe("Witness Bench interview questions", () => {
  it("does not ask a small on-device model, and says the built-in questions are used", async () => {
    ai.status = onDevice(SMALL);
    await startInterview();

    expect(generateAI).not.toHaveBeenCalled();
    expect(note().textContent).toBe(
      "The AI on this device is a small one, so it is not asked to write questions. These are the built-in questions.",
    );
  });

  it.each([
    ["a larger on-device model", onDevice(LARGER)],
    ["the cloud", CLOUD],
  ])("asks %s as before, with no note", async (_name, status) => {
    ai.status = status;
    await startInterview();

    expect(generateAI).toHaveBeenCalledTimes(1);
    expect(note()).not.toBeInTheDocument();
  });
});
