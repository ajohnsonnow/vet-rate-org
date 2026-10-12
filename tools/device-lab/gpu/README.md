# device-lab gpu

A real-hardware probe for the on-device models. It loads the app's WebLLM models in a real browser pinned to a chosen physical GPU and records whether each model loads, how much GPU memory it takes, and how fast it runs. It is the best honest proxy available for laptops and tablets without owning them, and it is a proxy: see Limits.

## Run it

Needs Node, `nvidia-smi` and PowerShell on the Windows workstation; the first run of each model downloads it from Hugging Face into `test-results/device-lab-gpu/profile` (ignored by git).

```
npm run device-lab:gpu -- --list
npm run device-lab:gpu -- --adapter radeon --model Qwen3.5-2B-q4f16_1-MLC
npm run device-lab:gpu -- --adapter 4060ti --model Qwen3.5-4B-q4f16_1-MLC --runs 3 --app-check
npm run device-lab:gpu -- --adapter 4060ti --model Qwen3.5-4B-q4f16_1-MLC --runs 3 --no-paint
npm run device-lab:gpu -- --adapter radeon --model Qwen2.5-1.5B-Instruct-q4f16_1-MLC --runs 3 --background-tab
npm run device-lab:gpu -- --matrix --adapters 4060ti,radeon --runs 3 --app-check --name matrix-paint-2026-10-11
npm run device-lab:gpu -- --matrix --constrain-free-gb 8,4,2 --adapters 4060ti
DEVICE_LAB_MAC_SSH=user@host npm run device-lab:gpu -- --adapter mac --model Qwen3.5-4B-q4f16_1-MLC
DEVICE_LAB_MAC_SSH=user@host npm run device-lab:gpu -- --mac-survey
DEVICE_LAB_MAC_SSH=user@host npm run device-lab:gpu -- --mac-survey --safari-model Qwen3.5-2B-q4f16_1-MLC
npm run device-lab:gpu -- --render tools/device-lab/gpu/results/<file>.json
```

`--matrix` defaults to the Radeon, the 4060 Ti and the 4080 SUPER, with the three tier models (Qwen3.5-4B desktop, Qwen3.5-2B laptop, Qwen2.5-1.5B tablet), two runs each; the committed matrices use three. Results go to `results/<name>.json` and `.md`. The dev server uses port 5232 only. `--help` lists every option.

## How the adapter is chosen

`--use-adapter-luid=<high>,<low>` (decimal LUID from DXGI, read at run time by `lib/list-adapters.ps1`) is the only mechanism that worked. Every run reads `adapter.info` and `adapter.limits` on the page and in the worker that runs inference, and the cell is marked invalid unless the description and device id match the adapter asked for. `--enable-webgpu-developer-features` is needed for `adapter.info` to carry the device id and description; without it Chrome reports only vendor and architecture, which cannot tell the four NVIDIA cards apart.

Tried and did not move the adapter (Chromium 145, Windows 11): `--force-high-performance-gpu`, `--force-low-power-gpu`, `requestAdapter({powerPreference: "low-power"})` (Chrome logs "The powerPreference option is currently ignored when calling requestAdapter() on Windows", crbug 369219127), `--use-webgpu-power-preference=default-low-power` and `force-high-performance` (no change), `force-low-power` (no adapter at all), `--use-angle=d3d11`, `--use-webgpu-adapter=default`. Without `--use-adapter-luid` Chrome always returned the first adapter DXGI lists, the 4070 Ti SUPER. The LUID flag with a hex or single-number value is ignored or yields no adapter; it needs `high,low` in decimal. The Windows per-app GPU preference was not tried: the LUID flag made it unnecessary, and no system setting was changed or needs restoring.

LUIDs change on reboot, which is why they are looked up each run.

## What it measures

For each adapter, model and run, one fresh browser session:

- adapter info and limits as the page and the worker see them, with `isSecureContext` and `navigator.gpu` checked first;
- the tier the app's own `detectDeviceCapabilities()` assigns on that adapter (the real module, imported from `src/`, with `window.screen.width` set to 1920);
- load time with the model already cached (a cold download runs as a separate session, its time reported as `coldDownload`);
- one untimed warm-up generation, then a fixed short prompt (41 tokens) and a fixed long synthetic prompt (about 3,200 tokens, 70 numbered log lines from a seeded generator, no personal data), each with `max_tokens` 128, temperature 0, Qwen reasoning off as the app does;
- time to first token, and tokens per second as (completion tokens minus one) over the time after the first token; WebLLM's own decode and prefill rates are stored alongside;
- GPU memory sampled during the run: `nvidia-smi` every 0.3 s for NVIDIA dedicated memory, Windows "GPU Adapter Memory" counters (about 1 s) for shared memory and for the Radeon; peaks are reported raw and as a delta over the idle baseline just before the browser started;
- device loss, through a hook on `GPUAdapter.requestDevice` inside the app's own inference worker (`probe/llm-worker.js` imports the app's `src/workers/webllm-swarm-worker.js` unchanged after the hook), plus tab crash and console errors.

Inference runs in the app's worker with `CreateWebWorkerMLCEngine`. The context window is the app's own for the tier the detector assigns on that adapter (12288 for desktop-high, 8192 for laptop, tablet and desktop-mid), read from the detector's profile at run time and stored in every row as `contextWindow`; `--context <n>` overrides it and the row says so. Rows recorded before this was changed used 8192 for every model and are marked in their tables. Tokens per second uses `stream: true` to see the first token, which adds a read-back per token; the app itself notes this is slow on Ada, so fast cards are capped near 25 to 75 tokens per second by streaming and the number understates raw decode speed.

Painting. The probe page runs a small canvas animation on `requestAnimationFrame`, because on Windows a page that never paints decides whether a long generation ends in `DXGI_ERROR_DEVICE_HUNG`: QA's static page lost the device 12 of 12 times on the RTX 4060 Ti with Qwen3.5-4B and the 3,254-token prompt, a painting copy 0 of 5. Every generation records `paint`: frames per second of the animation during that generation, whether it was painting (10 or more frames per second), whether the page was in the foreground (visible, focused, never hidden during the generation), `visibilityState` and `hasFocus`. Each row's `pageCondition` is one of "painting, foreground" (the default), "no-paint (stress condition)" (`--no-paint`, the old blank page) or "painting, background tab" (`--background-tab`, which opens a second tab and brings it to the front). Headless Chrome keeps reporting a backgrounded page as visible and focused while its animation drops to about 1 frame per second, so for that condition the table's foreground column is set to "no" from the option, and the frame rate is the evidence. The report puts each condition in its own section; the no-paint and background tables are stress conditions, not what a user sees.

App-path cross-check (`--app-check`). After each probe session the runner starts a second browser on the same pinned adapter, boots the real app at `/` through the same returning-user localStorage keys as `bootStressPage` in `tests/stress/helpers.ts`, loads the model with the app's `initializeSwarm` (model list narrowed to the model under test, as `tests/eval/golden-set.spec.ts` does) and sends the short prompt and the same synthetic long prompt through `generateAI` with `toolId` "personal-statement" and `openAdvice` off, because with it on the app does not call a model of 2B or smaller at all (`openAdviceHold.js`). Device loss is seen through the same `requestDevice` hook as the probe: the lab's dev server (`vite.config.mjs`) prepends it to the app's inference worker, and nothing under `src/` changes. The table's "App path agreed" column compares the outcome class of the two paths (finished, lost the device or crashed, other error). Limits of the check: the app page is the idle app, so what paints is whatever the app's own UI paints (only visibility is recorded, because adding an animation loop would change what is being tested); the app wraps the prompt in its persona system prompt, so the prompt the engine sees is longer than the probe's; the app may retry or reload the engine after an error, so a loss it recovers from is still counted because the hook sees the device die. Windows adapters only.

Constrained VRAM: `lib/ballast.mjs` starts a second browser on the same card, allocates 256 MiB WebGPU buffers until `nvidia-smi` shows the requested free amount (within 300 MiB), keeps them touched every 250 ms, and refuses to continue if `nvidia-smi` does not confirm it. The probe then runs as usual. Windows is free to demote the ballast or the model into shared system memory; the result shows what it did.

## Mac

`--adapter mac` runs the same page in Google Chrome on the Mac mini (Apple M1, 16 GB) reached over ssh. The destination is required and has no default: set `DEVICE_LAB_MAC_SSH=user@host` (or pass `--mac-ssh user@host`); the run stops with a message if it is unset. Key-based ssh must already work. The adapter check accepts a Metal adapter whose vendor is Apple and whose description starts with "Apple M"; it does not prove which Mac it is or its memory, so "Apple M1, 16 GB" in the rows is a label and the recorded adapter description is the evidence. That check is weak by design: there is only one Mac and no cheap, honest way to read its model number from the page. This machine serves the app; an ssh reverse tunnel (`-R 5232:127.0.0.1:5232`) makes it `localhost:5232` on the Mac, so WebGPU gets a secure context and no repository code is copied. A forward tunnel on port 9333 carries Chrome's DevTools protocol; Playwright attaches to a headless Chrome started on the Mac with a profile in `~/device-lab-scratch/chrome-profile`. Memory comes from a sampler over ssh: the GPU driver's `Alloc system memory` (unified memory, standing in for dedicated), browser process RSS, `memory_pressure` free percentage, `kern.memorystatus_vm_pressure_level` (1 normal, 2 warning, 4 critical) and swap.

`--mac-survey` opens `probe/survey.html` and `probe/layout.html` in desktop Safari (`open -a Safari`) and in an iPhone 17 and an iPad (A16) simulator (`simctl openurl`); the pages post their own results to a collector in `vite.config.mjs`. Nothing drives Safari through WebDriver: `safaridriver --enable` and "Allow Remote Automation" need an administrator password and were not touched. A Safari the run starts is quit afterwards (`pkill -x Safari`); one the user already had running is left alone. `--safari-model` adds a model load in desktop Safari. The layout check loads the app's home page in an iframe the width of the window and compares `scrollWidth` with `clientWidth`.

The iOS Simulator runs on the Mac's own CPU, GPU and memory. It tests iOS Safari's routing, user agent and layout, not an iPhone's or iPad's memory limits or GPU.

## Committed results (`results/`)

- `matrix-paint-2026-10-11`: Radeon and RTX 4060 Ti, three models, three runs, painting page in the foreground, context 12288, app-path check on every row. The main table.
- `background-tab-4060ti-4b-2026-10-11`, `background-tab-radeon-1.5b-2026-10-11`: the background-tab stress condition, three runs each, no app-path check.
- `app-path-radeon-extended-timeout-2026-10-11`: Radeon 2B and 1.5B, one run each, 900 s generation cap, to see whether the app path that hit the 300 s cap finishes.
- `matrix-no-paint-2026-10-11`, `ladder-radeon-*`, `vram-constrained-4060ti`, `matrix-mac-m1-chrome`: recorded before the probe page painted, with context 8192; every row is labelled "no-paint (stress condition)". They are kept as the stress table and as the only memory-ladder, constrained-VRAM and Mac numbers; do not compare their speeds or loss counts with the painting matrix.
- `mac-safari-*`: the Safari and iOS Simulator survey and model loads; these pages are not the probe page.

## Limits

- The Radeon is this machine's Ryzen 9 7950X3D integrated GPU (RDNA 2, 2 compute units, 512 MiB carve-out, the rest shared DDR5), not an Intel Iris Xe, Apple or Adreno GPU. It is slow, and it is the only integrated GPU here, but a laptop iGPU differs in compute, memory bandwidth and driver.
- The desktop has desktop thermals and power. A laptop throttles; nothing here does.
- Three runs per cell in the committed matrices (two in older files), too few for percentiles. Tokens per second varies from run to run and from session to session and is indicative only: QA measured 35 to 41 tokens per second on the RTX 4080 SUPER with the Qwen3.5-4B model against the 25 recorded for it in `matrix-no-paint-2026-10-11`, and an older file has 32.6 and 46.4 on one cell. Streaming (one read-back per token) also caps fast cards. Load times, first-token times and memory peaks are steadier than tokens per second.
- Windows kills a GPU job that does not yield for about two seconds (TDR, `DXGI_ERROR_DEVICE_HUNG`). What this tool has shown, and no more. (1) The RTX 4060 Ti is not driving a display here. With Qwen3.5-4B and the 3,254-token prompt it lost the device 12 of 12 times on a page that never paints (QA; `--no-paint` is that condition), 0 of 9 on the painting page in `matrix-paint-2026-10-11` (QA saw 0 of 5 on its own painting copies, headless and headed), and 0 of 9 through the real app. With another tab in front it lost the device 1 of 3 times (`background-tab-4060ti-4b-2026-10-11`; QA saw 2 of 4) and decoded at 3 to 7 tokens per second when it survived. So on that card the loss needs a page that is not painting or not in front; it is not what a user with the app in the foreground would see, and the no-paint tables are stress tests of the harness, not device results. (2) The Radeon (this machine's integrated GPU) does drive a display. Qwen3.5-4B loses the device on it in 3 of 3 probe runs with the page painting and 3 of 3 runs through the real app, and the detector recommends that model first on this adapter (it reports desktop-high with a 2 GiB buffer limit), so this is a failure a user could see. The 2B and 1.5B models survive a painting page, but at 4 to 6 tokens per second and about 180 to 210 s to the first token on the 3,254-token prompt; with the app's own prompt wrapping, even the 108-character prompt took 223 to 263 s, five of six runs hit the 300 s cap, and one lost the device (`matrix-paint-2026-10-11`); with a 900 s cap the 2B lost the device on the long prompt after 345 s and the 1.5B finished it in 520 s (`app-path-radeon-extended-timeout-2026-10-11`, one run each). With the page in the background the Radeon lost the device on the 1.5B in 3 of 3 runs. Whether a given laptop behaves like either card depends on its driver and display setup, which is not measured here.
- Detector inputs that depend on the machine are this machine's: `navigator.hardwareConcurrency` is 32, and `navigator.deviceMemory` is capped at 8. On Windows with a real laptop the CPU core clause would not push a weak GPU into the laptop tier.
- Headless (the new headless mode) is the default; `--headed` uses a visible window. No table here is headed; QA's two headed runs of a painting page matched headless (0 of 2 lost).
- Chrome 145 (Playwright's Chromium) on Windows, Chrome 154 on the Mac; Dawn and driver versions matter and are not pinned.
- The Mac is shared with other uses: Chrome and other apps were already running, with about 2 GB of swap in use before any run. Its memory pressure numbers include that.
- Safari rows are single runs; the first load in Safari includes the cold download.
- Nothing here measures battery, heat, or long sessions.
