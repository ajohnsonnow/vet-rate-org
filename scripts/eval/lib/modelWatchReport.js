/**
 * Builds the Markdown report and the JSON result. Every value that reaches
 * either comes from the validated shapes in modelWatchClassify.js (strict ids,
 * tokens, numbers, ISO dates) or from fixed text in this file.
 */
import {
  KIND_LABELS,
  TIER_THRESHOLDS,
  compareRuntime,
} from "./modelWatchClassify.js";

export const OUTCOME_EXIT_CODES = {
  quiet: 0,
  "source-error": 1,
  candidates: 2,
};

export function buildResult({
  now,
  gathered,
  classification,
  runtimePackages,
  tiers = TIER_THRESHOLDS,
}) {
  const newerRuntime = runtimePackages.filter((p) => p.newer);
  let outcome = "quiet";
  if (gathered.errors.length) outcome = "source-error";
  else if (classification.candidates.length || newerRuntime.length) {
    outcome = "candidates";
  }
  const ignoredCounts = {};
  for (const { reason } of classification.ignored) {
    ignoredCounts[reason] = (ignoredCounts[reason] ?? 0) + 1;
  }
  return {
    schema: 1,
    generatedAt: new Date(now).toISOString(),
    outcome,
    exitCode: OUTCOME_EXIT_CODES[outcome],
    sourceErrors: gathered.errors,
    sourcesOk: gathered.sourcesOk,
    tiers,
    appModels: gathered.appModels,
    runtimePackages,
    candidates: classification.candidates,
    unplacedTextModels: classification.unplaced,
    ignoredCounts,
    rejectedByIdPattern: gathered.rejected,
  };
}

export function runtimeComparisons(declared, latest) {
  return Object.keys(latest).map((name) =>
    compareRuntime(name, declared[name] ?? "", latest[name]),
  );
}

function vramCell(c) {
  if (c.vramMb === null) return "n/a";
  return `${c.vramEstimated ? "~" : ""}${Math.round(c.vramMb)}${c.vramEstimated ? " (est.)" : ""}`;
}

function commandCell(c) {
  if (c.goldenSetCommand) {
    const note = c.inWebllmPrebuiltList
      ? ""
      : " (not in the WebLLM prebuilt list; the runner only loads ids the installed build lists)";
    return `\`${c.goldenSetCommand}\`${note}`;
  }
  return "no golden-set path (it drives WebLLM text only)";
}

function runtimeStatus(p) {
  if (!p.newer) return "current";
  return p.inRange
    ? "newer release published, inside the declared range"
    : "newer release published, outside the declared range";
}

function appModelLines(appModels) {
  const roles = new Map();
  for (const m of appModels) {
    roles.set(m.id, [...(roles.get(m.id) ?? []), m.role]);
  }
  return [...roles].map(([id, r]) => `- \`${id}\` (${r.join("; ")})`);
}

const MAX_ROWS = 100;

function failedSourceLines(result) {
  if (!result.sourceErrors.length) return [];
  return [
    "## Sources that failed",
    "",
    ...result.sourceErrors.map((e) => `- \`${e.source}\`: ${e.message}`),
    "",
    "Findings below are incomplete until every source is fetched.",
    "",
  ];
}

function candidateRow(c) {
  const licence =
    c.licenceStatus === "ok" ? c.licence : `${c.licence} (review)`;
  return `| \`${c.id}\` | ${KIND_LABELS[c.kind]} | ${c.tier ?? "n/a"} | ${vramCell(c)} | ${licence} | ${c.source} | ${c.variants.length} | ${commandCell(c)} |`;
}

function candidateLines(result) {
  const head = ["## New candidates to evaluate", ""];
  if (!result.candidates.length) {
    return [...head, "None since the last snapshot.", ""];
  }
  const rows = result.candidates.slice(0, MAX_ROWS).map(candidateRow);
  const more = result.candidates.length - MAX_ROWS;
  return [
    ...head,
    "| Model id | Kind | Tier | VRAM MB | Licence | Source | Variants | Golden-set command |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    ...(more > 0 ? ["", `${more} more rows are in the JSON file.`] : []),
    "",
    'Licence "unknown" means the fetched data carried no licence tag (mlc-ai repos usually carry none); check the model card.',
    "",
    "Each row is a new candidate to evaluate: new since the snapshot and it fits a tier or kind the app uses. Quality is unknown until the golden set has been run and compared with the recorded baseline (`src/__tests__/agentic/JUDGE_RUBRIC.md`). Rows marked review need a licence check before any use.",
    "",
  ];
}

function runtimeLines(result) {
  return [
    "## Runtime packages",
    "",
    "| Package | package.json | Latest on npm | Status |",
    "| --- | --- | --- | --- |",
    ...result.runtimePackages.map(
      (p) =>
        `| \`${p.name}\` | \`${p.declared}\` | \`${p.latest}\` | ${runtimeStatus(p)} |`,
    ),
    "",
  ];
}

function tierLines(result) {
  return [
    "## Tier thresholds",
    "",
    "Ceilings on WebLLM `vram_required_MB`, anchored on the models the app loads today (laptop and tablet: Qwen2.5-1.5B, up to 1889 MB; desktop: Qwen2.5-3B and Llama-3.2-3B, up to 2952 MB). The phone ceiling is a judgment value, since the app runs no text model on phones. Models with no VRAM figure are placed from the parameter count in their id (marked est.).",
    "",
    ...result.tiers.map((t) => `- ${t.tier}: up to ${t.maxVramMb} MB`),
    "",
  ];
}

function setAsideLines(result) {
  const lines = Object.entries(result.ignoredCounts).map(
    ([reason, n]) => `- ${n} new model(s): ${reason}`,
  );
  const unplaced = result.unplacedTextModels;
  if (unplaced.length) {
    const ids = unplaced
      .slice(0, 20)
      .map((id) => `\`${id}\``)
      .join(", ");
    lines.push(
      `- ${unplaced.length} new text model(s) with no VRAM figure and no size in the id: ${ids}`,
    );
  }
  if (result.rejectedByIdPattern) {
    lines.push(
      `- ${result.rejectedByIdPattern} entry(ies) dropped because the id did not match the strict id pattern`,
    );
  }
  return [
    "## Not listed",
    "",
    ...(lines.length ? lines : ["Nothing was set aside."]),
    "",
  ];
}

export function renderMarkdown(result) {
  const lines = [
    "# Model watch",
    "",
    `Generated ${result.generatedAt}. Outcome: **${result.outcome}**.`,
    "",
    ...failedSourceLines(result),
    ...candidateLines(result),
    ...runtimeLines(result),
    ...tierLines(result),
    "## Models the app uses today",
    "",
    ...appModelLines(result.appModels),
    "",
    ...setAsideLines(result),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderSummary(result) {
  return `model-watch: ${result.outcome} (${result.candidates.length} candidate(s), ${result.runtimePackages.filter((p) => p.newer).length} newer runtime package(s), ${result.sourceErrors.length} source error(s))`;
}
