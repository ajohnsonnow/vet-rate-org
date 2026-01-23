#!/usr/bin/env python3
"""
VA Combined Rating Calculator Tool
===================================
Deterministic Python implementation for LLM function calling.
This ensures VA math is NEVER wrong (unlike LLM hallucinations).

Usage:
    - Import and call calculate_combined_rating()
    - Or run as CLI: python vaCalculatorTool.py --ratings 70,30,10

The VA uses "Bilateral Factor" math, not simple addition:
    Combined = 100 - ((100-A) × (100-B) × (100-C) / 10000...)
"""

import json
import argparse
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

# 2024 VA Compensation Rates (monthly, veteran alone)
VA_COMPENSATION_RATES_2024 = {
    10: 171.23,
    20: 338.49,
    30: 524.31,
    40: 755.28,
    50: 1075.16,
    60: 1361.88,
    70: 1716.28,
    80: 1995.01,
    90: 2241.91,
    100: 3737.85
}

# SMC-S (Housebound) additional monthly amount
SMC_S_RATE = 441.35

@dataclass
class RatingEntry:
    """A single disability rating with optional metadata."""
    percentage: int
    condition: str = ""
    is_bilateral: bool = False
    body_part: str = ""  # e.g., "left_leg", "right_arm"


def round_to_nearest_10(value: float) -> int:
    """
    VA rounds to nearest 10, with .5 rounding UP.
    Example: 74.5 → 80, 74.4 → 70
    """
    decimal_value = Decimal(str(value))
    rounded = (decimal_value / 10).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * 10
    return int(rounded)


def calculate_efficiency(ratings: List[int]) -> float:
    """
    Calculate remaining efficiency using VA formula.
    
    Formula: efficiency = (1 - r1) × (1 - r2) × (1 - r3) × ...
    
    Example: 70%, 30%, 10%
        = (1 - 0.70) × (1 - 0.30) × (1 - 0.10)
        = 0.30 × 0.70 × 0.90
        = 0.189 (18.9% remaining efficiency)
        = 81.1% disability → rounds to 80%
    """
    if not ratings:
        return 1.0
    
    efficiency = 1.0
    for rating in ratings:
        efficiency *= (1 - rating / 100)
    return efficiency


def calculate_bilateral_factor(bilateral_ratings: List[int]) -> Tuple[int, float]:
    """
    Calculate bilateral factor for paired extremities.
    
    Per 38 CFR 4.26:
    1. Combine bilateral ratings using VA math
    2. Add 10% of the combined value as "bilateral factor"
    3. This combined+factor replaces individual ratings in final calc
    
    Returns: (combined_bilateral_rating, bilateral_factor_value)
    """
    if len(bilateral_ratings) < 2:
        return (0, 0.0)
    
    # Combine the bilateral ratings
    efficiency = calculate_efficiency(bilateral_ratings)
    combined = 100 - (efficiency * 100)
    
    # Bilateral factor is 10% of combined value
    bilateral_factor = combined * 0.10
    
    # Total bilateral contribution
    total_bilateral = combined + bilateral_factor
    
    return (round(combined), bilateral_factor)


def calculate_combined_rating(
    ratings: List[int],
    bilateral_pairs: Optional[Dict[str, List[int]]] = None
) -> Dict:
    """
    Calculate VA Combined Disability Rating.
    
    Args:
        ratings: List of individual disability percentages
        bilateral_pairs: Optional dict of bilateral conditions
                        e.g., {"legs": [30, 20], "arms": [40, 30]}
    
    Returns:
        Dictionary with:
        - combined_rating: Final rounded rating (0-100)
        - exact_combined: Exact percentage before rounding
        - bilateral_factor: Total bilateral factor added
        - monthly_compensation: Estimated monthly pay
        - step_by_step: List of calculation steps for display
    """
    if not ratings and not bilateral_pairs:
        return {
            "combined_rating": 0,
            "exact_combined": 0.0,
            "bilateral_factor": 0.0,
            "monthly_compensation": 0.0,
            "step_by_step": ["No ratings provided"],
            "smc_s_eligible": False
        }
    
    steps = []
    all_ratings = list(ratings) if ratings else []
    total_bilateral_factor = 0.0
    
    # Process bilateral conditions
    if bilateral_pairs:
        for body_part, pair_ratings in bilateral_pairs.items():
            if len(pair_ratings) >= 2:
                combined_bilateral, bf = calculate_bilateral_factor(pair_ratings)
                total_bilateral_factor += bf
                
                # Remove individual bilateral ratings from main list
                # and add the combined bilateral rating
                steps.append(
                    f"Bilateral Factor ({body_part}): "
                    f"{pair_ratings} → Combined {combined_bilateral}% + "
                    f"BF {bf:.2f}% = {combined_bilateral + bf:.2f}%"
                )
                
                # Add combined bilateral (with factor) as single entry
                all_ratings.append(int(combined_bilateral + bf))
    
    # Sort ratings highest to lowest (required for VA math)
    all_ratings.sort(reverse=True)
    
    if not all_ratings:
        return {
            "combined_rating": 0,
            "exact_combined": 0.0,
            "bilateral_factor": total_bilateral_factor,
            "monthly_compensation": 0.0,
            "step_by_step": steps or ["No ratings provided"],
            "smc_s_eligible": False
        }
    
    # Calculate step-by-step
    steps.append(f"Ratings (sorted): {all_ratings}")
    steps.append("Starting with 100% efficiency (healthy)")
    
    remaining_efficiency = 100.0
    
    for i, rating in enumerate(all_ratings):
        disability_from_this = remaining_efficiency * (rating / 100)
        new_efficiency = remaining_efficiency - disability_from_this
        
        steps.append(
            f"Step {i+1}: {rating}% of {remaining_efficiency:.1f}% remaining = "
            f"{disability_from_this:.1f}% lost → {new_efficiency:.1f}% efficiency left"
        )
        
        remaining_efficiency = new_efficiency
    
    exact_combined = 100 - remaining_efficiency
    final_rating = round_to_nearest_10(exact_combined)
    
    # Ensure we don't exceed 100%
    final_rating = min(100, max(0, final_rating))
    
    steps.append(f"Exact combined: {exact_combined:.2f}%")
    steps.append(f"Rounded to nearest 10: {final_rating}%")
    
    # Get compensation
    compensation = VA_COMPENSATION_RATES_2024.get(final_rating, 0.0)
    
    # Check SMC-S eligibility (100% schedular + 60% separate)
    smc_s_eligible = False
    if final_rating == 100 and len(all_ratings) > 1:
        # Check if there's a separate 60%+ condition
        # This is simplified - real SMC-S is more complex
        separate_ratings = all_ratings[1:]  # Exclude the highest
        separate_combined = 100 - (calculate_efficiency(separate_ratings) * 100)
        if separate_combined >= 60:
            smc_s_eligible = True
            steps.append(f"⚠️ Potential SMC-S eligibility: 100% + {separate_combined:.1f}% separate")
    
    return {
        "combined_rating": final_rating,
        "exact_combined": round(exact_combined, 2),
        "bilateral_factor": round(total_bilateral_factor, 2),
        "monthly_compensation": compensation,
        "step_by_step": steps,
        "smc_s_eligible": smc_s_eligible
    }


def calculate_tdiu_eligibility(ratings: List[int]) -> Dict:
    """
    Check TDIU (Total Disability Individual Unemployability) eligibility.
    
    Per 38 CFR 4.16:
    - Schedular: One 60%+ OR combined 70%+ with one 40%+
    - Extraschedular: Can't work due to service-connected conditions
    
    Returns eligibility status and reasoning.
    """
    if not ratings:
        return {
            "schedular_eligible": False,
            "reason": "No ratings provided"
        }
    
    sorted_ratings = sorted(ratings, reverse=True)
    highest = sorted_ratings[0]
    
    combined_result = calculate_combined_rating(ratings)
    combined = combined_result["combined_rating"]
    
    # Check single disability 60%+
    if highest >= 60:
        return {
            "schedular_eligible": True,
            "reason": f"Single disability at {highest}% meets 60% threshold",
            "combined_rating": combined
        }
    
    # Check combined 70%+ with one at 40%+
    if combined >= 70 and highest >= 40:
        return {
            "schedular_eligible": True,
            "reason": f"Combined {combined}% with single {highest}% meets 70%/40% threshold",
            "combined_rating": combined
        }
    
    return {
        "schedular_eligible": False,
        "reason": f"Does not meet schedular TDIU (need 60% single OR 70% combined with 40% single). "
                  f"Current: {combined}% combined, highest single: {highest}%. "
                  f"May still qualify for extraschedular TDIU if unable to work.",
        "combined_rating": combined
    }


def format_for_llm(result: Dict) -> str:
    """
    Format calculation result as natural language for LLM output.
    """
    lines = [
        f"**Combined VA Disability Rating: {result['combined_rating']}%**",
        "",
        "**Calculation Steps (VA Math):**"
    ]
    
    for step in result['step_by_step']:
        lines.append(f"- {step}")
    
    lines.extend([
        "",
        f"**Monthly Compensation (2024):** ${result['monthly_compensation']:,.2f}",
    ])
    
    if result['bilateral_factor'] > 0:
        lines.append(f"**Bilateral Factor Applied:** {result['bilateral_factor']:.2f}%")
    
    if result['smc_s_eligible']:
        lines.append(f"**⭐ Potential SMC-S Eligibility Detected!**")
    
    return "\n".join(lines)


# ============================================================================
# LLM TOOL INTERFACE (for function calling / tool use)
# ============================================================================

TOOL_SCHEMA = {
    "name": "va_combined_rating_calculator",
    "description": "Calculate the VA combined disability rating using official VA math. "
                   "This tool performs deterministic calculations and should ALWAYS be used "
                   "instead of trying to calculate ratings manually.",
    "parameters": {
        "type": "object",
        "properties": {
            "ratings": {
                "type": "array",
                "items": {"type": "integer", "minimum": 0, "maximum": 100},
                "description": "List of individual disability rating percentages (0-100)"
            },
            "bilateral_pairs": {
                "type": "object",
                "description": "Optional. Bilateral conditions grouped by body part. "
                              "Example: {\"legs\": [30, 20], \"arms\": [40, 30]}",
                "additionalProperties": {
                    "type": "array",
                    "items": {"type": "integer"}
                }
            }
        },
        "required": ["ratings"]
    }
}


def execute_tool(arguments: Dict) -> str:
    """
    Execute the calculator tool with given arguments.
    Returns JSON string for LLM consumption.
    """
    ratings = arguments.get("ratings", [])
    bilateral_pairs = arguments.get("bilateral_pairs", None)
    
    result = calculate_combined_rating(ratings, bilateral_pairs)
    
    # Add formatted output for LLM
    result["formatted_response"] = format_for_llm(result)
    
    return json.dumps(result, indent=2)


# ============================================================================
# CLI INTERFACE
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="VA Combined Disability Rating Calculator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python vaCalculatorTool.py --ratings 70,30,10
  python vaCalculatorTool.py --ratings 50,40,30,20 --bilateral "legs:30,20"
  python vaCalculatorTool.py --ratings 70,40 --check-tdiu
        """
    )
    
    parser.add_argument(
        "--ratings", "-r",
        type=str,
        required=True,
        help="Comma-separated list of ratings (e.g., '70,30,10')"
    )
    
    parser.add_argument(
        "--bilateral", "-b",
        type=str,
        action="append",
        help="Bilateral pair in format 'bodypart:rating1,rating2' (can use multiple times)"
    )
    
    parser.add_argument(
        "--check-tdiu",
        action="store_true",
        help="Also check TDIU eligibility"
    )
    
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of formatted text"
    )
    
    args = parser.parse_args()
    
    # Parse ratings
    ratings = [int(r.strip()) for r in args.ratings.split(",")]
    
    # Parse bilateral pairs
    bilateral_pairs = None
    if args.bilateral:
        bilateral_pairs = {}
        for bp in args.bilateral:
            part, values = bp.split(":")
            bilateral_pairs[part] = [int(v.strip()) for v in values.split(",")]
    
    # Calculate
    result = calculate_combined_rating(ratings, bilateral_pairs)
    
    if args.check_tdiu:
        tdiu_result = calculate_tdiu_eligibility(ratings)
        result["tdiu_eligibility"] = tdiu_result
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(format_for_llm(result))
        if args.check_tdiu:
            print(f"\n**TDIU Eligibility:** {'Yes' if result['tdiu_eligibility']['schedular_eligible'] else 'No'}")
            print(f"**Reason:** {result['tdiu_eligibility']['reason']}")


if __name__ == "__main__":
    main()
