/**
 * Routes an assistant question about a combined rating, the bilateral factor
 * or the TDIU percentage thresholds to the calculator, so no model works the
 * figures out (unifiedAIService _answerWithoutModel). The ratings saved in My
 * Ratings go with it when the question brings no figures of its own.
 */

import { mentionsUnemployability } from "./raterGrounding";
import { asksRatingArithmetic } from "./ratingQuestion";
import { getMyRatings } from "./veteranProfile";

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
 * generateAI options for a rating question, or null for any other question.
 * generateAI answers such a call without calling a model, so the ratings
 * never leave the device: from the saved ratings passed here, from ratings
 * the question lists, or with a fixed request for them.
 */
export function ratingQuestionGrounding(question, ratings = getMyRatings()) {
  const text = String(question ?? "");
  if (!asksRatingArithmetic(text)) return null;
  const toolId = mentionsUnemployability(text)
    ? "tdiu-builder"
    : "rating-calculator";
  if (OWN_FIGURES.test(text)) return { toolId };
  const conditions = (Array.isArray(ratings) ? ratings : [])
    .filter(isUsable)
    .map(toCondition);
  return conditions.length > 0 ? { toolId, conditions } : { toolId };
}

const sideNote = (side) => (side && side !== "none" ? ` (${side})` : "");

export const describeSavedRatings = (conditions) => {
  const list = conditions
    .map((c) => `${c.name} ${c.rating}%${sideNote(c.side)}`)
    .join(", ");
  return `This uses the ratings saved in My Ratings: ${list}.`;
};
