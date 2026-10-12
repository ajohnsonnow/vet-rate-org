/* eslint-disable no-console, sonarjs/no-nested-template-literals, sonarjs/cognitive-complexity -- command-line tool */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { listAdapters, resolveAdapter } from "./lib/adapters.mjs";
import { startBallast } from "./lib/ballast.mjs";
import { runCell } from "./lib/cell.mjs";
import {
  macChromeTarget,
  macHost,
  startMacTunnel,
} from "./lib/targets/mac.mjs";
import { windowsTarget } from "./lib/targets/windows.mjs";
import { runMacSurvey } from "./lib/macSurvey.mjs";
import { renderMarkdown } from "./lib/report.mjs";
import { REPO_ROOT, startDevServer } from "./lib/server.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const TIER_MODELS = [
  "Qwen3.5-4B-q4f16_1-MLC",
  "Qwen3.5-2B-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
];

const USAGE = `Usage:
  npm run device-lab:gpu -- --list
  npm run device-lab:gpu -- --adapter <name> --model <id> [--runs 2]
  npm run device-lab:gpu -- --matrix [--adapters radeon,4060ti,4080] [--models id,id] [--runs 2]
  npm run device-lab:gpu -- --matrix --constrain-free-gb 8,4,2 [--adapters 4060ti]

Options:
  --adapter <name>          radeon, 4080, 4070, 5060, 4060, nvidia:<index>, or a name fragment
  --model <id>              a WebLLM model id (the three tier models are the defaults in --matrix)
  --constrain-free-gb <l>   comma list; a ballast leaves about that many GB of VRAM free (NVIDIA only)
  --runs <n>                runs per cell (default 2)
  --context <n>             context_window_size; default is the app's own value for the tier the
                            detector assigns on that adapter (12288 desktop-high, 8192 laptop)
  --no-paint                stress condition: the old blank probe page that never paints. Results are
                            labelled "no-paint (stress condition)"; the default page animates
  --background-tab          bring another tab to the front so the probe page is hidden (a stress condition)
  --app-check               after each probe session, run a short and a long prompt through the real
                            app (initializeSwarm + generateAI) on the same adapter and record whether
                            it agreed with the probe
  --screen-width <px>       window.screen.width the detector sees (default 1920)
  --headed                  visible Chromium instead of new headless
  --generation-timeout <s>  per generation (default 300)
  --long-paragraphs <n>     size of the synthetic long prompt (default 70, about 3,300 tokens)
  --name <string>           result file name stem (default: timestamp)
  --mac-ssh <user@host>     ssh destination of the Mac (or set DEVICE_LAB_MAC_SSH); there is no default
  --render <file.json>      rewrite the markdown table next to a results JSON

Remote Mac (Apple M1; needs key-based ssh and DEVICE_LAB_MAC_SSH=user@host, see README):
  --adapter mac --model <id>        Google Chrome on the Mac (alias m1); also valid in --adapters
  --mac-survey [--safari-model id]  Safari on macOS and iOS Simulator (iPhone, iPad): WebGPU presence,
                                    adapter, detector tier, horizontal scroll; model load only if given
`;

const { values } = parseArgs({
  options: {
    list: { type: "boolean" },
    adapter: { type: "string" },
    adapters: { type: "string" },
    model: { type: "string" },
    models: { type: "string" },
    matrix: { type: "boolean" },
    "constrain-free-gb": { type: "string" },
    runs: { type: "string", default: "2" },
    context: { type: "string" },
    "no-paint": { type: "boolean" },
    "background-tab": { type: "boolean" },
    "app-check": { type: "boolean" },
    "screen-width": { type: "string", default: "1920" },
    headed: { type: "boolean" },
    "generation-timeout": { type: "string", default: "300" },
    "long-paragraphs": { type: "string", default: "70" },
    name: { type: "string" },
    "mac-survey": { type: "boolean" },
    render: { type: "string" },
    "safari-model": { type: "string" },
    "mac-ssh": { type: "string" },
    help: { type: "boolean" },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

if (values.render) {
  const input = resolve(values.render);
  const cellsIn = JSON.parse(readFileSync(input, "utf8"));
  writeFileSync(
    input.replace(/\.json$/, ".md"),
    renderMarkdown(basename(input, ".json"), cellsIn),
  );
  process.exit(0);
}

if (values["mac-ssh"]) process.env.DEVICE_LAB_MAC_SSH = values["mac-ssh"];
const MAC_NAMES = new Set(["mac", "m1", "mac-chrome"]);
const adaptersAll = listAdapters();
if (values.list) {
  console.table(
    adaptersAll.map(
      ({ name, deviceIdHex, luidArg, dedicatedMiB, nvidiaIndex }) => ({
        name,
        deviceId: deviceIdHex,
        "--use-adapter-luid": luidArg,
        dedicatedMiB,
        nvidiaIndex,
      }),
    ),
  );
  process.exit(0);
}

const constrain = values["constrain-free-gb"]
  ? values["constrain-free-gb"]
      .split(",")
      .map((g) => Math.round(Number(g) * 1024))
  : [];
if (constrain.some((n) => !Number.isFinite(n) || n <= 0)) {
  console.error("--constrain-free-gb needs positive numbers");
  process.exit(2);
}

let adapterSpecs;
let models;
if (values["mac-survey"]) {
  adapterSpecs = [];
  models = [];
} else if (values.matrix) {
  adapterSpecs = (
    values.adapters ?? (constrain.length ? "4060ti" : "radeon,4060ti,4080")
  ).split(",");
  models = values.models ? values.models.split(",") : TIER_MODELS;
} else if (values.adapter && values.model) {
  adapterSpecs = [values.adapter];
  models = [values.model];
} else {
  console.error(USAGE);
  process.exit(2);
}

const runs = Number(values.runs);
const options = {
  headed: values.headed === true,
  contextWindow: values.context ? Number(values.context) : null,
  paint: values["no-paint"] !== true,
  backgroundTab: values["background-tab"] === true,
  appCheck: values["app-check"] === true,
  screenWidth: Number(values["screen-width"]),
  generationTimeoutMs: Number(values["generation-timeout"]) * 1000,
  longParagraphs: Number(values["long-paragraphs"]),
};
const adapters = adapterSpecs.map((s) =>
  MAC_NAMES.has(s)
    ? { mac: true, name: "Apple M1 (Google Chrome)" }
    : resolveAdapter(s, adaptersAll),
);
if (values["mac-survey"] || adapters.some((a) => a.mac)) {
  try {
    macHost();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
if (options.appCheck && adapters.some((a) => a.mac)) {
  console.error("--app-check is implemented for the Windows adapters only");
  process.exit(2);
}
if (constrain.length && adapters.some((a) => a.mac)) {
  console.error("--constrain-free-gb needs an NVIDIA adapter, not the Mac");
  process.exit(2);
}
const profileDir = resolve(REPO_ROOT, "test-results/device-lab-gpu/profile");
mkdirSync(profileDir, { recursive: true });
const resultsDir = join(here, "results");
mkdirSync(resultsDir, { recursive: true });
const stem = values.name ?? new Date().toISOString().replace(/[:.]/g, "-");

const cells = [];
function save() {
  writeFileSync(
    join(resultsDir, `${stem}.json`),
    JSON.stringify(cells, null, 2),
  );
  writeFileSync(join(resultsDir, `${stem}.md`), renderMarkdown(stem, cells));
}

const server = await startDevServer();
let activeBallast = null;
let tunnel = null;
const cleanup = async () => {
  await activeBallast?.close().catch(() => {});
  tunnel?.stop();
  server.stop();
};
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});

async function runCells() {
  if (adapters.some((a) => a.mac)) tunnel = await startMacTunnel();
  const levels = constrain.length ? constrain : [null];
  for (const adapter of adapters) {
    for (const level of levels) {
      for (const model of models) {
        for (let run = 1; run <= runs; run++) {
          activeBallast = level ? await startBallast(adapter, level) : null;
          const target = adapter.mac
            ? macChromeTarget()
            : windowsTarget(adapter, options);
          console.log(
            `cell: ${adapter.name} | ${model} | run ${run}${level ? ` | ${level} MiB free` : ""}`,
          );
          const c = await runCell({
            target,
            model,
            run,
            options,
            profileDir,
            ballast: activeBallast,
          });
          await activeBallast?.close();
          activeBallast = null;
          cells.push(c);
          save();
          console.log(
            `  loaded=${c.load?.ok ?? false} load=${c.load?.seconds?.toFixed(1)}s short=${c.short?.tokensPerSecond?.toFixed(1)} tok/s long=${c.long?.tokensPerSecond?.toFixed(1)} tok/s${c.error ? ` error=${c.error}` : ""}`,
          );
        }
      }
    }
  }
}

try {
  if (values["mac-survey"]) {
    tunnel = await startMacTunnel();
    const survey = await runMacSurvey({
      model: values["safari-model"],
      resultsDir,
      stem,
    });
    console.log(survey.summary);
  } else {
    await runCells();
  }
} finally {
  await cleanup();
}
if (!values["mac-survey"])
  console.log(`wrote ${join(resultsDir, stem)}.json and .md`);
