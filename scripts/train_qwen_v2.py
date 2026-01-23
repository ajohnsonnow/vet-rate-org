#!/usr/bin/env python3
"""
VetRate Qwen v2 Fine-Tuning Script
===================================
Uses QLoRA to fine-tune Qwen 2.5-7B models on VA-specific tasks.

Models:
- Auditor: Qwen2.5-7B-Instruct → Regulatory accuracy
- Writer: Qwen2.5-7B-Instruct → Statement drafting  
- Rater: Qwen2.5-Coder-7B-Instruct → Tool-calling for math

Hardware Target:
- RTX 4080 SUPER (16GB) + RTX 4070 Ti SUPER (16GB)
- Uses QLoRA (4-bit quantization) to fit in VRAM
"""

import os
import json
import torch
from pathlib import Path
from datetime import datetime

# Training imports
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset

# =============================================================================
# CONFIGURATION
# =============================================================================

BASE_DIR = Path.home() / "vet-rate-swarm"
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "models" / "finetuned"

# Model configurations
MODELS = {
    "auditor": {
        "base_model": "Qwen/Qwen2.5-7B-Instruct",
        "train_file": DATA_DIR / "train_auditor_v2.jsonl",
        "output_name": "vetrate-auditor-7b-v2",
    },
    "writer": {
        "base_model": "Qwen/Qwen2.5-7B-Instruct", 
        "train_file": DATA_DIR / "train_writer_v2.jsonl",
        "output_name": "vetrate-writer-7b-v2",
    },
    "rater": {
        "base_model": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "train_file": DATA_DIR / "train_rater_v2.jsonl",
        "output_name": "vetrate-rater-7b-v2",
    },
}

# QLoRA Configuration (4-bit quantization)
QLORA_CONFIG = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

# LoRA Configuration
LORA_CONFIG = LoraConfig(
    r=32,                      # Rank
    lora_alpha=64,             # Alpha scaling
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ],
)

# Training hyperparameters
TRAINING_ARGS = {
    "num_train_epochs": 3,
    "per_device_train_batch_size": 2,
    "gradient_accumulation_steps": 8,  # Effective batch size = 16
    "learning_rate": 2e-4,
    "warmup_ratio": 0.1,
    "lr_scheduler_type": "cosine",
    "optim": "adamw_8bit",
    "fp16": False,
    "bf16": True,
    "logging_steps": 10,
    "save_strategy": "epoch",
    "gradient_checkpointing": True,
    "max_grad_norm": 1.0,
}


# =============================================================================
# DATA LOADING
# =============================================================================

def load_training_data(train_file: Path):
    """Load JSONL training data in chat format"""
    
    def format_chat(example):
        """Convert messages to Qwen chat format"""
        messages = example.get("messages", [])
        
        text = ""
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            
            if role == "system":
                text += f"<|im_start|>system\n{content}<|im_end|>\n"
            elif role == "user":
                text += f"<|im_start|>user\n{content}<|im_end|>\n"
            elif role == "assistant":
                text += f"<|im_start|>assistant\n{content}<|im_end|>\n"
        
        return {"text": text}
    
    dataset = load_dataset("json", data_files=str(train_file), split="train")
    dataset = dataset.map(format_chat, remove_columns=dataset.column_names)
    
    return dataset


# =============================================================================
# TRAINING FUNCTION
# =============================================================================

def train_model(model_name: str):
    """Fine-tune a single model"""
    
    config = MODELS[model_name]
    print(f"\n{'='*60}")
    print(f"Training: {model_name.upper()}")
    print(f"Base Model: {config['base_model']}")
    print(f"Training Data: {config['train_file']}")
    print(f"{'='*60}\n")
    
    # Check training data exists
    if not config['train_file'].exists():
        print(f"❌ Training file not found: {config['train_file']}")
        return None
    
    # Load tokenizer
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        config['base_model'],
        trust_remote_code=True
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # Load model with QLoRA
    print("Loading model with QLoRA quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        config['base_model'],
        quantization_config=QLORA_CONFIG,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
    )
    
    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)
    
    # Apply LoRA
    print("Applying LoRA adapters...")
    model = get_peft_model(model, LORA_CONFIG)
    model.print_trainable_parameters()
    
    # Load dataset
    print("Loading training data...")
    dataset = load_training_data(config['train_file'])
    print(f"Training samples: {len(dataset)}")
    
    # Output directory
    output_dir = OUTPUT_DIR / config['output_name']
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # SFTConfig (TRL 0.27+ - combines TrainingArguments + SFT-specific settings)
    sft_config = SFTConfig(
        output_dir=str(output_dir),
        report_to="none",
        # Training params
        num_train_epochs=3,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        fp16=False,
        bf16=True,
        logging_steps=10,
        save_strategy="epoch",
        gradient_checkpointing=True,
        max_grad_norm=1.0,
        # SFT-specific params
        dataset_text_field="text",
        max_length=2048,
        packing=False,
    )
    
    # Create trainer (TRL 0.27+ API)
    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=dataset,
        processing_class=tokenizer,
    )
    
    # Train!
    print("\n🚀 Starting training...")
    start_time = datetime.now()
    
    trainer.train()
    
    duration = datetime.now() - start_time
    print(f"\n✅ Training complete! Duration: {duration}")
    
    # Save the model
    print(f"Saving to {output_dir}...")
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)
    
    # Save training info
    info = {
        "model_name": model_name,
        "base_model": config['base_model'],
        "train_samples": len(dataset),
        "training_duration": str(duration),
        "timestamp": datetime.now().isoformat(),
    }
    with open(output_dir / "training_info.json", "w") as f:
        json.dump(info, f, indent=2)
    
    print(f"✅ {model_name.upper()} training complete!")
    return output_dir


# =============================================================================
# MAIN
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="VetRate Qwen Fine-Tuning")
    parser.add_argument(
        "--model", 
        choices=["auditor", "writer", "rater", "all"],
        default="all",
        help="Which model to train"
    )
    args = parser.parse_args()
    
    print("""
╔═══════════════════════════════════════════════════════════════╗
║         🎖️  VETRATE QWEN v2 FINE-TUNING  🎖️                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Training Qwen 2.5-7B models with QLoRA for VA tasks          ║
║                                                               ║
║  Models:                                                      ║
║    • Auditor - Regulatory accuracy verification               ║
║    • Writer  - Personal statement drafting                    ║
║    • Rater   - Tool-calling for VA math                       ║
╚═══════════════════════════════════════════════════════════════╝
""")
    
    # Check GPU
    if torch.cuda.is_available():
        print(f"🖥️  GPU: {torch.cuda.get_device_name(0)}")
        print(f"💾 VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    else:
        print("⚠️  No GPU detected! Training will be very slow.")
    
    # Train models
    if args.model == "all":
        models_to_train = ["auditor", "writer", "rater"]
    else:
        models_to_train = [args.model]
    
    results = {}
    for model_name in models_to_train:
        try:
            output_dir = train_model(model_name)
            results[model_name] = {"status": "success", "output": str(output_dir)}
        except Exception as e:
            print(f"❌ Error training {model_name}: {e}")
            results[model_name] = {"status": "error", "error": str(e)}
    
    # Summary
    print("\n" + "="*60)
    print("TRAINING SUMMARY")
    print("="*60)
    for model, result in results.items():
        status = "✅" if result["status"] == "success" else "❌"
        print(f"{status} {model.upper()}: {result.get('output', result.get('error'))}")
    
    print("\n🎉 Fine-tuning complete!")


if __name__ == "__main__":
    main()
