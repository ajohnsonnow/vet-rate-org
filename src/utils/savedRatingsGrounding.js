/**
 * Grounds an assistant question about the veteran's combined rating or TDIU
 * in the ratings saved in My Ratings, so the answer leads with the
 * calculator's working (unifiedAIService enforceCalculatorOnResult).
 */

import { mentionsUnemployability } from "./raterGrounding";
import { getMyRatings } from "./veteranProfile";

const COMBINED_RATING_QUESTION =
  /\bcombined (?:disability |va )?rating\b|\bbilateral factor\b|\bva math\b|\b(?:total|overall) (?:disability |va )?rating\b/i;

// A question that brings its own figures ("combined rating for 50% and 30%")
// is not about the saved ratings; answering it from them would mislead.
const OWN_FIGURES = /\d{1,3}\s*(?:%|percent)/i;

const toCondition = ({ name, rating, side, bodyPart }) => ({
  name,
  rating: Number(rating),
  side,
  bodyPart,
});

const isUsable = (r) =>
  typeof r?.name === "string" &&
  r.name.trim() !== "" &&
  Number.isFinite(Number(r.rating));

/**
 * generateAI options for a question the saved ratings can answer, or null.
 * conditionsOnDeviceOnly keeps the ratings out of any request that leaves the
 * device; the calculator's working is added to the answer locally either way.
 */
export function savedRatingsGrounding(question, ratings = getMyRatings()) {
  const text = String(question ?? "");
  const asksTdiu = mentionsUnemployability(text);
  if (!asksTdiu && !COMBINED_RATING_QUESTION.test(text)) return null;
  if (OWN_FIGURES.test(text)) return null;
  const conditions = (Array.isArray(ratings) ? ratings : [])
    .filter(isUsable)
    .map(toCondition);
  if (conditions.length === 0) return null;
  return {
    toolId: asksTdiu ? "tdiu-builder" : "rating-calculator",
    conditions,
    conditionsOnDeviceOnly: true,
  };
}

const sideNote = (side) => (side && side !== "none" ? ` (${side})` : "");

export const describeSavedRatings = (conditions) => {
  const list = conditions
    .map((c) => `${c.name} ${c.rating}%${sideNote(c.side)}`)
    .join(", ");
  return `This uses the ratings saved in My Ratings: ${list}.`;
};
