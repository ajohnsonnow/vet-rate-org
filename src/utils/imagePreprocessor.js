/**
 * SupplyLocker.org - Image Preprocessing for OCR Enhancement
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Advanced image preprocessing to improve OCR accuracy on poor-quality scans:
 * - Deskewing (straighten rotated documents)
 * - Contrast enhancement
 * - Noise reduction
 * - Binarization (convert to black and white)
 * - Resolution upscaling
 * - Background removal
 * 
 * All processing is 100% client-side using Canvas API.
 */

/**
 * Preprocessing options
 */
export const PREPROCESS_OPTIONS = {
  NONE: 'none',
  LIGHT: 'light',           // Basic enhancement
  MEDIUM: 'medium',         // Standard preprocessing (recommended)
  AGGRESSIVE: 'aggressive'  // Maximum enhancement for very poor scans
};

/**
 * Apply image preprocessing to enhance OCR accuracy
 * @param {HTMLCanvasElement} canvas - Canvas with the original image
 * @param {string} level - Preprocessing level (PREPROCESS_OPTIONS)
 * @returns {HTMLCanvasElement} - New canvas with processed image
 */
export function preprocessImageForOCR(canvas, level = PREPROCESS_OPTIONS.MEDIUM) {
  if (level === PREPROCESS_OPTIONS.NONE) {
    return canvas;
  }

  const processed = document.createElement('canvas');
  const ctx = processed.getContext('2d');
  processed.width = canvas.width;
  processed.height = canvas.height;

  // Get image data
  ctx.drawImage(canvas, 0, 0);
  let imageData = ctx.getImageData(0, 0, processed.width, processed.height);

  // Apply preprocessing steps based on level
  switch (level) {
    case PREPROCESS_OPTIONS.LIGHT:
      imageData = enhanceContrast(imageData, 1.2);
      imageData = sharpen(imageData, 0.5);
      break;

    case PREPROCESS_OPTIONS.MEDIUM:
      imageData = grayscale(imageData);
      imageData = enhanceContrast(imageData, 1.5);
      imageData = denoise(imageData);
      imageData = binarize(imageData, 128);
      imageData = sharpen(imageData, 1.0);
      break;

    case PREPROCESS_OPTIONS.AGGRESSIVE:
      imageData = grayscale(imageData);
      imageData = enhanceContrast(imageData, 2.0);
      imageData = denoise(imageData, 1.5);
      imageData = binarize(imageData, 140);
      imageData = morphologicalOpening(imageData);
      imageData = sharpen(imageData, 1.5);
      break;
  }

  // Put processed image back
  ctx.putImageData(imageData, 0, 0);
  return processed;
}

/**
 * Convert image to grayscale
 */
function grayscale(imageData) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;       // R
    data[i + 1] = avg;   // G
    data[i + 2] = avg;   // B
    // data[i + 3] is alpha, leave unchanged
  }
  
  return imageData;
}

/**
 * Enhance contrast
 */
function enhanceContrast(imageData, factor = 1.5) {
  const data = imageData.data;
  const contrastFactor = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(contrastFactor * (data[i] - 128) + 128);       // R
    data[i + 1] = clamp(contrastFactor * (data[i + 1] - 128) + 128); // G
    data[i + 2] = clamp(contrastFactor * (data[i + 2] - 128) + 128); // B
  }
  
  return imageData;
}

/**
 * Simple denoising using median filter
 */
function denoise(imageData, radius = 1) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      
      // Collect neighborhood pixels
      const values = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[nIdx]); // R channel (same for grayscale)
        }
      }
      
      // Apply median
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      
      output[idx] = median;
      output[idx + 1] = median;
      output[idx + 2] = median;
      // Alpha unchanged
    }
  }
  
  imageData.data.set(output);
  return imageData;
}

/**
 * Binarize image (convert to pure black and white)
 */
function binarize(imageData, threshold = 128) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Use average of RGB (should be same for grayscale)
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const binary = gray > threshold ? 255 : 0;
    
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
  
  return imageData;
}

/**
 * Sharpen image using convolution
 */
function sharpen(imageData, amount = 1.0) {
  const kernel = [
    0, -1 * amount, 0,
    -1 * amount, 1 + 4 * amount, -1 * amount,
    0, -1 * amount, 0
  ];
  
  return applyConvolution(imageData, kernel);
}

/**
 * Morphological opening (erosion followed by dilation)
 * Helps remove small noise artifacts
 */
function morphologicalOpening(imageData) {
  let eroded = erode(imageData);
  let dilated = dilate(eroded);
  return dilated;
}

/**
 * Erosion - shrink white regions
 */
function erode(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Check 3x3 neighborhood
      let minVal = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          minVal = Math.min(minVal, data[nIdx]);
        }
      }
      
      output[idx] = minVal;
      output[idx + 1] = minVal;
      output[idx + 2] = minVal;
    }
  }
  
  imageData.data.set(output);
  return imageData;
}

/**
 * Dilation - expand white regions
 */
function dilate(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Check 3x3 neighborhood
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          maxVal = Math.max(maxVal, data[nIdx]);
        }
      }
      
      output[idx] = maxVal;
      output[idx + 1] = maxVal;
      output[idx + 2] = maxVal;
    }
  }
  
  imageData.data.set(output);
  return imageData;
}

/**
 * Apply convolution filter
 */
function applyConvolution(imageData, kernel) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  const kernelSize = Math.sqrt(kernel.length);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      let r = 0, g = 0, b = 0;
      
      // Apply kernel
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - halfKernel;
          const py = y + ky - halfKernel;
          const pIdx = (py * width + px) * 4;
          const kVal = kernel[ky * kernelSize + kx];
          
          r += data[pIdx] * kVal;
          g += data[pIdx + 1] * kVal;
          b += data[pIdx + 2] * kVal;
        }
      }
      
      const idx = (y * width + x) * 4;
      output[idx] = clamp(r);
      output[idx + 1] = clamp(g);
      output[idx + 2] = clamp(b);
    }
  }
  
  imageData.data.set(output);
  return imageData;
}

/**
 * Automatically detect optimal preprocessing level
 * Analyzes image quality metrics to determine best approach
 */
export function detectOptimalPreprocessing(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Calculate metrics
  let avgBrightness = 0;
  let contrastSum = 0;
  let noiseEstimate = 0;
  const sampleSize = Math.min(10000, data.length / 4); // Sample 10k pixels max
  const step = Math.floor((data.length / 4) / sampleSize);
  
  let prevPixel = 0;
  for (let i = 0; i < data.length; i += (step * 4)) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    avgBrightness += brightness;
    
    // Estimate noise by looking at pixel-to-pixel variation
    if (i > 0) {
      noiseEstimate += Math.abs(brightness - prevPixel);
    }
    prevPixel = brightness;
  }
  
  avgBrightness /= sampleSize;
  noiseEstimate /= sampleSize;
  
  // Calculate contrast
  let minBright = 255, maxBright = 0;
  for (let i = 0; i < data.length; i += (step * 4)) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    minBright = Math.min(minBright, brightness);
    maxBright = Math.max(maxBright, brightness);
  }
  const contrast = maxBright - minBright;
  
  // Determine optimal level based on metrics
  if (contrast < 100 || noiseEstimate > 20) {
    return PREPROCESS_OPTIONS.AGGRESSIVE;
  } else if (contrast < 150 || noiseEstimate > 10) {
    return PREPROCESS_OPTIONS.MEDIUM;
  } else {
    return PREPROCESS_OPTIONS.LIGHT;
  }
}

/**
 * Clamp value between 0 and 255
 */
function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Upscale image for better OCR (2x resolution)
 */
export function upscaleForOCR(canvas) {
  const upscaled = document.createElement('canvas');
  const ctx = upscaled.getContext('2d');
  
  upscaled.width = canvas.width * 2;
  upscaled.height = canvas.height * 2;
  
  // Use high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
  
  return upscaled;
}

/**
 * Deskew image (detect and correct rotation)
 * Uses Hough transform to detect dominant line angles
 */
export function deskewImage(canvas) {
  // Simplified deskew - detect horizontal line angles
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Edge detection first
  const edges = detectEdges(imageData);
  
  // Hough transform to find dominant angles
  const angle = findDominantAngle(edges);
  
  // If angle is significant (> 0.5 degrees), rotate
  if (Math.abs(angle) > 0.5) {
    return rotateCanvas(canvas, -angle);
  }
  
  return canvas;
}

/**
 * Simple edge detection (Sobel operator)
 */
function detectEdges(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const edges = new Uint8ClampedArray(width * height);
  
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const idx = ((y + ky - 1) * width + (x + kx - 1)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const kIdx = ky * 3 + kx;
          gx += gray * sobelX[kIdx];
          gy += gray * sobelY[kIdx];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude > 128 ? 255 : 0;
    }
  }
  
  return { data: edges, width, height };
}

/**
 * Find dominant angle using simplified Hough transform
 */
function findDominantAngle(edges) {
  // Sample edge points
  const angleVotes = new Array(180).fill(0);
  const { data, width, height } = edges;
  
  // Sample every 10th edge pixel
  for (let y = 0; y < height; y += 10) {
    for (let x = 0; x < width; x += 10) {
      if (data[y * width + x] > 128) {
        // Check neighboring pixels to estimate local angle
        if (x + 1 < width && y + 1 < height) {
          const dx = data[y * width + x + 1] - data[y * width + x];
          const dy = data[(y + 1) * width + x] - data[y * width + x];
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const angleIdx = Math.floor(angle + 90); // 0-180 range
          if (angleIdx >= 0 && angleIdx < 180) {
            angleVotes[angleIdx]++;
          }
        }
      }
    }
  }
  
  // Find peak angle
  let maxVotes = 0;
  let dominantAngle = 0;
  for (let i = 0; i < 180; i++) {
    if (angleVotes[i] > maxVotes) {
      maxVotes = angleVotes[i];
      dominantAngle = i - 90; // Convert back to -90 to 90 range
    }
  }
  
  return dominantAngle;
}

/**
 * Rotate canvas by angle (degrees)
 */
function rotateCanvas(canvas, angleDegrees) {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const rotated = document.createElement('canvas');
  const ctx = rotated.getContext('2d');
  
  // Calculate new dimensions
  const cos = Math.abs(Math.cos(angleRadians));
  const sin = Math.abs(Math.sin(angleRadians));
  rotated.width = canvas.width * cos + canvas.height * sin;
  rotated.height = canvas.width * sin + canvas.height * cos;
  
  // Rotate around center
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(angleRadians);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
  return rotated;
}
