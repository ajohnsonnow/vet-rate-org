/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The two-letter postal codes the VA forms' "State or Province" boxes take,
 * with the names people type instead.
 */

const STATES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
};
// Military mail: these have a code and no name.
const CODES = new Set([...Object.keys(STATES), "AA", "AE", "AP"]);
const CODE_OF_NAME = new Map(
  Object.entries(STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

/**
 * The two-letter code for a state typed as its code or its full name
 * ("ks", "Kansas", "north  carolina"), or "" when it is neither.
 */
export function stateCode(typed) {
  const text = String(typed ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const upper = text.toUpperCase();
  if (CODES.has(upper)) return upper;
  return CODE_OF_NAME.get(text.toLowerCase()) ?? "";
}
