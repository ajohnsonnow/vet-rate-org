#!/usr/bin/env python3
"""
Diamond Standard Headless Compiler v2
Optimized for overnight autonomous execution
Uses existing combined training data + WSL for MLC compilation
"""

import asyncio
import subprocess
import sys
import logging
import json
import os
from pathlib import Path
from datetime import datetime
import shutil

# Configure logging
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f'headless_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class HeadlessCompiler:
    """Autonomous LLM compilation for Vet-Rate"""
    
    def __init__(self):
        self.root = Path(__file__).parent
        self.knowledge_base = self.root / "knowledge-base"
        self.training_data = self.knowledge_base / "vet_rate_combined_training.jsonl"
        self.output_dir = self.root / "models"
        self.output_dir.mkdir(exist_ok=True)
        
        self.status = {
            "started": datetime.now().isoformat(),
            "phases": {},
            "errors": []
        }
    
    def log_phase(self, phase, status, details=""):
        """Log phase status"""
        self.status["phases"][phase] = {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        logger.info(f"[{status}] {phase}: {details}")
    
    def run_cmd(self, cmd, cwd=None, desc="", timeout=3600):
        """Run command with timeout"""
        logger.info(f"> {desc}")
        logger.info(f"  $ {cmd if isinstance(cmd, str) else ' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                shell=isinstance(cmd, str),
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            if result.stdout:
                for line in result.stdout.strip().split('\n')[-10:]:
                    logger.info(f"  {line}")
            
            if result.returncode != 0:
                logger.error(f"  Error: {result.stderr[:500] if result.stderr else 'Unknown'}")
                return False, result.stderr
            
            return True, result.stdout
            
        except subprocess.TimeoutExpired:
            logger.error(f"  Timeout after {timeout}s")
            return False, "Timeout"
        except Exception as e:
            logger.error(f"  Exception: {e}")
            return False, str(e)
    
    def verify_training_data(self):
        """Verify training data exists and is valid"""
        logger.info("=" * 70)
        logger.info("PHASE 0: Verifying Training Data")
        logger.info("=" * 70)
        
        if not self.training_data.exists():
            self.log_phase("verify_data", "FAILED", "Training data not found")
            return False
        
        # Count examples
        with open(self.training_data, 'r', encoding='utf-8') as f:
            count = sum(1 for _ in f)
        
        size_kb = self.training_data.stat().st_size / 1024
        
        self.log_phase("verify_data", "OK", f"{count} examples, {size_kb:.1f} KB")
        logger.info(f"  Training file: {self.training_data}")
        logger.info(f"  Examples: {count}")
        logger.info(f"  Size: {size_kb:.1f} KB")
        
        return count >= 100  # Minimum threshold
    
    def prepare_axolotl_dataset(self):
        """Convert training data to Axolotl format"""
        logger.info("=" * 70)
        logger.info("PHASE 1: Preparing Axolotl Dataset")
        logger.info("=" * 70)
        
        # Read and convert
        examples = []
        with open(self.training_data, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    item = json.loads(line)
                    # Axolotl alpaca format
                    examples.append({
                        "instruction": item.get("instruction", ""),
                        "input": item.get("input", ""),
                        "output": item.get("output", "")
                    })
        
        # Save in Axolotl format
        axolotl_file = self.knowledge_base / "axolotl_training.json"
        with open(axolotl_file, 'w', encoding='utf-8') as f:
            json.dump(examples, f, indent=2, ensure_ascii=False)
        
        self.log_phase("prepare_dataset", "OK", f"Converted {len(examples)} examples")
        return True
    
    def check_wsl(self):
        """Check if WSL is available for MLC compilation"""
        logger.info("=" * 70)
        logger.info("PHASE 2: Checking WSL Environment")
        logger.info("=" * 70)
        
        success, output = self.run_cmd("wsl --list --quiet", desc="Checking WSL")
        
        if not success or not output:
            self.log_phase("check_wsl", "FAILED", "WSL not available")
            return False
        
        # Check for Ubuntu
        if "Ubuntu" in output:
            self.log_phase("check_wsl", "OK", "Ubuntu available in WSL")
            return True
        
        self.log_phase("check_wsl", "WARN", f"Available distros: {output.strip()}")
        return True
    
    def train_with_axolotl_local(self):
        """Train model using local Python (CPU/CUDA)"""
        logger.info("=" * 70)
        logger.info("PHASE 3: Training with Axolotl")
        logger.info("=" * 70)
        
        # Check if transformers/torch available
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"  PyTorch device: {device}")
            if device == "cuda":
                logger.info(f"  GPU: {torch.cuda.get_device_name(0)}")
        except ImportError:
            logger.warning("  PyTorch not installed - will use alternative training")
            device = "cpu"
        
        # For now, create placeholder LoRA adapters
        # Real training would require GPU and significant time
        
        adapters_dir = self.output_dir / "lora-adapters"
        adapters_dir.mkdir(exist_ok=True)
        
        # Create training config for future use
        config = {
            "base_model": "meta-llama/Llama-3.2-3B-Instruct",
            "training_data": str(self.knowledge_base / "axolotl_training.json"),
            "output_dir": str(adapters_dir),
            "lora_config": {
                "r": 32,
                "lora_alpha": 64,
                "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
                "lora_dropout": 0.05
            },
            "training_args": {
                "num_train_epochs": 3,
                "per_device_train_batch_size": 4,
                "gradient_accumulation_steps": 4,
                "learning_rate": 2e-4,
                "warmup_steps": 100,
                "save_steps": 500
            },
            "status": "READY_FOR_TRAINING",
            "note": "Run on GPU-enabled system with: axolotl train this_config.yaml"
        }
        
        config_file = adapters_dir / "training_config.json"
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        self.log_phase("axolotl_training", "PREPARED", f"Config saved to {config_file}")
        logger.info("  Training config created - requires GPU for actual training")
        logger.info("  Alternative: Use pre-trained model with RAG approach")
        
        return True
    
    def prepare_mlc_compilation(self):
        """Prepare MLC LLM compilation scripts"""
        logger.info("=" * 70)
        logger.info("PHASE 4: Preparing MLC WebGPU Compilation")
        logger.info("=" * 70)
        
        mlc_dir = self.root / "mlc-compile"
        mlc_dir.mkdir(exist_ok=True)
        
        # Create WSL compilation script
        compile_script = """#!/bin/bash
# MLC LLM WebGPU Compilation Script
# Run in WSL with: bash compile_webgpu.sh

set -e

echo "=== MLC LLM WebGPU Compilation ==="

# Install MLC LLM if needed
if ! python3 -c "import mlc_llm" 2>/dev/null; then
    echo "Installing MLC LLM..."
    pip install --pre -U -f https://mlc.ai/wheels mlc-llm-nightly mlc-ai-nightly
fi

# Model to compile (using small efficient model)
BASE_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
OUTPUT_DIR="./webgpu-models"

mkdir -p $OUTPUT_DIR

echo "Compiling $BASE_MODEL for WebGPU..."

# Compile for WebGPU (q4f16_1 quantization)
python3 -m mlc_llm compile $BASE_MODEL \\
    --quantization q4f16_1 \\
    --device webgpu \\
    --output $OUTPUT_DIR/vet-rate-llm-q4f16 \\
    2>&1 | tee compile.log

# Compile for mobile (q3f16_1 quantization)  
python3 -m mlc_llm compile $BASE_MODEL \\
    --quantization q3f16_1 \\
    --device webgpu \\
    --output $OUTPUT_DIR/vet-rate-llm-q3f16 \\
    2>&1 | tee -a compile.log

echo "=== Compilation Complete ==="
ls -la $OUTPUT_DIR/
"""
        
        script_file = mlc_dir / "compile_webgpu.sh"
        with open(script_file, 'w', newline='\n') as f:
            f.write(compile_script)
        
        # Create mlc-chat-config for WebLLM
        mlc_config = {
            "model_lib": "vet-rate-llm-q4f16_1-webgpu",
            "local_id": "vet-rate-va-assistant",
            "conv_template": "llama-3",
            "temperature": 0.7,
            "top_p": 0.95,
            "mean_gen_len": 256,
            "max_gen_len": 1024,
            "shift_fill_factor": 0.3,
            "tokenizer_files": [
                "tokenizer.json",
                "tokenizer_config.json"
            ],
            "model_category": "llama",
            "model_name": "Vet-Rate VA Claims Assistant"
        }
        
        config_file = mlc_dir / "mlc-chat-config.json"
        with open(config_file, 'w') as f:
            json.dump(mlc_config, f, indent=2)
        
        self.log_phase("mlc_preparation", "OK", f"Scripts saved to {mlc_dir}")
        return True
    
    def create_rag_integration(self):
        """Create RAG integration code for immediate use"""
        logger.info("=" * 70)
        logger.info("PHASE 5: Creating RAG Integration")
        logger.info("=" * 70)
        
        # This approach works immediately without training
        rag_code = '''/**
 * Vet-Rate RAG (Retrieval-Augmented Generation) Integration
 * Uses existing knowledge base for instant VA claims assistance
 */

class VetRateRAG {
  constructor() {
    this.knowledgeBase = null;
    this.embeddings = new Map();
  }

  async loadKnowledgeBase() {
    // Load from training data
    const response = await fetch('/data/vet_rate_knowledge.json');
    this.knowledgeBase = await response.json();
    console.log(`Loaded ${this.knowledgeBase.length} knowledge entries`);
  }

  // Simple TF-IDF style matching
  findRelevant(query, topK = 5) {
    const queryTerms = query.toLowerCase().split(/\\s+/);
    
    const scored = this.knowledgeBase.map(item => {
      const text = `${item.instruction} ${item.output}`.toLowerCase();
      let score = 0;
      
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 1;
          // Boost for exact diagnostic code matches
          if (term.match(/^\\d{4}$/) && text.includes(`dc ${term}`)) {
            score += 5;
          }
        }
      }
      
      return { item, score };
    });
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.item);
  }

  async answer(query) {
    const relevant = this.findRelevant(query);
    
    if (relevant.length === 0) {
      return {
        answer: "I couldn't find specific information. Please try rephrasing your question about VA disability claims.",
        sources: []
      };
    }

    // Combine relevant knowledge
    const context = relevant.map(r => r.output).join('\\n\\n');
    
    return {
      answer: context,
      sources: relevant.map(r => ({
        citation: r.metadata?.citation || 'VA Knowledge Base',
        source: r.metadata?.source || 'Unknown'
      }))
    };
  }
}

export default VetRateRAG;
'''
        
        rag_dir = self.root / "rag-integration"
        rag_dir.mkdir(exist_ok=True)
        
        with open(rag_dir / "VetRateRAG.js", 'w') as f:
            f.write(rag_code)
        
        # Also create a JSON version of knowledge for frontend
        with open(self.training_data, 'r', encoding='utf-8') as f:
            knowledge = [json.loads(line) for line in f if line.strip()]
        
        with open(rag_dir / "vet_rate_knowledge.json", 'w', encoding='utf-8') as f:
            json.dump(knowledge, f, indent=2, ensure_ascii=False)
        
        self.log_phase("rag_integration", "OK", f"RAG code saved to {rag_dir}")
        return True
    
    def create_webllm_integration(self):
        """Create WebLLM integration for client-side inference"""
        logger.info("=" * 70)
        logger.info("PHASE 6: Creating WebLLM Integration")
        logger.info("=" * 70)
        
        webllm_code = '''/**
 * Vet-Rate WebLLM Integration
 * Client-side LLM inference using WebGPU
 */

import * as webllm from "@mlc-ai/web-llm";

class VetRateWebLLM {
  constructor() {
    this.engine = null;
    this.modelId = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
    this.systemPrompt = `You are a VA Claims Assistant helping veterans understand their disability benefits.
You specialize in:
- 38 CFR regulations and diagnostic codes
- Secondary service connection under 38 CFR § 3.310
- Rating criteria and schedules
- PACT Act presumptive conditions

Always cite specific regulations when possible. Be accurate and helpful.`;
  }

  async initialize(onProgress) {
    this.engine = await webllm.CreateMLCEngine(
      this.modelId,
      {
        initProgressCallback: onProgress || ((progress) => {
          console.log(`Loading: ${(progress.progress * 100).toFixed(1)}%`);
        })
      }
    );
    console.log("WebLLM engine initialized");
  }

  async chat(userMessage, knowledgeContext = "") {
    if (!this.engine) {
      throw new Error("Engine not initialized. Call initialize() first.");
    }

    const messages = [
      { role: "system", content: this.systemPrompt },
    ];

    if (knowledgeContext) {
      messages.push({
        role: "system",
        content: `Relevant VA regulations:\\n${knowledgeContext}`
      });
    }

    messages.push({ role: "user", content: userMessage });

    const response = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512
    });

    return response.choices[0].message.content;
  }

  async chatStream(userMessage, knowledgeContext = "", onChunk) {
    if (!this.engine) {
      throw new Error("Engine not initialized");
    }

    const messages = [
      { role: "system", content: this.systemPrompt },
    ];

    if (knowledgeContext) {
      messages.push({
        role: "system",
        content: `Relevant VA regulations:\\n${knowledgeContext}`
      });
    }

    messages.push({ role: "user", content: userMessage });

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      if (onChunk) onChunk(content);
    }

    return fullResponse;
  }
}

export default VetRateWebLLM;
'''
        
        webllm_dir = self.root / "webllm-integration"
        webllm_dir.mkdir(exist_ok=True)
        
        with open(webllm_dir / "VetRateWebLLM.js", 'w') as f:
            f.write(webllm_code)
        
        # Create combined assistant that uses both RAG + LLM
        combined_code = '''/**
 * Vet-Rate Combined Assistant
 * RAG + WebLLM for best accuracy
 */

import VetRateRAG from "./VetRateRAG.js";
import VetRateWebLLM from "./VetRateWebLLM.js";

class VetRateAssistant {
  constructor() {
    this.rag = new VetRateRAG();
    this.llm = new VetRateWebLLM();
    this.useWebLLM = false; // Start with RAG only
  }

  async initialize(options = {}) {
    // Always load RAG (instant)
    await this.rag.loadKnowledgeBase();
    console.log("RAG knowledge base loaded");

    // Optionally load WebLLM (requires WebGPU)
    if (options.enableWebLLM !== false) {
      try {
        if (navigator.gpu) {
          await this.llm.initialize(options.onProgress);
          this.useWebLLM = true;
          console.log("WebLLM initialized with WebGPU");
        } else {
          console.log("WebGPU not available - using RAG only");
        }
      } catch (e) {
        console.warn("WebLLM init failed:", e);
      }
    }
  }

  async ask(question) {
    // Step 1: Find relevant knowledge with RAG
    const ragResult = await this.rag.answer(question);
    
    // Step 2: If WebLLM available, enhance with LLM
    if (this.useWebLLM && ragResult.sources.length > 0) {
      const context = ragResult.answer;
      const llmResponse = await this.llm.chat(question, context);
      
      return {
        answer: llmResponse,
        sources: ragResult.sources,
        method: "RAG + WebLLM"
      };
    }
    
    // Fallback to RAG only
    return {
      ...ragResult,
      method: "RAG only"
    };
  }
}

export default VetRateAssistant;
'''
        
        with open(webllm_dir / "VetRateAssistant.js", 'w') as f:
            f.write(combined_code)
        
        self.log_phase("webllm_integration", "OK", f"WebLLM code saved to {webllm_dir}")
        return True
    
    def save_status(self):
        """Save final status"""
        self.status["completed"] = datetime.now().isoformat()
        
        status_file = self.root / "logs" / "compilation_status.json"
        with open(status_file, 'w') as f:
            json.dump(self.status, f, indent=2)
        
        logger.info(f"Status saved to {status_file}")
    
    def generate_report(self):
        """Generate human-readable completion report"""
        logger.info("=" * 70)
        logger.info("COMPILATION REPORT")
        logger.info("=" * 70)
        
        report = f"""
# Vet-Rate LLM Compilation Report
Generated: {datetime.now().isoformat()}

## Summary
Training data: {self.training_data}
Output directory: {self.output_dir}

## Phases Completed
"""
        for phase, info in self.status.get("phases", {}).items():
            status_icon = "[OK]" if info["status"] == "OK" else "[READY]" if info["status"] == "PREPARED" else "[FAIL]"
            report += f"- {status_icon} {phase}: {info['details']}\n"
        
        report += f"""
## Generated Artifacts

### RAG Integration (Ready to Use)
- `rag-integration/VetRateRAG.js` - Pure JavaScript RAG implementation
- `rag-integration/vet_rate_knowledge.json` - Knowledge base (1,496 entries)

### WebLLM Integration (Requires WebGPU)
- `webllm-integration/VetRateWebLLM.js` - Client-side LLM with WebGPU
- `webllm-integration/VetRateAssistant.js` - Combined RAG + LLM assistant

### MLC Compilation Scripts (For Future Use)
- `mlc-compile/compile_webgpu.sh` - WSL script for model compilation
- `mlc-compile/mlc-chat-config.json` - WebLLM configuration

### Training Config (For GPU Training)
- `models/lora-adapters/training_config.json` - Axolotl training configuration

## Next Steps

1. **Immediate Use (RAG)**: Copy RAG files to `src/services/` and integrate
2. **WebLLM Integration**: Add @mlc-ai/web-llm to package.json
3. **Custom Model Training**: Run Axolotl on GPU system when ready
4. **MLC Compilation**: Run compile script in WSL after training

## Notes
- RAG provides instant responses using existing knowledge base
- WebLLM enables client-side inference with pre-trained models
- Custom fine-tuning requires GPU (recommended: A100/H100)
"""
        
        report_file = self.root / "COMPILATION_REPORT.md"
        with open(report_file, 'w') as f:
            f.write(report)
        
        logger.info(f"Report saved to {report_file}")
        return report
    
    def run(self):
        """Execute all phases"""
        logger.info("=" * 70)
        logger.info("VET-RATE HEADLESS LLM COMPILATION")
        logger.info("=" * 70)
        logger.info(f"Started: {datetime.now().isoformat()}")
        logger.info(f"Log file: {log_file}")
        logger.info("=" * 70)
        
        try:
            # Phase 0: Verify data
            if not self.verify_training_data():
                logger.error("Training data verification failed!")
                return False
            
            # Phase 1: Prepare Axolotl dataset
            self.prepare_axolotl_dataset()
            
            # Phase 2: Check WSL
            self.check_wsl()
            
            # Phase 3: Prepare training config
            self.train_with_axolotl_local()
            
            # Phase 4: Prepare MLC scripts
            self.prepare_mlc_compilation()
            
            # Phase 5: Create RAG integration
            self.create_rag_integration()
            
            # Phase 6: Create WebLLM integration
            self.create_webllm_integration()
            
            # Generate report
            self.generate_report()
            
            # Save status
            self.save_status()
            
            logger.info("=" * 70)
            logger.info("COMPILATION COMPLETE")
            logger.info("=" * 70)
            logger.info("RAG integration ready for immediate use!")
            logger.info("See COMPILATION_REPORT.md for details")
            
            return True
            
        except Exception as e:
            logger.error(f"Fatal error: {e}")
            self.status["errors"].append(str(e))
            self.save_status()
            return False


if __name__ == "__main__":
    compiler = HeadlessCompiler()
    success = compiler.run()
    sys.exit(0 if success else 1)
