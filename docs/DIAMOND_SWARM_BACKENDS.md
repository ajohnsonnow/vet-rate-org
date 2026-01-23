# Diamond Swarm AI Backend Integration

## Overview

VetRate now supports **4 local AI inference backends** for 100% private claims assistance:

| Backend | Technology | Best For | Status |
|---------|-----------|----------|--------|
| **Diamond Swarm** | WebGPU/MLC | Fast GPU inference | ⏳ Pending WebGPU compilation |
| **Wllama** | WebAssembly | Universal browser support | ✅ Ready |
| **Local Server** | llama.cpp API | Desktop power users | ✅ Ready |
| **Cloud Fallback** | Gemini 2.5 Flash | When local unavailable | ✅ Ready |

---

## 🌐 Wllama (Browser WASM)

**Works everywhere a browser runs** - no WebGPU required.

### How It Works
- Uses WebAssembly to run GGUF models directly in the browser
- Automatically downloads and caches models
- ~4.4GB per model (Q4_K_M quantization)

### Files
- `src/utils/wllamaService.js` - Main service
- Models served from `/models/` or HuggingFace CDN

### Usage
```javascript
import { initializeWllama } from './utils/unifiedAIService';

// Initialize with auditor model
await initializeWllama('auditor', (progress) => {
  console.log(`Loading: ${progress.percent}%`);
});

// Now use generateAI() - it auto-selects Wllama if available
```

---

## 🖥️ Local Server (llama.cpp)

**Maximum performance** - runs on your desktop GPU.

### Starting the Server

**Linux/WSL:**
```bash
cd /home/antho/vet-rate-swarm
./start_diamond_server.sh auditor  # or writer, rater
```

**Server runs at:** `http://localhost:8080`

### Files
- `scripts/start_diamond_server.sh` - Server startup script
- `src/utils/localServerClient.js` - API client

### Usage
```javascript
import { checkLocalServer } from './utils/unifiedAIService';

// Check if server is running
const available = await checkLocalServer();

if (available) {
  // generateAI() will automatically use local server
}
```

### API Endpoints
- `GET /health` - Server health check
- `POST /v1/chat/completions` - OpenAI-compatible chat API
- `POST /completion` - Legacy completion API

---

## Priority Order (AUTO mode)

When `AI_MODES.AUTO` is selected, backends are tried in this order:

1. **Diamond Swarm** (WebGPU) - If WebGPU available and models loaded
2. **Wllama** (WASM) - If initialized with a model
3. **Local Server** (llama.cpp) - If server is running at localhost:8080
4. **Legacy Local** (WebLLM) - If initialized
5. **Cloud** (Gemini) - If API key configured

---

## Model Files

All three Diamond Swarm agents are available as GGUF:

| Model | Size | Path |
|-------|------|------|
| Auditor | ~4.4GB | `vetrate-auditor-7b-v2-Q4_K_M.gguf` |
| Writer | ~4.4GB | `vetrate-writer-7b-v2-Q4_K_M.gguf` |
| Rater | ~4.4GB | `vetrate-rater-7b-v2-Q4_K_M.gguf` |

---

## Configuration

### Set Preferred Mode
```javascript
import { setAIMode, AI_MODES } from './utils/unifiedAIService';

setAIMode(AI_MODES.WLLAMA);       // Prefer browser WASM
setAIMode(AI_MODES.LOCAL_SERVER); // Prefer llama.cpp server
setAIMode(AI_MODES.AUTO);         // Auto-select best available
```

### Check Status
```javascript
import { getAIStatus } from './utils/unifiedAIService';

const status = getAIStatus();
console.log(status.fullStatusText); // "🌐 Wllama (Browser WASM) - 100% Private"
```

---

## Privacy Guarantee

All local backends (Wllama, Local Server, Diamond Swarm, Legacy Local) provide:
- ✅ 100% on-device inference
- ✅ No data sent to any server
- ✅ Works offline after initial model download
- ✅ PII scrubbing before processing
- ✅ Hallucination filtering on output

---

## Future: WebGPU Compilation

Once MLC-LLM WebGPU compilation is complete, models will be available in MLC format for:
- Faster inference than WASM
- Native GPU acceleration
- Smaller download size (with better quantization)

Track progress in: `llm-compiler/WEBGPU_COMPILATION_STATUS.md`
