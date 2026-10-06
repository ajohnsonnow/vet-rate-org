/**
 * WCAG 2.2 AA (4.5:1 for text) for the text colours of the bilateral notices,
 * badges and buttons this work introduced. jsdom has no layout or CSS, so the
 * check reads the Tailwind classes off the rendered elements and computes the
 * ratio from the palette values those classes resolve to (light theme; the
 * dark-theme pairs are listed in PAIRS). The semantic families used here
 * (amber, green, purple, gray) are not remapped by tailwind.config.js; blue
 * is, to the brand ramp, so its darkest-contrast palette value is used.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BilateralIssuesSummary from "../../components/BilateralIssuesSummary.jsx";
import WhatIfSandbox from "../../components/WhatIfSandbox.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

const HEX = {
  white: "#ffffff",
  "amber-50": "#fffbeb",
  "amber-100": "#fef3c7",
  "amber-200": "#fde68a",
  "amber-800": "#92400e",
  "amber-900": "#78350f",
  "green-50": "#f0fdf4",
  "green-300": "#86efac",
  "green-700": "#15803d",
  "green-800": "#166534",
  "purple-50": "#faf5ff",
  "purple-300": "#d8b4fe",
  "purple-700": "#7e22ce",
  "gray-200": "#e5e7eb",
  "gray-700": "#374151",
  // brand-700 of the gold palette, the lightest of the four brand ramps
  "blue-700": "#796000",
  // amber-900 and green-900 at 30% and 20% over the dark forest surface #0f2919
  "amber-900/30 on dark": "#2e2d16",
  "green-900/20 on dark": "#102f1e",
  "purple-900/30 on dark": "#2a2636",
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (text, background) => {
  const [hi, lo] = [luminance(HEX[text]), luminance(HEX[background])].sort(
    (a, b) => b - a,
  );
  return (hi + 0.05) / (lo + 0.05);
};

const PAIRS = [
  ["short notice, light", "amber-900", "amber-50"],
  ["short notice, dark", "amber-100", "amber-900/30 on dark"],
  ["calculator notice, light", "amber-800", "amber-50"],
  ["calculator notice, dark", "amber-200", "amber-900/30 on dark"],
  ["side badge outside the group", "gray-700", "gray-200"],
  ["sandbox applied line, light", "green-700", "green-50"],
  ["sandbox rule line, light", "green-800", "green-50"],
  ["sandbox rule line, dark", "green-300", "green-900/20 on dark"],
  ["rule sentence, light", "purple-700", "purple-50"],
  ["rule sentence, dark", "purple-300", "purple-900/30 on dark"],
  ["add to scenario button", "white", "blue-700"],
];

beforeEach(() => {
  localStorage.clear();
});

describe("text introduced with the bilateral notices meets 4.5:1", () => {
  it.each(PAIRS)("%s: %s on %s", (_label, text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("the old sandbox rule colour, green-600 on green-50, did not", () => {
    HEX["green-600"] = "#16a34a";
    expect(contrast("green-600", "green-50")).toBeLessThan(4.5);
  });
});

describe("the rendered elements carry the checked colours", () => {
  it("short notice and the ignored-rating notice inside it", () => {
    render(
      <BilateralIssuesSummary
        conditions={[
          { name: "Left knee pain", rating: 10, side: "none" },
          { name: "Right knee pain", rating: 10, side: "none" },
          { name: "Knee", rating: "severe", side: "none" },
        ]}
      />,
    );
    for (const notice of screen.getAllByRole("status")) {
      expect(notice).toHaveClass("bg-amber-50", "text-amber-900");
      expect(notice).toHaveClass("dark:text-amber-100");
    }
  });

  it("sandbox rule line and add button", async () => {
    render(
      <LanguageProvider>
        <WhatIfSandbox onClose={() => {}} />
      </LanguageProvider>,
    );
    for (const name of [/Knee \(Left\).*10/i, /Knee \(Right\).*10/i]) {
      fireEvent.click((await screen.findAllByRole("button", { name }))[0]);
    }
    const rule = await screen.findByText(/these ratings are combined first/i);
    expect(rule).toHaveClass("text-green-800", "dark:text-green-300");
    expect(rule).not.toHaveClass("text-green-600");
    expect(
      screen.getByRole("button", { name: /add to scenario/i }),
    ).toHaveClass("bg-blue-700", "text-white");
  });
});
