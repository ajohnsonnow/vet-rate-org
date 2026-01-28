#!/usr/bin/env python3
"""
💎 VetRate Knowledge Distillation Pipeline
==========================================
Generates training data from 7B teacher models to train smaller mobile models.

This script:
1. Loads the VetRate 7B teacher model
2. Runs inference on diverse VA claims scenarios
3. Saves high-quality outputs as training data for smaller models

The smaller models learn to mimic the 7B model's reasoning and accuracy
while being 5-10x smaller and faster on mobile devices.
"""

import json
import os
from pathlib import Path
from datetime import datetime
from tqdm import tqdm

# Distillation prompts - scenarios the mobile model needs to handle well
DISTILLATION_SCENARIOS = {
    "auditor": [
        # Rating verification scenarios
        {
            "instruction": "Review this veteran's claimed conditions and verify the combined rating calculation.",
            "input": "Conditions: PTSD 70%, Tinnitus 10%, Lumbar Strain 20%, Left Knee 10%",
        },
        {
            "instruction": "Check if this claim includes proper nexus evidence for secondary conditions.",
            "input": "Primary: Service-connected Diabetes Type 2. Claimed secondaries: Peripheral Neuropathy bilateral feet, Erectile Dysfunction, Chronic Kidney Disease Stage 2",
        },
        {
            "instruction": "Identify any missing documentation for this TDIU claim.",
            "input": "Veteran claims unemployability due to PTSD (70%) and Back condition (40%). Last worked 2019 as truck driver. Has VA treatment records but no employer statements.",
        },
        # Compliance check scenarios
        {
            "instruction": "Verify this claim meets 38 CFR requirements for presumptive service connection.",
            "input": "Gulf War veteran, boots on ground Kuwait 1991. Claiming: Chronic Fatigue Syndrome, Fibromyalgia, IBS. No diagnosis during service.",
        },
        {
            "instruction": "Check bilateral factor application in this rating calculation.",
            "input": "Left knee: 20%, Right knee: 10%, Left hip: 10%, Right hip: 10%",
        },
        # BVA appeal scenarios
        {
            "instruction": "Review the strength of evidence for this BVA appeal.",
            "input": "Denied for sleep apnea secondary to PTSD. Have: 1) Private nexus letter, 2) VA C&P noting weight gain from PTSD meds, 3) Buddy statement from spouse about snoring started after deployment",
        },
        {
            "instruction": "Identify procedural errors in this rating decision.",
            "input": "Claim denied stating 'no current diagnosis' but veteran submitted diagnosis from VA provider dated 2 months before decision. No mention of this evidence in decision letter.",
        },
        # Complex multi-issue scenarios
        {
            "instruction": "Audit this claim for completeness and identify strategic improvements.",
            "input": "Vietnam veteran, Agent Orange exposed. Currently rated: CAD 60%, Diabetes 20%, Peripheral Neuropathy 20% each leg. Recently diagnosed: Prostate Cancer, Parkinson's symptoms, Chloracne. Not yet filed.",
        },
    ],
    
    "writer": [
        # Personal statement scenarios
        {
            "instruction": "Write a personal statement for service connection of PTSD.",
            "input": "Combat veteran, Iraq 2004-2005. Witnessed IED attack killing squad member. Symptoms: nightmares, hypervigilance, avoidance of crowds, anger issues affecting marriage.",
        },
        {
            "instruction": "Write a nexus letter template for sleep apnea secondary to PTSD.",
            "input": "Veteran has 70% PTSD, gained 45 lbs since service due to medications and depression. Diagnosed OSA 2022, uses CPAP.",
        },
        {
            "instruction": "Draft a buddy statement for chronic pain observation.",
            "input": "Spouse of veteran with back injury. Married 15 years, observed decline since deployment. Uses cane, can't play with kids, constant pain affects mood.",
        },
        # Increase claim statements
        {
            "instruction": "Write a statement supporting increased rating for knee condition.",
            "input": "Current 10%. Has: giving way episodes 2-3x/week, uses brace, can't walk more than 1 block, stairs very difficult, affects job as nurse (standing all day).",
        },
        # Appeal statements
        {
            "instruction": "Draft a NOD (Notice of Disagreement) for denied hearing loss claim.",
            "input": "Infantry MOS, qualified expert rifle. Denied because 'hearing normal at separation.' Has current diagnosis, artillery exposure, no hearing protection provided in 1980s.",
        },
    ],
    
    "rater": [
        # Basic rating calculations
        {
            "instruction": "Calculate the combined VA rating for these conditions.",
            "input": "PTSD 70%, Migraine 30%, Tinnitus 10%, Back 20%",
        },
        {
            "instruction": "Calculate rating with bilateral factor applied.",
            "input": "Left knee 20%, Right knee 20%, Left ankle 10%, Right ankle 10%",
        },
        # Diagnostic code analysis
        {
            "instruction": "What is the maximum rating for DC 5243 (Intervertebral Disc Syndrome)?",
            "input": "Veteran has lumbar IVDS with incapacitating episodes requiring bed rest prescribed by physician.",
        },
        {
            "instruction": "Explain the rating criteria for PTSD under DC 9411.",
            "input": "Veteran has occupational and social impairment with reduced reliability. Symptoms: weekly panic attacks, difficulty maintaining work relationships, depressed mood, chronic sleep impairment.",
        },
        # TDIU analysis
        {
            "instruction": "Analyze TDIU eligibility.",
            "input": "Combined rating 80%. Single condition at 40% (back). PTSD 50%, Knee 10%, Tinnitus 10%. Worked as construction worker, HS education only. Can't do physical labor anymore.",
        },
        # SMC analysis
        {
            "instruction": "Check eligibility for Special Monthly Compensation.",
            "input": "Veteran has: 100% schedular PTSD, plus 60% combined for physical conditions (back 40%, knee 20%, tinnitus 10% after combining). Total combined would be 100% even without PTSD.",
        },
    ],
}


def generate_system_prompt(agent_type: str) -> str:
    """Generate the system prompt for each agent type."""
    prompts = {
        "auditor": """You are CWO3 Auditor, a VA claims compliance specialist. Your role is to:
- Review claims for accuracy and completeness
- Verify rating calculations against 38 CFR
- Identify missing evidence or documentation
- Check for procedural errors
- Ensure all secondary conditions are properly linked
Always cite specific CFR sections when applicable.""",
        
        "writer": """You are CWO4 Writer, a VA claims document specialist. Your role is to:
- Generate compelling personal statements
- Draft nexus letter templates with proper medical language
- Create buddy/lay statements that support claims
- Write appeal statements and NODs
- Use factual, professional language that meets VA requirements
Focus on specific incidents, symptoms, and functional limitations.""",
        
        "rater": """You are CWO5 Rater, a VA disability rating expert. Your role is to:
- Calculate combined ratings using VA math
- Apply bilateral factor correctly
- Analyze diagnostic codes and rating criteria
- Evaluate TDIU eligibility
- Assess SMC entitlement
Always show your work and cite 38 CFR sections.""",
    }
    return prompts.get(agent_type, "")


def create_distillation_dataset(agent_type: str, output_dir: Path):
    """
    Create the distillation dataset structure.
    
    In production, this would call the 7B model to generate responses.
    For now, we create the scaffold that the training pipeline expects.
    """
    scenarios = DISTILLATION_SCENARIOS.get(agent_type, [])
    system_prompt = generate_system_prompt(agent_type)
    
    output_file = output_dir / f"distill_{agent_type}_7b.jsonl"
    
    # Create training examples
    examples = []
    for scenario in scenarios:
        example = {
            "system": system_prompt,
            "instruction": scenario["instruction"],
            "input": scenario["input"],
            "output": f"[PLACEHOLDER: Run 7B model inference to generate this response]\n\nTo generate actual training data:\n1. Load vetrate-{agent_type}-7b-v2\n2. Run inference with this prompt\n3. Save the output here",
        }
        examples.append(example)
    
    # Write to JSONL
    with open(output_file, 'w', encoding='utf-8') as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')
    
    print(f"✅ Created {len(examples)} distillation examples for {agent_type}")
    print(f"   Output: {output_file}")
    
    return examples


def create_inference_script(output_dir: Path):
    """Create a script to run 7B inference for actual distillation."""
    script = '''#!/bin/bash
# Run this in WSL with the 7B models loaded

# Activate environment
source /home/antho/vet-rate-swarm/venv/bin/activate

# Run distillation inference
python3 << 'EOF'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import json
from pathlib import Path

MODEL_MAP = {
    "auditor": "VetRate/vetrate-auditor-7b-v2",
    "writer": "VetRate/vetrate-writer-7b-v2", 
    "rater": "VetRate/vetrate-rater-7b-v2",
}

for agent_type, model_id in MODEL_MAP.items():
    print(f"\\n{'='*60}")
    print(f"Loading {agent_type} model: {model_id}")
    print('='*60)
    
    # Load model
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    
    # Load placeholder file
    input_file = Path(f"training-data-v2/distill_{agent_type}_7b.jsonl")
    output_file = Path(f"training-data-v2/distill_{agent_type}_7b_complete.jsonl")
    
    with open(input_file, 'r') as f:
        examples = [json.loads(line) for line in f]
    
    # Generate responses
    completed = []
    for ex in examples:
        prompt = f"<|system|>{ex['system']}<|user|>{ex['instruction']}\\n\\n{ex['input']}<|assistant|>"
        
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        outputs = model.generate(
            **inputs,
            max_new_tokens=1024,
            temperature=0.7,
            do_sample=True,
        )
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("<|assistant|>")[-1].strip()
        
        ex['output'] = response
        completed.append(ex)
        print(f"  ✓ Generated response for: {ex['instruction'][:50]}...")
    
    # Save completed dataset
    with open(output_file, 'w') as f:
        for ex in completed:
            f.write(json.dumps(ex, ensure_ascii=False) + '\\n')
    
    print(f"\\n✅ Saved {len(completed)} examples to {output_file}")
    
    # Cleanup
    del model
    torch.cuda.empty_cache()

print("\\n🎉 Distillation dataset generation complete!")
EOF
'''
    
    script_path = output_dir / "run_distillation_inference.sh"
    with open(script_path, 'w', newline='\n', encoding='utf-8') as f:
        f.write(script)
    
    print(f"✅ Created inference script: {script_path}")


def main():
    print("=" * 70)
    print("💎 VetRate Knowledge Distillation Pipeline")
    print("=" * 70)
    print()
    print("This creates training data to distill 7B models → 1.7B mobile models")
    print()
    
    # Setup paths
    base_dir = Path(__file__).parent
    output_dir = base_dir / "training-data-v2"
    output_dir.mkdir(exist_ok=True)
    
    # Create distillation datasets for each agent
    for agent_type in ["auditor", "writer", "rater"]:
        print(f"\n📝 Creating {agent_type} distillation dataset...")
        create_distillation_dataset(agent_type, output_dir)
    
    # Create inference script
    print("\n📜 Creating inference script...")
    create_inference_script(base_dir)
    
    print("\n" + "=" * 70)
    print("✅ DISTILLATION PIPELINE READY")
    print("=" * 70)
    print("""
Next Steps:
1. Run `./run_distillation_inference.sh` in WSL to generate actual 7B outputs
2. Train mobile models with: `accelerate launch -m axolotl.cli.train axolotl-configs/auditor-1b-mobile-distill.yml`
3. Repeat for writer and rater agents
4. Compile to WebGPU with MLC-LLM
5. Upload to HuggingFace: VetRate/vetrate-{agent}-1.7b-mobile-v1
""")


if __name__ == "__main__":
    main()
