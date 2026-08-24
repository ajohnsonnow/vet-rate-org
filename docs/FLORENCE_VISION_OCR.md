# Florence-2 Vision OCR Implementation Guide

> **STATUS: superseded for service records.** The premise below — that Florence-2
> should replace Tesseract for DD214 analysis — was tested against a real
> 39-document C-File on 2026-08-21 and did not hold. Service records now go
> through the Tesseract ensemble first; Florence is a fallback that must clear a
> field-level confidence bar before its output is allowed to replace OCR text.
> See **Measured results** below. The implementation details in this document
> remain accurate for the vision path itself.

## Overview

This document describes the client-side Vision Language Model (VLM) implementation for Vet-Rate.org using Florence-2.

## Measured results (2026-08-21)

Both engines were run over the same five real scanned service records (four
DD214 pages plus an NGB 22) and each engine's output was scored by the DD214
field parser:

| Engine             | Field-confidence score on real scans |
| ------------------ | ------------------------------------ |
| Tesseract ensemble | 83–89 / 100                          |
| Florence-2         | 4–11 / 100                           |

Florence's failure mode is the dangerous one: rather than returning nothing, it
returned _confident, fluent, invented_ text. On these documents it produced
veteran names that appear nowhere in the record, and repetition loops
("CABEENENT", "CABRSTANTS") that a naive substring match read as a Combat
Action Badge. Length and garble heuristics both passed on that output — only
scoring the parsed fields caught it.

The practical consequence: a wrong answer that looks right is worse than a
gap. Extraction for service records is therefore OCR-first, and vision output
is accepted only when it beats `VISION_MIN_FIELD_CONFIDENCE`.

## Why Florence-2 was expected to win

The original reasoning, retained for context — it is still true of the _class_
of problem, just not borne out on this corpus:

Traditional OCR is expected to struggle on DD214s because:

- Old scanned documents have noise, coffee stains, stamps
- Faxed copies lose character definition
- Crooked scans break line detection
- Military forms have complex layouts with boxes/columns

Florence-2 "sees" the document like a human would:

- Uses visual context to predict obscured text
- Understands document structure and layouts
- Handles degraded quality gracefully
- Runs 100% client-side via WebGPU

The catch is that "predicts obscured text" and "invents plausible text" are the
same capability, and on a benefits claim the second one is unacceptable.

## Architecture

```
User uploads PDF
       ↓
PDF.js renders page to canvas (216 DPI)
       ↓
Canvas converted to image blob
       ↓
Web Worker loads Florence-2 via WebGPU
       ↓
Vision model "reads" image
       ↓
Raw text → DD214 Parser → Structured data
       ↓
Display results with privacy masking
```

## File Structure

```
src/
├── workers/
│   └── florence-ocr-worker.js     # WebGPU worker (Florence-2 inference)
├── utils/
│   ├── florencePdfUtils.js        # High-res PDF rendering
│   ├── dd214VisionParser.js       # Text → structured data parser
│   └── florenceOCRService.js      # High-level service API
├── components/
│   └── DD214VisionScanner.jsx     # React drag-drop component
public/
└── pdf.worker.min.mjs             # PDF.js worker (must be in public/)
```

## Usage

### Option 1: Drop-in Component

```jsx
import DD214VisionScanner from "./components/DD214VisionScanner";

function MyPage() {
  const handleDataExtracted = (data) => {
    console.log("Parsed fields:", data.fields);
    console.log("Confidence:", data.confidence);
  };

  return (
    <DD214VisionScanner
      onDataExtracted={handleDataExtracted}
      onRawText={(text) => console.log("Raw OCR:", text)}
    />
  );
}
```

### Option 2: Service API

```javascript
import { florenceOCRService } from "../utils/florenceOCRService";

// Check browser support
if (!florenceOCRService.isWebGPUSupported()) {
  console.error("WebGPU not available");
  return;
}

// Track loading progress
florenceOCRService.addEventListener("progress", ({ progress, message }) => {
  console.log(`Loading: ${progress}% - ${message}`);
});

// Initialize (preload model)
await florenceOCRService.initialize();

// Process a document
const file = document.querySelector('input[type="file"]').files[0];
const { text, parsedData } = await florenceOCRService.processDocument(file);

console.log("Name:", parsedData.fields.name);
console.log("Branch:", parsedData.fields.branch);
console.log("MOS:", parsedData.fields.mos);

// Ask a specific question
const answer = await florenceOCRService.askQuestion(
  file,
  "What is the separation date?",
);
console.log("Separation Date:", answer);

// Clean up when done
florenceOCRService.shutdown();
```

### Option 3: Direct Worker Control

```javascript
// Create worker
const worker = new Worker(
  new URL("../workers/florence-ocr-worker.js", import.meta.url),
  { type: "module" },
);

// Handle messages
worker.onmessage = (e) => {
  const { status, progress, text, error } = e.data;

  if (status === "loading") console.log(`Progress: ${progress}%`);
  if (status === "ready") console.log("Model loaded!");
  if (status === "complete") console.log("OCR Result:", text);
  if (status === "error") console.error("Error:", error);
};

// Load model
worker.postMessage({ type: "LOAD" });

// Process image (after model is ready)
worker.postMessage({
  type: "ANALYZE",
  payload: { imageBlob: myImageBlob },
});
```

## Configuration

### PDF Rendering Scales

```javascript
import { PDF_CONFIG } from "../utils/florencePdfUtils";

PDF_CONFIG.SCALE_NORMAL; // 2.0 = 144 DPI (quick preview)
PDF_CONFIG.SCALE_HIGH; // 3.0 = 216 DPI (default for OCR)
PDF_CONFIG.SCALE_ULTRA; // 4.0 = 288 DPI (degraded documents)
PDF_CONFIG.SCALE_EXTREME; // 5.0 = 360 DPI (very poor quality)
```

### Worker Mixed Precision

The worker uses mixed-precision quantization to balance accuracy and memory:

```javascript
dtype: {
  embed_tokens: 'fp16',        // Token embeddings - keep sharp
  vision_encoder: 'fp16',      // Vision transformer - critical for OCR
  encoder_model: 'q4',         // Text encoder - can compress
  decoder_model_merged: 'q4'   // Text decoder - can compress
}
```

This reduces VRAM usage by ~50% while maintaining OCR accuracy.

## Browser Requirements

| Browser | Minimum Version | Notes                            |
| ------- | --------------- | -------------------------------- |
| Chrome  | 113+            | ✅ Full support                  |
| Edge    | 113+            | ✅ Full support                  |
| Arc     | Any             | ✅ Full support (Chromium-based) |
| Firefox | -               | ❌ No WebGPU                     |
| Safari  | 18+             | ⚠️ Experimental                  |

**Required Settings:**

- Hardware acceleration enabled
- At least 4GB GPU VRAM
- Desktop recommended (mobile may work on high-end devices)

## Privacy Guarantees

1. **Model runs in browser** - No server calls for inference
2. **Document never uploaded** - All processing happens in WebGPU/WASM
3. **SSN auto-masked** - Sensitive fields hidden by default in UI
4. **Cache API storage** - Model cached locally, not re-downloaded

## Comparison: Tesseract vs Florence-2

The first four rows were the design expectation. The last row is what the two
engines actually scored on real scanned DD214s, and it is the row that decides
the routing.

| Feature                          | Tesseract.js                              | Florence-2                               |
| -------------------------------- | ----------------------------------------- | ---------------------------------------- |
| Engine                           | Traditional OCR                           | Vision Language Model                    |
| Noise Handling                   | Expected poor                             | Expected excellent                       |
| Layout Understanding             | Basic                                     | Advanced                                 |
| Failure mode                     | Returns garbage that _looks_ like garbage | Returns fluent text that is **invented** |
| Speed (first load)               | ~2 seconds                                | ~60-120 seconds                          |
| Speed (inference)                | ~5-10 seconds                             | ~3-8 seconds                             |
| Model Size                       | ~20MB                                     | ~300MB                                   |
| GPU Required                     | No                                        | Yes (WebGPU)                             |
| Privacy                          | 100% client                               | 100% client                              |
| **Measured on real DD214 scans** | **83–89 / 100**                           | **4–11 / 100**                           |

The failure-mode row is the reason the routing is not simply "whichever scores
higher on average". Tesseract's mistakes are visibly mistakes, and the
zero-for-O correction cleans up its characteristic error. Florence's mistakes
read as clean data and reach the veteran's record as fact.

## Troubleshooting

### "WebGPU is not supported"

- Use Chrome 113+ or Edge 113+
- Enable hardware acceleration in browser settings
- Check for disabled WebGPU flags

### Model loading stuck at 0%

- Check network connectivity (first load downloads ~300MB)
- Disable browser extensions that block requests
- Try incognito mode

### Out of Memory errors

- Close other browser tabs
- Restart browser
- Check GPU VRAM (need ~4GB)

### PDF rendering issues

- Ensure pdf.worker.min.mjs is in public/ folder
- Check console for PDF.js errors
- Try PNG/JPG image instead

## Integration with Existing DD214Analyzer

The new Vision Scanner can be used alongside or replace the existing Tesseract-based OCR:

```jsx
// In DD214Analyzer.jsx, add a toggle:
import DD214VisionScanner from './DD214VisionScanner';
import { isWebGPUSupported } from '../utils/florenceOCRService';

const [useVisionAI, setUseVisionAI] = useState(isWebGPUSupported());

{useVisionAI ? (
  <DD214VisionScanner onDataExtracted={handleExtracted} />
) : (
  // Existing Tesseract-based upload UI
)}
```

## Maintenance

### Updating Florence-2 Model

The model is loaded from HuggingFace Hub. To change models:

1. Edit `florence-ocr-worker.js`:

   ```javascript
   const MODEL_ID = "onnx-community/Florence-2-base-ft"; // Change this
   ```

2. Test thoroughly - different models have different memory requirements

### Updating PDF.js

1. Update package: `npm update pdfjs-dist`
2. Re-copy worker: `cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/`
3. Update CDN URLs in `florencePdfUtils.js` if needed

## Credits

- Florence-2 by Microsoft Research
- Transformers.js by Hugging Face
- PDF.js by Mozilla
- WebGPU by W3C/Khronos

---

_Built for Vet-Rate.org - Diamond Standard veteran tools_
