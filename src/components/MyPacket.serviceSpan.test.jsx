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

import { DD214PeriodsSummary, _saveProfileTab } from "./MyPacket.jsx";
import {
  upsertServicePeriod,
  updateServicePeriod,
  getServiceEntry,
} from "../utils/veteranProfile.js";

const t = (...keys) => keys.join(".");
const PROFILE_KEY = "vet_rate_veteran_profile";

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

describe("[D12-3] _saveProfileTab: a stale Save Profile payload cannot revert the mirror", () => {
  it("excludes serviceStartDate/serviceStartDateDerived from the user-sourcing walk, so the chokepoint's projection wins", () => {
    localStorage.clear();
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ fullName: "Jordan Sample" }),
    );
    const id = upsertServicePeriod(
      {
        serviceStartDate: "2002-03-05",
        serviceStartDateDerived: true,
        serviceEndDate: "2010-06-15",
        formType: "NGB22",
      },
      { sourceDocument: "ngb22-synthetic.pdf", confidence: 60 },
    );
    // A My Packet edit elsewhere corrects the period AFTER the Profile tab
    // already captured its (now stale) local component state.
    updateServicePeriod(id, { serviceStartDate: "2001-11-01" });

    const staleVeteranProfile = {
      fullName: "Jordan Sample",
      serviceStartDate: "2002-03-05",
      serviceStartDateDerived: true,
    };
    const success = _saveProfileTab(staleVeteranProfile);

    expect(success).toBe(true);
    expect(getServiceEntry()).toMatchObject({
      date: "2001-11-01",
      derived: false,
      source: "veteran",
    });
  });
});
