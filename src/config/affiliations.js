/**
 * affiliations.js — shared registry for service branches and affiliation palettes.
 *
 * This is a pure data/config module (no React). Consumed by:
 *   - BDDBuilder.jsx (SERVICE_BRANCHES for the branch selector)
 *   - ThemeContext.jsx (PALETTES / VALID_PALETTES for palette state + class wiring)
 *   - AffiliationPicker.jsx (Sprint 4 — reads PALETTES for the UI)
 *
 * Palette ids MUST match the spec in docs/AFFILIATION_PALETTES.md exactly (kebab-case).
 */

// ─────────────────────────────────────────────────────────────
// SERVICE BRANCHES
// Moved verbatim from BDDBuilder.jsx (lines 30-39).
// ─────────────────────────────────────────────────────────────
export const SERVICE_BRANCHES = [
  { id: "army", label: "U.S. Army", icon: "⭐" },
  { id: "navy", label: "U.S. Navy", icon: "⚓" },
  { id: "air-force", label: "U.S. Air Force", icon: "🛩️" },
  { id: "marines", label: "U.S. Marine Corps", icon: "🦅" },
  { id: "coast-guard", label: "U.S. Coast Guard", icon: "⚓" },
  { id: "space-force", label: "U.S. Space Force", icon: "🚀" },
  { id: "national-guard", label: "National Guard (Title 10)", icon: "🏛️" },
  { id: "reserves", label: "Reserves (Title 10)", icon: "🎖️" },
];

// ─────────────────────────────────────────────────────────────
// AFFILIATION PALETTES
// Ordered list of every affiliation a user can choose.
// Groups match spec Section 3: Default / Branch / Inclusive / Remembrance.
// Descriptions are short, respectful one-liners; cultural notes follow spec Section 4.
// ─────────────────────────────────────────────────────────────
export const PALETTES = [
  // ── Default ──────────────────────────────────────────────
  {
    id: "default",
    label: "Vet-Rate default",
    group: "Default",
    icon: "🎨",
    description:
      "The original Vet-Rate green and gold — no branch affiliation.",
  },

  // ── Branch ───────────────────────────────────────────────
  {
    id: "army",
    label: "U.S. Army",
    group: "Branch",
    icon: "🪖",
    description: "Army black and gold — honoring soldiers of the U.S. Army.",
  },
  {
    id: "navy",
    label: "U.S. Navy",
    group: "Branch",
    icon: "⚓",
    description: "Navy blue and gold — honoring sailors of the U.S. Navy.",
  },
  {
    id: "air-force",
    label: "U.S. Air Force",
    group: "Branch",
    icon: "🛩️",
    description:
      "Air Force blue and silver — honoring airmen of the U.S. Air Force.",
  },
  {
    id: "marines",
    label: "U.S. Marine Corps",
    group: "Branch",
    icon: "🦅",
    description:
      "Scarlet and gold — honoring Marines of the U.S. Marine Corps.",
  },
  {
    id: "coast-guard",
    label: "U.S. Coast Guard",
    group: "Branch",
    icon: "🛟",
    description:
      "Coast Guard blue and orange — honoring those who guard our coasts.",
  },
  {
    id: "space-force",
    label: "U.S. Space Force",
    group: "Branch",
    icon: "🚀",
    description:
      "Space Force midnight blue and silver — honoring Guardians of the newest branch.",
  },
  {
    id: "national-guard",
    label: "National Guard",
    group: "Branch",
    icon: "🏛️",
    description:
      "Guard navy and gold — honoring the men and women of the National Guard.",
  },
  {
    id: "reserves",
    label: "Reserves",
    group: "Branch",
    icon: "🎖️",
    description:
      "Reserves green and gold — honoring the service of all Reserve component members.",
  },

  // ── Inclusive ────────────────────────────────────────────
  {
    id: "pride",
    label: "LGBTQ+ Veterans",
    group: "Inclusive",
    icon: "🏳️‍🌈",
    description:
      "Intersex-Inclusive Progress Pride colors — honoring LGBTQ+ veterans who served with distinction.",
  },
  {
    id: "flag",
    label: "American Flag",
    group: "Inclusive",
    icon: "🇺🇸",
    description:
      "Old Glory red, white, and blue — a universal expression of service and country.",
  },

  // ── Remembrance ──────────────────────────────────────────
  {
    id: "pow-mia",
    label: "POW/MIA",
    group: "Remembrance",
    icon: "🖤",
    description:
      "Black and grayscale — a somber tribute to prisoners of war and those still missing in action. You Are Not Forgotten.",
  },
  {
    id: "gold-star",
    label: "Gold Star Families",
    group: "Remembrance",
    icon: "⭐",
    description:
      "Honoring Gold Star families — those who have lost a loved one in service to the nation.",
  },
  {
    id: "purple-heart",
    label: "Purple Heart",
    group: "Remembrance",
    icon: "💜",
    description:
      "Purple and gold — honoring service members wounded or killed in action.",
  },
  {
    id: "women-veterans",
    label: "Women Veterans",
    group: "Remembrance",
    icon: "♀️",
    description:
      "Plum and teal — honoring the generations of women who have served in the U.S. military.",
  },
  {
    id: "juneteenth",
    label: "Juneteenth",
    group: "Remembrance",
    icon: "🕊️",
    description:
      "Drawn from the Juneteenth flag — celebrating freedom and honoring Black veterans' contributions to American liberty.",
  },
  {
    id: "native-code-talker",
    label: "Native Code Talkers",
    group: "Remembrance",
    icon: "🪶",
    description:
      "Earth-tone red and ochre — honoring Native American Code Talkers whose unbreakable language helped secure Allied victory.",
  },
];

// ─────────────────────────────────────────────────────────────
// VALID PALETTE IDS — for fast validation in ThemeContext
// ─────────────────────────────────────────────────────────────
export const VALID_PALETTES = new Set(PALETTES.map((p) => p.id));
