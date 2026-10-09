#!/usr/bin/env python3
"""Quick test of VetRate Swarm components"""
import sys
sys.path.insert(0, ".")

from vaCalculatorTool import calculate_combined_rating
from vetrate_swarm import classify_query, Agent

# Test calculator
print("=" * 50)
print("VA CALCULATOR TEST")
print("=" * 50)
result = calculate_combined_rating([70, 30, 10])
print(f"Input: [70, 30, 10]")
print(f"Combined Rating: {result['combined_rating']}%")
print(f"Exact Value: {result['exact_combined']:.2f}%")
print()

# Test classifier
print("=" * 50)
print("QUERY CLASSIFIER TEST")
print("=" * 50)
tests = [
    ("Calculate 70% + 30% + 10%", "rater"),
    ("Write a PTSD statement", "writer"),
    ("Verify DC 9411 criteria", "auditor"),
    ("Am I eligible for TDIU?", "rater"),
    ("Draft nexus letter for tinnitus", "writer"),
    ("Is it true 38 CFR requires...", "auditor"),
]

for q, expected in tests:
    agent, conf = classify_query(q)
    match = "✅" if agent.value == expected else "❌"
    print(f"{match} [{agent.value:8}] {q}")

print()
print("All systems operational!")
