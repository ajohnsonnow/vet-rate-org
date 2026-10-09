#!/usr/bin/env python3
"""
Validate Axolotl YAML configurations for RTX 4080 Super compatibility.
Ensures all settings are optimal for 16GB VRAM and 40-series architecture.
"""

import yaml
import sys
from pathlib import Path
from typing import Dict, List, Tuple

class AxolotlConfigValidator:
    """Validate Axolotl configs against RTX 4080 Super constraints."""
    
    REQUIRED_SETTINGS = {
        'load_in_4bit': True,
        'flash_attention': True,
        'bf16': True,
        'fp16': False,
    }
    
    RECOMMENDED_RANGES = {
        'lora_r': (16, 64),
        'lora_alpha': (32, 128),
        'sequence_len': (2048, 8192),
        'micro_batch_size': (1, 8),
        'gradient_accumulation_steps': (2, 8),
    }
    
    VRAM_ESTIMATES = {
        'base_model_4bit': 3.5,  # GB
        'gradients': 2.0,
        'optimizer_states': 1.5,
        'activations_per_batch': 0.8,  # GB per batch item
        'overhead': 1.0,
    }
    
    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config = self._load_config()
        self.warnings = []
        self.errors = []
    
    def _load_config(self) -> Dict:
        """Load YAML config file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"❌ ERROR: Failed to load {self.config_path}: {e}")
            sys.exit(1)
    
    def validate_all(self) -> Tuple[bool, List[str], List[str]]:
        """Run all validation checks."""
        print(f"\n{'='*70}")
        print(f"Validating: {self.config_path.name}")
        print(f"{'='*70}\n")
        
        self._check_required_settings()
        self._check_model_compatibility()
        self._check_lora_settings()
        self._check_batch_settings()
        self._estimate_vram()
        self._check_dataset_paths()
        self._check_precision_settings()
        
        return len(self.errors) == 0, self.warnings, self.errors
    
    def _check_required_settings(self):
        """Verify critical RTX 4080 Super settings."""
        print("🔍 Checking RTX 4080 Super Required Settings...")
        
        for key, expected_value in self.REQUIRED_SETTINGS.items():
            actual_value = self.config.get(key)
            if actual_value == expected_value:
                print(f"  ✅ {key}: {actual_value}")
            elif actual_value is None:
                self.errors.append(f"Missing required setting: {key}")
                print(f"  ❌ {key}: MISSING (should be {expected_value})")
            else:
                self.errors.append(f"{key} should be {expected_value}, got {actual_value}")
                print(f"  ❌ {key}: {actual_value} (should be {expected_value})")
    
    def _check_model_compatibility(self):
        """Check base model is Llama-3.2-3B."""
        print("\n🤖 Checking Model Compatibility...")
        
        base_model = self.config.get('base_model', '')
        if 'Llama-3.2-3B' in base_model:
            print(f"  ✅ Base Model: {base_model}")
        else:
            self.warnings.append(f"Base model is not Llama-3.2-3B: {base_model}")
            print(f"  ⚠️  Base Model: {base_model} (expected Llama-3.2-3B)")
    
    def _check_lora_settings(self):
        """Validate LoRA hyperparameters."""
        print("\n🎯 Checking LoRA Settings...")
        
        lora_r = self.config.get('lora_r', 0)
        lora_alpha = self.config.get('lora_alpha', 0)
        lora_dropout = self.config.get('lora_dropout', 0)
        
        # Check rank
        min_r, max_r = self.RECOMMENDED_RANGES['lora_r']
        if min_r <= lora_r <= max_r:
            print(f"  ✅ LoRA Rank: {lora_r}")
        else:
            self.warnings.append(f"LoRA rank {lora_r} outside recommended range [{min_r}, {max_r}]")
            print(f"  ⚠️  LoRA Rank: {lora_r} (recommended: {min_r}-{max_r})")
        
        # Check alpha
        min_alpha, max_alpha = self.RECOMMENDED_RANGES['lora_alpha']
        if min_alpha <= lora_alpha <= max_alpha:
            print(f"  ✅ LoRA Alpha: {lora_alpha}")
        else:
            self.warnings.append(f"LoRA alpha {lora_alpha} outside recommended range [{min_alpha}, {max_alpha}]")
            print(f"  ⚠️  LoRA Alpha: {lora_alpha} (recommended: {min_alpha}-{max_alpha})")
        
        # Check dropout
        if 0 <= lora_dropout <= 0.2:
            print(f"  ✅ LoRA Dropout: {lora_dropout}")
        else:
            self.warnings.append(f"LoRA dropout {lora_dropout} is unusual")
            print(f"  ⚠️  LoRA Dropout: {lora_dropout}")
        
        # Check target modules
        target_modules = self.config.get('lora_target_modules', [])
        expected_modules = ['q_proj', 'k_proj', 'v_proj', 'o_proj']
        if all(m in target_modules for m in expected_modules):
            print(f"  ✅ Target Modules: {len(target_modules)} modules")
        else:
            self.warnings.append(f"Target modules missing some QKV projections")
            print(f"  ⚠️  Target Modules: {target_modules}")
    
    def _check_batch_settings(self):
        """Validate batch size and gradient accumulation."""
        print("\n📊 Checking Batch Settings...")
        
        micro_batch = self.config.get('micro_batch_size', 0)
        grad_accum = self.config.get('gradient_accumulation_steps', 0)
        effective_batch = micro_batch * grad_accum
        
        print(f"  Micro Batch Size: {micro_batch}")
        print(f"  Gradient Accumulation: {grad_accum}")
        print(f"  ✅ Effective Batch Size: {effective_batch}")
        
        if effective_batch < 8:
            self.warnings.append(f"Effective batch size {effective_batch} is small, may impact training")
        elif effective_batch > 32:
            self.warnings.append(f"Effective batch size {effective_batch} is large, may slow convergence")
    
    def _estimate_vram(self):
        """Estimate VRAM usage."""
        print("\n💾 VRAM Estimation (RTX 4080 Super: 16GB)...")
        
        micro_batch = self.config.get('micro_batch_size', 4)
        seq_len = self.config.get('sequence_len', 4096)
        
        # Calculate components
        base = self.VRAM_ESTIMATES['base_model_4bit']
        grads = self.VRAM_ESTIMATES['gradients']
        optimizer = self.VRAM_ESTIMATES['optimizer_states']
        activations = self.VRAM_ESTIMATES['activations_per_batch'] * micro_batch
        overhead = self.VRAM_ESTIMATES['overhead']
        
        total = base + grads + optimizer + activations + overhead
        
        print(f"  Base Model (4-bit): {base:.1f} GB")
        print(f"  Gradients: {grads:.1f} GB")
        print(f"  Optimizer States: {optimizer:.1f} GB")
        print(f"  Activations (batch={micro_batch}): {activations:.1f} GB")
        print(f"  Overhead: {overhead:.1f} GB")
        print(f"  {'─'*50}")
        
        if total < 14:
            print(f"  ✅ Estimated Total: {total:.1f} GB / 16 GB ({total/16*100:.0f}%)")
        elif total < 16:
            print(f"  ⚠️  Estimated Total: {total:.1f} GB / 16 GB ({total/16*100:.0f}%) - Tight")
            self.warnings.append(f"VRAM usage near limit: {total:.1f} GB")
        else:
            print(f"  ❌ Estimated Total: {total:.1f} GB / 16 GB - EXCEEDS CAPACITY")
            self.errors.append(f"VRAM estimate {total:.1f} GB exceeds 16 GB limit")
    
    def _check_dataset_paths(self):
        """Verify training data files exist."""
        print("\n📁 Checking Dataset Paths...")
        
        datasets = self.config.get('datasets', [])
        test_datasets = self.config.get('test_datasets', [])
        
        all_paths = []
        if datasets:
            all_paths.extend([d.get('path') for d in datasets if d.get('path')])
        if test_datasets:
            all_paths.extend([d.get('path') for d in test_datasets if d.get('path')])
        
        config_dir = self.config_path.parent
        for rel_path in all_paths:
            full_path = config_dir / rel_path
            if full_path.exists():
                size_mb = full_path.stat().st_size / (1024 * 1024)
                print(f"  ✅ {rel_path} ({size_mb:.2f} MB)")
            else:
                self.errors.append(f"Dataset file not found: {rel_path}")
                print(f"  ❌ {rel_path} - NOT FOUND")
    
    def _check_precision_settings(self):
        """Check precision and attention settings."""
        print("\n🎯 Checking Precision & Attention...")
        
        checks = [
            ('flash_attention', True, "Flash Attention 2"),
            ('bf16', True, "BFloat16"),
            ('fp16', False, "Float16 (should be disabled)"),
            ('gradient_checkpointing', True, "Gradient Checkpointing"),
        ]
        
        for key, expected, label in checks:
            actual = self.config.get(key)
            if actual == expected:
                print(f"  ✅ {label}: {actual}")
            else:
                print(f"  ⚠️  {label}: {actual} (expected {expected})")
                if key in ['bf16', 'flash_attention']:
                    self.warnings.append(f"{label} not optimally configured")
    
    def print_summary(self):
        """Print validation summary."""
        print(f"\n{'='*70}")
        print("VALIDATION SUMMARY")
        print(f"{'='*70}")
        
        if not self.errors and not self.warnings:
            print("✅ ALL CHECKS PASSED - Ready for training!")
        else:
            if self.errors:
                print(f"\n❌ ERRORS ({len(self.errors)}):")
                for err in self.errors:
                    print(f"  - {err}")
            
            if self.warnings:
                print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
                for warn in self.warnings:
                    print(f"  - {warn}")
        
        print()


def main():
    """Main validation script."""
    script_dir = Path(__file__).parent
    configs_dir = script_dir / 'axolotl-configs'
    
    if not configs_dir.exists():
        print(f"❌ ERROR: Config directory not found: {configs_dir}")
        sys.exit(1)
    
    config_files = list(configs_dir.glob('*-qlora.yml'))
    
    if not config_files:
        print(f"❌ ERROR: No *-qlora.yml files found in {configs_dir}")
        sys.exit(1)
    
    print("╔═══════════════════════════════════════════════════════════════════════╗")
    print("║         RTX 4080 Super - Axolotl Config Validator                    ║")
    print("╚═══════════════════════════════════════════════════════════════════════╝")
    
    all_valid = True
    
    for config_file in sorted(config_files):
        validator = AxolotlConfigValidator(config_file)
        is_valid, warnings, errors = validator.validate_all()
        validator.print_summary()
        
        if not is_valid:
            all_valid = False
    
    print("="*70)
    if all_valid:
        print("✅ ALL CONFIGS VALID - Ready to begin training!")
        sys.exit(0)
    else:
        print("❌ VALIDATION FAILED - Fix errors before training")
        sys.exit(1)


if __name__ == "__main__":
    main()
