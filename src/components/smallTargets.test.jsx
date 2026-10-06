import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/unifiedAIService", () => ({
  getAIStatus: () => ({
    effectiveMode: "cloud",
    cloudAvailable: true,
    swarmStatus: { model: null },
  }),
}));

import GeminiApiKeyForm from "./GeminiApiKeyForm";
import TokenLimitConfig from "./TokenLimitConfig";

const MIN = /min-h-\[44px\]/;

describe("small interactive targets in the AI settings are 44px", () => {
  it("the Get a free API key link", () => {
    render(
      <GeminiApiKeyForm
        apiKey=""
        setApiKey={() => {}}
        showApiKey={false}
        setShowApiKey={() => {}}
        apiKeySaved={false}
        onSave={() => {}}
        onClear={() => {}}
      />,
    );
    expect(
      screen.getByRole("link", { name: /free API key/ }).className,
    ).toMatch(MIN);
  });

  it("the Show Details toggle on the response length card", () => {
    render(<TokenLimitConfig />);
    expect(
      screen.getByRole("button", { name: "Show Details" }).className,
    ).toMatch(MIN);
  });
});
