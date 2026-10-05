import {
  draftAfterModelError,
  resolvePassageDraft,
  standardDraft,
} from "../../../src/utils/writerDraftCheck.js";
import {
  STANDARD_DRAFT_NOTE,
  appealStatementPlan,
  buildPassagePrompt,
  buildTdiuAnalysisTemplate,
  formStatementPlan,
  nexusRequestPlan,
  personalStatementPlan,
  selectPassages,
  witnessStatementPlan,
} from "../../../src/utils/writerTemplates.js";

/**
 * The production functions a golden-set case may name as its `entry`: the
 * ones the app's own screens call.
 *
 *   args(formInputs, run)   the argument list the browser runner passes to
 *                           the real function
 *   text(result)            the answer text out of the function's own result
 *   failure(result)         its error message, or null
 *   draft(formInputs)       writing tools only: what the tool sends and how
 *                           it settles the model's reply, rebuilt from the
 *                           same pure modules for the dry run. `prompt` is
 *                           null when the tool makes no model call (the form
 *                           has no free-text passage to reword).
 *
 * The browser runner maps each name to the function itself
 * (tests/eval/golden-set.spec.ts). Nothing here calls production code that
 * needs a browser. toolEntries.production.test.js holds `draft` to what the
 * real functions send and return.
 */

/*
 * The statement helper and the Decision Decoder pass generateAI their own
 * system prompt, which the engine receives in place of a persona prompt
 * (with any knowledge-base context appended). An entry that does this names
 * the prompt here, and routing for its cases means: the engine got that
 * prompt. toolEntries.production.test.js holds these to the real calls.
 */
export const HELPER_SYSTEM_PROMPT =
  "You are a helpful assistant specializing in VA disability claims and veteran benefits. You help veterans write accurate, compelling statements for their claims.";
export const DECODER_SYSTEM_PROMPT =
  "You are a VA claims expert. Respond only with valid JSON.";

const helperResult = {
  ownSystemPrompt: HELPER_SYSTEM_PROMPT,
  text: (result) => result?.content ?? "",
  failure: (result) => (result?.success ? null : (result?.error ?? "failed")),
};

function planDraft(plan) {
  const sent = selectPassages(plan);
  const passages = sent.map((passage) => passage.text);
  return {
    template: plan.build(plan.answers),
    passages,
    prompt: sent.length > 0 ? buildPassagePrompt(passages) : null,
    resolve: (reply) =>
      sent.length > 0
        ? resolvePassageDraft({ plan, sent, reply })
        : standardDraft(plan),
    afterError: (error) => draftAfterModelError(plan, sent, error),
  };
}

function formDraft(formType, formData) {
  const plan = formStatementPlan(formType, formData);
  if (!plan) throw new Error(`form type ${formType} has no AI wording step`);
  return planDraft(plan);
}

function tdiuDraft(disabilities) {
  const template = JSON.stringify(buildTdiuAnalysisTemplate(disabilities));
  return {
    template,
    passages: [],
    prompt: null,
    resolve: () => ({
      content: template,
      draftPath: "template",
      draftNote: STANDARD_DRAFT_NOTE,
      draftRejectReasons: [],
      passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
    }),
  };
}

export const TOOL_ENTRIES = {
  enhancePersonalStatement: {
    ...helperResult,
    args: (i) => [i.answers ?? {}, i.condition, i.primaryCondition ?? null],
    draft: (i) =>
      planDraft(
        personalStatementPlan(
          i.answers ?? {},
          i.condition,
          i.primaryCondition ?? null,
        ),
      ),
  },
  enhanceFormStatement: {
    ...helperResult,
    args: (i) => [i.formType, i.formData ?? {}],
    draft: (i) => formDraft(i.formType, i.formData ?? {}),
  },
  enhanceAppealStatement: {
    ...helperResult,
    args: (i) => [i.answers ?? {}],
    draft: (i) => planDraft(appealStatementPlan(i.answers ?? {})),
  },
  generateNexusLetterRequest: {
    ...helperResult,
    args: (i) => [i.answers ?? {}],
    draft: (i) => planDraft(nexusRequestPlan(i.answers ?? {})),
  },
  compileWitnessStatement: {
    args: (i) => [i.relationship, i.condition, i.answers ?? {}],
    text: (result) => result?.statement ?? "",
    failure: () => null,
    draft: (i) =>
      planDraft(
        witnessStatementPlan(i.relationship, i.condition, i.answers ?? {}),
      ),
  },
  generateVocationalImpact: {
    args: (i) => [i.disabilities ?? []],
    text: (result) => (result?.analysis ? JSON.stringify(result.analysis) : ""),
    failure: () => null,
    draft: (i) => tdiuDraft(i.disabilities ?? []),
  },
  decodeDecision: {
    ownSystemPrompt: DECODER_SYSTEM_PROMPT,
    args: (i, run) => [i.documentText, { timeout: run?.timeoutMs }],
    text: (result) => (result?.data ? JSON.stringify(result.data) : ""),
    failure: (result) => (result?.success ? null : (result?.error ?? "failed")),
  },
};

export const TOOL_ENTRY_NAMES = Object.keys(TOOL_ENTRIES);

export const isWritingEntry = (entry) =>
  typeof TOOL_ENTRIES[entry]?.draft === "function";

/**
 * Turn what the real function returned into the outcome fields the record
 * builder reads. `outcome.toolResult` is the function's own return value.
 */
export function normalizeToolOutcome(entry, outcome) {
  const spec = TOOL_ENTRIES[entry];
  if (!spec || !outcome?.ok) return outcome;
  const result = outcome.toolResult;
  const failure = spec.failure(result);
  return {
    ...outcome,
    ok: failure === null,
    ...(failure === null ? {} : { error: failure }),
    text: spec.text(result),
    tool: {
      draftPath: result?.draftPath ?? null,
      draftNote: result?.draftNote ?? null,
      draftRejectReasons: result?.draftRejectReasons ?? [],
      draftErrorReason: result?.draftErrorReason ?? null,
      passages: result?.passages ?? null,
    },
    // The tool handed back its app-built draft because the engine failed.
    // The case is answered, but the engine may still be busy or wedged.
    ...(result?.draftErrorReason ? { needsRecovery: true } : {}),
  };
}
