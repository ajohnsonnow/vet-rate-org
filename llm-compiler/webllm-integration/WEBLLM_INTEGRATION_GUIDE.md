# WebLLM Integration Guide — VetRate Custom Swarm

## 🎯 Overview

This React/TypeScript hook (`useVetRateSwarm`) provides a complete interface for running your LoRA-trained VA specialist models directly in the browser via WebGPU.

**Zero server dependencies** — all inference runs 100% client-side.

---

## 📦 Installation

```bash
# Install WebLLM dependency
npm install @mlc-ai/web-llm

# Or with yarn
yarn add @mlc-ai/web-llm
```

---

## 🗂️ File Structure

After MLC compilation, your `/dist` folder should look like:

```
public/
└── dist/
    ├── vetrate-auditor-web/
    │   ├── mlc-chat-config.json
    │   ├── ndarray-cache.json
    │   ├── params_shard_0.bin
    │   ├── params_shard_1.bin
    │   ├── ...
    │   ├── tokenizer.json
    │   ├── tokenizer_config.json
    │   └── vetrate-auditor-3b-q4f16-webgpu.wasm
    │
    ├── vetrate-writer-web/
    │   └── ... (same structure)
    │
    └── vetrate-rater-web/
        └── ... (same structure)
```

---

## ⚙️ AppConfig Deep Dive

The `createAppConfig()` function generates the configuration WebLLM needs to locate your local models:

```typescript
function createAppConfig(role: SwarmRole, basePath: string): AppConfig {
  const roleConfig = SWARM_CONFIGS[role];
  const modelPath = `${basePath}/vetrate-${role}-web`;

  return {
    model_list: [
      {
        // Path to model directory (relative to public/)
        model: `${modelPath}`,
        
        // Unique identifier (must match what you used in MLC compile)
        model_id: roleConfig.modelId,
        
        // Path to compiled WebGPU WASM library
        model_lib: `${modelPath}/${roleConfig.modelId}-webgpu.wasm`,
        
        // Optional overrides
        overrides: {
          context_window_size: 4096,
        },
      },
    ],
    // Enable web worker for non-blocking UI
    use_web_worker: true,
  };
}
```

### Custom Base Path

If your models are hosted elsewhere (e.g., CDN), update `modelBasePath`:

```typescript
const swarm = useVetRateSwarm({
  modelBasePath: 'https://cdn.vetrate.org/models',
  debug: true,
});
```

---

## 🚀 Basic Usage

```tsx
import { useVetRateSwarm } from './useVetRateSwarm';

function MyComponent() {
  const {
    isLoading,
    isReady,
    isInferring,
    currentRole,
    loadProgress,
    error,
    webGpuSupported,
    initEngine,
    switchRole,
    runInference,
    abortInference,
  } = useVetRateSwarm({
    initialRole: 'auditor',
    modelBasePath: '/dist',
    debug: true,
  });

  // Initialize with progress callback
  const handleInit = async () => {
    await initEngine('auditor', (progress) => {
      console.log(`Loading Model: ${(progress.progress * 100).toFixed(1)}%`);
      // progress.text contains status message
      // progress.timeElapsed contains seconds elapsed
    });
  };

  // Run inference with streaming
  const handleChat = async (prompt: string) => {
    const response = await runInference(prompt, {
      maxTokens: 1024,
      temperature: 0.7,
      onChunk: (chunk) => {
        // Each token as it's generated
        console.log(chunk);
      },
    });
    return response;
  };

  // Hot-swap to different specialist
  const switchToWriter = async () => {
    await switchRole('writer', (progress) => {
      console.log(`Switching: ${(progress.progress * 100).toFixed(1)}%`);
    });
  };
}
```

---

## 🛡️ WebGPU Error Handling

The hook automatically checks WebGPU availability:

```tsx
const { webGpuSupported, error } = useVetRateSwarm();

if (!webGpuSupported) {
  return (
    <div className="error-banner">
      <h2>WebGPU Not Available</h2>
      <p>{error}</p>
      <ul>
        <li>Chrome 113+ (recommended)</li>
        <li>Edge 113+</li>
        <li>Firefox Nightly with WebGPU flag</li>
      </ul>
    </div>
  );
}
```

### Manual Check

```typescript
import { checkWebGPUSupport } from './useVetRateSwarm';

const { supported, error } = await checkWebGPUSupport();
if (!supported) {
  alert(error);
}
```

---

## 📊 Progress Callback Structure

```typescript
interface LoadProgress {
  progress: number;      // 0.0 to 1.0
  timeElapsed: number;   // Seconds since init started
  text: string;          // Human-readable status
}
```

### Progress Messages (typical sequence):
1. `"Initializing..."`
2. `"Loading model from cache..."`
3. `"Downloading params_shard_0.bin (45.2 MB)..."`
4. `"Compiling WebGPU shaders..."`
5. `"Model loaded successfully!"`

---

## 🔄 Hot-Swapping Roles

Switch between specialists without page reload:

```typescript
// Initial load
await initEngine('auditor');

// ... user asks regulatory question, Auditor responds ...

// Switch to Writer for drafting
await switchRole('writer');

// ... user asks for personal statement draft, Writer responds ...

// Switch to Rater for calculations
await switchRole('rater');
```

Each role has a specialized system prompt optimized for its domain.

---

## 💉 Injecting Knowledge Context

Pass retrieved VA regulations as context:

```typescript
const response = await runInference(
  "What rating should I expect for sleep apnea with CPAP?",
  {
    knowledgeContext: `
38 CFR § 4.97 - Schedule of ratings—respiratory system
DC 6847 - Sleep Apnea Syndromes:
- 100%: Chronic respiratory failure with carbon dioxide retention or cor pulmonale
- 50%: Requires use of breathing assistance device such as CPAP
- 30%: Persistent day-time hypersomnolence
- 0%: Asymptomatic but documented sleep disorder
    `,
    maxTokens: 512,
  }
);
```

---

## ⏹️ Aborting Inference

```typescript
const { runInference, abortInference, isInferring } = useVetRateSwarm();

// Start long inference
const promise = runInference("Explain all PACT Act conditions...");

// User clicks cancel
if (isInferring) {
  abortInference();
}
```

---

## 📋 API Reference

### Hook Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialRole` | `SwarmRole` | `'auditor'` | Initial model to load |
| `modelBasePath` | `string` | `'/dist'` | Base path to compiled models |
| `debug` | `boolean` | `false` | Enable console logging |

### Returned State

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | `boolean` | Model is being downloaded/compiled |
| `isReady` | `boolean` | Model ready for inference |
| `isInferring` | `boolean` | Currently generating response |
| `currentRole` | `SwarmRole \| null` | Active specialist role |
| `loadProgress` | `LoadProgress \| null` | Download progress details |
| `error` | `string \| null` | Last error message |
| `webGpuSupported` | `boolean` | Browser supports WebGPU |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `initEngine` | `(role?, onProgress?) => Promise<boolean>` | Initialize/load model |
| `switchRole` | `(role, onProgress?) => Promise<boolean>` | Hot-swap to different role |
| `runInference` | `(prompt, options?) => Promise<string>` | Generate response |
| `abortInference` | `() => void` | Cancel current generation |
| `getSystemPrompt` | `() => string \| null` | Get current role's system prompt |

---

## 🚨 Troubleshooting

### "Model not found"
- Verify files exist in `/public/dist/vetrate-{role}-web/`
- Check `ndarray-cache.json` and `params_shard_*.bin` files are present
- Ensure WASM file name matches `model_lib` in config

### "WebGPU not available"
- Update browser to Chrome 113+ or Edge 113+
- Check GPU drivers are up to date
- Try `chrome://flags/#enable-unsafe-webgpu` (Chrome)

### "Out of memory"
- Close other GPU-intensive applications
- Reduce `context_window_size` in overrides
- Ensure you're using q4f16_1 quantized models (not fp16)

### Slow first load
- Normal! First load downloads ~1.5GB per model
- Models are cached in IndexedDB after first download
- Subsequent loads are nearly instant

---

## 📈 Performance Tips

1. **Preload models** during user onboarding:
   ```typescript
   useEffect(() => {
     initEngine('auditor'); // Start loading immediately
   }, []);
   ```

2. **Show progress UI** to reduce perceived wait time

3. **Use streaming** (`onChunk`) for responsive UX

4. **Cache model selection** in localStorage:
   ```typescript
   const savedRole = localStorage.getItem('vetrate_role') as SwarmRole;
   const swarm = useVetRateSwarm({ initialRole: savedRole || 'auditor' });
   ```

---

## 🎖️ Diamond Standard Compliance

This implementation meets all Diamond-tier requirements:
- ✅ 100% client-side inference (no API keys)
- ✅ WebGPU acceleration for RTX 4080 Super-class GPUs
- ✅ Hot-swappable LoRA specialist roles
- ✅ Streaming responses with abort capability
- ✅ Progress callbacks with detailed status
- ✅ TypeScript type safety throughout
- ✅ React 18 compatibility with proper cleanup

---

*VetRate Custom LLM Swarm — Serving Those Who Served* 🇺🇸
