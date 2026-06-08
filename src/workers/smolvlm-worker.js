/**
 * Vet-Rate.org - SmolVLM Vision Worker
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * In-browser Vision Language Model for document analysis
 *
 * Model: HuggingFaceTB/SmolVLM-256M-Instruct (256M params, runs in any WebGPU browser)
 * Backend: WebGPU via @huggingface/transformers v3
 * Privacy: 100% client-side — NO DATA LEAVES BROWSER
 *
 * REPLACES: Broken MLC WebLLM Phi-3.5-vision path
 *   - Phi-3.5-vision-instruct-q4f16_1-MLC crashes with:
 *     "Cannot find parameter in cache: vision_embed_tokens..." (WebLLM v0.2.80 known bug)
 *   - SmolVLM uses transformers.js ONNX runtime — confirmed working in Chrome/Edge with WebGPU
 *
 * CAPABILITIES:
 * - Visual Q&A over document images (DD214, C-File, medical records)
 * - Structured JSON extraction from document images
 * - Handles base64 image data URLs or Blob objects
 *
 * USAGE (from main thread):
 *   worker.postMessage({ type: 'LOAD' })
 *   worker.postMessage({ type: 'ANALYZE', payload: { imageBlob, prompt } })
 *   worker.postMessage({ type: 'UNLOAD' })
 */

import {
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  RawImage,
  env,
} from "@huggingface/transformers";

// Cache models in browser (avoids re-download)
env.useBrowserCache = true;
env.allowLocalModels = false;

const MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct";
const MAX_NEW_TOKENS = 1024;

// Worker state
let model = null;
let processor = null;
let isLoading = false;
let fp16Supported = false;

/**
 * Detect if GPU adapter supports FP16 (shader-f16 feature)
 * Falls back gracefully to fp32 if not supported.
 */
async function detectFP16() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    fp16Supported = adapter?.features?.has("shader-f16") ?? false;
  } catch {
    fp16Supported = false;
  }
}

/**
 * Load SmolVLM model and processor
 */
async function loadModel() {
  if (model && processor) {
    self.postMessage({ status: "ready", cached: true });
    return;
  }

  if (isLoading) {
    self.postMessage({ status: "loading", message: "Already loading..." });
    return;
  }

  isLoading = true;

  try {
    await detectFP16();

    self.postMessage({
      status: "loading",
      progress: 0,
      message: `Initializing SmolVLM Vision engine (${fp16Supported ? "fp16" : "fp32"})...`,
    });

    const dtype = fp16Supported ? "fp16" : "fp32";

    // Load processor and model in parallel where possible
    self.postMessage({
      status: "loading",
      progress: 5,
      message: "Loading image processor...",
    });

    processor = await AutoProcessor.from_pretrained(MODEL_ID);

    self.postMessage({
      status: "loading",
      progress: 10,
      message: "Downloading SmolVLM-256M model weights (first load only)...",
    });

    model = await AutoModelForVision2Seq.from_pretrained(MODEL_ID, {
      dtype,
      device: "webgpu",
      progress_callback: (info) => {
        if (info.status === "progress") {
          const scaled = 10 + (info.progress ?? 0) * 0.85;
          self.postMessage({
            status: "loading",
            progress: Math.round(scaled),
            message: `Downloading: ${info.file || "model weights"}...`,
          });
        }
      },
    });

    isLoading = false;

    self.postMessage({
      status: "ready",
      progress: 100,
      message: "SmolVLM ready!",
      modelInfo: { id: MODEL_ID, device: "webgpu", dtype },
    });
  } catch (err) {
    isLoading = false;

    let errorType = "unknown";
    let errorMessage = err.message;

    if (err.message.includes("WebGPU") || err.message.includes("adapter")) {
      errorType = "webgpu";
      errorMessage = "WebGPU not available. Use Chrome/Edge 113+ on desktop.";
    } else if (err.message.includes("memory") || err.message.includes("OOM")) {
      errorType = "memory";
      errorMessage = "Insufficient GPU memory. Close other tabs and retry.";
    } else if (
      err.message.includes("fetch") ||
      err.message.includes("network")
    ) {
      errorType = "network";
      errorMessage = "Network error downloading model. Check connection.";
    }

    self.postMessage({
      status: "error",
      error: errorMessage,
      errorType,
      originalError: err.message,
    });
  }
}

/**
 * Analyze a document image with a text prompt
 * @param {Object} payload - { imageBlob: Blob, prompt: string }
 */
async function analyzeImage(payload) {
  if (!model || !processor) {
    self.postMessage({
      status: "error",
      error: "Model not loaded. Call LOAD first.",
    });
    return;
  }

  const { imageBlob, prompt } = payload;

  if (!imageBlob) {
    self.postMessage({ status: "error", error: "imageBlob is required." });
    return;
  }

  const userPrompt =
    prompt || "Extract all text and information from this document.";

  try {
    self.postMessage({ status: "processing", message: "Loading image..." });

    const image = await RawImage.fromBlob(imageBlob);

    // Build chat-template message with image
    const messages = [
      {
        role: "user",
        content: [{ type: "image" }, { type: "text", text: userPrompt }],
      },
    ];

    // Apply chat template to get formatted text
    const textInput = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
    });

    self.postMessage({
      status: "processing",
      message: "Processing image through vision encoder...",
    });

    const inputs = await processor(textInput, [image], {
      do_image_splitting: false, // Keep off for speed; can enable for high-res docs
    });

    self.postMessage({
      status: "processing",
      message: "Generating response...",
    });

    // Stream tokens back for responsive UI
    let outputText = "";
    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token) => {
        outputText += token;
        self.postMessage({ status: "streaming", token, partial: outputText });
      },
    });

    const { sequences } = await model.generate({
      ...inputs,
      max_new_tokens: MAX_NEW_TOKENS,
      do_sample: false,
      repetition_penalty: 1.1,
      streamer,
      return_dict_in_generate: true,
    });

    // Decode final sequences
    const decoded = processor.batch_decode(sequences, {
      skip_special_tokens: true,
    });

    // Strip the prompt prefix from the output
    const finalText = decoded[0] ?? outputText;

    self.postMessage({
      status: "complete",
      text: finalText,
      imageSize: { width: image.width, height: image.height },
    });
  } catch (err) {
    self.postMessage({
      status: "error",
      error: `Vision analysis failed: ${err.message}`,
    });
  }
}

/**
 * Unload model to free GPU memory
 */
function unloadModel() {
  model = null;
  processor = null;
  isLoading = false;

  // eslint-disable-next-line no-undef
  if (typeof gc !== "undefined") gc();

  self.postMessage({ status: "unloaded", message: "SmolVLM unloaded." });
}

// ── Message router ────────────────────────────────────────────────────────────
self.onmessage = async ({ data: { type, payload } }) => {
  switch (type) {
    case "LOAD":
      await loadModel();
      break;
    case "ANALYZE":
      await analyzeImage(payload);
      break;
    case "UNLOAD":
      unloadModel();
      break;
    case "STATUS":
      self.postMessage({
        status: "status",
        modelLoaded: !!model,
        processorLoaded: !!processor,
        isLoading,
        modelId: MODEL_ID,
      });
      break;
    default:
      self.postMessage({
        status: "error",
        error: `Unknown message type: ${type}`,
      });
  }
};
