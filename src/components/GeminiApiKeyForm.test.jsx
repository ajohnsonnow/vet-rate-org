import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GeminiApiKeyForm from "./GeminiApiKeyForm";

const props = {
  apiKey: "",
  setApiKey: vi.fn(),
  showApiKey: false,
  setShowApiKey: vi.fn(),
  apiKeySaved: false,
  onSave: vi.fn(),
  onClear: vi.fn(),
};

describe("GeminiApiKeyForm", () => {
  it("gives the key field an accessible name and a 44px minimum height", () => {
    render(<GeminiApiKeyForm {...props} />);
    const field = screen.getByLabelText("Gemini API key");
    expect(field.className).toMatch(/min-h-\[44px\]/);
  });

  it("names the show/hide control and keeps it a 44px target", () => {
    render(<GeminiApiKeyForm {...props} />);
    const toggle = screen.getByRole("button", { name: "Show API key" });
    expect(toggle.className).toMatch(/min-h-\[44px\]/);
    expect(toggle.className).toMatch(/min-w-\[44px\]/);
  });

  it("flips the name when the key is shown", () => {
    render(<GeminiApiKeyForm {...props} showApiKey />);
    expect(screen.getByRole("button", { name: "Hide API key" })).toBeTruthy();
  });
});
