// No-op sharp replacement.
//
// @huggingface/transformers lists sharp as a dependency for Node.js image
// preprocessing, but the project's browser build (Vite) stubs sharp at
// bundle time — it is marked "(ignored)" in the transformers.js browser
// bundle and never loaded in browser WebGPU workers.
//
// This stub eliminates the @img/sharp-*-x64 LGPL native binaries from
// node_modules. If anything does reach the sharp code path in a non-browser
// context (tests, SSR), the error message below explains what happened.

const ERR = '[sharp-noop] sharp is not available: this project uses ' +
  '@huggingface/transformers in browser WebGPU workers where sharp is ' +
  'never invoked. Canvas-API fallback handles image preprocessing.';

function sharp() {
  const api = {
    resize: () => api,
    extract: () => api,
    extend: () => api,
    flatten: () => api,
    rotate: () => api,
    flip: () => api,
    flop: () => api,
    sharpen: () => api,
    blur: () => api,
    gamma: () => api,
    negate: () => api,
    normalise: () => api,
    normalize: () => api,
    threshold: () => api,
    linear: () => api,
    recomb: () => api,
    modulate: () => api,
    tint: () => api,
    grayscale: () => api,
    greyscale: () => api,
    toColourspace: () => api,
    toColorspace: () => api,
    composite: () => api,
    toFormat: () => api,
    png: () => api,
    jpeg: () => api,
    webp: () => api,
    avif: () => api,
    gif: () => api,
    tiff: () => api,
    raw: () => api,
    tile: () => api,
    withMetadata: () => api,
    metadata: () => Promise.reject(new Error(ERR)),
    stats: () => Promise.reject(new Error(ERR)),
    toBuffer: (cb) => {
      if (typeof cb === 'function') { cb(new Error(ERR)); return api; }
      return Promise.reject(new Error(ERR));
    },
    toFile: (_path, cb) => {
      if (typeof cb === 'function') { cb(new Error(ERR)); return api; }
      return Promise.reject(new Error(ERR));
    },
  };
  return api;
}

sharp.cache = () => ({ memory: 0, files: 0, items: 0 });
sharp.concurrency = () => 0;
sharp.counters = () => ({ queue: 0, process: 0 });
sharp.simd = () => false;
sharp.format = {};
sharp.interpolators = {};
sharp.versions = { vips: '0.0.0', cairo: '0.0.0' };

module.exports = sharp;
module.exports.default = sharp;
