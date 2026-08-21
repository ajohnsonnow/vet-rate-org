/**
 * Duty stations + world map spec §8 / acceptance criterion 7: rendering
 * the map must issue zero network requests - boundary data is vendored
 * (src/data/geo/), never fetched. Also covers criterion 8 (a station with
 * latitude: null renders in the list but not the map) at the marker level.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import DutyStationMap from "../../components/DutyStationMap.jsx";

// Mirrors LanguageContext's t(key, params) interpolation contract closely
// enough to assert DutyStationMap actually passes the plotted count through,
// without needing a full LanguageProvider (this component takes t as a
// plain prop, like its DeploymentsSection/AwardsSection siblings).
const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

const FIXTURE_STATIONS = [
  { id: "a", name: "Fort Bragg", latitude: 35.139, longitude: -79.006 },
  { id: "b", name: "Camp Pendleton", latitude: 33.3, longitude: -117.4 },
  { id: "c", name: "No coordinates on file", latitude: null, longitude: null },
];

describe("DutyStationMap - offline (zero network requests)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never calls fetch or XMLHttpRequest.open while rendering", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const xhrSpy = vi.spyOn(XMLHttpRequest.prototype, "open");

    render(<DutyStationMap stations={FIXTURE_STATIONS} t={t} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });
});

describe("DutyStationMap - rendering", () => {
  it("renders the sphere + graticule + all 241 bundled country paths with zero stations", () => {
    const { container } = render(<DutyStationMap stations={[]} t={t} />);
    expect(container.querySelector("svg")).toBeTruthy();
    // sphere (1) + graticule (1) + 241 countries = 243 <path> elements
    expect(container.querySelectorAll("path").length).toBe(243);
  });

  it("plots only stations with finite, in-range coordinates (criterion 8)", () => {
    const { container } = render(
      <DutyStationMap stations={FIXTURE_STATIONS} t={t} />,
    );
    // 2 valid stations, the null-coordinate one is skipped
    expect(container.querySelectorAll("circle").length).toBe(2);
  });

  it("reports the plotted count in aria-label, not the raw station count", () => {
    const { container } = render(
      <DutyStationMap stations={FIXTURE_STATIONS} t={t} />,
    );
    const svg = container.querySelector("svg");
    expect(svg.getAttribute("aria-label")).toContain("2");
  });

  it("renders a draft crosshair marker in addition to saved stations", () => {
    const { container } = render(
      <DutyStationMap
        stations={FIXTURE_STATIONS}
        draftLatitude={10}
        draftLongitude={20}
        t={t}
      />,
    );
    expect(container.querySelectorAll("circle").length).toBe(3); // 2 stations + draft
  });

  it("renders no draft marker when draft coordinates are out of range", () => {
    const { container } = render(
      <DutyStationMap
        stations={[]}
        draftLatitude={999}
        draftLongitude={20}
        t={t}
      />,
    );
    expect(container.querySelectorAll("circle").length).toBe(0);
  });
});
