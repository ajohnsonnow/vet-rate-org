/**
 * An NGB-22 that prints no entry date gets one calculated (separation date
 * minus net service - musterCallProcessor.js's serviceStartDateDerived
 * flag). DutyStationsSection shows each duty station's linked service
 * period label (formatPeriodLabel) both in the "linked period" dropdown and
 * the duty station list entry - both must mark it (via the translated
 * myPacketSection.calculatedFromNetService key, not hard-coded English) when
 * the linked period's start date isn't something printed on the veteran's
 * form.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DutyStationsSection from "../../components/DutyStationsSection.jsx";

afterEach(cleanup);

const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

function buildServiceHistory(periodId) {
  return {
    dutyStations: [
      {
        id: "duty_1",
        name: "Fort Bragg",
        periodId,
        country: "United States of America",
        latitude: 35.139,
        longitude: -79.006,
        startDate: "",
        endDate: "",
        notes: "",
      },
    ],
  };
}

async function renderSection(veteranProfile, periodId) {
  const utils = render(
    <DutyStationsSection
      serviceHistory={buildServiceHistory(periodId)}
      veteranProfile={veteranProfile}
      loadServiceHistory={() => {}}
      t={t}
    />,
  );
  await screen.findByRole("img", {}, { timeout: 5000 });
  return utils;
}

describe("DutyStationsSection - calculated entry date marker", () => {
  it("marks a linked period's calculated start date as calculated", async () => {
    await renderSection(
      {
        servicePeriods: [
          {
            id: "period_1",
            branch: "Army National Guard",
            serviceStartDate: "2012-03-14",
            serviceStartDateDerived: true,
            serviceEndDate: "2020-03-14",
          },
        ],
      },
      "period_1",
    );

    expect(
      screen.getByText(/\(myPacketSection\.calculatedFromNetService\)/),
    ).toBeInTheDocument();
  });

  it("does not mark a printed start date as calculated", async () => {
    await renderSection(
      {
        servicePeriods: [
          {
            id: "period_1",
            branch: "Army",
            serviceStartDate: "2010-01-01",
            serviceEndDate: "2014-01-01",
          },
        ],
      },
      "period_1",
    );

    expect(
      screen.queryByText(/\(myPacketSection\.calculatedFromNetService\)/),
    ).not.toBeInTheDocument();
  });

  // The list entry above (formatPeriodLabel via DutyStationEntry) is only
  // one of formatPeriodLabel's two callers - the "linked period" <select>
  // shown in the edit form (PeriodSelect) is the other, and used its own
  // hard-coded "(calculated)" that the list entry's translated text never
  // exercised.
  it("marks the calculated start date inside the linked-period dropdown option too", async () => {
    await renderSection(
      {
        servicePeriods: [
          {
            id: "period_1",
            branch: "Army National Guard",
            serviceStartDate: "2012-03-14",
            serviceStartDateDerived: true,
            serviceEndDate: "2020-03-14",
          },
        ],
      },
      "period_1",
    );

    fireEvent.click(screen.getByText("myPacketSection.edit"));

    const option = document.querySelector(
      '#duty-station-period option[value="period_1"]',
    );
    expect(option).not.toBeNull();
    expect(option.textContent).toContain(
      "(myPacketSection.calculatedFromNetService)",
    );
  });
});
