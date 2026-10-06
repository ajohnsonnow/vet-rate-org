/**
 * Which golden cases the app answers without a model, and with what. A case
 * sent straight to generateAI on a rater tool is answered by the calculator
 * or by the fixed request for ratings when it asks for rating arithmetic
 * (src/utils/ratingQuestion.js). The production functions are passed in, so
 * the dry run and the routing check follow the app and cannot drift from it.
 */
export function noModelAnswerer({ resolveAgentForTool, answerRatingQuestion }) {
  return (caseDef) =>
    !caseDef.entry && resolveAgentForTool(caseDef.toolId) === "rater"
      ? answerRatingQuestion(caseDef.input, caseDef.conditions, {
          recognise: true,
        })
      : null;
}
