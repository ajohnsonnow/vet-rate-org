#!/usr/bin/env python3
"""Test intent classification"""
import sys
sys.path.insert(0, ".")
from vetrate_auto import classify_intent

tests = [
    ("I have 50% sleep apnea, 30% migraines, and 10% tinnitus. What is my rating?", "MATH"),
    ("Draft a buddy statement for my husbands sleep apnea", "WRITE"),
    ("Is sleep apnea considered a presumptive condition for Gulf War veterans?", "AUDIT"),
    ("Calculate combined rating for 70 and 30 percent", "MATH"),
    ("Help me write a PTSD personal statement", "WRITE"),
    ("What does 38 CFR say about tinnitus ratings?", "AUDIT"),
]

print("Intent Classification Test")
print("=" * 60)
correct = 0
for query, expected in tests:
    result = classify_intent(query)
    match = "✅" if result == expected else "❌"
    if result == expected: correct += 1
    print(f"{match} [{result:5}] {query[:50]}...")

print(f"\nAccuracy: {correct}/{len(tests)}")
