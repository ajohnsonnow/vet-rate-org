/**
 * Regression coverage for a bug found during an independent QA pass on the
 * duty-stations + world map feature: save() only validated the station
 * name, not the latitude/longitude fields. An out-of-range value (e.g.
 * latitude 500) silently became `latitude: null` on save via
 * sanitizeCoordinate() in veteranProfile.js, with no alert or other signal
 * that anything was wrong -- the station would just be missing from the map.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import DutyStationsSection from "../../components/DutyStationsSection.jsx";
import { getDutyStations } from "../../utils/veteranProfile.js";

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

const t = (key) => key;

const VETERAN_PROFILE = { servicePeriods: [] };

async function renderSection() {
  const utils = render(
    <DutyStationsSection
      serviceHistory={{ dutyStations: [] }}
      veteranProfile={VETERAN_PROFILE}
      loadServiceHistory={() => {}}
      t={t}
    />,
  );
  // Explicit timeout: the 50m boundary data means parsing + rendering 241
  // country paths, not 177, so the default 1000ms findBy timeout can flake
  // under full-suite parallel load.
  await screen.findByRole("img", {}, { timeout: 5000 });
  return utils;
}

describe("DutyStationsSection — coordinate range validation on save", () => {
  it("rejects an out-of-range latitude with an alert instead of silently nulling it", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await renderSection();

    fireEvent.click(screen.getByRole("button", { name: /addDutyStation/ }));
    fireEvent.change(screen.getByLabelText(/stationName/), {
      target: { value: "Bad Coords Base" },
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /\bsave$/i }));

    expect(alertSpy).toHaveBeenCalled();
    expect(getDutyStations()).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it("accepts a valid coordinate and persists it", async () => {
    await renderSection();

    fireEvent.click(screen.getByRole("button", { name: /addDutyStation/ }));
    fireEvent.change(screen.getByLabelText(/stationName/), {
      target: { value: "Fort Bragg" },
    });
    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: "35.139" },
    });
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: "-79.006" },
    });

    fireEvent.click(screen.getByRole("button", { name: /\bsave$/i }));

    const stations = getDutyStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].latitude).toBe(35.139);
  });
});
