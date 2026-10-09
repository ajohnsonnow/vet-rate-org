/**
 * Vet-Rate.org - DD-214 review row text for an award
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The parser splits "ARMY COMMENDATION MEDAL (2ND AWARD)" into a name, an
 * award number (deviceCount) and a device list. The review row shows them
 * again as the document printed them, and the save keeps the same number and
 * devices (the service-history award's notes, the Knowledge Base award), so
 * the row reads as what will be saved.
 */

const MAX_AWARD_NUMBER = 999;
const MAX_DEVICE_KINDS_SHOWN = 5;
const MAX_DEVICE_NAME_CHARS = 40;
const MAX_AWARD_ROW_CHARS = 300;
const MAX_AWARDS_ROW_CHARS = 2000;

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffixes = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 10] ?? "th"}`;
}

/** The award number as a whole number, or undefined when unusable. */
export function awardNumberOf(award) {
  const count = award?.deviceCount;
  return Number.isInteger(count) && count > 0 && count <= MAX_AWARD_NUMBER
    ? count
    : undefined;
}

/** "2nd award", or an empty string when the award has no number. */
export function awardNumberText(award) {
  const number = awardNumberOf(award);
  return number === undefined ? "" : `${ordinal(number)} award`;
}

function deviceName(device) {
  const text = typeof device === "string" ? device : device?.type;
  return typeof text === "string"
    ? text.replace(/\s+/g, " ").trim().slice(0, MAX_DEVICE_NAME_CHARS)
    : "";
}

function deviceSummary(devices) {
  const counts = new Map();
  for (const device of Array.isArray(devices) ? devices : []) {
    const name = deviceName(device);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const kinds = [...counts].map(([name, count]) =>
    count > 1 ? `${count} ${name}` : name,
  );
  const shown = kinds.slice(0, MAX_DEVICE_KINDS_SHOWN).join(", ");
  const hidden = kinds.length - MAX_DEVICE_KINDS_SHOWN;
  return hidden > 0 ? `${shown} and ${hidden} more` : shown;
}

const clip = (text, max) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * @param {{name?: string, deviceCount?: number, devices?: unknown[]}} award
 * @returns {string} the name followed by its award number and devices, or an
 *   empty string when the award has no name
 */
export function awardRowText(award) {
  const name = typeof award?.name === "string" ? award.name.trim() : "";
  if (name === "") return "";
  const number = awardNumberText(award);
  const devices = deviceSummary(award.devices);
  const numberPart = number ? ` (${number})` : "";
  const devicesPart = devices ? " with " + devices : "";
  return clip(`${name}${numberPart}${devicesPart}`, MAX_AWARD_ROW_CHARS);
}

/** The awards row: every award's text, one after another, bounded in length. */
export function awardsRowText(awards) {
  const rows = (Array.isArray(awards) ? awards : [])
    .map(awardRowText)
    .filter((text) => text !== "");
  let text = "";
  for (const [index, row] of rows.entries()) {
    const next = text === "" ? row : `${text}; ${row}`;
    if (next.length > MAX_AWARDS_ROW_CHARS) {
      return `${text}; and ${rows.length - index} more`;
    }
    text = next;
  }
  return text;
}

/**
 * What the save records about an award's number and devices in a notes field,
 * in the same words as the review row.
 */
export function awardNotesText(award) {
  const labels = (Array.isArray(award?.devices) ? award.devices : [])
    .map((device) => (typeof device === "string" ? device : device?.type || ""))
    .filter(Boolean);
  return [
    awardNumberText(award),
    labels.length > 0 ? `Devices: ${labels.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}
