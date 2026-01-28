#!/bin/bash
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
    print(f"\n{'='*60}")
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
        prompt = f"<|system|>{ex['system']}<|user|>{ex['instruction']}\n\n{ex['input']}<|assistant|>"
        
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
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    
    print(f"\n✅ Saved {len(completed)} examples to {output_file}")
    
    # Cleanup
    del model
    torch.cuda.empty_cache()

print("\n🎉 Distillation dataset generation complete!")
EOF
