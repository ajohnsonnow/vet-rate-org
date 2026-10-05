import {
  resolveTdiuDraft,
  resolveWriterDraft,
} from "../../../src/utils/writerDraftCheck.js";
import {
  buildAppealStatementTemplate,
  buildBuddyStatementTemplate,
  buildNexusLetterRequestTemplate,
  buildPTSDStressorTemplate,
  buildPersonalStatementTemplate,
  buildRewordPrompt,
  buildTdiuAnalysisTemplate,
  buildTdiuRewordPrompt,
  buildWitnessStatementTemplate,
  formStatementInputs,
  suppliedIn,
} from "../../../src/utils/writerTemplates.js";

/**
 * The production functions a golden-set case may name as its `entry`: the
 * ones the app's own screens call.
 *
 *   args(formInputs, run)   the argument list the browser runner passes to
 *                           the real function
 *   text(result)            the answer text out of the function's own result
 *   failure(result)         its error message, or null
 *   draft(formInputs)       writing tools only: the request the tool sends
 *                           and how it settles the model's reply, rebuilt
 *                           from the same pure modules for the dry run
 *
 * The browser runner maps each name to the function itself
 * (tests/eval/golden-set.spec.ts). Nothing here calls production code that
 * needs a browser. toolEntries.test.js holds `draft` to what the real
 * functions send and return.
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

const isText = (value) => typeof value === "string" && value.trim() !== "";

const statementDraft = ({
  template,
  answers,
  keep = [],
  addressedToReader = false,
}) => ({
  template,
  prompt: buildRewordPrompt(template),
  resolve: (output) =>
    resolveWriterDraft({
      output,
      template,
      inputs: suppliedIn(template, Object.values(answers)),
      keep: keep.filter(isText),
      addressedToReader,
    }),
});

const personalDraft = (answers, condition, primaryCondition) =>
  statementDraft({
    template: buildPersonalStatementTemplate(
      answers,
      condition,
      primaryCondition,
    ),
    answers,
    keep: [condition, primaryCondition],
  });

function formDraft(formType, formData) {
  const mapped = formStatementInputs(formType, formData);
  if (mapped?.kind === "buddy") {
    return statementDraft({
      template: buildBuddyStatementTemplate(mapped.answers, mapped.condition),
      answers: mapped.answers,
      keep: [mapped.condition],
    });
  }
  if (mapped?.kind === "ptsd") {
    return statementDraft({
      template: buildPTSDStressorTemplate(mapped.answers),
      answers: mapped.answers,
    });
  }
  if (mapped?.kind === "personal") {
    return personalDraft(
      mapped.answers,
      mapped.condition,
      mapped.primaryCondition,
    );
  }
  throw new Error(`form type ${formType} has no AI wording step`);
}

function tdiuDraft(disabilities, veteranContext) {
  const template = buildTdiuAnalysisTemplate(disabilities);
  const context = veteranContext
    ? `\n\nVETERAN CASE DATA (for reference only):\n${veteranContext}\n`
    : "";
  return {
    template: JSON.stringify(template),
    prompt: `${buildTdiuRewordPrompt(template)}${context}`,
    resolve: (output) => {
      const { analysis, ...rest } = resolveTdiuDraft({
        output,
        template,
        reference: [veteranContext],
      });
      return { content: JSON.stringify(analysis), ...rest };
    },
  };
}

export const TOOL_ENTRIES = {
  enhancePersonalStatement: {
    ...helperResult,
    args: (i) => [i.answers ?? {}, i.condition, i.primaryCondition ?? null],
    draft: (i) =>
      personalDraft(i.answers ?? {}, i.condition, i.primaryCondition ?? null),
  },
  enhanceFormStatement: {
    ...helperResult,
    args: (i) => [i.formType, i.formData ?? {}],
    draft: (i) => formDraft(i.formType, i.formData ?? {}),
  },
  enhanceAppealStatement: {
    ...helperResult,
    args: (i) => [i.answers ?? {}],
    draft: (i) =>
      statementDraft({
        template: buildAppealStatementTemplate(i.answers ?? {}),
        answers: i.answers ?? {},
        keep: [i.answers?.conditionName],
      }),
  },
  generateNexusLetterRequest: {
    ...helperResult,
    args: (i) => [i.answers ?? {}],
    draft: (i) =>
      statementDraft({
        template: buildNexusLetterRequestTemplate(i.answers ?? {}),
        answers: i.answers ?? {},
        keep: [i.answers?.conditionName, i.answers?.primaryCondition],
        addressedToReader: true,
      }),
  },
  compileWitnessStatement: {
    args: (i) => [i.relationship, i.condition, i.answers ?? {}],
    text: (result) => result?.statement ?? "",
    failure: () => null,
    draft: (i) =>
      statementDraft({
        template: buildWitnessStatementTemplate(
          i.relationship,
          i.condition,
          i.answers ?? {},
        ),
        answers: i.answers ?? {},
        keep: [i.condition],
      }),
  },
  generateVocationalImpact: {
    args: (i) => [i.disabilities ?? [], i.veteranContext ?? ""],
    text: (result) => (result?.analysis ? JSON.stringify(result.analysis) : ""),
    failure: () => null,
    draft: (i) => tdiuDraft(i.disabilities ?? [], i.veteranContext ?? ""),
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
    },
  };
}
