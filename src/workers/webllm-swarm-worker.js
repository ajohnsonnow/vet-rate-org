/**
 * Vet-Rate.org - Warrant Council WebLLM Inference Worker
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Runs the MLC WebLLM engine OFF the main thread. A wedged WebGPU decode
 * (the "adapter consumed" state seen on multi-hour C-File runs) blocks only
 * this worker's event loop — the main thread stays responsive, so its
 * inference timeouts can actually fire, terminate() this worker, and respawn
 * it on a fresh GPU adapter (see reloadSwarmEngine in diamondSwarm.js).
 *
 * PRIVACY: 100% client-side. NO DATA LEAVES BROWSER.
 */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Worker-scope copy of _ensureMLCGPUPatch (diamondSwarm.js): WebLLM calls
// navigator.gpu.requestAdapter inside THIS worker, so the main-thread patch
// never reaches it. Without the adapter's true max limits, requestDevice
// falls back to defaults and high-end GPUs (Blackwell / RTX 5060 Ti class)
// fail to load models.
function ensureWorkerGPUPatch() {
  if (globalThis._mlc_gpu_patched || !navigator.gpu) return;

  const _origRequestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async function (options) {
    const a = await _origRequestAdapter(options);
    if (!a) return a;
    const aLimits = a.limits;
    const aFeatures = a.features;
    const _origRequestDevice = a.requestDevice.bind(a);
    a.requestDevice = async function (descriptor = {}) {
      const requiredLimits = {
        ...descriptor.requiredLimits,
        maxComputeInvocationsPerWorkgroup:
          aLimits.maxComputeInvocationsPerWorkgroup || 1024,
        maxStorageBufferBindingSize: aLimits.maxStorageBufferBindingSize,
        maxBufferSize: aLimits.maxBufferSize,
        maxComputeWorkgroupSizeX: aLimits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: aLimits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: aLimits.maxComputeWorkgroupSizeZ,
        maxComputeWorkgroupStorageSize: aLimits.maxComputeWorkgroupStorageSize,
        maxBindGroups: aLimits.maxBindGroups,
        maxBindingsPerBindGroup: aLimits.maxBindingsPerBindGroup,
        maxDynamicStorageBuffersPerPipelineLayout:
          aLimits.maxDynamicStorageBuffersPerPipelineLayout,
        maxStorageBuffersPerShaderStage:
          aLimits.maxStorageBuffersPerShaderStage,
      };
      const requiredFeatures = [...(descriptor.requiredFeatures || [])];
      if (
        aFeatures.has("shader-f16") &&
        !requiredFeatures.includes("shader-f16")
      ) {
        requiredFeatures.push("shader-f16");
      }
      return await _origRequestDevice({
        ...descriptor,
        requiredLimits,
        requiredFeatures,
      });
    };
    return a;
  };
  globalThis._mlc_gpu_patched = true;
}

ensureWorkerGPUPatch();

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
