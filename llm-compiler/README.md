# Diamond Standard LLM Compiler - README

## 🎯 Overview

Autonomous headless system for compiling specialized VA Claims LLMs with 100% client-side WebGPU inference. No servers, no data transmission, complete veteran privacy.

## 🏗️ Architecture

### Model Swarm (3 Specialists)
1. **Auditor** - 38 CFR Law [RED citations]
2. **Writer** - Medical/Nexus [GREEN citations]  
3. **Rater** - Procedures [BLUE citations]

### Knowledge Hierarchy
```
38 CFR (LAW) → M21-1 (MANUAL) → BVA (PRECEDENT) → OGC (COUNSEL) → FREG (UPDATES)
```

### Optimization Targets
- **Mobile**: q3f16_1 quantization (<4GB RAM)
- **Desktop**: q4f16_1 quantization (<8GB RAM)

## 🚀 Quick Start

### Prerequisites
```bash
# Python 3.10+
python --version

# Install base dependencies
pip install aiohttp beautifulsoup4 lxml requests anthropic huggingface-hub
```

### Autonomous Execution
```bash
# Navigate to compiler directory
cd llm-compiler

# Run orchestrator (headless - no interaction required)
python diamond_orchestrator.py

# Monitor progress
tail -f logs/orchestrator_*.log
```

## 📁 Directory Structure

```
llm-compiler/
├── diamond_orchestrator.py       # Main autonomous controller
├── scrapers/
│   ├── va_knowledge_scraper.py   # Multi-source regulatory scraper
│   └── requirements.txt
├── axolotl-configs/
│   ├── auditor-38cfr.yaml        # Auditor training config
│   ├── writer-medical.yaml       # Writer training config
│   └── rater-procedures.yaml     # Rater training config
├── mlc-scripts/
│   └── compile-webgpu.sh         # WebGPU compilation pipeline
├── knowledge-base/               # Scraped regulatory data
└── logs/                         # Orchestration logs
```

## 🔄 Execution Phases

### Phase 1: Knowledge Scraping (~2-4 hours)
- 38 CFR Parts 3 & 4 (full text)
- OGC Precedent Opinions (1989-2019)
- BVA Decisions (precedential cases)
- Federal Register (VA updates)
- M21-1 Manual (procedures)

**Output**: `va_complete_knowledge_base.json` (~500MB)

### Phase 2: Model Training (~4-8 hours per model)
- Axolotl LoRA fine-tuning
- 3 specialized models trained in parallel
- Llama 3.2 3B base model
- QLoRA 4-bit quantization during training

**Output**: 3 trained models in `axolotl-configs/outputs/`

### Phase 3: WebGPU Compilation (~2-3 hours)
- MLC LLM compilation pipeline
- Dual quantization (q3f16_1 + q4f16_1)
- WebGPU/Metal/Vulkan backend support
- Model cards and deployment manifest

**Output**: WebGPU artifacts in `mlc-scripts/webgpu-artifacts/`

### Phase 4: HuggingFace Upload (~1-2 hours)
- Automatic upload to Vet-Rate-org org
- Model cards with usage instructions
- Version tagging and metadata

**Output**: Models live at `huggingface.co/Vet-Rate-org/`

## 📊 Resource Requirements

### Minimum (CPU-only training)
- 32GB RAM
- 100GB disk space
- 12-16 hour runtime

### Recommended (GPU-accelerated)
- NVIDIA GPU with 16GB+ VRAM
- 64GB RAM
- 200GB disk space
- 6-10 hour runtime

## 🔍 Monitoring

### Real-time Logs
```bash
tail -f logs/orchestrator_*.log
```

### Status Check
```bash
cat logs/orchestration_status.json
```

### Knowledge Base Stats
```bash
python -c "
import json
with open('knowledge-base/va_complete_knowledge_base.json') as f:
    data = json.load(f)
    print(f'Citations: {data[\"metadata\"][\"total_citations\"]}')
    print(f'Sources: {data[\"metadata\"][\"sources\"]}')
"
```

## 🔧 Configuration

### Environment Variables
```bash
# HuggingFace token (for auto-upload)
export HF_TOKEN="hf_your_token_here"

# Anthropic API key (for enhanced scraping)
export ANTHROPIC_API_KEY="sk-ant-your-key"
```

### Custom Knowledge Sources
Edit `scrapers/va_knowledge_scraper.py`:
```python
# Add custom URLs to scraping pipeline
custom_urls = [
    "https://your-va-resource.gov/...",
]
```

### Model Configuration
Edit Axolotl configs in `axolotl-configs/`:
- `lora_r`: LoRA rank (higher = more parameters)
- `num_epochs`: Training epochs (more = better but slower)
- `sequence_len`: Context window (longer = more memory)

## 🎨 Frontend Integration

### WebGPU Engine Setup
```typescript
import * as tvmjs from '@mlc-ai/web-llm';

// Initialize model swarm
const auditor = await tvmjs.MLCEngine.create('Vet-Rate-org/va-auditor-model-q4f16_1');
const writer = await tvmjs.MLCEngine.create('Vet-Rate-org/va-writer-model-q4f16_1');
const rater = await tvmjs.MLCEngine.create('Vet-Rate-org/va-rater-model-q4f16_1');

// Query with automatic model routing
const response = await auditor.chat.completions.create({
  messages: [{ 
    role: 'user', 
    content: 'What is the rating criteria for PTSD?' 
  }]
});
```

### Citation Rendering
```typescript
// Parse color-coded citations
const citations = response.choices[0].message.content.match(/\[(RED|BLUE|GREEN|PURPLE|ORANGE)\]/g);

// Render with hierarchy colors
const colorMap = {
  RED: '#ef4444',    // 38 CFR - Law
  BLUE: '#3b82f6',   // M21-1 - Manual
  GREEN: '#10b981',  // BVA - Precedent
  PURPLE: '#a855f7', // OGC - Counsel
  ORANGE: '#f97316'  // Federal Register - Updates
};
```

## 📝 Notes

### Privacy & Security
- All inference happens client-side in browser
- No veteran data transmitted to servers
- Models bundled with citations metadata
- HIPAA-friendly architecture

### Legal Disclaimer
Models provide legal information, not legal advice. Veterans should consult accredited representatives for official claims assistance.

### Updates
Re-run scraper monthly to capture:
- New Federal Register rules
- Recent BVA decisions
- Updated OGC opinions
- M21-1 manual revisions

## 🤝 Contributing

See `CONTRIBUTING.md` for:
- Knowledge source additions
- Model architecture improvements
- Frontend integration enhancements
- Community verification protocols

## 📄 License

Apache 2.0 - See LICENSE file

## 🔗 Resources

- [MLC LLM Documentation](https://mlc.ai/)
- [Axolotl Training Guide](https://github.com/OpenAccess-AI-Collective/axolotl)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [VA Regulatory Sources](https://www.ecfr.gov/current/title-38)

---

**Diamond Standard**: Maximum regulatory coverage × Minimum latency × Zero data transmission
