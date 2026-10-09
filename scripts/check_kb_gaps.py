#!/usr/bin/env python3
"""
Quick script to check all knowledge base gaps and entry counts
"""
import json
import os
from pathlib import Path

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

FILES_TO_CHECK = {
    "Federal Circuit": "federal-circuit/federal_circuit_knowledge.json",
    "M21-1 Merged": "m21-1/m21_1_complete_merged.json",
    "Presumptive": "presumptive/presumptive_conditions.json",
    "CAVC Top 200": "cavc/cavc_top_200_dkb_format.json",
    "CAVC 2007-2023": "cavc/cavc_2007_2023_dkb_format.json",
    "BVA Decisions": "bva/bva_decisions_raw.json",
    "OGC All": "ogc/ogc_all_dkb_format.json",
    "eCFR Fresh": "ecfr-fresh/ecfr_complete_combined.json",
    "Secondary": "secondary/secondary_conditions.json",
}

def count_entries(file_path):
    """Count entries in a JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return len(data)
            elif isinstance(data, dict):
                # Check if it's wrapped in a key
                if 'entries' in data:
                    return len(data['entries'])
                return 1
            return 0
    except Exception as e:
        return f"ERROR: {e}"

print("\n" + "="*70)
print("💎 KNOWLEDGE BASE GAP ANALYSIS")
print("="*70 + "\n")

total_entries = 0
for name, rel_path in FILES_TO_CHECK.items():
    full_path = KB_DIR / rel_path
    if full_path.exists():
        count = count_entries(full_path)
        if isinstance(count, int):
            status = "✅" if count > 0 else "⚠️"
            print(f"{status} {name:25} {count:>6} entries")
            total_entries += count
        else:
            print(f"❌ {name:25} {count}")
    else:
        print(f"❌ {name:25} FILE NOT FOUND")

print("\n" + "="*70)
print(f"📊 TOTAL ENTRIES: {total_entries}")
print("="*70 + "\n")

# Now check for identified gaps from audit
print("="*70)
print("📋 GAP STATUS (from DIAMOND_KB_COMPREHENSIVE_AUDIT_JAN_2026.md)")
print("="*70 + "\n")

gaps = [
    ("GAP #1", "CAVC 2007-2023", "CRITICAL", "cavc/cavc_2007_2023_dkb_format.json"),
    ("GAP #2", "BVA Precedential", "HIGH", "bva/bva_decisions_raw.json"),
    ("GAP #3", "M21-1 Manual", "HIGH", "m21-1/m21_1_complete_merged.json"),
    ("GAP #4", "OGC Opinions", "HIGH", "ogc/ogc_all_dkb_format.json"),
    ("GAP #5", "Federal Circuit", "HIGH", "federal-circuit/federal_circuit_knowledge.json"),
    ("GAP #7", "Presumptive", "HIGH", "presumptive/presumptive_conditions.json"),
    ("GAP #8", "Secondary", "MEDIUM", "secondary/secondary_conditions.json"),
]

for gap_id, gap_name, priority, rel_path in gaps:
    full_path = KB_DIR / rel_path
    if full_path.exists():
        count = count_entries(full_path)
        if isinstance(count, int) and count > 0:
            print(f"✅ {gap_id} - {gap_name:25} [{priority:8}] → {count:>6} entries")
        else:
            print(f"🟡 {gap_id} - {gap_name:25} [{priority:8}] → {count}")
    else:
        print(f"❌ {gap_id} - {gap_name:25} [{priority:8}] → NOT FOUND")

print("\n" + "="*70)
