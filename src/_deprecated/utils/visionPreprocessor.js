/**
 * Vet-Rate Vision Image Preprocessor
 * 
 * This utility handles image preprocessing for vision models compiled with
 * the Float32 Bypass. Since we've patched the compiler to expect float32
 * inputs instead of uint8, we need to normalize pixel data on the CPU side
 * before sending it to the GPU.
 * 
 * @module VisionPreprocessor
 * @author Vet-Rate.org Firearm Safety Team
 * @date January 2026
 */

/**
 * Converts raw RGBA image data to normalized Float32 RGB data.
 * This is the key function that enables the Float32 Bypass to work.
 * 
 * @param {ImageData|Uint8ClampedArray} imageData - Raw image data from canvas
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Float32Array} Normalized RGB data in range [0.0, 1.0]
 */
export function convertToFloat32RGB(imageData, width, height) {
  const data = imageData instanceof ImageData ? imageData.data : imageData;
  const pixelCount = width * height;
  const float32Data = new Float32Array(pixelCount * 3);
  
  for (let i = 0; i < pixelCount; i++) {
    // Extract RGBA and convert to normalized RGB
    const srcOffset = i * 4;
    const dstOffset = i * 3;
    
    float32Data[dstOffset] = data[srcOffset] / 255.0;         // R
    float32Data[dstOffset + 1] = data[srcOffset + 1] / 255.0; // G
    float32Data[dstOffset + 2] = data[srcOffset + 2] / 255.0; // B
    // Alpha channel (srcOffset + 3) is discarded
  }
  
  return float32Data;
}

/**
 * Converts raw RGBA image data to Float32 with CLIP normalization.
 * CLIP models expect specific mean/std normalization.
 * 
 * @param {ImageData|Uint8ClampedArray} imageData - Raw image data from canvas
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Float32Array} CLIP-normalized RGB data
 */
export function convertToFloat32CLIP(imageData, width, height) {
  const data = imageData instanceof ImageData ? imageData.data : imageData;
  const pixelCount = width * height;
  const float32Data = new Float32Array(pixelCount * 3);
  
  // CLIP ImageNet normalization constants
  const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
  const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];
  
  for (let i = 0; i < pixelCount; i++) {
    const srcOffset = i * 4;
    const dstOffset = i * 3;
    
    // Normalize to [0, 1] then apply CLIP normalization
    for (let c = 0; c < 3; c++) {
      const normalized = data[srcOffset + c] / 255.0;
      float32Data[dstOffset + c] = (normalized - CLIP_MEAN[c]) / CLIP_STD[c];
    }
  }
  
  return float32Data;
}

/**
 * Prepares an image for vision model input with proper tensor layout.
 * Vision models typically expect [batch, channels, height, width] (NCHW) format.
 * 
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} source - Image source
 * @param {Object} options - Configuration options
 * @param {number} [options.targetWidth=336] - Target width (CLIP uses 336)
 * @param {number} [options.targetHeight=336] - Target height (CLIP uses 336)
 * @param {boolean} [options.clipNormalize=true] - Apply CLIP normalization
 * @returns {Promise<{data: Float32Array, shape: number[]}>} Tensor data and shape
 */
export async function prepareImageForVision(source, options = {}) {
  const {
    targetWidth = 336,
    targetHeight = 336,
    clipNormalize = true
  } = options;
  
  // Create offscreen canvas for resizing
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  
  // Draw and resize image
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  
  // Convert to Float32
  const hwcData = clipNormalize 
    ? convertToFloat32CLIP(imageData, targetWidth, targetHeight)
    : convertToFloat32RGB(imageData, targetWidth, targetHeight);
  
  // Convert from HWC (height, width, channels) to CHW (channels, height, width)
  const chwData = new Float32Array(targetWidth * targetHeight * 3);
  const pixelCount = targetWidth * targetHeight;
  
  for (let h = 0; h < targetHeight; h++) {
    for (let w = 0; w < targetWidth; w++) {
      const hwcIdx = (h * targetWidth + w) * 3;
      for (let c = 0; c < 3; c++) {
        const chwIdx = c * pixelCount + h * targetWidth + w;
        chwData[chwIdx] = hwcData[hwcIdx + c];
      }
    }
  }
  
  return {
    data: chwData,
    shape: [1, 3, targetHeight, targetWidth]  // NCHW format
  };
}

/**
 * Batch processes multiple images for vision model input.
 * 
 * @param {Array<HTMLImageElement|HTMLCanvasElement|ImageBitmap>} sources - Image sources
 * @param {Object} options - Configuration options
 * @returns {Promise<{data: Float32Array, shape: number[]}>} Batched tensor data
 */
export async function prepareBatchForVision(sources, options = {}) {
  const {
    targetWidth = 336,
    targetHeight = 336,
    clipNormalize = true
  } = options;
  
  const batchSize = sources.length;
  const channelSize = targetWidth * targetHeight;
  const imageSize = channelSize * 3;
  
  const batchData = new Float32Array(batchSize * imageSize);
  
  // Process all images in parallel
  const processedImages = await Promise.all(
    sources.map(source => prepareImageForVision(source, options))
  );
  
  // Combine into batch tensor
  processedImages.forEach((result, batchIdx) => {
    batchData.set(result.data, batchIdx * imageSize);
  });
  
  return {
    data: batchData,
    shape: [batchSize, 3, targetHeight, targetWidth]
  };
}

/**
 * Extracts image from a file input or blob and prepares it for vision.
 * 
 * @param {File|Blob} file - Image file
 * @param {Object} options - Configuration options
 * @returns {Promise<{data: Float32Array, shape: number[]}>} Tensor data and shape
 */
export async function prepareFileForVision(file, options = {}) {
  const bitmap = await createImageBitmap(file);
  return prepareImageForVision(bitmap, options);
}

/**
 * Utility to check if the browser supports the Float32 bypass approach.
 * This checks for basic WebGPU support without requiring experimental features.
 * 
 * @returns {Promise<{supported: boolean, message: string}>}
 */
export async function checkFloat32Support() {
  if (!navigator.gpu) {
    return {
      supported: false,
      message: 'WebGPU is not supported in this browser'
    };
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        message: 'Could not get WebGPU adapter'
      };
    }
    
    const device = await adapter.requestDevice();
    
    // Check for float32 shader support (should be universal in WebGPU)
    const features = [...adapter.features];
    
    // We specifically do NOT require shader-f16 or experimental features
    // That's the whole point of the Float32 bypass!
    
    device.destroy();
    
    return {
      supported: true,
      message: 'Float32 vision models are supported',
      features: features
    };
  } catch (error) {
    return {
      supported: false,
      message: `WebGPU initialization failed: ${error.message}`
    };
  }
}

/**
 * Debug utility to visualize Float32 tensor data as an image.
 * Useful for verifying preprocessing is working correctly.
 * 
 * @param {Float32Array} data - CHW format Float32 data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {boolean} [clipNormalized=true] - Whether data is CLIP normalized
 * @returns {HTMLCanvasElement} Canvas with reconstructed image
 */
export function debugVisualizeTensor(data, width, height, clipNormalized = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  
  const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
  const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];
  
  const pixelCount = width * height;
  
  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      const pixelIdx = h * width + w;
      const outputIdx = pixelIdx * 4;
      
      for (let c = 0; c < 3; c++) {
        const chwIdx = c * pixelCount + pixelIdx;
        let value = data[chwIdx];
        
        // Reverse CLIP normalization if applied
        if (clipNormalized) {
          value = value * CLIP_STD[c] + CLIP_MEAN[c];
        }
        
        // Convert back to 0-255
        imageData.data[outputIdx + c] = Math.round(Math.max(0, Math.min(255, value * 255)));
      }
      
      imageData.data[outputIdx + 3] = 255; // Alpha
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Export default object for convenience
export default {
  convertToFloat32RGB,
  convertToFloat32CLIP,
  prepareImageForVision,
  prepareBatchForVision,
  prepareFileForVision,
  checkFloat32Support,
  debugVisualizeTensor
};
