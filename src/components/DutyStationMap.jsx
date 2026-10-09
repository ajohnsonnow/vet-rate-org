/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Offline, equal-area (Equal Earth projection) world map for the duty
 * stations feature. Zero network calls — boundary data is vendored (see
 * src/data/geo/README.md), never fetched. Lazy-loaded from MyPacket.jsx so
 * a My Packet visit that never opens the Service tab doesn't pay for the
 * d3-geo/topojson-client/boundary-data "geo" chunk.
 *
 * This component is the sole owner of the projection + bundled features —
 * it's a controlled component: the parent (DutyStationsSection) owns the
 * draft lat/lon/country form state, this component only ever reports
 * position + derived-country changes upward via callbacks. That keeps
 * every d3-geo/topojson-client import confined to this one lazy chunk,
 * including the "pick country" dropdown and the geoContains country
 * derivation that runs identically whether the position came from a map
 * click or the keyboard number inputs in the parent form.
 */
import { useEffect, useMemo, useRef } from "react";
import { geoPath, geoGraticule10, geoContains, geoCentroid } from "d3-geo";
import {
  loadWorldFeatures,
  createWorldProjection,
} from "../data/geo/worldFeatures";

function isValidCoordinate(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// getScreenCTM/matrixTransform account for the SVG's viewBox + responsive
// CSS size + preserveAspectRatio letterboxing, so this stays correct at
// every rendered width without any manual rect-math.
function svgPointFromClientCoords(svgEl, clientX, clientY) {
  const ctm = svgEl.getScreenCTM?.();
  if (!ctm) return null;
  const point = svgEl.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(ctm.inverse());
  return [local.x, local.y];
}

function useWorldMap() {
  return useMemo(() => {
    const features = loadWorldFeatures();
    const projection = createWorldProjection();
    const path = geoPath(projection);
    const [[x0, y0], [x1, y1]] = path.bounds({ type: "Sphere" });
    const viewBox = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
    const countryOptions = features
      .filter((f) => f.properties?.name)
      .map((f) => ({ name: f.properties.name, centroid: geoCentroid(f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { features, projection, path, viewBox, countryOptions };
  }, []);
}

// Whenever the draft lat/lon changes (from a map click, the country picker,
// or the parent's own keyboard number inputs) re-derive which bundled
// feature contains it, so all three entry paths funnel through the same
// geoContains logic and produce identical stored records.
function useCountryDerivation({
  features,
  draftLatitude,
  draftLongitude,
  onCountryDerived,
}) {
  useEffect(() => {
    if (!onCountryDerived) return;
    if (!isValidCoordinate(draftLatitude, draftLongitude)) {
      onCountryDerived("");
      return;
    }
    const hit = features.find((f) =>
      geoContains(f, [draftLongitude, draftLatitude]),
    );
    onCountryDerived(hit?.properties?.name || "");
  }, [draftLatitude, draftLongitude, features, onCountryDerived]);
}

function WorldMapLayers({ features, path }) {
  return (
    <>
      <path
        d={path({ type: "Sphere" })}
        className="fill-blue-50 dark:fill-slate-800 stroke-gray-400 dark:stroke-gray-600"
        strokeWidth={1}
      />
      <path
        d={path(geoGraticule10())}
        className="fill-none stroke-gray-300 dark:stroke-gray-700"
        strokeWidth={0.5}
        strokeOpacity={0.5}
      />
      {features.map((f) => (
        <path
          key={f.properties.name}
          d={path(f)}
          className="fill-gray-300 dark:fill-gray-700 stroke-white dark:stroke-gray-900"
          strokeWidth={0.5}
        />
      ))}
    </>
  );
}

function DutyStationMarkers({ stations, projection }) {
  return stations
    .filter((s) => isValidCoordinate(s.latitude, s.longitude))
    .map((s) => {
      const point = projection([s.longitude, s.latitude]);
      if (!point) return null;
      return (
        <circle
          key={s.id}
          cx={point[0]}
          cy={point[1]}
          r={4.5}
          className="fill-red-600 dark:fill-red-400 stroke-white dark:stroke-gray-900"
          strokeWidth={1}
        >
          <title>{s.name || ""}</title>
        </circle>
      );
    });
}

function DraftMarker({ point }) {
  if (!point) return null;
  const [x, y] = point;
  return (
    <g className="pointer-events-none">
      <line
        x1={x - 8}
        y1={y}
        x2={x + 8}
        y2={y}
        className="stroke-amber-500 dark:stroke-amber-400"
        strokeWidth={1.5}
      />
      <line
        x1={x}
        y1={y - 8}
        x2={x}
        y2={y + 8}
        className="stroke-amber-500 dark:stroke-amber-400"
        strokeWidth={1.5}
      />
      <circle
        cx={x}
        cy={y}
        r={9}
        className="fill-none stroke-amber-500 dark:stroke-amber-400"
        strokeWidth={1}
      />
    </g>
  );
}

function MapCaption({
  t,
  draftValid,
  draftLatitude,
  draftLongitude,
  countryOptions,
  onCountryPick,
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span>
          {t("myPacketSection.pickOnMap")}
          {draftValid &&
            `: ${draftLatitude.toFixed(4)}, ${draftLongitude.toFixed(4)}`}
        </span>
        <label className="flex items-center gap-1.5">
          {t("myPacketSection.pickCountryHint")}
          <select
            onChange={onCountryPick}
            value=""
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            <option value="">{t("myPacketSection.selectEllipsis")}</option>
            {countryOptions.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500">
        {t("myPacketSection.equalAreaNote")}
      </p>
    </>
  );
}

function useMapHandlers({
  svgRef,
  projection,
  countryOptions,
  onPositionChange,
}) {
  const handleMapClick = (e) => {
    if (!onPositionChange) return;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const local = svgPointFromClientCoords(svgEl, e.clientX, e.clientY);
    if (!local) return;
    const inverted = projection.invert(local);
    if (!inverted) return;
    const [lon, lat] = inverted;
    if (!isValidCoordinate(lat, lon)) return;
    onPositionChange(round4(lat), round4(lon));
  };

  const handleCountryPick = (e) => {
    const name = e.target.value;
    if (!name) return;
    const option = countryOptions.find((o) => o.name === name);
    if (!option) return;
    const [lon, lat] = option.centroid;
    onPositionChange?.(round4(lat), round4(lon));
  };

  return { handleMapClick, handleCountryPick };
}

export default function DutyStationMap({
  stations = [],
  draftLatitude = null,
  draftLongitude = null,
  onPositionChange,
  onCountryDerived,
  t,
}) {
  const svgRef = useRef(null);
  const { features, projection, path, viewBox, countryOptions } = useWorldMap();
  useCountryDerivation({
    features,
    draftLatitude,
    draftLongitude,
    onCountryDerived,
  });
  const { handleMapClick, handleCountryPick } = useMapHandlers({
    svgRef,
    projection,
    countryOptions,
    onPositionChange,
  });

  const draftValid = isValidCoordinate(draftLatitude, draftLongitude);
  const draftPoint = draftValid
    ? projection([draftLongitude, draftLatitude])
    : null;
  const plottedCount = stations.filter((s) =>
    isValidCoordinate(s.latitude, s.longitude),
  ).length;

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("myPacketSection.mapAriaLabel", { count: plottedCount })}
        className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-slate-900 cursor-crosshair"
        onClick={handleMapClick}
      >
        <WorldMapLayers features={features} path={path} />
        <DutyStationMarkers stations={stations} projection={projection} />
        <DraftMarker point={draftPoint} />
      </svg>

      <MapCaption
        t={t}
        draftValid={draftValid}
        draftLatitude={draftLatitude}
        draftLongitude={draftLongitude}
        countryOptions={countryOptions}
        onCountryPick={handleCountryPick}
      />
    </div>
  );
}
