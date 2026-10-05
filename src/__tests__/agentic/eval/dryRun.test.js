import { describe, it, expect, afterAll } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateVARating } from "../../../utils/vaCalculator";
import { resolveAgentForTool } from "../../../utils/agentBoundaries";
import { SWARM_AGENTS } from "../../../utils/diamondSwarm";
import {
  AUTOMATED_CHECK_IDS,
  AUTO_FAIL,
} from "../../../../scripts/eval/lib/goldenChecks.js";
import {
  DRY_RUN_EXPECTATIONS,
  DRY_RUN_LEGAL_SECTIONS,
  DRY_RUN_MODEL_ID,
  assertDryRunDraftPaths,
  assertDryRunExpectations,
  buildDryRunTranscript,
} from "../../../../scripts/eval/lib/dryRun.js";
import {
  loadGoldenSet,
  selectCases,
} from "../../../../scripts/eval/lib/goldenSet.js";
import { parseArgs } from "../../../../scripts/eval/lib/cliArgs.js";
import {
  appendTranscript,
  claimRunFiles,
  finalizeRun,
} from "../../../../scripts/eval/lib/runArtifacts.js";

const GOLDEN_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "golden-set.jsonl",
);
const goldenCases = loadGoldenSet(GOLDEN_PATH);
const personaPrompts = Object.fromEntries(
  Object.values(SWARM_AGENTS).map((a) => [a.id, a.systemPrompt]),
);
const settings = { temperature: 0, maxTokens: 1024, timeoutMs: 1000 };
const ctx = {
  calculateVARating,
  legalSections: DRY_RUN_LEGAL_SECTIONS,
  legalIndexNote: "fixture",
};

const tmpDirs = [];
const makeTmp = () => {
  const dir = mkdtempSync(join(tmpdir(), "golden-dry-"));
  tmpDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

const runInfo = (files) => ({
  modelId: DRY_RUN_MODEL_ID,
  date: "2026-10-04T00:00:00.000Z",
  gitCommit: "abc",
  gitDirty: false,
  legalIndexNote: "fixture",
  transcriptFile: `${files.name}.jsonl`,
});

function dryRun(dir) {
  const files = claimRunFiles(dir, DRY_RUN_MODEL_ID);
  appendTranscript(
    files.transcriptPath,
    buildDryRunTranscript({
      cases: goldenCases,
      personaPrompts,
      resolveAgentForTool,
      calculateVARating,
      settings,
    }),
  );
  const out = finalizeRun({
    transcriptPath: files.transcriptPath,
    summaryPath: files.summaryPath,
    goldenCases,
    ctx,
    runInfo: runInfo(files),
  });
  return { files, ...out };
}

describe("dry run end to end", () => {
  const dir = makeTmp();
  const run = dryRun(dir);

  it("records every case and meets every canned expectation", () => {
    expect(run.cases).toHaveLength(goldenCases.length);
    expect(assertDryRunExpectations(run.grades)).toEqual([]);
  });

  it("records the draft path each tool case took", () => {
    expect(assertDryRunDraftPaths(run.cases)).toEqual([]);
    const byId = new Map(run.cases.map((c) => [c.id, c]));
    expect(byId.get("t01")).toMatchObject({
      entry: "enhancePersonalStatement",
      draftPath: "model",
      draftNote: null,
      requestMatch: "matched",
    });
    expect(byId.get("t03")).toMatchObject({
      draftPath: "template",
      draftRejectReasons: ["not a draft: refusal"],
    });
    expect(byId.get("t03").response).toContain(
      "[how you have seen the condition affect the veteran's daily life]",
    );
    expect(byId.get("a07")).not.toHaveProperty("draftPath");
  });

  it("reports a tool case that took the wrong path", () => {
    const flipped = run.cases.map((c) =>
      c.id === "t03" ? { ...c, draftPath: "model" } : c,
    );
    expect(assertDryRunDraftPaths(flipped)).toEqual([
      "t03 draft path: expected template, got model",
    ]);
  });

  it("every automated check is failed by at least one canned response", () => {
    for (const id of AUTOMATED_CHECK_IDS) {
      const failing = run.grades.filter(
        (g) => g.checks[id].status === AUTO_FAIL,
      );
      expect(failing.length, `${id} has no canned failure`).toBeGreaterThan(0);
    }
  });

  it("writes a summary with the table, totals, model, commit and device", () => {
    const md = readFileSync(run.files.summaryPath, "utf8");
    expect(md).toContain("# Golden-set run: dry-run-stub");
    expect(md).toContain("- Git commit: `abc`");
    expect(md).toContain("- Device / GPU:");
    expect(md).toContain("- Date: 2026-10-04");
    expect(md).toContain("| Case | Agent (expected / actual) |");
    expect(md).toContain("| Human score | Pass (Y/N) | Notes |");
    expect(md).toContain("## Totals");
    expect(md).toMatch(/\| a20 \| writer \/ rater \| FAIL \|/);
    const rows = md
      .split("## Tool cases")[0]
      .split("\n")
      .filter((l) => /^\| [at]\d\d /.test(l));
    expect(rows).toHaveLength(goldenCases.length);
    for (const row of rows) {
      expect(row.split(/(?<!\\)\|/)).toHaveLength(17);
    }
    expect(md).toContain("| t03 | enhanceFormStatement | template |");
    expect(md).toContain("| t01 | writer / tool's own prompt | pass |");
    expect(md).toContain("| t04 | writer / writer | pass |");
    expect(md).toContain("| t06 | generateNexusLetterRequest | - |");
  });

  it("transcript file name carries the date and model id", () => {
    expect(run.files.name).toMatch(/^run_\d{4}-\d{2}-\d{2}_\d{6}_dry-run-stub/);
  });

  it("records the real persona fingerprints in the meta line", () => {
    expect(run.meta.personaFingerprints.rater).toBe(
      "7584c59adf89a44ad3bb0dd64887c409f8cbd71568286f6d25aaa03c5738a057",
    );
  });
});

describe("dry run expectations bite", () => {
  it("reports a problem when a check stops detecting its failure", () => {
    const run = dryRun(makeTmp());
    const broken = run.grades.map((g) =>
      g.id === "a04"
        ? {
            ...g,
            checks: {
              ...g.checks,
              "no-new-pii": { status: "auto-pass", detail: "" },
            },
          }
        : g,
    );
    expect(assertDryRunExpectations(broken)).toEqual([
      "a04 no-new-pii: expected auto-fail, got auto-pass",
    ]);
  });

  it("reports a missing graded case", () => {
    const run = dryRun(makeTmp());
    const without = run.grades.filter((g) => g.id !== "a02");
    expect(assertDryRunExpectations(without)).toContain(
      "a02: not graded (case missing from this run)",
    );
  });

  it("every expectation names a real golden-set case", () => {
    const ids = new Set(goldenCases.map((c) => c.id));
    for (const id of Object.keys(DRY_RUN_EXPECTATIONS)) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("run files", () => {
  it("never overwrites an earlier run, even in the same second", () => {
    const dir = makeTmp();
    const when = new Date("2026-10-04T12:00:00Z");
    const first = claimRunFiles(dir, "Model-A", when);
    appendTranscript(first.transcriptPath, [{ type: "meta", marker: "first" }]);
    const second = claimRunFiles(dir, "Model-A", when);
    expect(second.transcriptPath).not.toBe(first.transcriptPath);
    expect(second.name).toBe(`${first.name}-2`);
    expect(readFileSync(first.transcriptPath, "utf8")).toContain("first");
    expect(existsSync(second.summaryPath)).toBe(true);
  });
});

describe("launcher argument parsing", () => {
  it("defaults to temperature 0 and 1024 tokens", () => {
    const opts = parseArgs(["--model", "Qwen3-4B-q4f16_1-MLC"]);
    expect(opts).toMatchObject({
      model: "Qwen3-4B-q4f16_1-MLC",
      temperature: 0,
      maxTokens: 1024,
      dryRun: false,
      cases: [],
    });
  });

  it("reads cases and numeric flags", () => {
    const opts = parseArgs([
      "--dry-run",
      "--cases",
      "a01, a11",
      "--temperature",
      "0.3",
      "--max-tokens",
      "256",
    ]);
    expect(opts).toMatchObject({
      dryRun: true,
      cases: ["a01", "a11"],
      temperature: 0.3,
      maxTokens: 256,
    });
  });

  it("rejects a hostile model id, unknown flags and bad numbers", () => {
    expect(() => parseArgs(["--model", "x; rm -rf /"])).toThrow(
      /invalid model id/,
    );
    expect(() => parseArgs(["--bogus"])).toThrow(/unknown argument/);
    expect(() => parseArgs(["--flag", "a b;c"])).toThrow(
      /plain localStorage key/,
    );
    expect(
      parseArgs(["--flag", "vet_rate_x", "--flag", "vet_rate_x", "--flag", "y"])
        .flags,
    ).toEqual(["vet_rate_x", "y"]);
    expect(() => parseArgs(["--max-tokens", "1.5"])).toThrow(/integer/);
    expect(() => parseArgs(["--model"])).toThrow(/needs a value/);
  });

  it("selectCases rejects an unknown case id", () => {
    expect(() => selectCases(goldenCases, ["a99"])).toThrow(/a99/);
    expect(selectCases(goldenCases, ["a02"])).toHaveLength(1);
  });
});
