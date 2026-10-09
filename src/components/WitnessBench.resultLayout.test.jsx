/**
 * Witness Bench result header on a phone. jsdom does no layout, so this
 * pins what makes it fit at 390px: the heading and the three controls
 * stack, the controls wrap, and their row does not carry the class pair
 * (`flex gap-2`) that a global phone rule widens every button of to 120px.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext.jsx";

vi.mock("../utils/unifiedAIService", async (importOriginal) => ({
  ...(await importOriginal()),
  isAnyAIAvailable: () => false,
  getAIStatus: () => ({ statusText: "No AI" }),
  generateAI: vi.fn(),
}));

const { default: WitnessBench } = await import("./WitnessBench.jsx");

async function openResult() {
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
    { target: { value: "PTSD" } },
  );
  fireEvent.change(screen.getByPlaceholderText("e.g., Jane Smith, John Doe"), {
    target: { value: "Sam Example" },
  });
  fireEvent.click(screen.getByRole("button", { name: /start interview/i }));
  const next = () => screen.queryByRole("button", { name: /^next/i });
  for (let i = 0; i < 20; i++) {
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: `They did thing number ${i} that I saw.` },
    });
    if (!next()) break;
    fireEvent.click(next());
  }
  fireEvent.click(screen.getByRole("button", { name: /generate statement/i }));
  await screen.findByRole("textbox", { name: "Your Buddy Statement" });
}

beforeEach(() => {
  localStorage.clear();
});

describe("Witness Bench result header at phone width", () => {
  it("stacks the heading above the controls and lets the heading shrink", async () => {
    await openResult();
    const heading = screen.getByRole("heading", {
      name: /Your Buddy Statement/,
    });
    const header = heading.parentElement;

    expect(header.className).toMatch(/\bflex-col\b/);
    expect(header.className).toMatch(/\bsm:flex-row\b/);
    expect(heading.className).toMatch(/\bmin-w-0\b/);
    expect(heading.className).toMatch(/\bbreak-words\b/);
  });

  it("wraps Copy, Save and Download in a row the global 120px rule does not match", async () => {
    await openResult();
    const copy = screen.getByRole("button", { name: /copy/i });
    const row = copy.parentElement;

    expect(row.className).toMatch(/\bflex-wrap\b/);
    expect(row.className).not.toMatch(/(^|\s)gap-[23](\s|$)/);
    expect(row).toContainElement(
      screen.getByRole("button", { name: /save to my packet/i }),
    );
    expect(row).toContainElement(
      screen.getByRole("button", { name: /download/i }),
    );
    for (const button of row.querySelectorAll("button")) {
      expect(button.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it("opens the download menu inside the screen, from the left edge", async () => {
    await openResult();
    fireEvent.click(screen.getByRole("button", { name: /download/i }));
    const menu = screen.getByRole("button", {
      name: /Download as PDF/,
    }).parentElement;

    expect(menu.className).toMatch(/\bleft-0\b/);
    expect(menu.className).toMatch(/\bsm:right-0\b/);
    expect(menu.className).toMatch(/max-w-\[calc\(100vw-2rem\)\]/);
  });
});
