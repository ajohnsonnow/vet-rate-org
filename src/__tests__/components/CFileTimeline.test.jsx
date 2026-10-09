/**
 * Regression: the 313MB stress spec crashed rendering this component when a
 * timeline event had no `category` (garbled-OCR chunks omit it). The filter
 * dropdown built its option list from a raw Set of event.category values,
 * so `undefined` reached `cat.replace(...)` and threw, taking down MyPacket.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CFileTimeline from "../../components/CFileTimeline.jsx";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";

function renderTimeline(events) {
  return render(
    <LanguageProvider>
      <CFileTimeline events={events} />
    </LanguageProvider>,
  );
}

describe("CFileTimeline", () => {
  it("renders without crashing when an event has no category", () => {
    renderTimeline([
      {
        date: "2010-05-10",
        description: "Hearing loss noted on exam",
        significance: "high",
        page_number: 547,
      },
      {
        date: "2011-02-01",
        description: "Follow-up visit",
        category: "medical_visit",
        significance: "low",
        page_number: 12,
      },
    ]);

    expect(screen.getByText("Hearing loss noted on exam")).toBeInTheDocument();
    expect(screen.getByText("Follow-up visit")).toBeInTheDocument();
  });

  it("omits category-less events from the filter dropdown but keeps them under All Events", () => {
    renderTimeline([
      { date: "2010-05-10", description: "No category event" },
      {
        date: "2011-02-01",
        description: "Categorized event",
        category: "medical_visit",
      },
    ]);

    const options = screen
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"));
    expect(options).toContain("all");
    expect(options).toContain("medical_visit");
    expect(options).not.toContain(undefined);
    expect(options).toHaveLength(2);
  });
});
