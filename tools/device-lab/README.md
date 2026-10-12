# device-lab

A reusable Playwright device-profile matrix, plus a RAM-capped Docker job. The
core (this directory, minus `docker/`) knows nothing about any app. The
app-specific parts live in the project that uses it.

## What it does, and what it cannot do

It spoofs what the page is told and exercises the app's routing and layout. It
does not make a model load or run like that hardware.

A profile changes, inside a Chromium context:

- viewport, screen size, device pixel ratio, touch, mobile flag, user agent
  (Playwright context options);
- `navigator.userAgentData` (`mobile`, `platform`), `navigator.deviceMemory`,
  `navigator.hardwareConcurrency` (an init script that runs before page code);
- `navigator.gpu`: removed, present with `requestAdapter()` resolving `null`, or
  present with an adapter-like object carrying the profile's `limits` and
  `info`;
- CPU throttling (`Emulation.setCPUThrottlingRate`) and network conditions
  (`Network.emulateNetworkConditions`) over CDP.

It cannot:

- give the page a real GPU device. A profile adapter's `requestDevice()` rejects
  on purpose, so code that goes on to create a device fails loudly instead of
  silently using the host GPU. Models, shaders and WebGPU workloads do not run
  as they would on the real device;
- slow the GPU, limit memory, or change the real CPU. CPU throttling is a
  multiplier on this machine's main thread, not a model of another chip. Memory
  limits are the Docker job's, and only apply there;
- change other browser engines. Safari and Firefox profiles are Chromium with
  Safari-like or Firefox-like navigator fields; layout, JavaScript and WebGPU
  behaviour are Chromium's;
- reach Web Workers: the init script runs in every frame of the context, not in
  workers;
- throttle on Firefox or WebKit: the CDP parts apply to Chromium only and are
  skipped elsewhere.

Real values for a device class have to be measured on the device. Each profile
says how much of it was.

## Layout

- `profiles/*.json`: one hardware profile per file. `name` equals the file name.
- `types.ts`: the profile shape.
- `profiles.ts`: `loadProfiles()`, `getProfile(name)`; both validate.
- `apply-profile.ts`: `contextOptionsFor(profile)`, `applyProfile(page, profile)`.
- `fixtures.ts`: a Playwright `test` that applies the project's profile to `page`.
- `spec-helpers.ts`: `assertProfileApplied`, `assertNoHorizontalScroll`,
  `readPageFacts`.
- `index.ts`: re-exports, and `projectsFor()` (one Playwright project per profile).
- `selftest/`: checks the overrides, throttles and helpers against a local
  server. `npm run test:device-lab:selftest`.
- `docker/`: the RAM-capped job, described below.

## Profile fields

| Field                                     | Meaning                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `name`, `deviceClass`                     | Identifier (equals file name) and a short description.                              |
| `source`                                  | Plain-text citation of where each number came from. No comments in JSON.            |
| `basis`                                   | Per section, `measured`, `documented` or `estimate`. Required for every section.    |
| `viewport`, `screen`, `deviceScaleFactor` | CSS pixels. `screen` is `window.screen`.                                            |
| `isMobile`, `hasTouch`, `userAgent`       | Passed to the context.                                                              |
| `userAgentData`                           | `{ mobile, platform }`, or `null` for browsers without it (Safari, Firefox).        |
| `deviceMemory`                            | GB as the browser reports it (Chrome caps at 8), or `null` for browsers without it. |
| `hardwareConcurrency`, `cpuThrottleRate`  | Logical cores reported; CDP CPU slowdown multiplier (1 = none).                     |
| `network`                                 | Optional `{ downloadKbps, uploadKbps, latencyMs }`.                                 |
| `gpu`                                     | `null` (no `navigator.gpu`), `{ "adapter": null }`, or an adapter with limits.      |

`basis` means: `measured` was read from real hardware by this lab (the
`source` says when and how), `documented` comes from a vendor or tool
specification, `estimate` is a stated assumption. Where a real device's value is
not known, the profile says `estimate` and uses a stated floor rather than a
precise-looking number.

## Add a profile

1. Copy the closest file in `profiles/` to `profiles/<new-name>.json`; set
   `name` to the file name.
2. Fill every field. Write the `source` field as plain sentences: which device,
   which numbers came from where, which are assumptions.
3. Set each `basis` entry honestly.
4. `npm run test:device-lab:selftest` checks that the values read back in the page.
5. In the app layer, add the profile's expected result to the expectations map.

## Point it at another project

Copy these into the other repo (keep the layout):

1. `tools/device-lab/` without `docker/` and `selftest/` (the core).
2. A Playwright config like `playwright.device-lab.config.ts`: `projects:
projectsFor()`, your own port, your own `webServer`, `reuseExistingServer:
false`.
3. A spec directory like `tests/device-lab/`, importing `test` from the core so
   `page` already has the profile applied.
4. An expectations file mapping profile name to what your app should do there.

Configure:

- `webServer.command` and `baseURL` for the app;
- a boot helper that gets past your app's first-run dialogs;
- how the spec reads the app's decision: this repo imports the detector module
  from the dev server inside the page; another app might read a `data-` attribute
  or a global;
- `applyNetwork: false` in `use` if the app is served unbundled from a dev
  server, where throttled bandwidth makes every load take minutes;
- the lint and tsconfig exclusions your repo needs for a new directory.

The core needs `@playwright/test`. It was only run here under ESM
(`"type": "module"`); the `__dirname` fallback for CommonJS is untested.

## Quirks found while building it

- A top-level `use.screen` in a Playwright project is not honoured by the test
  runner (the screen height collapsed to the viewport height). `projectsFor`
  passes it as `contextOptions.screen`, which is. Plain `browser.newContext()`
  honours `screen` directly.
- With a user-agent override active, Chromium returns a new `NavigatorUAData`
  object on every `navigator.userAgentData` read, so patching one instance does
  not stick. The override replaces the property with one wrapper object.
- An app that goes on to call `requestDevice()` on a profile adapter gets the
  deliberate rejection. This app's GPU manager logs it as a console error on
  every GPU profile; nothing else breaks.
- A profile's CPU and network throttles survive navigation within the page. They
  cannot be read back from inside the page; the self-test measures their effect.

## RAM-capped Docker job

`npm run test:device-lab:ram -- <preset>` where preset is `4gb` (2 cpus), `8gb`
(4 cpus) or `16gb` (8 cpus), from `docker/presets.json`. Add
`--overalloc` to run the over-allocation probes instead of the specs.

What it does:

- builds `docker/Dockerfile` on the official Playwright image, pinned to the
  repo's `@playwright/test` version (1.58.2), and builds the app for production
  inside it;
- runs the container with `--memory` and `--memory-swap` set to the same value
  (so no swap) and `--cpus` from the preset;
- inside it, serves the build with `vite preview` and runs three import specs
  with Chromium: `cfile-segmentation-latency`, `dkb-import-latency` and
  `advanced-ocr-perf`. Each generates its own synthetic input. The corpus spec
  that reads `docs/test-data` is not included;
- the cases whose title contains "CPU throttle" add their own 4x CDP CPU
  throttle on top of the container's cap, so a failure there is harness
  overhead, not a container result. They are left out of the main run
  (`grepInvert` in `docker/playwright.docker.config.ts`) and run afterwards in a
  second Playwright invocation, reported as "double-throttled" with their own
  counts and log (`playwright-double-throttled.log`). The job's PASS or FAIL
  reads only the main run and the OOM state; the container's memory samples
  and `memory.peak` cover both invocations;
- samples the container's cgroup every 0.5 s (`memory.current`, `memory.stat`,
  `memory.events`) and reads `memory.peak` at the end; the host reads
  `docker inspect` for `OOMKilled` and the exit code;
- writes `test-results/device-lab-ram/<preset>/` (`summary.json`, `result.json`,
  `memory.csv`, `playwright.log`, `playwright-report.json`).

How to read the numbers:

- `memory.peak` includes reclaimable page cache. The "working set" figure
  subtracts inactive file cache, as `docker stats` does. Both are shown.
- A tab killed by the cgroup OOM killer shows up as `oom_kill` greater than 0 in
  `memory.events` and as a Playwright crash, while the container survives.
  `OOMKilled=true` with exit 137 means the container's main process was killed.
- The specs time main-thread stalls against fixed budgets (500 ms, 1000 ms).
  On 2 or 4 cpus a budget can fail with no memory problem at all. A failure
  in a serial block skips the rest of that block, so pass and fail counts are
  not comparable across presets.

Where the build differs from the shipped production build:

- the specs load `/src/utils/*.js` by source URL, which only a dev server
  serves, so `docker/vite.docker.config.js` builds `musterCallProcessor`,
  `aiSystemPrompts` and `advancedOCR` as extra entries of the same build, with
  `preserveEntrySignatures: "strict"` so their exports survive;
- the shipped config strips `console.log/debug/info` calls and
  `src/utils/logger.js` only prints in dev, but the specs wait on log lines. The
  docker config sets `pure_funcs` to empty and turns logger console output on;
- `--mode e2e`, so `@mlc-ai/web-llm` is the fake and no model is downloaded.

To reuse the Docker job in another project, copy `docker/`, then change the
Dockerfile's build command, the Playwright image tag, the spec list in
`playwright.docker.config.ts`, and `vite.docker.config.js`.
