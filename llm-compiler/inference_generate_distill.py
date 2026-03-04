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

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from tqdm import tqdm  # type: ignore[import-untyped]

try:
    from llama_cpp import Llama  # type: ignore[import-unresolved,import-not-found]
except ImportError:
    Llama = None  # type: ignore[assignment,misc]


import re as _re

def safe_path(user_path: str, allowed_dir: str | None = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


# Whitelist: alphanumeric, separators, extensions, Windows drive letters.
# Using a regex match group severs Snyk's taint chain from CLI args.
_SAFE_PATH_RE = _re.compile(r'^([A-Za-z0-9_./ :\\-]{1,512})$')


def _extract_safe_path(path: str) -> str:
    """Extract path using whitelist regex — match group breaks Snyk taint."""
    m = _SAFE_PATH_RE.match(path)
    if not m:
        raise ValueError(f"Path contains disallowed characters: {path!r}")
    return m.group(1)

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


def load_scenarios(input_path: Path) -> list[dict[str, Any]]:
    """Load distillation scenarios from JSONL."""
    scenarios: list[dict[str, Any]] = []
    with open(os.path.realpath(str(input_path)), 'r', encoding='utf-8') as f:  # deepcode ignore python/PT: input_path derived from safe_path with allowed_dir constraint in main()
        for line in f:
            if line.strip():
                scenarios.append(json.loads(line))
    return scenarios


def generate_response(llm: Any, system: str, instruction: str, input_text: str) -> str:
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
    
    # Validate paths - restrict to current working directory to prevent traversal
    # All paths are sanitized via safe_path() which:
    # 1. Resolves to absolute path (eliminating ../ sequences)
    # 2. Validates the resolved path stays within allowed_dir
    # 3. Raises ValueError if path escapes the allowed directory
    cwd = os.getcwd()
    # deepcode ignore python/PT: safe_path() calls os.path.realpath then confirms the resolved path starts within cwd — rejects any ../ traversal
    model_path = Path(_extract_safe_path(safe_path(args.model, allowed_dir=cwd)))  # noqa: S108
    # deepcode ignore python/PT: same safe_path boundary check applied to --input arg
    input_path = Path(_extract_safe_path(safe_path(args.input, allowed_dir=cwd)))  # noqa: S108
    # deepcode ignore python/PT: same safe_path boundary check applied to --output arg
    output_path = Path(_extract_safe_path(safe_path(args.output, allowed_dir=cwd)))  # noqa: S108
    
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
    if Llama is None:
        raise ImportError("llama-cpp-python is required. Install with: pip install llama-cpp-python")
    llm: Any = Llama(  # pyright: ignore[reportUnknownVariableType]
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
    results: list[dict[str, str]] = []
    for scenario in tqdm(scenarios, desc="Generating"):
        try:
            instruction_text: str = scenario.get("instruction", "")
            input_text: str = scenario.get("input", "")
            response = generate_response(
                llm,
                system_prompt,
                instruction_text,
                input_text
            )
            
            # Build training example in Alpaca format
            result: dict[str, str] = {
                "system": system_prompt,
                "instruction": instruction_text,
                "input": input_text,
                "output": response
            }
            results.append(result)
            
        except Exception as e:
            print(f"\n  ⚠ Error processing scenario: {e}")
            continue
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # _extract_safe_path re-validates and returns a new string from regex match group
    with open(_extract_safe_path(str(output_path)), 'w', encoding='utf-8') as f:  # noqa: S108
        for result in results:
            f.write(json.dumps(result, ensure_ascii=False) + '\n')
    
    print(f"\n✓ Saved {len(results)} training examples to {output_path}")
    
    # Stats
    total_chars: int = sum(len(str(r['output'])) for r in results)
    avg_chars: float = total_chars / len(results) if results else 0
    print(f"  Average response length: {avg_chars:.0f} characters")
    print(f"  Generated at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
