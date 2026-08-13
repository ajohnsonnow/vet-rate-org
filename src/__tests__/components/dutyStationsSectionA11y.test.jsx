/**
 * Duty stations + world map spec §8: vitest-axe assertion on the rendered
 * DutyStationsSection (header/button/map/form/list), including the
 * lazy-loaded DutyStationMap once it settles.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers.js";
import DutyStationsSection from "../../components/DutyStationsSection.jsx";

expect.extend({ toHaveNoViolations });

afterEach(cleanup);

const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

const SERVICE_HISTORY = {
  dutyStations: [
    {
      id: "duty_1",
      name: "Fort Bragg",
      periodId: null,
      country: "United States of America",
      latitude: 35.139,
      longitude: -79.006,
      startDate: "2010-01-01",
      endDate: "2012-01-01",
      notes: "",
    },
  ],
};

const VETERAN_PROFILE = {
  servicePeriods: [
    {
      id: "period_1",
      branch: "Army",
      serviceStartDate: "2010-01-01",
      serviceEndDate: "2014-01-01",
    },
  ],
};

async function renderSection() {
  const utils = render(
    <DutyStationsSection
      serviceHistory={SERVICE_HISTORY}
      veteranProfile={VETERAN_PROFILE}
      loadServiceHistory={() => {}}
      t={t}
    />,
  );
  // Wait for the lazy-loaded DutyStationMap (Suspense) to settle. Explicit
  // timeout: the 50m boundary data means parsing + rendering 241 country
  // paths, not 177, so the default 1000ms findBy timeout can flake under
  // full-suite parallel load.
  await screen.findByRole("img", {}, { timeout: 5000 });
  return utils;
}

describe("DutyStationsSection — accessibility", () => {
  it("has no axe violations in the default (list) view", async () => {
    const { container } = await renderSection();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations with the add/edit form open", async () => {
    const { container } = await renderSection();
    fireEvent.click(screen.getByRole("button", { name: /addDutyStation/ }));
    // A plain native .click() here previously let axe scan before React's
    // click-triggered state update committed, so this test silently
    // re-scanned the closed view twice and never actually exercised the
    // form's inputs. findByLabelText both waits for the form to render and
    // asserts its fields are genuinely label-associated.
    await screen.findByLabelText(/stationName/);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
