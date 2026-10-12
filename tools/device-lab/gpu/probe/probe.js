/* eslint-disable sonarjs/cognitive-complexity -- one streaming loop with its error paths */
import { SHORT_PROMPT, buildLongPrompt } from "./prompts.js";
import { detectDeviceCapabilities } from "/src/utils/deviceCapabilityDetector.js";
import { buildThinkingRequestFields } from "/src/utils/reasoningText.js";
import * as webllm from "@mlc-ai/web-llm";

const deviceEvents = [];
new BroadcastChannel("device-lab-gpu").onmessage = (e) => {
  if (deviceEvents.length < 40) deviceEvents.push(e.data);
};

let engine = null;
let worker = null;
let loadedModelId = null;

// A page that never paints lets Windows treat the GPU as idle for display
// purposes, and long compute jobs on it end in DXGI_ERROR_DEVICE_HUNG. The
// default is a small animation driven by requestAnimationFrame; ?paint=0
// removes it (the --no-paint stress condition).
const paintEnabled = new URLSearchParams(location.search).get("paint") !== "0";
let paintFrames = 0;
let hiddenSeen = document.visibilityState === "hidden";
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") hiddenSeen = true;
});

function startPaint() {
  const canvas = document.getElementById("paint");
  const ctx = canvas.getContext("2d");
  const tick = (now) => {
    paintFrames++;
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 8; i++) {
      const h = 10 + 60 * Math.abs(Math.sin(now / 400 + i));
      ctx.fillStyle = `hsl(${(now / 20 + i * 40) % 360} 80% 60%)`;
      ctx.fillRect(10 + i * 18, canvas.height - 10 - h, 12, h);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (paintEnabled) startPaint();
else document.getElementById("paint")?.remove();

function paintSnapshot() {
  hiddenSeen = document.visibilityState === "hidden";
  return { frames: paintFrames, t: performance.now() };
}

function paintSince(snap) {
  const seconds = (performance.now() - snap.t) / 1000;
  const frames = paintFrames - snap.frames;
  const framesPerSecond = seconds > 0 ? frames / seconds : 0;
  return {
    enabled: paintEnabled,
    frames,
    framesPerSecond: Math.round(framesPerSecond * 10) / 10,
    painting: paintEnabled && framesPerSecond >= 10,
    foreground:
      document.visibilityState === "visible" &&
      !hiddenSeen &&
      document.hasFocus(),
    visibilityState: document.visibilityState,
    hasFocus: document.hasFocus(),
  };
}

const paintReport = () => paintSince({ frames: 0, t: 0 });

function adapterSummary(a) {
  const i = a.info;
  return {
    vendor: i.vendor,
    architecture: i.architecture,
    device: i.device,
    description: i.description,
    isFallbackAdapter: i.isFallbackAdapter,
    maxBufferSize: a.limits.maxBufferSize,
    maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize,
    maxComputeWorkgroupStorageSize: a.limits.maxComputeWorkgroupStorageSize,
    shaderF16: a.features.has("shader-f16"),
  };
}

function inWorker() {
  return new Promise((resolve) => {
    const w = new Worker(new URL("./adapter-worker.js", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e) => {
      w.terminate();
      resolve(e.data);
    };
    w.onerror = (e) => {
      w.terminate();
      resolve({ error: String(e.message || e) });
    };
    w.postMessage(1);
  });
}

async function adapterReport() {
  const a = await navigator.gpu.requestAdapter();
  if (!a) return { main: null, worker: await inWorker() };
  return { main: adapterSummary(a), worker: await inWorker() };
}

async function detect() {
  const profile = await detectDeviceCapabilities();
  return {
    tier: profile.tier,
    gpuTier: profile.gpuTier,
    gpuMaxBufferSize: profile.gpuMaxBufferSize,
    gpuDescription: profile.gpuDescription,
    systemRAM: profile.systemRAM,
    cpuCores: profile.cpuCores,
    screenWidth: window.screen.width,
    contextWindowSize: profile.contextWindowSize,
    recommendedModels: profile.recommendedModels,
    canUseWebLLM: profile.canUseWebLLM,
  };
}

function isCached(modelId) {
  return webllm.hasModelInCache(modelId);
}

async function load(modelId, contextWindowSize) {
  worker = new Worker(new URL("./llm-worker.js", import.meta.url), {
    type: "module",
  });
  const progress = [];
  const t0 = performance.now();
  try {
    engine = await webllm.CreateWebWorkerMLCEngine(
      worker,
      modelId,
      {
        initProgressCallback: (r) => {
          progress.push(r.text);
          if (progress.length > 40) progress.shift();
        },
        logLevel: "SILENT",
      },
      { context_window_size: contextWindowSize },
    );
    loadedModelId = modelId;
    return {
      ok: true,
      loadMs: performance.now() - t0,
      lastProgress: progress.slice(-3),
    };
  } catch (err) {
    return {
      ok: false,
      loadMs: performance.now() - t0,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      lastProgress: progress.slice(-3),
    };
  }
}

async function generate(kind, maxTokens, timeoutMs, paragraphs) {
  const prompt = kind === "long" ? buildLongPrompt(paragraphs) : SHORT_PROMPT;
  const paintStart = paintSnapshot();
  const t0 = performance.now();
  let tFirst = null;
  let text = "";
  let chunks = 0;
  let usage = null;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    engine.interruptGenerate();
  }, timeoutMs);
  try {
    const stream = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0,
      max_tokens: maxTokens,
      ...buildThinkingRequestFields(loadedModelId, false),
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        if (tFirst === null) tFirst = performance.now();
        text += delta;
        chunks++;
      }
      if (chunk.usage) usage = chunk.usage;
    }
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      timedOut,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      paint: paintSince(paintStart),
    };
  }
  clearTimeout(timer);
  const tEnd = performance.now();
  const completionTokens = usage?.completion_tokens ?? chunks;
  const decodeSeconds = tFirst === null ? null : (tEnd - tFirst) / 1000;
  return {
    ok: true,
    timedOut,
    promptChars: prompt.length,
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens,
    ttftSeconds: tFirst === null ? null : (tFirst - t0) / 1000,
    totalSeconds: (tEnd - t0) / 1000,
    tokensPerSecond:
      decodeSeconds && completionTokens > 1
        ? (completionTokens - 1) / decodeSeconds
        : null,
    engineDecodeTokensPerSecond: usage?.extra?.decode_tokens_per_s ?? null,
    enginePrefillTokensPerSecond: usage?.extra?.prefill_tokens_per_s ?? null,
    textHead: text.slice(0, 80),
    paint: paintSince(paintStart),
  };
}

async function unload() {
  try {
    await engine?.unload();
  } finally {
    worker?.terminate();
    engine = null;
    worker = null;
    loadedModelId = null;
  }
}

const getDeviceEvents = () => deviceEvents.slice();

window.__probe = {
  getDeviceEvents,
  adapterReport,
  detect,
  paintReport,
  isCached,
  load,
  generate,
  unload,
};
window.__probeReady = true;
