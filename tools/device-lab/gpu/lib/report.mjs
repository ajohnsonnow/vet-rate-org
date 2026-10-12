/* eslint-disable sonarjs/no-nested-conditional -- plain display formatting */
const f1 = (n) => (n === null || n === undefined ? "-" : n.toFixed(1));
const f2 = (n) => (n === null || n === undefined ? "-" : n.toFixed(2));
const int = (n) => (n === null || n === undefined ? "-" : String(n));
const cell = (s) =>
  String(s ?? "-")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ");

const DEFAULT_CONDITION = "painting, foreground";
const CONDITION_NOTES = {
  "no-paint (stress condition)":
    "The probe page never paints (a static page, no animation). This is a stress condition that reproduces the first version of the probe; on Windows it alone decides whether a long generation ends in DXGI_ERROR_DEVICE_HUNG. It is not what a user sees.",
  "painting, background tab":
    "The probe page animates but another tab was brought to the front. Headless Chrome keeps reporting the page as visible and focused, but its requestAnimationFrame callbacks drop to about 1 per second, so it is not painting. A stress condition.",
};

const conditionOf = (c) => c.pageCondition ?? DEFAULT_CONDITION;

function pageCell(c) {
  const p = c.long?.paint ?? c.short?.paint ?? c.paint;
  if (!p) return "-";
  const foreground = p.foreground && !c.backgroundTab;
  return `${p.painting ? "yes" : "no"} (${p.framesPerSecond}) / ${foreground ? "yes" : "no"}`;
}

function appCell(c) {
  if (!c.appCheck) return "not run";
  const a = c.appCheck.agreed;
  if (a.agreed) return `yes (both ${a.probe})`;
  return `NO (probe ${a.probe}, app ${a.app}${c.appCheck.error ? `: ${cell(c.appCheck.error).slice(0, 80)}` : ""})`;
}

export function renderMarkdown(title, allCells) {
  let cells = allCells;
  const lines = [`# ${title}`, ""];
  const mac = cells.filter((c) => c.platform === "macos");
  cells = cells.filter((c) => c.platform !== "macos");
  const unconstrained = cells.filter((c) => !c.ballast);
  const constrained = cells.filter((c) => c.ballast);

  const conditions = [...new Set(unconstrained.map(conditionOf))];
  for (const condition of conditions) {
    const group = unconstrained.filter((c) => conditionOf(c) === condition);
    if (conditions.length > 1 || condition !== DEFAULT_CONDITION)
      lines.push(`## ${condition}`, "", CONDITION_NOTES[condition] ?? "", "");
    lines.push(
      "| Adapter | Model | Run | Page: painting (fps) / foreground | Context window | Detector tier (gpuTier) | maxBufferSize | Loaded | Load s | 1st token s (short / long) | tok/s (short / long) | Peak dedicated MiB (delta) | Peak shared MiB (delta) | Crash / lost | App path agreed | Error |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const c of group) lines.push(row(c, false));
    lines.push("");
  }
  if (constrained.length) {
    lines.push(
      "| Adapter | Model | Run | Page condition | Context window | Free VRAM target MiB | Free at ballast / at probe start MiB | Loaded | Load s | 1st token s (short / long) | tok/s (short / long) | Peak dedicated MiB | Min free MiB | Peak shared MiB (delta) | Crash / lost | Error |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const c of constrained) lines.push(row(c, true));
    lines.push("");
  }
  if (mac.length) {
    lines.push(
      "| Target | Model | Run | Page condition | Context window | Detector tier (gpuTier) | maxBufferSize | Loaded | Load s | 1st token s (short / long) | tok/s (short / long) | GPU alloc peak MiB (delta) | Browser RSS peak MiB | Min system free % | Max pressure level | Swap used MiB (base / peak) | Crash / lost | Error |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const c of mac) lines.push(macRow(c));
    lines.push("");
  }
  return lines.join("\n");
}

function macRow(c) {
  const m = c.memory ?? {};
  const x = m.mac ?? {};
  const loaded =
    c.load?.ok && !c.error ? "yes" : c.load?.ok ? "yes (run failed)" : "no";
  const tier = c.detector ? `${c.detector.tier} (${c.detector.gpuTier})` : "-";
  const lost = c.crashed
    ? "tab crash"
    : c.deviceLost
      ? `device lost (${cell(c.deviceLost)})`
      : "no";
  return `| ${cell(c.adapter)} | ${c.model} | ${c.run} | ${conditionOf(c)} | ${int(c.contextWindow)} | ${tier} | ${int(c.adapterInReport?.main?.maxBufferSize)} | ${loaded} | ${f1(c.load?.seconds)} | ${f2(c.short?.ttftSeconds)} / ${f2(c.long?.ttftSeconds)} | ${f1(c.short?.tokensPerSecond)} / ${f1(c.long?.tokensPerSecond)} | ${int(m.peakDedicatedMiB)} (${int(m.peakDedicatedDeltaMiB)}) | ${int(x.peakBrowserRssMiB)} | ${int(x.minSystemFreePercent)} | ${int(x.maxPressureLevel)} | ${int(x.baselineSwapUsedMiB)} / ${int(x.peakSwapUsedMiB)} | ${lost} | ${cell(c.error ?? c.load?.error ?? "")} |`;
}

function row(c, constrained) {
  const m = c.memory ?? {};
  const loaded =
    c.load?.ok && !c.error ? "yes" : c.load?.ok ? "yes (run failed)" : "no";
  const tier = c.detector ? `${c.detector.tier} (${c.detector.gpuTier})` : "-";
  const ttft = `${f2(c.short?.ttftSeconds)} / ${f2(c.long?.ttftSeconds)}`;
  const tps = `${f1(c.short?.tokensPerSecond)} / ${f1(c.long?.tokensPerSecond)}`;
  const lost = c.crashed
    ? "tab crash"
    : c.deviceLost
      ? `device lost (${cell(c.deviceLost)})`
      : "no";
  const err = cell(c.error ?? c.load?.error ?? "");
  const shared = `${int(m.peakSharedMiB)} (${int(m.peakSharedDeltaMiB)})`;
  if (constrained) {
    return `| ${cell(c.adapter)} | ${c.model} | ${c.run} | ${conditionOf(c)} | ${int(c.contextWindow)} | ${c.ballast.targetFreeMiB} | ${c.ballast.freeAfterMiB} / ${int(c.preLoadFreeMiB)} | ${loaded} | ${f1(c.load?.seconds)} | ${ttft} | ${tps} | ${int(m.peakDedicatedMiB)} | ${int(m.minFreeMiB)} | ${shared} | ${lost} | ${err} |`;
  }
  const dedicated = `${int(m.peakDedicatedMiB)} (${int(m.peakDedicatedDeltaMiB)})`;
  return `| ${cell(c.adapter)} | ${c.model} | ${c.run} | ${pageCell(c)} | ${int(c.contextWindow)} | ${tier} | ${int(c.adapterInReport?.main?.maxBufferSize)} | ${loaded} | ${f1(c.load?.seconds)} | ${ttft} | ${tps} | ${dedicated} | ${shared} | ${lost} | ${appCell(c)} | ${err} |`;
}
