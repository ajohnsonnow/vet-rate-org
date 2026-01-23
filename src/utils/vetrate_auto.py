#!/usr/bin/env python3
"""
VetRate Auto-Routing Swarm
==========================
Automatically classifies user queries and routes to the appropriate specialist:
- MATH queries → Rater (Qwen-Coder) + VACalculator Tool
- WRITE queries → Writer (Qwen-Instruct)  
- AUDIT queries → Auditor (Qwen-Instruct)

Hardware: RTX 4080 SUPER (16GB) - loads one model at a time to maximize context
"""

import sys
import re
import json
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent))

from llama_cpp import Llama
from vaCalculatorTool import calculate_combined_rating

# =============================================================================
# CONFIGURATION
# =============================================================================

MODELS_DIR = Path.home() / "vet-rate-swarm" / "models" / "gguf"
MODEL_INSTRUCT = MODELS_DIR / "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
MODEL_CODER = MODELS_DIR / "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"

# GPU settings
N_GPU_LAYERS = -1  # -1 = all layers to GPU
N_CTX = 8192       # Context window

# =============================================================================
# INTENT CLASSIFICATION (Rule-Based - Fast & Reliable)
# =============================================================================

MATH_PATTERNS = [
    r'\d+\s*%',                    # Any percentage
    r'calculat\w*',                # calculate, calculation
    r'combined?\s*rat\w*',         # combined rating
    r'what\s*(is|would)\s*my',     # what is my rating
    r'add\s*up',                   # add up
    r'total\s*rat\w*',             # total rating
    r'tdiu',                       # TDIU eligibility
    r'bilateral\s*factor',         # bilateral factor
]

WRITE_PATTERNS = [
    r'write\b',                    # write
    r'draft\b',                    # draft  
    r'statement',                  # statement
    r'letter',                     # letter
    r'nexus',                      # nexus letter
    r'buddy',                      # buddy statement
    r'help\s*me\s*(write|draft)',  # help me write
    r'template',                   # template
]

AUDIT_PATTERNS = [
    r'is\s*(it|this|that)\s*(true|correct|accurate)',  # is it true
    r'verif\w*',                   # verify
    r'38\s*cfr',                   # 38 CFR
    r'regulation',                 # regulation
    r'criteria',                   # criteria
    r'presumptive',                # presumptive condition
    r'require[sd]?',               # required
    r'dc\s*\d{4}',                 # DC codes
]

def classify_intent(query: str) -> str:
    """Classify user intent: MATH, WRITE, or AUDIT"""
    query_lower = query.lower()
    
    scores = {"MATH": 0, "WRITE": 0, "AUDIT": 0}
    
    for pattern in MATH_PATTERNS:
        if re.search(pattern, query_lower):
            scores["MATH"] += 1
    
    for pattern in WRITE_PATTERNS:
        if re.search(pattern, query_lower):
            scores["WRITE"] += 1
    
    for pattern in AUDIT_PATTERNS:
        if re.search(pattern, query_lower):
            scores["AUDIT"] += 1
    
    # Boost MATH if multiple percentages found
    if len(re.findall(r'\d+\s*%', query_lower)) >= 2:
        scores["MATH"] += 2
    
    # Get winner (default to AUDIT for general questions)
    if max(scores.values()) == 0:
        return "AUDIT"
    
    return max(scores, key=scores.get)

# =============================================================================
# MODEL LOADING (Single model at a time for max VRAM efficiency)
# =============================================================================

# Global model cache
_current_model = None
_current_model_type = None

def load_model(model_type: str) -> Llama:
    """Load model, switching if necessary"""
    global _current_model, _current_model_type
    
    if _current_model_type == model_type and _current_model is not None:
        return _current_model
    
    # Unload current model
    if _current_model is not None:
        del _current_model
        _current_model = None
        import gc
        gc.collect()
    
    # Load new model
    model_path = MODEL_CODER if model_type == "CODER" else MODEL_INSTRUCT
    
    print(f"\n🔄 Loading {model_type} model...")
    _current_model = Llama(
        model_path=str(model_path),
        n_gpu_layers=N_GPU_LAYERS,
        n_ctx=N_CTX,
        verbose=False
    )
    _current_model_type = model_type
    print(f"✅ {model_type} loaded!")
    
    return _current_model

# =============================================================================
# AGENT FUNCTIONS
# =============================================================================

def run_rater(query: str) -> str:
    """Extract ratings and calculate combined VA rating"""
    llm = load_model("CODER")
    
    system_prompt = """You are a VA Rating Extractor. Extract disability ratings from the user's query.
Output ONLY a JSON array of integers representing the percentages.

Examples:
User: "I have 70% PTSD and 30% back pain"
Output: [70, 30]

User: "50% sleep apnea, 30% migraines, 10% tinnitus"
Output: [50, 30, 10]

User: "My ratings are forty percent and twenty percent"
Output: [40, 20]

Output ONLY the JSON array, nothing else."""

    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        temperature=0.1,
        max_tokens=100
    )
    
    content = response['choices'][0]['message']['content'].strip()
    
    try:
        # Extract JSON array from response
        match = re.search(r'\[[\d,\s]+\]', content)
        if match:
            ratings = json.loads(match.group(0))
            
            # Call the deterministic calculator
            result = calculate_combined_rating(ratings)
            
            output = f"""
🧮 **VA Combined Rating Calculation**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Input Ratings: {ratings}
📈 Exact Combined: {result['exact_combined']:.2f}%
✅ **Final Rating: {result['combined_rating']}%**
💰 Monthly Compensation: ${result['monthly_compensation']:,.2f}

📝 Calculation Steps:
"""
            for step in result['step_by_step']:
                output += f"   • {step}\n"
            
            return output
        else:
            return f"❌ Could not extract ratings. Model output: {content}"
    except Exception as e:
        return f"❌ Error: {e}\nModel output: {content}"


def run_writer_auditor(query: str, mode: str) -> None:
    """Generate text with Writer or Auditor persona (streaming)"""
    llm = load_model("INSTRUCT")
    
    if mode == "WRITE":
        system_prompt = """You are VetRate-Writer, a veteran personal statement drafting assistant.

RULES:
1. Help veterans organize thoughts into statement templates
2. Include DISCLAIMER that you're not a lawyer
3. NEVER refuse to help draft a statement
4. Use placeholders like [DATE], [SPECIFIC DETAILS]
5. Recommend consulting with a VSO

Be empathetic, professional, and helpful."""
        emoji = "✍️"
        title = "Writer"
    else:
        system_prompt = """You are VetRate-Auditor, a VA regulatory accuracy checker.

RULES:
1. Verify claims against 38 CFR regulations
2. NEVER make up regulations - say "I'm not certain" if unsure
3. Cite specific CFR sections when possible
4. Format: ACCURACY CHECK → VERIFICATION → SOURCE
5. Label anecdotal information clearly

Be precise and factual."""
        emoji = "⚖️"
        title = "Auditor"
    
    print(f"\n{emoji} **VetRate-{title} Response:**\n")
    print("─" * 50)
    
    # Stream the response
    stream = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        temperature=0.5,
        max_tokens=1500,
        stream=True
    )
    
    for chunk in stream:
        delta = chunk['choices'][0].get('delta', {})
        if 'content' in delta:
            print(delta['content'], end="", flush=True)
    
    print("\n" + "─" * 50)


# =============================================================================
# MAIN LOOP
# =============================================================================

def main():
    print("""
╔═══════════════════════════════════════════════════════════════╗
║           🎖️  VETRATE AUTO-ROUTING SWARM  🎖️                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Routes your questions to the right specialist automatically  ║
║                                                               ║
║  🧮 MATH    → Rater (calculations, TDIU, bilateral)           ║
║  ✍️  WRITE   → Writer (statements, letters, templates)         ║
║  ⚖️  AUDIT   → Auditor (regulations, criteria, verification)  ║
║                                                               ║
║  Type 'q' to quit                                             ║
╚═══════════════════════════════════════════════════════════════╝
""")
    
    while True:
        try:
            user_query = input("\n🎖️  User > ").strip()
            
            if user_query.lower() in ['q', 'exit', 'quit']:
                print("\n👋 Thank you for using VetRate. Semper Fi!")
                break
            
            if not user_query:
                continue
            
            # 1. Classify intent
            intent = classify_intent(user_query)
            intent_emoji = {"MATH": "🧮", "WRITE": "✍️", "AUDIT": "⚖️"}
            print(f"\n🔀 Routing to: {intent_emoji[intent]} {intent}")
            
            # 2. Execute appropriate agent
            if intent == "MATH":
                print(run_rater(user_query))
            elif intent == "WRITE":
                run_writer_auditor(user_query, mode="WRITE")
            else:
                run_writer_auditor(user_query, mode="AUDIT")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    main()
