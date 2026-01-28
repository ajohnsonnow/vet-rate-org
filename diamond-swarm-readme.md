# Diamond Swarm - VA Claims AI Agents

Fine-tuned Qwen2.5-7B models specialized for VA disability claims assistance.

## Models

| Model | Purpose | HuggingFace | GGUF |
|-------|---------|-------------|------|
| **Auditor** | Legal analysis, compliance review, document parsing | [Diamond-Swarm-Auditor-7B](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Auditor-7B) | [GGUF](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Auditor-7B-GGUF) |
| **Writer** | Personal statements, nexus letters, buddy statements | [Diamond-Swarm-Writer-7B](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Writer-7B) | [GGUF](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Writer-7B-GGUF) |
| **Rater** | VA rating calculations, bilateral factor, TDIU assessment | [Diamond-Swarm-Rater-7B](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Rater-7B) | [GGUF](https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Rater-7B-GGUF) |

## Base Model

- **Qwen2.5-7B-Instruct** - Fine-tuned with QLoRA (4-bit)

## Training Data

- 38 CFR Part 4 (VA Rating Schedule)
- BVA case decisions
- VA claims procedures and terminology
- Nexus letter templates
- Personal statement examples

## Usage

### HuggingFace Transformers

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("Vet-Rate-org/Diamond-Swarm-Auditor-7B")
tokenizer = AutoTokenizer.from_pretrained("Vet-Rate-org/Diamond-Swarm-Auditor-7B")
```

### llama.cpp

```bash
# Download GGUF
wget https://huggingface.co/Vet-Rate-org/Diamond-Swarm-Auditor-7B-GGUF/resolve/main/vetrate-auditor-7b-v2-Q4_K_M.gguf

# Run server
./llama-server -m vetrate-auditor-7b-v2-Q4_K_M.gguf -c 4096 -ngl 99 --port 8080
```

### Ollama

```bash
# Create Modelfile
FROM ./vetrate-auditor-7b-v2-Q4_K_M.gguf
PARAMETER temperature 0.7
SYSTEM You are a VA claims expert specializing in legal analysis.

# Create model
ollama create diamond-auditor -f Modelfile
ollama run diamond-auditor
```

## GGUF Quantizations

- **Q4_K_M** (~4.4GB) - Best balance of speed and quality
- **Q5_K_M** (~5.1GB) - Higher quality, slightly slower

## License

MIT - Free for personal and commercial use

## Disclaimer

These models provide educational information only. They are NOT legal or medical advice. Always consult with accredited VSOs, attorneys, or medical professionals for official guidance.

## Credits

- Built by [Vet-Rate.org](https://vet-rate.org)
- Powered by [Qwen2.5](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)
