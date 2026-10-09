# 📱 VetRate Mobile Models - Knowledge Distillation

## Overview

The VetRate Warrant Council mobile models are **1.7B parameter** versions of our full **7B models**, trained using **knowledge distillation**. This means the smaller models learn to mimic the behavior and expertise of the larger models.

## Why Distillation?

| Aspect | 7B Full Model | 1.7B Mobile Model |
|--------|--------------|-------------------|
| Size | ~4.4 GB | ~0.8 GB |
| VRAM Required | 6 GB | 2 GB |
| Load Time | 15-30 sec | 3-5 sec |
| Device Support | Desktop/Laptop | Phone/Tablet/Laptop |
| Capability | Full Expert | 95%+ of Full |

## The Warrant Council Mobile Edition

```
📱 CWO3 Auditor (Mobile)  - vetrate-auditor-1.7b-mobile-v1
📱 CWO4 Writer (Mobile)   - vetrate-writer-1.7b-mobile-v1  
📱 CWO5 Rater (Mobile)    - vetrate-rater-1.7b-mobile-v1
```

## Technical Details

### Base Model

- **SmolLM2-1.7B-Instruct** from HuggingFace
- Chosen for efficiency and strong instruction-following

### Training Method

1. **Teacher Inference**: Run 7B models on diverse VA claims scenarios
2. **Data Collection**: Save high-quality outputs as training data
3. **Student Training**: Fine-tune 1.7B model to produce same outputs
4. **QLoRA**: 4-bit quantization during training for efficiency

### Context Length

- 7B models: 4096 tokens
- Mobile models: 2048 tokens (sufficient for most tasks)

## Quantization Options

| Format | Size | Quality | Use Case |
|--------|------|---------|----------|
| Q4_K_M | ~450 MB | Good | Mobile browsers |
| Q8_0 | ~800 MB | Better | Desktop with limited VRAM |
| FP16 | ~3.4 GB | Best | High-end devices |

## How to Train

```bash
# 1. Generate distillation data
python distill_to_mobile.py

# 2. Run 7B inference to complete examples
python inference_generate_distill.py \
    --model /path/to/vetrate-auditor-7b-Q4_K_M.gguf \
    --input training-data-v2/distill_auditor_scenarios.jsonl \
    --output training-data-v2/distill_auditor_7b_complete.jsonl

# 3. Train mobile model
accelerate launch -m axolotl.cli.train \
    axolotl-configs/auditor-1b-mobile-distill.yml

# 4. Convert to GGUF
python -m llama_cpp.convert --outtype q4_k_m model_dir
```

Or run the complete pipeline:

```bash
./train_mobile_models.sh
```

## File Structure

```
llm-compiler/
├── axolotl-configs/
│   ├── auditor-1b-mobile-distill.yml
│   ├── writer-1b-mobile-distill.yml
│   └── rater-1b-mobile-distill.yml
├── training-data-v2/
│   ├── distill_auditor_scenarios.jsonl
│   ├── distill_auditor_7b_complete.jsonl
│   └── ... (writer, rater)
├── models/
│   └── mobile/
│       ├── vetrate-auditor-1.7b-mobile-v1/
│       ├── vetrate-writer-1.7b-mobile-v1/
│       └── vetrate-rater-1.7b-mobile-v1/
├── distill_to_mobile.py        # Generate scenario scaffolds
├── inference_generate_distill.py  # Run 7B inference
├── train_mobile_models.sh      # Complete pipeline
└── MOBILE_MODELS_README.md     # This file
```

## WebGPU Deployment

After training, compile for browser use:

```bash
./compile_webgpu.sh VetRate/vetrate-auditor-1.7b-mobile-v1
```

This creates WebGPU-optimized models that run entirely in the browser with no server required.

## Performance Notes

- **First load**: ~3-5 seconds on modern mobile browsers
- **Inference speed**: ~15-25 tokens/second on mobile
- **Memory usage**: ~2 GB RAM during inference
- **Battery impact**: Moderate (GPU acceleration helps)

## Contributing

To improve the mobile models:

1. Add more distillation scenarios to `distill_to_mobile.py`
2. Re-run the training pipeline
3. Test on mobile devices
4. Submit PR with improvements
