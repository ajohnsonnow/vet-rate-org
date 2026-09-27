/**
 * D11-2: My Packet's Service tab "Service span: <start> - <end>" line
 * showed a calculated NGB-22 start date with no marker, unlike every other
 * consumer of serviceStartDateDerived - a veteran reading their own Service
 * tab had no way to know the date was a guess. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../utils/documentAnalyzer", () => ({
  OCR_STATES: {},
  getProgressStyling: () => ({}),
  formatFileSize: (bytes) => `${bytes} bytes`,
  isFileSupported: () => true,
  getAcceptString: () => "",
}));
vi.mock("../utils/musterCallProcessor", () => ({
  processFormationDocument: vi.fn(),
  PROCESSING_STATES: { EXTRACTING: "EXTRACTING", COMPLETE: "COMPLETE" },
}));
vi.mock("../utils/smolVLMService", () => ({
  smolVLMService: {},
  isSmolVLMSupported: () => false,
}));

import { DD214PeriodsSummary } from "./MyPacket.jsx";

const t = (...keys) => keys.join(".");

describe("DD214PeriodsSummary - Service span calculated-date marker", () => {
  it("marks a calculated service span start date", () => {
    render(
      <DD214PeriodsSummary
        summary={{
          totalTimeInService: "8 years",
          serviceSpan: {
            start: "2002-03-05",
            startDerived: true,
            end: "2010-06-15",
          },
          branches: ["Army National Guard"],
          highestPayGrade: "E-5",
          mostRecentRank: "SGT",
          characterOfService: "Honorable",
          characterOfServiceDisagrees: false,
        }}
        dd214Data={null}
        awards={[]}
        t={t}
      />,
    );

    expect(screen.getByText(/2002-03-05/)).toBeInTheDocument();
    expect(screen.getByText(/calculated from net service/)).toBeInTheDocument();
  });

  it("shows no marker for a genuinely printed start date", () => {
    render(
      <DD214PeriodsSummary
        summary={{
          totalTimeInService: "8 years",
          serviceSpan: {
            start: "2002-03-05",
            startDerived: false,
            end: "2010-06-15",
          },
          branches: ["Army"],
          highestPayGrade: "E-5",
          mostRecentRank: "SGT",
          characterOfService: "Honorable",
          characterOfServiceDisagrees: false,
        }}
        dd214Data={null}
        awards={[]}
        t={t}
      />,
    );

    expect(screen.getByText(/2002-03-05/)).toBeInTheDocument();
    expect(
      screen.queryByText(/calculated from net service/),
    ).not.toBeInTheDocument();
  });
});
