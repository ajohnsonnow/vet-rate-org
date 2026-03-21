/**
 * Vet-Rate.org - Florence-2 Vision OCR Worker
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * DIAMOND STANDARD Vision OCR - Client-Side VLM for DD214 Analysis
 *
 * Engine: Florence-2-base-ft (Fine-tuned for documents)
 * Backend: WebGPU with mixed-precision quantization
 * Privacy: 100% client-side - NO DATA LEAVES BROWSER
 *
 * CAPABILITIES:
 * - Dense OCR for complex document layouts
 * - Visual Question Answering (DOC_VQA)
 * - Handles scanned, crooked, noisy DD214s
 * - Mixed precision (fp16 vision + q4 decoder) for memory efficiency
 */

import {
  AutoProcessor,
  Florence2ForConditionalGeneration,
  env,
  RawImage,
} from "@huggingface/transformers";

// Browser environment configuration
env.allowLocalModels = false; // Force fetching from HuggingFace Hub
env.useBrowserCache = true; // Cache in browser (Cache API)

// Model selection - fine-tuned version is better for documents
const MODEL_ID = "onnx-community/Florence-2-base-ft";

// Worker state
let model = null;
let processor = null;
let isLoading = false;

/**
 * Task tokens for Florence-2
 * @see https://huggingface.co/microsoft/Florence-2-base
 */
const TASKS = {
  OCR: "<OCR>", // Full text extraction (best for DD214)
  OCR_WITH_REGION: "<OCR_WITH_REGION>", // OCR with bounding boxes
  CAPTION: "<CAPTION>", // Basic image description
  DETAILED_CAPTION: "<DETAILED_CAPTION>",
  MORE_DETAILED_CAPTION: "<MORE_DETAILED_CAPTION>",
  OD: "<OD>", // Object detection
  DENSE_REGION_CAPTION: "<DENSE_REGION_CAPTION>",
  REGION_PROPOSAL: "<REGION_PROPOSAL>",
  DOC_VQA: "<DOC_VQA>", // Document Visual Question Answering
};

/**
 * Message handler
 */
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case "LOAD":
      await loadModel();
      break;

    case "ANALYZE":
      await analyzeImage(payload);
      break;

    case "DOC_VQA":
      await askDocumentQuestion(payload);
      break;

    case "STATUS":
      sendStatus();
      break;

    case "UNLOAD":
      unloadModel();
      break;

    default:
      self.postMessage({
        status: "error",
        error: `Unknown message type: ${type}`,
      });
  }
};

/**
 * Load Florence-2 model with mixed precision
 * Uses fp16 for vision (accuracy) and q4 for decoder (memory savings)
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
    self.postMessage({
      status: "loading",
      progress: 0,
      stage: "init",
      message: "Initializing Florence-2 Vision Engine...",
    });

    // Load processor first (small, fast)
    self.postMessage({
      status: "loading",
      progress: 5,
      stage: "processor",
      message: "Loading image processor...",
    });

    processor = await AutoProcessor.from_pretrained(MODEL_ID);

    // Load model with mixed precision for optimal memory/quality balance
    // This is the "secret sauce" that prevents browser crashes
    self.postMessage({
      status: "loading",
      progress: 10,
      stage: "model",
      message:
        "Loading vision model (this may take 1-2 minutes on first load)...",
    });

    model = await Florence2ForConditionalGeneration.from_pretrained(MODEL_ID, {
      device: "webgpu",
      dtype: {
        // Mixed Precision Strategy:
        // - Keep vision encoder in fp16 for accuracy (the "eyes")
        // - Compress language model to q4 for memory savings (the "brain")
        embed_tokens: "fp16", // Token embeddings - keep sharp
        vision_encoder: "fp16", // Vision transformer - critical for OCR
        encoder_model: "q4", // Text encoder - can compress
        decoder_model_merged: "q4", // Text decoder - can compress
      },
      progress_callback: (info) => {
        if (info.status === "progress") {
          // Scale progress from 10-95%
          const scaledProgress = 10 + info.progress * 0.85;
          self.postMessage({
            status: "loading",
            progress: Math.round(scaledProgress),
            stage: "download",
            file: info.file || "model weights",
            message: `Downloading: ${info.file || "model weights"}...`,
          });
        }
      },
    });

    isLoading = false;

    self.postMessage({
      status: "ready",
      progress: 100,
      message: "Florence-2 Vision Engine ready!",
      modelInfo: {
        id: MODEL_ID,
        device: "webgpu",
        quantization: "mixed (fp16+q4)",
      },
    });
  } catch (err) {
    isLoading = false;

    // Provide helpful error messages for common failures
    let errorMessage = err.message;
    let errorType = "unknown";

    if (err.message.includes("WebGPU")) {
      errorType = "webgpu";
      errorMessage =
        "WebGPU not supported. Please use Chrome/Edge 113+ on desktop.";
    } else if (err.message.includes("memory") || err.message.includes("OOM")) {
      errorType = "memory";
      errorMessage =
        "Insufficient GPU memory. Try closing other tabs or applications.";
    } else if (
      err.message.includes("network") ||
      err.message.includes("fetch")
    ) {
      errorType = "network";
      errorMessage =
        "Network error downloading model. Check internet connection.";
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
 * Analyze image with OCR task
 * @param {Object} payload - { imageBlob: Blob, task?: string }
 */
async function analyzeImage(payload) {
  if (!model || !processor) {
    self.postMessage({
      status: "error",
      error: "Model not loaded. Call LOAD first.",
    });
    return;
  }

  try {
    self.postMessage({
      status: "processing",
      stage: "ingest",
      message: "Preparing image for analysis...",
    });

    // Convert blob to RawImage format
    const image = await RawImage.fromBlob(payload.imageBlob);

    // Use OCR task by default (best for DD214 full text extraction)
    const task = payload.task || TASKS.OCR;

    self.postMessage({
      status: "processing",
      stage: "tokenize",
      message: "Processing image through vision encoder...",
    });

    // Process image + task prompt
    const inputs = await processor(image, task);

    self.postMessage({
      status: "processing",
      stage: "generate",
      message: "AI reading document...",
    });

    // Generate output
    const generated_ids = await model.generate({
      ...inputs,
      max_new_tokens: 1536, // DD214s can be text-heavy
      do_sample: false, // Deterministic output for OCR
      num_beams: 1, // Greedy decoding (faster)
    });

    // Decode tokens to text
    const generated_text = processor.batch_decode(generated_ids, {
      skip_special_tokens: false,
    })[0];

    // Post-process to extract clean result
    const result = processor.post_process_generation(
      generated_text,
      task,
      image.size,
    );

    // Extract the actual text from the result
    const extractedText = result[task] || result;

    self.postMessage({
      status: "complete",
      task,
      text: extractedText,
      rawResult: result,
      imageSize: { width: image.width, height: image.height },
    });
  } catch (err) {
    self.postMessage({
      status: "error",
      error: `Analysis failed: ${err.message}`,
      stage: "analyze",
    });
  }
}

/**
 * Document Visual Question Answering
 * Ask specific questions about the document
 * @param {Object} payload - { imageBlob: Blob, question: string }
 */
async function askDocumentQuestion(payload) {
  if (!model || !processor) {
    self.postMessage({
      status: "error",
      error: "Model not loaded. Call LOAD first.",
    });
    return;
  }

  if (!payload.question) {
    self.postMessage({
      status: "error",
      error: "Question is required for DOC_VQA task.",
    });
    return;
  }

  try {
    self.postMessage({
      status: "processing",
      stage: "vqa",
      message: `Analyzing: "${payload.question}"...`,
    });

    const image = await RawImage.fromBlob(payload.imageBlob);

    // For DOC_VQA, the task token is combined with the question
    const taskPrompt = `${TASKS.DOC_VQA}${payload.question}`;

    const inputs = await processor(image, taskPrompt);

    const generated_ids = await model.generate({
      ...inputs,
      max_new_tokens: 256, // Answers are usually short
      do_sample: false,
    });

    const generated_text = processor.batch_decode(generated_ids, {
      skip_special_tokens: false,
    })[0];

    const result = processor.post_process_generation(
      generated_text,
      TASKS.DOC_VQA,
      image.size,
    );

    self.postMessage({
      status: "complete",
      task: "DOC_VQA",
      question: payload.question,
      answer: result[TASKS.DOC_VQA] || result,
    });
  } catch (err) {
    self.postMessage({
      status: "error",
      error: `VQA failed: ${err.message}`,
      stage: "vqa",
    });
  }
}

/**
 * Get current worker status
 */
function sendStatus() {
  self.postMessage({
    status: "status",
    modelLoaded: !!model,
    processorLoaded: !!processor,
    isLoading,
    modelId: MODEL_ID,
  });
}

/**
 * Unload model to free memory
 */
function unloadModel() {
  model = null;
  processor = null;
  isLoading = false;

  // Trigger garbage collection hint
  if (typeof gc !== "undefined") gc();

  self.postMessage({
    status: "unloaded",
    message: "Vision model unloaded to free memory.",
  });
}
