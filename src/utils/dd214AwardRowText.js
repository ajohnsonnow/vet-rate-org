/**
 * Vet-Rate.org - DD-214 review row text for an award
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The parser splits "ARMY COMMENDATION MEDAL (2ND AWARD)" into a name, an
 * award count and a device list, and the saved award keeps all three. The
 * review row shows them again as the document printed them, so the row reads
 * as what will be saved.
 */

const MAX_AWARD_COUNT = 999;

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffixes = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 10] ?? "th"}`;
}

function deviceName(device) {
  const text = typeof device === "string" ? device : device?.type;
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

function deviceSummary(devices) {
  const counts = new Map();
  for (const device of Array.isArray(devices) ? devices : []) {
    const name = deviceName(device);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => (count > 1 ? `${count} ${name}` : name))
    .join(", ");
}

/**
 * @param {{name?: string, deviceCount?: number, devices?: unknown[]}} award
 * @returns {string} the name followed by its award number and devices, or an
 *   empty string when the award has no name
 */
export function awardRowText(award) {
  const name = typeof award?.name === "string" ? award.name.trim() : "";
  if (name === "") return "";
  const count = award.deviceCount;
  const number =
    Number.isInteger(count) && count > 0 && count <= MAX_AWARD_COUNT
      ? ` (${ordinal(count)} award)`
      : "";
  const devices = deviceSummary(award.devices);
  const withDevices = devices ? " with " + devices : "";
  return `${name}${number}${withDevices}`;
}
