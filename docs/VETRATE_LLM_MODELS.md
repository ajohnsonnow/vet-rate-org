# VetRate LLM Models

## Overview

VetRate uses three specialized fine-tuned language models, each optimized for specific tasks in the VA disability claims assistance workflow. All models are based on **Llama-3.2-3B-Instruct** and trained using QLoRA (4-bit quantization with LoRA adapters).

---

## Model Specifications

| Model | Parameters | Base Model | Quantization | Size (Q4_K_M) |
|-------|------------|------------|--------------|---------------|
| VetRate-Auditor | 3.26B | Llama-3.2-3B-Instruct | Q4_K_M | ~1.9 GB |
| VetRate-Writer | 3.26B | Llama-3.2-3B-Instruct | Q4_K_M | ~1.9 GB |
| VetRate-Rater | 3.26B | Llama-3.2-3B-Instruct | Q4_K_M | ~1.9 GB |

---

## 1. VetRate-Auditor

### Role
**VA Regulations Expert & Claims Auditor**

### Capabilities
- **38 CFR Knowledge**: Deep understanding of Title 38 Code of Federal Regulations, particularly Part 3 (Adjudication) and Part 4 (Schedule for Rating Disabilities)
- **Diagnostic Code Expertise**: Comprehensive knowledge of VA diagnostic codes and rating criteria
- **Claims Review**: Analyzes disability claims for completeness and compliance
- **Rating Criteria**: Explains rating percentages (0%, 10%, 30%, 50%, 70%, 100%) for specific conditions
- **Secondary Conditions**: Identifies potential secondary service-connected conditions
- **Appeals Process**: Explains NOD (Notice of Disagreement), BVA (Board of Veterans Appeals), and CAVC procedures

### Example Use Cases
- "What are the rating criteria for PTSD under 38 CFR § 4.130?"
- "What secondary conditions can be claimed with sleep apnea?"
- "Explain the bilateral factor calculation"
- "What evidence is needed for a TDIU claim?"

### Training Focus
- eCFR regulations and legal citations
- VA M21-1 Adjudication Procedures Manual
- Diagnostic code definitions and criteria
- Claims processing procedures

---

## 2. VetRate-Writer

### Role
**Medical-Legal Document Specialist**

### Capabilities
- **Nexus Letters**: Drafts medical nexus letters connecting conditions to military service
- **Personal Statements**: Creates compelling personal/buddy statements for claims
- **DBQ Assistance**: Helps understand and prepare for Disability Benefits Questionnaires
- **Intent to File**: Drafts ITF and formal claim submissions
- **Appeal Briefs**: Assists with NOD and appeal documentation
- **Medical Terminology**: Translates complex medical language for VA claims

### Example Use Cases
- "Write a nexus letter for sleep apnea secondary to PTSD"
- "Create a personal statement for tinnitus claim"
- "Draft a buddy statement for PTSD stressor verification"
- "Help me respond to a duty to assist letter"

### Training Focus
- Medical-legal writing conventions
- VA-accepted nexus letter formats
- Persuasive statement techniques
- IMO (Independent Medical Opinion) structures

---

## 3. VetRate-Rater

### Role
**VA Combined Rating Calculator & Decision Support**

### Capabilities
- **Combined Ratings**: Calculates VA combined disability ratings using official formula
- **Bilateral Factor**: Applies bilateral factor for paired extremity conditions
- **Rating Predictions**: Estimates potential ratings based on symptom severity
- **Compensation Estimates**: Provides monthly compensation estimates by rating level
- **Strategic Planning**: Suggests conditions to prioritize for maximum benefit
- **SMC Eligibility**: Identifies Special Monthly Compensation eligibility

### Example Use Cases
- "Calculate combined rating: 70% PTSD, 40% back, 30% knee bilateral"
- "What rating would I get with these PTSD symptoms: [symptoms]"
- "How much is 80% disability compensation with 2 dependents?"
- "Am I eligible for SMC-S with 100% scheduler plus 60% separate?"

### Training Focus
- VA combined rating mathematics
- Bilateral factor calculations
- Compensation rate tables
- SMC criteria and calculations

---

## Technical Details

### Training Configuration
```yaml
# QLoRA Parameters
load_in_4bit: true
bnb_4bit_compute_dtype: bfloat16
bnb_4bit_use_double_quant: true
bnb_4bit_quant_type: nf4

# LoRA Parameters
lora_r: 32
lora_alpha: 64
lora_dropout: 0.05
lora_target_modules:
  - q_proj, k_proj, v_proj, o_proj
  - gate_proj, up_proj, down_proj

# Training
sequence_len: 4096
micro_batch_size: 4
num_epochs: 3
learning_rate: 2e-4
optimizer: adamw_bnb_8bit
```

### Hardware Requirements
- **Minimum**: 8GB VRAM (Q4_K_M quantized)
- **Recommended**: 16GB VRAM (F16 or multiple models)
- **Tested On**: NVIDIA RTX 4080 SUPER + RTX 4070 Ti SUPER

### Performance Metrics
| Metric | Value |
|--------|-------|
| Prompt Processing | 132-422 tokens/sec |
| Generation Speed | 53-92 tokens/sec |
| Context Length | 4096 tokens |
| Memory Usage (Q4_K_M) | ~2.5 GB VRAM |

---

## Model Files

### Available Formats
| Format | Size | Use Case |
|--------|------|----------|
| F16 (GGUF) | ~6.0 GB | Maximum quality, requires more VRAM |
| Q4_K_M (GGUF) | ~1.9 GB | Balanced quality/size, recommended |

### File Locations
```
models/gguf/
├── vetrate-auditor-3b-F16.gguf      # 6.0 GB
├── vetrate-auditor-3b-Q4_K_M.gguf   # 1.9 GB
├── vetrate-writer-3b-F16.gguf       # 6.0 GB
├── vetrate-writer-3b-Q4_K_M.gguf    # 1.9 GB
├── vetrate-rater-3b-F16.gguf        # 6.0 GB
└── vetrate-rater-3b-Q4_K_M.gguf     # 1.9 GB
```

---

## Usage Examples

### With llama.cpp
```bash
# Load Auditor model
./llama-cli -m vetrate-auditor-3b-Q4_K_M.gguf -ngl 99 -c 4096 -cnv

# Load Writer model
./llama-cli -m vetrate-writer-3b-Q4_K_M.gguf -ngl 99 -c 4096 -cnv

# Load Rater model
./llama-cli -m vetrate-rater-3b-Q4_K_M.gguf -ngl 99 -c 4096 -cnv
```

### With Python (transformers)
```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "Vet-Rate-org/VetRate-Auditor-3B",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained("Vet-Rate-org/VetRate-Auditor-3B")
```

---

## Swarm Architecture

The three models are designed to work together in a **swarm configuration**:

```
User Query
    │
    ▼
┌─────────────────┐
│  Query Router   │ ← Determines which model(s) to invoke
└─────────────────┘
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Auditor │      │ Writer  │      │  Rater  │
│ (Regs)  │      │ (Docs)  │      │ (Calc)  │
└─────────┘      └─────────┘      └─────────┘
    │                  │                  │
    └──────────────────┴──────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Combined Response│
              └─────────────────┘
```

---

## Disclaimer

These models are trained to assist veterans with understanding VA disability claims processes. They are **NOT** a substitute for:
- Professional legal advice
- Medical diagnosis or treatment
- Official VA decisions
- Accredited Veterans Service Organizations (VSOs)

Always verify information with official VA sources and consult with accredited representatives for claims assistance.

---

---

## Test Results & Lessons Learned (January 2026)

### Original Llama-3.2-3B Models Failed Testing

| Model | Test | Result | Issue |
|-------|------|--------|-------|
| **Auditor** | PTSD 50% vs 70% criteria | ❌ FAIL | Hallucinated definitions, infinite loop |
| **Writer** | Nexus Letter for Sleep Apnea | ❌ FAIL | "I can't assist with that" (safety refusal) |
| **Rater** | Calculate 70%+30%+10% | ❌ FAIL | Answered 55% (correct: 80%) |

### Root Cause Analysis

1. **Model Size Too Small**: 3B parameters insufficient for legal/medical reasoning
2. **Quantization Damage**: Q4_K_M crushed reasoning capabilities
3. **Safety Alignment**: Llama-3's guardrails blocked legitimate document drafting
4. **Math Hallucination**: LLMs cannot reliably do VA math - invented fictional formulas

### Recommended Fixes

| Model | Fix |
|-------|-----|
| **Auditor** | Switch to Qwen 2.5-7B, add contrastive training (negative examples) |
| **Writer** | Switch to Qwen 2.5-7B (fewer refusals), reframe as "Drafting Assistant" |
| **Rater** | **DO NOT USE LLM FOR MATH** - Use Python tool instead |

### Qwen 2.5-7B Comparison Test

| Test | Llama-3 3B | Qwen 2.5-7B |
|------|------------|-------------|
| Nexus Letter | ❌ Refused | ✅ Full professional letter |
| PTSD Criteria | ❌ Hallucinated | ✅ Correct (partial output) |
| VA Math | ❌ 55% | ❌ 56.67% (still wrong) |

**Conclusion**: Qwen 2.5-7B is better for writing/auditing tasks but STILL cannot do VA math.

---

## VA Calculator Tool (Deterministic)

Since no LLM can reliably do VA math, we created a Python tool:

**Location**: `src/utils/vaCalculatorTool.py`

### Features
- ✅ Correct VA combined rating formula
- ✅ Bilateral factor calculation (38 CFR 4.26)
- ✅ TDIU eligibility check (38 CFR 4.16)
- ✅ 2024 compensation rates
- ✅ SMC-S eligibility detection
- ✅ Step-by-step calculation display
- ✅ LLM function calling interface

### Usage

```bash
# CLI
python vaCalculatorTool.py --ratings 70,30,10
# Output: 80% (correct!)

# With bilateral factor
python vaCalculatorTool.py --ratings 50 --bilateral "knees:40,30" --check-tdiu
```

### LLM Integration

The tool provides a `TOOL_SCHEMA` for function calling:

```python
from vaCalculatorTool import execute_tool, TOOL_SCHEMA

# LLM calls tool with arguments
result = execute_tool({"ratings": [70, 30, 10]})
```

---

## Retraining Plan (v2.0)

### New Base Model: Qwen 2.5-7B-Instruct

| Attribute | Old (Llama 3B) | New (Qwen 7B) |
|-----------|----------------|---------------|
| Parameters | 3.26B | 7.62B |
| Context | 4K | 32K |
| Math/Logic | Poor | Good |
| Safety | Over-restrictive | Balanced |
| VRAM (Q4) | ~2.5 GB | ~4.5 GB |

### Training Data Improvements

1. **Auditor**: Add contrastive examples ("Why is this NOT 100%?")
2. **Writer**: Reframe prompts as "drafting assistance" not "legal advice"
3. **Rater**: Train to OUTPUT PYTHON CODE, not do math directly

### Example Rater Training Data (v2.0)

```json
{
  "instruction": "Calculate the combined VA rating for: 70% PTSD, 30% migraines, 10% tinnitus",
  "output": "```python\nfrom vaCalculatorTool import calculate_combined_rating\nresult = calculate_combined_rating([70, 30, 10])\nprint(result['formatted_response'])\n```"
}
```

---

## License

Models are provided under the VetRate project license. Base model (Llama-3.2-3B-Instruct) is subject to Meta's Llama license terms. Qwen models are subject to Alibaba's license terms.

---

*Last Updated: January 23, 2026*
