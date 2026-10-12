import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { surveyDesktopSafari, surveySimulator } from "./safari.mjs";
import { REPO_ROOT } from "./server.mjs";

const SIMULATORS = [
  { name: "iphone", pattern: /^iPhone 17$/ },
  { name: "ipad", pattern: /^iPad \(A16\)$/ },
];

function summarizeRun(entry) {
  const s = entry.survey ?? {};
  const l = entry.layout ?? {};
  const a = s.adapterReport?.main ?? null;
  return {
    target: entry.target,
    userAgent: s.userAgent ?? null,
    isSecureContext: s.isSecureContext ?? null,
    hasNavigatorGpu: s.hasNavigatorGpu ?? null,
    maxTouchPoints: s.maxTouchPoints ?? null,
    screen: s.screen ?? null,
    adapter: a,
    detector: s.detector ?? null,
    horizontalScroll: l.frame?.horizontalScroll ?? null,
    layout: l.frame ?? null,
    load: s.load ?? null,
    short: s.short ?? null,
    long: s.long ?? null,
    timedOut: Boolean(s.timedOut || l.timedOut),
    errors: (s.errors ?? []).map((e) =>
      `${e.stage}: ${e.error ?? e.message}`.slice(0, 200),
    ),
  };
}

function toMarkdown(stem, rows, automation) {
  const lines = [
    `# ${stem}`,
    "",
    `Safari WebDriver status (never enabled by this tool): ${JSON.stringify(automation)}`,
    "",
    "| Target | navigator.gpu | Secure context | Touch points | Adapter (vendor / architecture / device / description) | maxBufferSize | Detector tier (gpuTier) | Model load | Horizontal scroll on home | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const a = r.adapter;
    const adapter = a
      ? [a.vendor, a.architecture, a.device, a.description]
          .map((x) => x || "-")
          .join(" / ")
      : "-";
    const tier = r.detector
      ? `${r.detector.tier} (${r.detector.gpuTier})`
      : "-";
    let load = "not attempted";
    if (r.load)
      load = r.load.ok
        ? `ok ${r.load.loadMs / 1000}s`
        : `failed: ${r.load.error}`;
    lines.push(
      `| ${r.target} | ${r.hasNavigatorGpu} | ${r.isSecureContext} | ${r.maxTouchPoints} | ${adapter} | ${a?.maxBufferSize ?? "-"} | ${tier} | ${load} | ${r.horizontalScroll} | ${[r.timedOut ? "timed out" : "", ...r.errors].filter(Boolean).join("; ").replace(/\|/g, "/")} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export async function runMacSurvey({ model, resultsDir, stem }) {
  const shots = join(REPO_ROOT, "test-results/device-lab-gpu/screenshots");
  mkdirSync(shots, { recursive: true });
  const automation =
    "not used: pages post their own results; safaridriver and Allow Remote Automation were never enabled";
  const entries = [];
  const save = () => {
    const rows = entries.map(summarizeRun);
    writeFileSync(
      join(resultsDir, `${stem}.json`),
      JSON.stringify({ automation, entries, rows }, null, 2),
    );
    writeFileSync(
      join(resultsDir, `${stem}.md`),
      toMarkdown(stem, rows, automation),
    );
    return toMarkdown(stem, rows, automation);
  };
  const attempt = async (label, fn) => {
    try {
      entries.push(await fn());
    } catch (err) {
      entries.push({
        target: label,
        survey: {
          errors: [
            { stage: "runner", error: String(err.message).slice(0, 300) },
          ],
        },
      });
    }
    save();
  };
  await attempt("Safari on macOS", () =>
    surveyDesktopSafari({ model, timeoutMs: model ? 1_500_000 : 120_000 }),
  );
  for (const sim of model ? [] : SIMULATORS) {
    await attempt(`iOS Simulator: ${sim.name}`, () =>
      surveySimulator({
        ...sim,
        model: undefined,
        timeoutMs: 180_000,
        screenshotDir: shots,
      }),
    );
  }
  return { summary: save() };
}
