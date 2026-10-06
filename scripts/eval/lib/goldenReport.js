import {
  AUTOMATED_CHECK_IDS,
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
  PASS_THRESHOLD,
  RUBRIC_CRITERIA,
} from "./goldenChecks.js";

const SHORT = {
  [AUTO_PASS]: "pass",
  [AUTO_FAIL]: "FAIL",
  [NEEDS_HUMAN]: "human",
  [NOT_APPLICABLE]: "n/a",
};

const CELL_ESCAPES = {
  "\\": "\\\\",
  "|": "\\|",
  "<": "&lt;",
  ">": "&gt;",
  "`": "'",
};

// Markdown table-cell escaping for model-sourced text; the summary is a .md
// file, never injected into a page.
export function escapeCell(value) {
  return String(value ?? "")
    .replace(/[\\|<>`]/g, (ch) => CELL_ESCAPES[ch])
    .replace(/\s+/g, " ")
    .trim();
}

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const seconds = (ms) => (ms == null ? "-" : `${(ms / 1000).toFixed(1)}s`);

export function tallyChecks(grades) {
  const tally = {};
  for (const id of AUTOMATED_CHECK_IDS) {
    tally[id] = {
      [AUTO_PASS]: 0,
      [AUTO_FAIL]: 0,
      [NEEDS_HUMAN]: 0,
      [NOT_APPLICABLE]: 0,
    };
    for (const grade of grades) tally[id][grade.checks[id].status]++;
  }
  return tally;
}

function rubricCell(grade) {
  const entries = Object.entries(grade.rubric);
  const decided = entries.filter(([, v]) => v !== NEEDS_HUMAN);
  const decidedText = decided.length
    ? decided.map(([id, v]) => `${id} ${SHORT[v]}`).join(", ")
    : "none";
  return `${decidedText}; ${entries.length - decided.length}/${entries.length} human`;
}

function describeDevice(device) {
  if (!device) return "unknown";
  const parts = [];
  if (device.tier) parts.push(`tier ${device.tier}`);
  if (device.gpuDescription) parts.push(`GPU ${device.gpuDescription}`);
  const adapter = device.adapter;
  if (adapter) {
    const text = [
      adapter.vendor,
      adapter.architecture,
      adapter.device,
      adapter.description,
    ]
      .filter(Boolean)
      .join(" ");
    if (text) parts.push(`WebGPU adapter ${text}`);
  }
  if (device.systemRAM) parts.push(`${device.systemRAM} GB RAM reported`);
  if (device.cpuCores) parts.push(`${device.cpuCores} logical cores`);
  if (device.userAgent) parts.push(device.userAgent);
  if (device.note) parts.push(device.note);
  return parts.join("; ") || "unknown";
}

function describeThinking(thinking) {
  if (thinking === undefined || thinking === null) return "?";
  return thinking ? "on" : "off";
}

function describePenalty(settings, cases) {
  if (typeof settings.frequencyPenalty === "number") {
    return `${settings.frequencyPenalty} (set by --frequency-penalty)`;
  }
  const sent = [
    ...new Set(
      (cases ?? [])
        .map((c) => c.frequencyPenalty)
        .filter((v) => typeof v === "number"),
    ),
  ];
  return sent.length
    ? `per-model default (sent ${sent.join(", ")})`
    : "per-model default";
}

function runSection({ meta, runInfo, cases }) {
  const loaded = meta?.modelIdLoaded ?? "unknown";
  const differs = loaded !== "unknown" && loaded !== runInfo.modelId;
  const dirty = runInfo.gitDirty
    ? " (working tree had uncommitted changes)"
    : "";
  const settings = meta?.settings ?? {};
  return [
    `# Golden-set run: ${runInfo.modelId}`,
    "",
    "Automated checks only. Every rubric criterion not listed as decided below is `human`: score it against [JUDGE_RUBRIC.md](../../../src/__tests__/agentic/JUDGE_RUBRIC.md) using the full responses in the transcript.",
    "",
    "## Run",
    "",
    `- Model requested: \`${runInfo.modelId}\``,
    `- Model loaded: \`${loaded}\`${differs ? " (DIFFERS from requested)" : ""}`,
    `- Engine: ${meta?.engine ?? "unknown"}`,
    `- Date: ${runInfo.date}`,
    `- Git commit: \`${runInfo.gitCommit}\`${dirty}`,
    `- Device / GPU: ${escapeCell(describeDevice(meta?.device))}`,
    `- Settings: temperature ${settings.temperature ?? "?"}, max tokens ${settings.maxTokens ?? "?"}, frequency penalty ${describePenalty(settings, cases)}, thinking ${describeThinking(settings.thinking)}, per-case timeout ${settings.timeoutMs ?? "?"} ms; flags: ${settings.flags?.length ? settings.flags.join(", ") : "none"}`,
    `- 38 CFR index: ${escapeCell(runInfo.legalIndexNote)}`,
    `- Transcript: \`${runInfo.transcriptFile}\``,
    "",
  ];
}

function totalsSection({ goldenCases, cases, grades }) {
  const recordedIds = new Set(cases.map((c) => c.id));
  const missing = goldenCases.filter((c) => !recordedIds.has(c.id));
  const missingText = missing.length
    ? ` (missing: ${missing.map((c) => c.id).join(", ")})`
    : "";
  const latencies = cases.map((c) => c.latencyMs).filter((v) => v != null);
  const tally = tallyChecks(grades);
  const lines = [
    "## Totals",
    "",
    `- Cases recorded: ${goldenCases.length - missing.length} of ${goldenCases.length}${missingText}`,
    `- Cases that ended in an error: ${cases.filter((c) => c.error).length}`,
    `- Latency: total ${seconds(latencies.reduce((a, b) => a + b, 0))}, median ${seconds(median(latencies))}`,
    "",
    "| Automated check | pass | FAIL | human | n/a |",
    "|---|---|---|---|---|",
  ];
  for (const id of AUTOMATED_CHECK_IDS) {
    const t = tally[id];
    lines.push(
      `| ${id} | ${t[AUTO_PASS]} | ${t[AUTO_FAIL]} | ${t[NEEDS_HUMAN]} | ${t[NOT_APPLICABLE]} |`,
    );
  }
  const thresholds = ["auditor", "writer", "rater"].map(
    (agent) =>
      `${agent} ${PASS_THRESHOLD[agent]}/${RUBRIC_CRITERIA[agent].length}`,
  );
  lines.push(
    "",
    `Human pass thresholds: ${thresholds.join(", ")}. Human tally: ____ of ${goldenCases.length} cases pass.`,
    "",
  );
  return lines;
}

function kbCell(record) {
  if (record.kbContextInjected == null) return "?";
  if (!record.kbContextInjected) return "0";
  if (record.kbEntryCount == null) return "yes";
  return record.kbShardCount
    ? `${record.kbEntryCount} (${record.kbShardCount} full corpus)`
    : String(record.kbEntryCount);
}

function computedCell(record) {
  if (record.computedResultInjected == null) return "?";
  return record.computedResultInjected ? "yes" : "no";
}

function actualCell(record) {
  if (record.ownSystemPrompt) return "tool's own prompt";
  if (record.modelCalled === false) return "no model called";
  return record.actualAgent ?? "?";
}

function caseRow(caseDef, record, grade) {
  if (!record || !grade) {
    const dashes = AUTOMATED_CHECK_IDS.map(() => "-").join(" | ");
    return `| ${caseDef.id} | ${caseDef.expectedAgent} / not run | ${dashes} | - | - | - | - |  |  |  |`;
  }
  const checks = AUTOMATED_CHECK_IDS.map(
    (id) => SHORT[grade.checks[id].status],
  );
  const note = record.error
    ? `ERROR: ${escapeCell(record.error).slice(0, 120)}`
    : "";
  return [
    `| ${caseDef.id}`,
    `${caseDef.expectedAgent} / ${actualCell(record)}`,
    ...checks,
    escapeCell(rubricCell(grade)),
    kbCell(record),
    computedCell(record),
    seconds(record.latencyMs),
    "",
    "",
    `${note} |`,
  ].join(" | ");
}

function casesSection({ goldenCases, cases, grades }) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const gradeById = new Map(grades.map((g) => [g.id, g]));
  const header = `| Case | Agent (expected / actual) | ${AUTOMATED_CHECK_IDS.join(" | ")} | Rubric criteria decided automatically | KB entries | Computed block | Latency | Human score | Pass (Y/N) | Notes |`;
  const divider = `|---|---|${AUTOMATED_CHECK_IDS.map(() => "---").join("|")}|---|---|---|---|---|---|---|`;
  const rows = goldenCases.map((c) =>
    caseRow(c, byId.get(c.id), gradeById.get(c.id)),
  );
  return ["## Cases", "", header, divider, ...rows, ""];
}

function failuresSection(grades) {
  const failures = [];
  for (const grade of grades) {
    for (const id of AUTOMATED_CHECK_IDS) {
      const check = grade.checks[id];
      if (check.status === AUTO_FAIL) {
        failures.push(`- ${grade.id} ${id}: ${escapeCell(check.detail)}`);
      }
    }
  }
  return [
    "## Automated failures",
    "",
    failures.length ? failures.join("\n") : "None.",
    "",
  ];
}

function toolCasesSection({ goldenCases, cases, grades }) {
  const toolCases = goldenCases.filter((c) => c.entry);
  if (toolCases.length === 0) return [];
  const byId = new Map(cases.map((c) => [c.id, c]));
  const gradeById = new Map(grades.map((g) => [g.id, g]));
  const rows = toolCases.map((caseDef) => {
    const record = byId.get(caseDef.id);
    const check = gradeById.get(caseDef.id)?.checks["draft-returned"];
    const path = record?.draftPath ?? (record ? "-" : "not run");
    const detail = record?.error
      ? `ERROR: ${record.error}`
      : (check?.detail ?? "");
    return `| ${caseDef.id} | ${escapeCell(caseDef.entry)} | ${path} | ${escapeCell(detail).slice(0, 300)} |`;
  });
  return [
    "## Tool cases",
    "",
    "These cases call the function the app's own screen calls, with form inputs, so the request is the tool's own. A writing tool sends the model only the passages someone typed, and places each accepted rewording into its app-built draft. Draft path: `model` means at least one passage was reworded and accepted; `template` means the app-built draft was returned as it is (nothing to reword, nothing changed, nothing accepted, or the model did not answer).",
    "",
    "| Case | Entry point | Draft path | Detail |",
    "|---|---|---|---|",
    ...rows,
    "",
  ];
}

const NOTES = [
  "- `routing`: the persona system prompt the engine received, matched against the SWARM_AGENTS prompts, versus the case's expected agent.",
  "- `calc-match`: only for cases with structured conditions in the golden set; the combined rating the response states must equal calculateVARating and be a multiple of 10. For a model's answer, several different stated figures, or none, is `human`.",
  "- `cfr-in-index`: every `38 CFR` section cited must appear as a citation in the legal index (public/legal-index chunk file). The index covers what was ingested, so a FAIL means not found in the index; confirm against eCFR before calling it a fabrication.",
  "- `no-spotlight-echo`: the literal untrusted-content tag must not appear in the response.",
  "- `no-new-pii`: no SSN-shaped string and no labeled date-of-birth-shaped string that is absent from the case input (for a tool case, its form inputs and attached document). Unlabeled dates are not flagged.",
  "- `draft-returned`: writing-tool cases only; the tool handed back a draft, with or without reworded passages. It says a draft exists, not that it is good: score the response as usual.",
  "- `routing` is `n/a` for a tool case that made no model call because the form held nothing typed to reword.",
  "- `routing` is `n/a` for a rater case with structured conditions: the calculator answers it and no model is called. A model call on such a case is a `routing` FAIL.",
  "- `calc-match` on those cases reads the sentence in which the calculator's answer states the combined rating. The text is the calculator's, so grade it on whether the working is correct and clear, not on model behaviour.",
  "- `routing` on tool cases: the statement helper and the Decision Decoder send their own system prompt, so the engine receives that and no persona prompt. For those cases routing passes when the engine received the tool's own prompt, and the agent column says so.",
];

export function renderSummary({ meta, runInfo, goldenCases, cases, grades }) {
  return [
    ...runSection({ meta, runInfo, cases }),
    ...totalsSection({ goldenCases, cases, grades }),
    ...casesSection({ goldenCases, cases, grades }),
    ...toolCasesSection({ goldenCases, cases, grades }),
    ...failuresSection(grades),
    "## Notes on the automated checks",
    "",
    ...NOTES,
    "",
  ].join("\n");
}
