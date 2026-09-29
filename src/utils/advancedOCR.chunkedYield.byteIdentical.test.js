import { describe, it, expect } from "vitest";

// advancedOCR imports pdfjs-dist, which references canvas globals jsdom
// doesn't provide (same pattern as
// advancedOCR.applyVATerminologyCorrection.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const {
  adaptiveThreshold,
  denoise,
  sharpen,
  dilate,
  erode,
  morphologicalClosing,
  unsharpMask,
  grayscale,
  enhanceContrast,
  removeYellowing,
  invert,
  autoLevels,
} = await import("./advancedOCR");

/**
 * PROOF: yielding to the event loop mid-loop (advancedOCR.js's
 * ROWS_PER_CHUNK chunking, added so a single preprocessing pass on a real
 * scanned-page image can't freeze the main thread for the ~30s measured
 * live before this fix) changes ONLY *when* each function returns control
 * to the event loop, never *what* it computes. Each reference function
 * below is the exact pre-chunking algorithm (same reads from `data`, same
 * writes to `output`, no early exits, no chunk-boundary special-casing) -
 * a plain, uninterrupted synchronous pass computed against the same input
 * these tests hand to the real (chunked, async) exports. Deep-equal
 * Uint8ClampedArray comparison on an image taller than ROWS_PER_CHUNK (40)
 * proves at least one real mid-computation yield happened and the output
 * was unaffected.
 */

const WIDTH = 12;
const HEIGHT = 97; // > 2 * ROWS_PER_CHUNK - crosses multiple chunk boundaries

// Deterministic pseudo-random grayscale image - no Math.random, reproducible.
function syntheticGrayImage(width, height) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = Math.floor(rand() * 256);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

// Independent R/G/B channels (unlike syntheticGrayImage's r=g=b), so
// removeYellowing's "r>150 && g>150 && b<150" branch actually fires for a
// share of pixels and invert exercises real per-channel values.
function syntheticColorImage(width, height) {
  let seed = 13;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = Math.floor(rand() * 256);
    data[i * 4 + 1] = Math.floor(rand() * 256);
    data[i * 4 + 2] = Math.floor(rand() * 256);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function cloneImage(img) {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  };
}

function referenceLocalMean(data, x, y, width, height, radius) {
  let sum = 0;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
        sum += data[(ny * width + nx) * 4];
        count++;
      }
    }
  }
  return sum / count;
}

function referenceAdaptiveThreshold(imageData, blockSize = 11) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  const radius = Math.floor(blockSize / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const mean = referenceLocalMean(data, x, y, width, height, radius);
      const value = data[idx] > mean * 0.95 ? 255 : 0;
      output[idx] = output[idx + 1] = output[idx + 2] = value;
    }
  }
  return output;
}

function referenceDenoise(imageData, strength = 1) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  const radius = Math.ceil(strength);
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      const values = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          values.push(data[((y + dy) * width + (x + dx)) * 4]);
        }
      }
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      output[idx] = output[idx + 1] = output[idx + 2] = median;
    }
  }
  return output;
}

function referenceSharpen(imageData, amount = 1.0) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  const kernel = [
    0,
    -amount,
    0,
    -amount,
    1 + 4 * amount,
    -amount,
    0,
    -amount,
    0,
  ];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum +=
            data[((y + ky) * width + (x + kx)) * 4] *
            kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      const idx = (y * width + x) * 4;
      const value = Math.max(0, Math.min(255, sum));
      output[idx] = output[idx + 1] = output[idx + 2] = value;
    }
  }
  return output;
}

function referenceDilate(imageData, size) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let maxVal = 0;
      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          maxVal = Math.max(maxVal, data[((y + dy) * width + (x + dx)) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = maxVal;
    }
  }
  return output;
}

function referenceErode(imageData, size) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  for (let y = size; y < height - size; y++) {
    for (let x = size; x < width - size; x++) {
      let minVal = 255;
      for (let dy = -size; dy <= size; dy++) {
        for (let dx = -size; dx <= size; dx++) {
          minVal = Math.min(minVal, data[((y + dy) * width + (x + dx)) * 4]);
        }
      }
      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = minVal;
    }
  }
  return output;
}

function referenceUnsharpMask(imageData, amount = 1.0) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  const blurred = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += data[((y + dy) * width + (x + dx)) * 4];
        }
      }
      blurred[idx] = blurred[idx + 1] = blurred[idx + 2] = sum / 9;
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    const diff = data[i] - blurred[i];
    const v = (d) => Math.max(0, Math.min(255, d + amount * diff));
    output[i] = v(data[i]);
    output[i + 1] = v(data[i + 1]);
    output[i + 2] = v(data[i + 2]);
  }
  return output;
}

function referenceGrayscale(imageData) {
  const { data } = imageData;
  const output = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    output[i] = output[i + 1] = output[i + 2] = avg;
    output[i + 3] = data[i + 3];
  }
  return output;
}

function referenceEnhanceContrast(imageData, factor) {
  const { data } = imageData;
  const output = new Uint8ClampedArray(data);
  const f = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
  const clamp = (v) => Math.max(0, Math.min(255, v));
  for (let i = 0; i < data.length; i += 4) {
    output[i] = clamp(f * (data[i] - 128) + 128);
    output[i + 1] = clamp(f * (data[i + 1] - 128) + 128);
    output[i + 2] = clamp(f * (data[i + 2] - 128) + 128);
    output[i + 3] = data[i + 3];
  }
  return output;
}

function referenceRemoveYellowing(imageData) {
  const { data } = imageData;
  const output = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 150 && g > 150 && b < 150) {
      const max = Math.max(r, g, b);
      output[i] = output[i + 1] = output[i + 2] = max;
    }
  }
  return output;
}

function referenceInvert(imageData) {
  const { data } = imageData;
  const output = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    output[i] = 255 - data[i];
    output[i + 1] = 255 - data[i + 1];
    output[i + 2] = 255 - data[i + 2];
  }
  return output;
}

function referenceAutoLevels(imageData) {
  const { data } = imageData;
  const output = new Uint8ClampedArray(data);
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < min) min = brightness;
    if (brightness > max) max = brightness;
  }
  if (max === min) return output;
  const scale = 255 / (max - min);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  for (let i = 0; i < data.length; i += 4) {
    output[i] = clamp((data[i] - min) * scale);
    output[i + 1] = clamp((data[i + 1] - min) * scale);
    output[i + 2] = clamp((data[i + 2] - min) * scale);
  }
  return output;
}

describe("advancedOCR.js chunked/yielding preprocessing: byte-identical to the pre-chunking algorithm", () => {
  it("adaptiveThreshold", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceAdaptiveThreshold(cloneImage(img), 11);
    const actual = await adaptiveThreshold(cloneImage(img), 11);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("denoise", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceDenoise(cloneImage(img), 2);
    const actual = await denoise(cloneImage(img), 2);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("sharpen", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceSharpen(cloneImage(img), 1.2);
    const actual = await sharpen(cloneImage(img), 1.2);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("dilate", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceDilate(cloneImage(img), 2);
    const actual = await dilate(cloneImage(img), 2);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("erode", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceErode(cloneImage(img), 2);
    const actual = await erode(cloneImage(img), 2);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("morphologicalClosing (dilate + erode)", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceErode(
      {
        width: WIDTH,
        height: HEIGHT,
        data: referenceDilate(cloneImage(img), 2),
      },
      2,
    );
    const actual = await morphologicalClosing(cloneImage(img), 2);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("unsharpMask", async () => {
    const img = syntheticGrayImage(WIDTH, HEIGHT);
    const expected = referenceUnsharpMask(cloneImage(img), 2.0);
    const actual = await unsharpMask(cloneImage(img), 2.0);
    expect([...actual.data]).toEqual([...expected]);
  });
});

// Same proof as above, for the full-image passes that loop flatly over
// `data` (no neighbourhood access) rather than a sliding window - these
// were the ones still left as one uninterrupted synchronous pass.
describe("advancedOCR.js flat full-image passes: byte-identical to the pre-chunking algorithm", () => {
  it("grayscale", async () => {
    const img = syntheticColorImage(WIDTH, HEIGHT);
    const expected = referenceGrayscale(cloneImage(img));
    const actual = await grayscale(cloneImage(img));
    expect([...actual.data]).toEqual([...expected]);
  });

  it("enhanceContrast", async () => {
    const img = syntheticColorImage(WIDTH, HEIGHT);
    const expected = referenceEnhanceContrast(cloneImage(img), 1.8);
    const actual = await enhanceContrast(cloneImage(img), 1.8);
    expect([...actual.data]).toEqual([...expected]);
  });

  it("removeYellowing", async () => {
    const img = syntheticColorImage(WIDTH, HEIGHT);
    const expected = referenceRemoveYellowing(cloneImage(img));
    const actual = await removeYellowing(cloneImage(img));
    expect([...actual.data]).toEqual([...expected]);
  });

  it("invert", async () => {
    const img = syntheticColorImage(WIDTH, HEIGHT);
    const expected = referenceInvert(cloneImage(img));
    const actual = await invert(cloneImage(img));
    expect([...actual.data]).toEqual([...expected]);
  });

  it("autoLevels", async () => {
    const img = syntheticColorImage(WIDTH, HEIGHT);
    const expected = referenceAutoLevels(cloneImage(img));
    const actual = await autoLevels(cloneImage(img));
    expect([...actual.data]).toEqual([...expected]);
  });
});
