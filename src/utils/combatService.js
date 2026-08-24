// Combat participation is decided from the decoration list VA itself uses:
// M21-1, Part VIII, Subpart iv, 1.A.3.h, "Individual Decorations as Evidence
// of Combat Participation" - receipt of one of these creates a presumption
// the veteran engaged in combat with the enemy absent clear and convincing
// evidence to the contrary. That presumption is what opens 38 U.S.C. 1154(b)'s
// relaxed evidentiary standard and 38 CFR 3.304(f)(2)'s conceded PTSD stressor,
// so getting the list right is a claim-outcome question, not a display detail.
//
// Campaign, expeditionary, and service medals are deliberately NOT on VA's
// list. A Global War on Terrorism Service Medal is awarded for serving in the
// period, not for combat; presenting one as proof of combat overstates the
// record in the veteran's own file. Those are reported separately as theater
// evidence, which corroborates presence but not participation.

export const COMBAT_PRESUMPTION_CITATION =
  "M21-1, Part VIII, Subpart iv, 1.A.3.h; 38 U.S.C. 1154(b)";

const V = "v_device";
const C = "c_device";

// `phrases` match as normalized substrings; `aliases` match as whole tokens
// only (a bare "CAB" inside "CABLE" is not a Combat Action Badge).
// `requiresDevice` entries are combat decorations only when the valor device
// is present - a Bronze Star Medal without "V" is a meritorious-service award
// and does not establish combat.
export const COMBAT_DECORATIONS = [
  {
    id: "air_force_achievement_v",
    name: 'Air Force Achievement Medal with "V" Device',
    phrases: ["AIR FORCE ACHIEVEMENT MEDAL"],
    requiresDevice: V,
  },
  {
    id: "air_force_combat_action_medal",
    name: "Air Force Combat Action Medal",
    phrases: ["AIR FORCE COMBAT ACTION MEDAL"],
    aliases: ["AFCAM"],
  },
  {
    id: "air_force_commendation_v",
    name: 'Air Force Commendation Medal with "V" Device',
    phrases: ["AIR FORCE COMMENDATION MEDAL"],
    requiresDevice: V,
  },
  {
    id: "air_force_cross",
    name: "Air Force Cross",
    phrases: ["AIR FORCE CROSS"],
    aliases: ["AFC"],
  },
  {
    id: "air_medal_v",
    name: 'Air Medal with "V" Device',
    phrases: ["AIR MEDAL"],
    requiresDevice: V,
  },
  {
    id: "army_commendation_v",
    name: 'Army Commendation Medal with "V" Device',
    phrases: ["ARMY COMMENDATION MEDAL"],
    requiresDevice: V,
  },
  {
    id: "bronze_star_v",
    name: 'Bronze Star Medal with "V" Device',
    phrases: ["BRONZE STAR"],
    requiresDevice: V,
  },
  {
    id: "combat_action_badge",
    name: "Combat Action Badge",
    phrases: ["COMBAT ACTION BADGE"],
    aliases: ["CAB"],
  },
  {
    id: "combat_action_ribbon",
    name: "Combat Action Ribbon",
    phrases: ["COMBAT ACTION RIBBON"],
    aliases: ["CAR"],
  },
  {
    id: "combat_aircrew_insignia",
    name: "Combat Aircrew Insignia",
    phrases: ["COMBAT AIRCREW"],
  },
  {
    id: "combat_infantryman_badge",
    name: "Combat Infantryman Badge",
    phrases: ["COMBAT INFANTRYMAN BADGE", "COMBAT INFANTRY BADGE"],
    aliases: ["CIB"],
  },
  {
    id: "combat_medical_badge",
    name: "Combat Medical Badge",
    phrases: ["COMBAT MEDICAL BADGE", "COMBAT MEDIC BADGE"],
    aliases: ["CMB"],
  },
  {
    id: "distinguished_flying_cross",
    name: "Distinguished Flying Cross",
    phrases: ["DISTINGUISHED FLYING CROSS"],
    aliases: ["DFC"],
  },
  {
    id: "distinguished_service_cross",
    name: "Distinguished Service Cross",
    phrases: ["DISTINGUISHED SERVICE CROSS"],
    aliases: ["DSC"],
  },
  {
    id: "fmf_combat_operations",
    name: "Fleet Marine Force Combat Operations Insignia",
    phrases: ["FLEET MARINE FORCE COMBAT OPERATIONS", "FMF COMBAT OPERATIONS"],
  },
  {
    id: "joint_service_commendation_v",
    name: 'Joint Service Commendation Medal with "V" Device',
    phrases: ["JOINT SERVICE COMMENDATION MEDAL"],
    requiresDevice: V,
  },
  {
    id: "medal_of_honor",
    name: "Medal of Honor",
    phrases: ["MEDAL OF HONOR"],
    aliases: ["MOH"],
  },
  {
    id: "navy_commendation_v",
    name: 'Navy Commendation Medal with "V" Device',
    phrases: ["NAVY COMMENDATION MEDAL", "NAVY AND MARINE CORPS COMMENDATION"],
    requiresDevice: V,
  },
  {
    id: "navy_cross",
    name: "Navy Cross",
    phrases: ["NAVY CROSS"],
  },
  {
    id: "parachutist_combat_jump",
    name: "Parachutist Badge with Combat Jump Device",
    phrases: ["COMBAT JUMP"],
  },
  {
    id: "purple_heart",
    name: "Purple Heart",
    phrases: ["PURPLE HEART"],
    aliases: ["PH"],
  },
  {
    id: "silver_star",
    name: "Silver Star",
    phrases: ["SILVER STAR"],
  },
];

// Corroborates presence in a theater of operations. Not on VA's combat
// decoration list and never reported as establishing combat.
const THEATER_EVIDENCE_PHRASES = [
  "CAMPAIGN MEDAL",
  "EXPEDITIONARY MEDAL",
  "OVERSEAS SERVICE RIBBON",
  "SEA SERVICE",
  "KOREA DEFENSE SERVICE",
  "ARMED FORCES SERVICE MEDAL",
  "HUMANITARIAN SERVICE",
];

// "C0MBAT ACTI0N BADGE" is what a scanned DD214 actually yields; the same
// zero-for-O substitution is corrected on the extraction side, so correct it
// here too rather than depending on which caller reaches this first.
const normalize = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/(?<=[A-Z])0|0(?=[A-Z])/g, "O")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const isAlnum = (ch) => Boolean(ch) && /[A-Z0-9]/.test(ch);

function containsToken(text, token) {
  let idx = text.indexOf(token);
  while (idx !== -1) {
    const before = idx === 0 ? "" : text[idx - 1];
    const afterIdx = idx + token.length;
    const after = afterIdx >= text.length ? "" : text[afterIdx];
    if (!isAlnum(before) && !isAlnum(after)) return true;
    idx = text.indexOf(token, idx + 1);
  }
  return false;
}

// The four award shapes in circulation: a plain string, veteranProfile's
// {name}, ribbonRackData.parseDD214Text's {award: {name}, matchedText}, and
// dd214VisionParser's {name, abbreviation}.
export function awardDisplayName(item) {
  if (typeof item === "string") return item;
  return item?.name || item?.award?.name || item?.matchedText || "";
}

// Block 13 writes the valor device inline against the abbreviation
// ("ARCOM-2 W/V DEVICE") while the canonical name stays plain, so the
// device qualifier is only visible in matchedText/abbreviation.
const searchableText = (item) => {
  if (typeof item === "string") return item;
  return [item?.name, item?.award?.name, item?.matchedText, item?.abbreviation]
    .filter(Boolean)
    .join(" ");
};

const awardDevices = (item) =>
  Array.isArray(item?.devices) ? item.devices : [];

const hasDevice = (devices, type) =>
  devices.some((d) => (typeof d === "string" ? d : d?.type) === type);

// A "V" spelled out in the award's own name counts: DD214 Block 13 routinely
// writes the device inline ("ARCOM W/V DEVICE") rather than as structured data.
const nameCarriesValorDevice = (normalizedName) =>
  containsToken(normalizedName, "V DEVICE") ||
  containsToken(normalizedName, "W V") ||
  containsToken(normalizedName, "VALOR");

const nameCarriesCombatDevice = (normalizedName) =>
  containsToken(normalizedName, "C DEVICE");

/**
 * The M21-1 1.A.3.h decoration this award is, or null if it is not one.
 * @param {string|Object} award
 * @returns {{id: string, name: string}|null}
 */
export function matchCombatDecoration(award) {
  const normalizedName = normalize(searchableText(award));
  if (!normalizedName) return null;
  const devices = awardDevices(award);

  for (const decoration of COMBAT_DECORATIONS) {
    const phraseHit = (decoration.phrases || []).some((p) =>
      normalizedName.includes(p),
    );
    const aliasHit = (decoration.aliases || []).some((a) =>
      containsToken(normalizedName, a),
    );
    if (!phraseHit && !aliasHit) continue;

    if (decoration.requiresDevice === V) {
      if (!hasDevice(devices, V) && !nameCarriesValorDevice(normalizedName)) {
        continue;
      }
    }
    return { id: decoration.id, name: decoration.name };
  }

  // The "C" device establishes combat conditions on any meritorious-service
  // or achievement award, so it qualifies independently of which award it sits
  // on. Reported under the award's own name, since the decoration is the award.
  if (hasDevice(devices, C) || nameCarriesCombatDevice(normalizedName)) {
    return {
      id: "c_device",
      name: `${awardDisplayName(award)} with "C" Device`,
    };
  }

  return null;
}

export const isCombatDecoration = (award) =>
  matchCombatDecoration(award) !== null;

const isTheaterEvidence = (award) => {
  const normalizedName = normalize(searchableText(award));
  return THEATER_EVIDENCE_PHRASES.some((p) => normalizedName.includes(p));
};

/**
 * Combat determination for a set of awards.
 * `indicators` stays a string array - myPacketManager joins it, the briefing
 * renders it, and dd214FieldExtractor already emits that shape.
 * @param {Array} awards
 * @returns {{hasVerifiedCombat: boolean, indicators: string[], supportingEvidence: string[], citation: string}}
 */
// Every "C" device match shares the id "c_device" but names a different
// award, so the id alone would collapse two differently-decorated awards
// into one indicator.
const decorationKey = (decoration) =>
  decoration.id === "c_device" ? decoration.name : decoration.id;

export function deriveCombatService(awards = []) {
  const indicators = [];
  const supportingEvidence = [];
  const seenIndicators = new Set();
  const seenSupporting = new Set();

  for (const award of Array.isArray(awards) ? awards : []) {
    const decoration = matchCombatDecoration(award);
    if (decoration) {
      const key = decorationKey(decoration);
      if (!seenIndicators.has(key)) {
        seenIndicators.add(key);
        indicators.push(decoration.name);
      }
      continue;
    }
    if (isTheaterEvidence(award)) {
      const name = awardDisplayName(award);
      const key = normalize(name);
      if (name && !seenSupporting.has(key)) {
        seenSupporting.add(key);
        supportingEvidence.push(name);
      }
    }
  }

  return {
    hasVerifiedCombat: indicators.length > 0,
    indicators,
    supportingEvidence,
    citation: COMBAT_PRESUMPTION_CITATION,
  };
}

/**
 * Combat decorations named anywhere in a raw Block 13 / Block 18 text.
 * Segments split on "//" only, after collapsing whitespace: a real scan
 * breaks "C0MBAT" and "ACTI0N BADGE" across a blank line, and degrades some
 * "//" separators to a single "/", so splitting on newlines or single
 * slashes loses the decoration outright (verified against this corpus).
 * Evaluating per segment is what keeps "BRONZE STAR MEDAL" in its own
 * segment from borrowing a "V" device that belongs to a different award.
 * @param {string} text
 * @returns {string[]} decoration names, in list order, deduped
 */
export function findCombatDecorationsInText(text) {
  const segments = String(text || "")
    .replace(/\s+/g, " ")
    .split("//")
    .map((s) => s.trim())
    .filter(Boolean);

  const found = new Map();
  for (const segment of segments) {
    const decoration = matchCombatDecoration(segment);
    if (decoration) found.set(decorationKey(decoration), decoration.name);
  }
  return [...found.values()];
}

/**
 * Union-merges a newly parsed determination into one already stored. Combat
 * is sticky: a veteran's second DD214 that happens to omit Block 13 does not
 * retract a Combat Action Badge established by the first.
 */
export function mergeCombatService(existing, incoming) {
  if (!incoming) return existing || null;
  if (!existing) return { ...incoming };

  const union = (a = [], b = []) => [...new Set([...a, ...b])];
  return {
    ...existing,
    hasVerifiedCombat:
      Boolean(existing.hasVerifiedCombat) ||
      Boolean(incoming.hasVerifiedCombat),
    indicators: union(existing.indicators, incoming.indicators),
    supportingEvidence: union(
      existing.supportingEvidence,
      incoming.supportingEvidence,
    ),
    deployments: union(existing.deployments, incoming.deployments),
    citation: existing.citation || incoming.citation,
  };
}
