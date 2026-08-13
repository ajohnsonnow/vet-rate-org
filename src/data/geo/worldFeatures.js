/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Single source of truth for the bundled world boundary data + projection
 * used by DutyStationMap.jsx and its equal-area regression test — both
 * import from here so a future edit can't silently swap the projection in
 * one place and not the other. Lives alongside the vendored topojson (see
 * README.md in this directory) so vite.config.js's "geo" manualChunks rule
 * (id.includes("src/data/geo")) buckets this loader with its data instead
 * of it landing in whichever chunk happens to import it first.
 */
import { geoEqualEarth } from "d3-geo";
import { feature } from "topojson-client";
import worldTopo from "./world-countries-50m.topo.json";

/**
 * Parse the vendored topojson into a GeoJSON feature list. Five of the 241
 * features (disputed/unclaimed territories with no standard numeric country
 * code — N. Cyprus, Somaliland, Kosovo, Indian Ocean Ter., Siachen Glacier)
 * have `id: undefined`; every feature does have a unique `properties.name`,
 * so callers must key/identify features by name, not id.
 * @returns {Array<Object>} GeoJSON Feature[] (MultiPolygon/Polygon)
 */
export function loadWorldFeatures() {
  if (!worldTopo?.objects?.countries) {
    throw new Error(
      "World boundary data is missing objects.countries — src/data/geo/world-countries-50m.topo.json may be corrupt or out of date.",
    );
  }
  return feature(worldTopo, worldTopo.objects.countries).features;
}

/**
 * The one and only projection this app is allowed to render the world
 * map with. Equal-area (true relative landmass size) — Mercator, Natural
 * Earth 1, Equirectangular, and Robinson are explicitly prohibited (spec
 * do-not-list #4). Fit once against a fixed 1000-unit-wide internal
 * coordinate space (the Sphere, not any one feature) — callers must never
 * re-fit/re-create this on resize; the SVG scales via viewBox instead.
 * @returns {import("d3-geo").GeoProjection}
 */
export function createWorldProjection() {
  return geoEqualEarth().fitWidth(1000, { type: "Sphere" });
}
