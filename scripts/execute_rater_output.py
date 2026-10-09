#!/usr/bin/env python3
"""
Execute the EXACT code that VetRate-Rater generated.
This proves the full pipeline works: LLM -> Code -> Tool -> Result
"""
from vaCalculatorTool import calculate_combined_rating

# This is the EXACT code the Qwen-Coder Rater model generated:
result = calculate_combined_rating([70, 30, 10])
print(f"Combined: {result['combined_rating']}%")

# Bonus: show full result
print("\n--- Full Result ---")
print(f"Exact Value: {result['exact_combined']:.2f}%")
print(f"Monthly Compensation: ${result['monthly_compensation']:,.2f}")
print(f"Steps: {result['step_by_step']}")
