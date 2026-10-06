/**
 * Which golden cases the app answers without a model, and with what. The
 * production functions are passed in, so the dry run and the routing check
 * follow the app and cannot drift from it.
 *
 * A case sent straight to generateAI on a rater tool is answered by the
 * calculator or by the fixed request for ratings when it asks for rating
 * arithmetic (src/utils/ratingQuestion.js). On a small-class model
 * (`smallModel`), every other such case with a question gets the fixed
 * open-advice message (src/utils/openAdviceHold.js, ADR-010 section 11).
 * Tool cases follow their own tool, and an empty question gets the app's
 * empty-question reply before either rule applies.
 */
export function noModelAnswerer({
  resolveAgentForTool,
  answerRatingQuestion,
  openAdviceHeldAnswer,
  smallModel = false,
}) {
  const ratingAnswer = (caseDef) =>
    resolveAgentForTool(caseDef.toolId) === "rater"
      ? answerRatingQuestion(caseDef.input, caseDef.conditions, {
          recognise: true,
        })
      : null;
  return (caseDef) => {
    if (caseDef.entry || String(caseDef.input ?? "").trim() === "") return null;
    return (
      ratingAnswer(caseDef) ?? (smallModel ? openAdviceHeldAnswer() : null)
    );
  };
}
