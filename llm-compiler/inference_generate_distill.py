#!/usr/bin/env python3
"""
💎 VetRate Inference Generation for Knowledge Distillation
==========================================================
Runs the 7B teacher model on distillation scenarios to generate
high-quality training data for mobile models.

Usage:
    python inference_generate_distill.py \
        --model /path/to/vetrate-auditor-7b-Q4_K_M.gguf \
        --input training-data-v2/distill_auditor_scenarios.jsonl \
        --output training-data-v2/distill_auditor_7b_complete.jsonl

Requirements:
    pip install llama-cpp-python tqdm
"""

import argparse
import json
from pathlib import Path
from tqdm import tqdm
from llama_cpp import Llama
from datetime import datetime

# System prompts for each model type
SYSTEM_PROMPTS = {
    "auditor": """You are CWO3 Auditor, a VA claims compliance expert. You review veteran disability claims for:
- Accuracy of information and calculations
- Compliance with 38 CFR regulations
- Completeness of evidence and documentation
- Proper application of bilateral factor, pyramiding rules, and rating criteria

Always cite specific 38 CFR sections when applicable. Be thorough but concise.""",

    "writer": """You are CWO4 Writer, a VA claims document specialist. You help veterans by:
- Writing compelling personal statements in first-person veteran voice
- Drafting nexus letter templates with proper medical-legal language
- Creating buddy statements that support claims effectively
- Formatting NODs and appeal statements per VA requirements

Write with empathy but professionalism. Focus on service connection evidence.""",

    "rater": """You are CWO5 Rater, a VA rating calculation expert. You specialize in:
- Combined rating calculations using VA math
- Bilateral factor application (10% of combined bilateral)
- Diagnostic code analysis under 38 CFR Part 4
- TDIU qualification and SMC entitlement analysis

Always show your work with step-by-step calculations. Explain the VA math process."""
}


def detect_model_type(model_path: str) -> str:
    """Detect model type from filename."""
    path_lower = model_path.lower()
    if "auditor" in path_lower:
        return "auditor"
    elif "writer" in path_lower:
        return "writer"
    elif "rater" in path_lower:
        return "rater"
    else:
        return "auditor"  # Default


def load_scenarios(input_path: Path) -> list:
    """Load distillation scenarios from JSONL."""
    scenarios = []
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                scenarios.append(json.loads(line))
    return scenarios


def generate_response(llm: Llama, system: str, instruction: str, input_text: str) -> str:
    """Generate response from the 7B model."""
    
    # Format prompt for the model
    if input_text:
        prompt = f"""<|system|>
{system}
<|user|>
{instruction}

{input_text}
<|assistant|>
"""
    else:
        prompt = f"""<|system|>
{system}
<|user|>
{instruction}
<|assistant|>
"""
    
    # Generate with appropriate settings
    response = llm(
        prompt,
        max_tokens=2048,
        temperature=0.1,  # Low temp for consistent, accurate outputs
        top_p=0.95,
        repeat_penalty=1.1,
        stop=["<|user|>", "<|system|>", "<|endoftext|>"]
    )
    
    return response['choices'][0]['text'].strip()


def main():
    parser = argparse.ArgumentParser(description="Generate distillation training data")
    parser.add_argument("--model", required=True, help="Path to GGUF model file")
    parser.add_argument("--input", required=True, help="Input JSONL with scenarios")
    parser.add_argument("--output", required=True, help="Output JSONL with completions")
    parser.add_argument("--n_ctx", type=int, default=4096, help="Context length")
    parser.add_argument("--n_gpu_layers", type=int, default=-1, help="GPU layers (-1 = all)")
    args = parser.parse_args()
    
    model_path = Path(args.model)
    input_path = Path(args.input)
    output_path = Path(args.output)
    
    # Detect model type
    model_type = detect_model_type(str(model_path))
    system_prompt = SYSTEM_PROMPTS[model_type]
    
    print("╔════════════════════════════════════════════════════════════════════════════╗")
    print("║              💎 VetRate Knowledge Distillation Inference                  ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    print(f"  Model: {model_path.name}")
    print(f"  Type: {model_type}")
    print(f"  Input: {input_path}")
    print(f"  Output: {output_path}")
    print()
    
    # Load the 7B model
    print("→ Loading 7B teacher model...")
    llm = Llama(
        model_path=str(model_path),
        n_ctx=args.n_ctx,
        n_gpu_layers=args.n_gpu_layers,
        n_batch=512,
        verbose=False
    )
    print("  ✓ Model loaded\n")
    
    # Load scenarios
    scenarios = load_scenarios(input_path)
    print(f"→ Processing {len(scenarios)} distillation scenarios...\n")
    
    # Generate responses
    results = []
    for scenario in tqdm(scenarios, desc="Generating"):
        try:
            response = generate_response(
                llm,
                system_prompt,
                scenario.get("instruction", ""),
                scenario.get("input", "")
            )
            
            # Build training example in Alpaca format
            result = {
                "system": system_prompt,
                "instruction": scenario.get("instruction", ""),
                "input": scenario.get("input", ""),
                "output": response
            }
            results.append(result)
            
        except Exception as e:
            print(f"\n  ⚠ Error processing scenario: {e}")
            continue
    
    # Save results
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        for result in results:
            f.write(json.dumps(result, ensure_ascii=False) + '\n')
    
    print(f"\n✓ Saved {len(results)} training examples to {output_path}")
    
    # Stats
    total_chars = sum(len(r['output']) for r in results)
    avg_chars = total_chars / len(results) if results else 0
    print(f"  Average response length: {avg_chars:.0f} characters")
    print(f"  Generated at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
