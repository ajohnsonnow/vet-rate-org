#!/usr/bin/env python3
"""Final comprehensive knowledge base gap report"""
import json
from pathlib import Path

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

def count_json(file_path):
    """Count entries in JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Check if it's a dict with 'entries' key (DKB format)
            if isinstance(data, dict) and 'entries' in data:
                return len(data['entries'])
            # Otherwise check if it's an array
            elif isinstance(data, list):
                return len(data)
            # Single object
            return 1
    except:
        return 0

print("\n" + "="*80)
print("💎 FINAL KNOWLEDGE BASE GAP REPORT")
print("="*80 + "\n")

# All identified gaps from audit
gaps = [
    {
        "id": "GAP #1",
        "name": "CAVC 2007-2023 (16 years)",
        "priority": "CRITICAL",
        "target": "200-500",
        "files": ["cavc/cavc_2007_2023_dkb_format.json"]
    },
    {
        "id": "GAP #2", 
        "name": "BVA Precedential Decisions",
        "priority": "HIGH",
        "target": "50-100",
        "files": [
            "bva/bva_decisions_raw.json",
            "bva/bva_precedential_decisions.json"
        ]
    },
    {
        "id": "GAP #3",
        "name": "M21-1 Manual (Procedural)",
        "priority": "HIGH", 
        "target": "200-500",
        "files": [
            "m21-1/m21_1_complete_merged.json",
            "m21-1/m21_1_gap_filler.json",
            "m21-1/m21_1_additional_resources.json",
            "m21-1/m21_1_final_push.json"
        ]
    },
    {
        "id": "GAP #4",
        "name": "OGC Precedent Opinions",
        "priority": "HIGH",
        "target": "100-200",
        "files": ["ogc/ogc_all_dkb_format.json"]
    },
    {
        "id": "GAP #5",
        "name": "Federal Circuit Cases",
        "priority": "HIGH",
        "target": "20-50",
        "files": ["federal-circuit/federal_circuit_knowledge.json"]
    },
    {
        "id": "GAP #6",
        "name": "Rating Schedule (38 CFR Part 4)",
        "priority": "MEDIUM",
        "target": "1000+",
        "files": [
            "ecfr-fresh/ecfr_rating_criteria.json",
            "ecfr-fresh/ecfr_diagnostic_codes.json",
            "ecfr-fresh/ecfr_sections.json",
            "ecfr-fresh/ecfr_knowledge_base.json",
            "ecfr-fresh/ecfr_gap_filler.json"
        ]
    },
    {
        "id": "GAP #7",
        "name": "Presumptive Conditions",
        "priority": "HIGH",
        "target": "100-150",
        "files": ["presumptive/presumptive_conditions.json"]
    },
    {
        "id": "GAP #8",
        "name": "Secondary Conditions Matrix",
        "priority": "MEDIUM",
        "target": "50-100",
        "files": ["secondary/secondary_conditions_matrix.json"]
    }
]

grand_total = 0

for gap in gaps:
    total = 0
    status_parts = []
    
    for file in gap["files"]:
        path = KB_DIR / file
        if path.exists():
            count = count_json(path)
            total += count
            status_parts.append(f"{path.name}: {count}")
        else:
            status_parts.append(f"{path.name}: NOT FOUND")
    
    # Determine status
    target_min = int(gap["target"].split("-")[0].replace("+", ""))
    if total >= target_min:
        status = "✅ COMPLETE"
    elif total > 0:
        status = f"🟡 PARTIAL ({total}/{target_min})"
    else:
        status = "❌ MISSING"
    
    grand_total += total
    
    print(f"{status}")
    print(f"  {gap['id']} - {gap['name']}")
    print(f"  Priority: {gap['priority']} | Target: {gap['target']} | Actual: {total}")
    for part in status_parts:
        print(f"    → {part}")
    print()

print("="*80)
print(f"📊 GRAND TOTAL: {grand_total:,} knowledge base entries")
print("="*80)

# Summary
print("\n" + "="*80)
print("📋 SUMMARY")
print("="*80 + "\n")

complete = sum(1 for g in gaps if count_json(KB_DIR / g["files"][0]) > 0)
print(f"✅ Gaps Addressed: {complete}/{len(gaps)}")
print(f"📊 Total Entries: {grand_total:,}")
print(f"🎯 Status: {'DIAMOND TIER' if complete == len(gaps) else 'IN PROGRESS'}")
print()
