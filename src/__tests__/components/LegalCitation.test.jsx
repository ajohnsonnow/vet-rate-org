import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import {
  LegalCitation,
  LegalCitationList,
} from "../../components/LegalCitation.jsx";

const FIXTURE = {
  citation: "38 CFR § 4.71a",
  title: "Schedule of ratings—musculoskeletal",
  source_url:
    "https://www.ecfr.gov/current/title-38/chapter-I/part-4/section-4.71a",
  fetched_at: "2026-05-15T07:17:18.982Z",
  score: 0.82,
};

async function checkA11y(container) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations;
}

describe("LegalCitation", () => {
  it("renders the citation string", () => {
    render(<LegalCitation {...FIXTURE} />);
    expect(screen.getByText("38 CFR § 4.71a")).toBeInTheDocument();
  });

  it("wraps the citation in an external link with rel='noopener noreferrer'", () => {
    render(<LegalCitation {...FIXTURE} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", FIXTURE.source_url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.rel).toMatch(/noopener/);
    expect(link.rel).toMatch(/noreferrer/);
  });

  it("renders without a link when source_url is missing or non-gov", () => {
    const { container, rerender } = render(
      <LegalCitation {...FIXTURE} source_url={undefined} />,
    );
    expect(container.querySelector("a")).toBeNull();
    rerender(
      <LegalCitation {...FIXTURE} source_url="https://evil.example/x" />,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("formats the fetched_at date", () => {
    render(<LegalCitation {...FIXTURE} />);
    // Locale-dependent output, but should contain the year + month abbrev
    expect(screen.getByText(/May/i)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("passes axe-core", async () => {
    const { container } = render(<LegalCitation {...FIXTURE} />);
    const violations = await checkA11y(container);
    expect(violations).toEqual([]);
  });
});

describe("LegalCitationList", () => {
  it("renders one badge per citation", () => {
    const items = [
      FIXTURE,
      {
        ...FIXTURE,
        citation: "38 CFR § 4.1",
        source_url: "https://www.ecfr.gov/section-4.1",
      },
    ];
    render(<LegalCitationList citations={items} />);
    expect(screen.getByText("38 CFR § 4.71a")).toBeInTheDocument();
    expect(screen.getByText("38 CFR § 4.1")).toBeInTheDocument();
  });

  it("renders nothing for empty input", () => {
    const { container } = render(<LegalCitationList citations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when citations is not an array", () => {
    const { container } = render(<LegalCitationList citations={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
