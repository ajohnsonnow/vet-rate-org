import { describe, it, expect } from "vitest";

// advancedOCR imports pdfjs-dist, which references canvas globals jsdom
// doesn't provide (same pattern as
// advancedOCR.applyVATerminologyCorrection.test.js).
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const { adaptiveThreshold } = await import("./advancedOCR");

// A scanned page's background darkens unevenly, so a single global threshold
// either loses faint text in the dark corners or blows out the lit ones.
// adaptiveThreshold binarizes each pixel against its own neighborhood's mean
// instead of one document-wide cutoff.
const grayImage = (values, width, height) => {
  const data = new Uint8ClampedArray(width * height * 4);
  values.forEach((v, i) => {
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  });
  return { width, height, data };
};

describe("advancedOCR: adaptiveThreshold", () => {
  it("binarizes each pixel against its own local neighborhood mean, not a single global cutoff", () => {
    // Row of 3 pixels: [100, 100, 200]. blockSize 3 -> radius 1.
    // x=0: mean(100,100)=100,  100 > 95      -> white (255)
    // x=1: mean(100,100,200)=133.3, 100 <= 126.7 -> black (0)
    // x=2: mean(100,200)=150,  200 > 142.5   -> white (255)
    const image = grayImage([100, 100, 200], 3, 1);
    const result = adaptiveThreshold(image, 3);

    const pixel = (x) => [
      result.data[x * 4],
      result.data[x * 4 + 1],
      result.data[x * 4 + 2],
    ];
    expect(pixel(0)).toEqual([255, 255, 255]);
    expect(pixel(1)).toEqual([0, 0, 0]);
    expect(pixel(2)).toEqual([255, 255, 255]);
  });

  it("preserves the alpha channel and image dimensions", () => {
    const image = grayImage([10, 250, 10, 250], 2, 2);
    const result = adaptiveThreshold(image, 3);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect([...result.data].filter((_, i) => i % 4 === 3)).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it("only ever writes pure black or white into each channel", () => {
    const image = grayImage([12, 240, 88, 60, 199, 5, 133, 77, 210], 3, 3);
    const result = adaptiveThreshold(image, 5);
    for (let i = 0; i < result.data.length; i += 4) {
      expect([0, 255]).toContain(result.data[i]);
      expect(result.data[i]).toBe(result.data[i + 1]);
      expect(result.data[i]).toBe(result.data[i + 2]);
    }
  });
});
