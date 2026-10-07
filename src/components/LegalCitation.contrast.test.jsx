import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LegalCitation } from "./LegalCitation";

// Tailwind 3 palette values for the classes the chip uses.
const HEX = {
  "slate-50": "#f8fafc",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "slate-600": "#475569",
  "slate-700": "#334155",
  "slate-800": "#1e293b",
  "blue-300": "#93c5fd",
  "blue-700": "#1d4ed8",
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(HEX[a]), lum(HEX[b])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colour = (el, prefix) => {
  const token = el.className
    .split(/\s+/)
    .filter((c) => c.startsWith(`${prefix}text-`))
    .map((c) => c.slice(prefix.length + 5))
    .find((name) => name in HEX);
  return token;
};
const surface = (el, prefix) =>
  el.className
    .split(/\s+/)
    .find((c) => c.startsWith(`${prefix}bg-`))
    ?.slice(prefix.length + 3);

describe("the source chip is readable in both themes", () => {
  const view = () =>
    render(
      <LegalCitation
        citation="38 CFR § 4.26"
        source_url="https://www.ecfr.gov/current/title-38/section-4.26"
        fetched_at="2026-01-01"
        score={0.7}
      />,
    );

  it.each([
    ["light", ""],
    ["dark", "dark:"],
  ])(
    "every text colour reaches 4.5:1 on its box in the %s theme",
    (_t, prefix) => {
      const { container } = view();
      const box = container.firstChild;
      const bg = surface(box, prefix) ?? surface(box, "");
      const link = container.querySelector("a");
      const date = container.querySelector('[title="Last fetched"]');
      const score = container.querySelector(
        '[title="Cosine similarity to query"]',
      );
      for (const el of [box, link, date, score]) {
        const fg = colour(el, prefix) ?? colour(el, "");
        expect(
          ratio(fg, bg),
          `${el.className} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
