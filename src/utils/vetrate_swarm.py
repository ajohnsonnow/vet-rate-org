#!/usr/bin/env python3
"""
VetRate Swarm Orchestrator
Routes veteran queries to specialized LLM nodes

Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    USER QUERY                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               QUERY CLASSIFIER (Rules-Based)                 │
│  - Math keywords → RATER                                     │
│  - Letter/statement keywords → WRITER                        │
│  - Regulation/verify keywords → AUDITOR                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  RATER    │  │  WRITER   │  │  AUDITOR  │
│  (Coder)  │  │ (Instruct)│  │ (Instruct)│
│  + Tool   │  │           │  │           │
└───────────┘  └───────────┘  └───────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    RESPONSE                                  │
└─────────────────────────────────────────────────────────────┘

Models:
- Rater: Qwen2.5-Coder-7B-Instruct (outputs Python, uses VACalculator)
- Writer: Qwen2.5-7B-Instruct (drafts statements, never refuses)
- Auditor: Qwen2.5-7B-Instruct (verifies against 38 CFR)
"""

import re
import subprocess
import json
import tempfile
from pathlib import Path
from typing import Literal, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

# Import the VA Calculator for Rater tool calls
try:
    # Try absolute import first (when run as module)
    from src.utils.vaCalculatorTool import calculate_combined_rating, calculate_bilateral_factor
    CALCULATOR_AVAILABLE = True
except ImportError:
    try:
        # Fallback to relative import (when run from same directory)
        from vaCalculatorTool import calculate_combined_rating, calculate_bilateral_factor
        CALCULATOR_AVAILABLE = True
    except ImportError:
        CALCULATOR_AVAILABLE = False
        print("Warning: VACalculator not found. Rater will output code only.")


class Agent(Enum):
    RATER = "rater"
    WRITER = "writer"
    AUDITOR = "auditor"


@dataclass
class SwarmConfig:
    """Configuration for the VetRate Swarm"""
    llama_cpp_path: str = "~/llama.cpp/build/bin/llama-cli"
    models_dir: str = "~/vet-rate-swarm/models/gguf"
    
    # Model files
    rater_model: str = "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
    writer_model: str = "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
    auditor_model: str = "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
    
    # Generation settings
    n_gpu_layers: int = 99
    context_size: int = 8192
    max_tokens: int = 1024
    temperature: float = 0.2


# =============================================================================
# CLASSIFICATION RULES
# =============================================================================

RATER_KEYWORDS = [
    r'\bcalculat\w*\b',
    r'\bcombined?\s*rat\w*\b',
    r'\b\d+\s*%',
    r'\bpercentage?\b',
    r'\bbilateral\s*factor\b',
    r'\btdiu\b',
    r'\bwhat\s*(is|would)\s*my\s*rat\w*\b',
    r'\badd\w*\s*rat\w*\b',
    r'\btotal\s*rat\w*\b',
    r'\bva\s*math\b',
    r'\bwhole\s*person\b',
]

WRITER_KEYWORDS = [
    r'\bwrite\b',
    r'\bdraft\b',
    r'\bstatement\b',
    r'\bletter\b',
    r'\bnexus\b',
    r'\bpersonal\s*statement\b',
    r'\bbuddy\s*statement\b',
    r'\blay\s*statement\b',
    r'\bhelp\s*me\s*(write|draft)\b',
    r'\btemplate\b',
    r'\bclaim\s*(form|letter)\b',
]

AUDITOR_KEYWORDS = [
    r'\bverif\w*\b',
    r'\baccura\w*\b',
    r'\bcorrect\b',
    r'\b38\s*cfr\b',
    r'\bregulation\b',
    r'\bcriteria\b',
    r'\brequirement\b',
    r'\bis\s*(this|that|it)\s*(true|correct|accurate)\b',
    r'\bfact\s*check\b',
    r'\bdiagnostic\s*code\b',
    r'\bdc\s*\d{4}\b',
    r'\brating\s*criteria\b',
    r'\bm21-?1\b',
    r'\brequire[sd]?\b',
    r'\bsymptoms?\s*for\b',
]


def classify_query(query: str) -> Tuple[Agent, float]:
    """
    Classify a query to determine which agent should handle it.
    Returns (Agent, confidence_score)
    """
    query_lower = query.lower()
    
    scores = {
        Agent.RATER: 0,
        Agent.WRITER: 0,
        Agent.AUDITOR: 0,
    }
    
    # Score each agent based on keyword matches
    for pattern in RATER_KEYWORDS:
        if re.search(pattern, query_lower):
            scores[Agent.RATER] += 1
    
    for pattern in WRITER_KEYWORDS:
        if re.search(pattern, query_lower):
            scores[Agent.WRITER] += 1
    
    for pattern in AUDITOR_KEYWORDS:
        if re.search(pattern, query_lower):
            scores[Agent.AUDITOR] += 1
    
    # Special case: if numbers with % are present and "calculate" type words
    if re.search(r'\d+\s*%.*\d+\s*%', query_lower):
        scores[Agent.RATER] += 2
    
    # Get winner
    max_score = max(scores.values())
    
    if max_score == 0:
        # Default to Auditor for general questions
        return Agent.AUDITOR, 0.5
    
    winner = max(scores, key=scores.get)
    confidence = max_score / (sum(scores.values()) + 1)
    
    return winner, min(confidence, 1.0)


# =============================================================================
# SYSTEM PROMPTS
# =============================================================================

RATER_SYSTEM_PROMPT = """You are VetRate-Rater, a specialized VA disability rating calculator.

CRITICAL RULES:
1. For ANY rating calculation, output Python code using the VACalculator tool.
2. NEVER calculate manually - ALWAYS use the tool.
3. Use the "Whole Person Concept" (38 CFR 4.25):
   - Sort ratings descending
   - For each rating, apply it to the REMAINING healthy efficiency
   - remaining_efficiency = remaining_efficiency * (1 - rating/100)
   - Round final result to nearest 10

FORMULA (for reference):
combined = 0
for rating in sorted_ratings:
    combined = combined + (rating * (100 - combined) / 100)
final = round(round(combined) / 10) * 10

Always output executable Python code that imports and uses VACalculator."""

WRITER_SYSTEM_PROMPT = """You are VetRate-Writer, a veteran personal statement drafting assistant.

CRITICAL RULES:
1. You HELP veterans organize their thoughts into statement templates.
2. You are NOT a lawyer - always include disclaimer.
3. NEVER refuse to help a veteran draft their statement.
4. Output should be a TEMPLATE the veteran can customize.
5. Include placeholders like [DATE], [SPECIFIC DETAILS], etc.
6. Always recommend consulting with a VSO or accredited agent.

Your role is DRAFTING ASSISTANCE, not legal advice. You help veterans articulate their experiences."""

AUDITOR_SYSTEM_PROMPT = """You are VetRate-Auditor, a VA regulatory accuracy checker.

CRITICAL RULES:
1. Verify ALL claims against 38 CFR regulations.
2. NEVER make up regulations - if unsure, say so.
3. Always cite specific CFR sections when possible.
4. Format responses as:
   - ACCURACY CHECK: [CORRECT/INCORRECT/PARTIALLY CORRECT]
   - VERIFICATION: [explanation]
   - SOURCE: [CFR citation]
5. If information is anecdotal, label it clearly.

Your job is accuracy verification, not opinion. Stick to the regulations."""


# =============================================================================
# SWARM ORCHESTRATOR
# =============================================================================

class VetRateSwarm:
    """Main orchestrator for the VetRate LLM Swarm"""
    
    def __init__(self, config: Optional[SwarmConfig] = None):
        self.config = config or SwarmConfig()
        
        # Expand paths
        self.llama_path = Path(self.config.llama_cpp_path).expanduser()
        self.models_dir = Path(self.config.models_dir).expanduser()
    
    def _get_model_path(self, agent: Agent) -> Path:
        """Get the model file path for an agent"""
        model_map = {
            Agent.RATER: self.config.rater_model,
            Agent.WRITER: self.config.writer_model,
            Agent.AUDITOR: self.config.auditor_model,
        }
        return self.models_dir / model_map[agent]
    
    def _get_system_prompt(self, agent: Agent) -> str:
        """Get the system prompt for an agent"""
        prompt_map = {
            Agent.RATER: RATER_SYSTEM_PROMPT,
            Agent.WRITER: WRITER_SYSTEM_PROMPT,
            Agent.AUDITOR: AUDITOR_SYSTEM_PROMPT,
        }
        return prompt_map[agent]
    
    def _format_prompt(self, agent: Agent, user_query: str) -> str:
        """Format the full prompt with Qwen chat template"""
        system = self._get_system_prompt(agent)
        
        return f"""<|im_start|>system
{system}<|im_end|>
<|im_start|>user
{user_query}<|im_end|>
<|im_start|>assistant
"""
    
    def _call_llm(self, agent: Agent, prompt: str) -> str:
        """Call the LLM via llama.cpp"""
        model_path = self._get_model_path(agent)
        
        # Write prompt to temp file to avoid escaping issues (cross-platform)
        prompt_file = Path(tempfile.gettempdir()) / "vetrate_prompt.txt"
        prompt_file.write_text(prompt)
        
        cmd = [
            str(self.llama_path),
            "-m", str(model_path),
            "-f", str(prompt_file),
            "-c", str(self.config.context_size),
            "-n", str(self.config.max_tokens),
            "--temp", str(self.config.temperature),
            "-ngl", str(self.config.n_gpu_layers),
            "--no-display-prompt",
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            return "Error: Model timed out"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _extract_and_run_code(self, response: str) -> Optional[str]:
        """Extract Python code from response and execute it"""
        if not CALCULATOR_AVAILABLE:
            return None
        
        # Find code blocks
        code_match = re.search(r'```python\n(.*?)```', response, re.DOTALL)
        if not code_match:
            return None
        
        code = code_match.group(1)
        
        # Create a safe execution environment with the calculator functions
        safe_globals = {
            'calculate_combined_rating': calculate_combined_rating,
            'calculate_bilateral_factor': calculate_bilateral_factor,
            'print': print,
        }
        
        try:
            # Capture output
            import io
            import sys
            
            old_stdout = sys.stdout
            sys.stdout = captured = io.StringIO()
            
            exec(code, safe_globals)
            
            sys.stdout = old_stdout
            return captured.getvalue()
        except Exception as e:
            return f"Code execution error: {e}"
    
    def process_query(self, query: str, force_agent: Optional[Agent] = None) -> dict:
        """
        Process a user query through the swarm.
        
        Args:
            query: The user's question
            force_agent: Optionally force a specific agent
            
        Returns:
            dict with agent, confidence, response, and optionally code_output
        """
        # Classify
        if force_agent:
            agent = force_agent
            confidence = 1.0
        else:
            agent, confidence = classify_query(query)
        
        # Format prompt
        prompt = self._format_prompt(agent, query)
        
        # Call LLM
        response = self._call_llm(agent, prompt)
        
        result = {
            "agent": agent.value,
            "confidence": confidence,
            "response": response,
        }
        
        # For Rater, try to execute the code
        if agent == Agent.RATER:
            code_output = self._extract_and_run_code(response)
            if code_output:
                result["code_output"] = code_output
        
        return result
    
    def quick_calculate(self, ratings: list[int]) -> dict:
        """
        Quick path: directly calculate combined rating without LLM.
        Use this when you just need the math.
        """
        if not CALCULATOR_AVAILABLE:
            return {"error": "Calculator not available"}
        
        return calculate_combined_rating(ratings)


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    """Interactive CLI for the VetRate Swarm"""
    print("=" * 60)
    print("VetRate Swarm Orchestrator")
    print("=" * 60)
    print("\nAgents:")
    print("  🧮 Rater  - VA disability calculations")
    print("  ✍️  Writer - Personal statement drafting")
    print("  ⚖️  Auditor - Regulation verification")
    print("\nType 'quit' to exit, 'calc 70 30 10' for quick math")
    print("=" * 60)
    
    swarm = VetRateSwarm()
    
    while True:
        try:
            query = input("\n🎖️  Your question: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break
        
        if not query:
            continue
        
        if query.lower() in ['quit', 'exit', 'q']:
            print("Goodbye!")
            break
        
        # Quick calc shortcut
        if query.lower().startswith('calc '):
            try:
                ratings = [int(x) for x in query[5:].split()]
                result = swarm.quick_calculate(ratings)
                print(f"\n📊 Quick Calculate: {result}")
                continue
            except:
                print("Usage: calc 70 30 10")
                continue
        
        # Process through swarm
        print(f"\n🔄 Classifying query...")
        result = swarm.process_query(query)
        
        agent_emoji = {"rater": "🧮", "writer": "✍️", "auditor": "⚖️"}
        emoji = agent_emoji.get(result["agent"], "🤖")
        
        print(f"\n{emoji} Agent: {result['agent'].upper()} (confidence: {result['confidence']:.0%})")
        print("-" * 40)
        print(result["response"])
        
        if "code_output" in result:
            print("\n📊 Code Output:")
            print(result["code_output"])


if __name__ == "__main__":
    main()
