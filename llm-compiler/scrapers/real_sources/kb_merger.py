#!/usr/bin/env python3
"""
💎 Knowledge Base Merger
=========================
Merges multiple knowledge sources into the main vet_rate_knowledge.json

Sources:
1. eCFR Official (38 CFR Part 4) - OFFICIAL regulations
2. Community Knowledge (VeteransBenefitsKB) - COMMUNITY_PROVIDED

Each source maintains its own clear tagging for transparency.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter

def load_json(filepath):
    """Load a JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, filepath):
    """Save data to JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    # Use absolute paths - workspace root
    workspace_root = Path("E:/VS_Studio/vet-rate-org-official")
    
    # Paths
    ecfr_kb_path = workspace_root / "public" / "data" / "vet_rate_knowledge.json"
    community_kb_path = workspace_root / "llm-compiler" / "knowledge-base" / "community" / "community_knowledge.json"
    output_path = workspace_root / "public" / "data" / "vet_rate_knowledge.json"
    backup_path = workspace_root / "public" / "data" / f"vet_rate_knowledge_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    print("=" * 60)
    print("💎 Knowledge Base Merger")
    print("=" * 60)
    
    # Load existing knowledge base (eCFR official)
    print(f"\n📥 Loading eCFR Official KB: {ecfr_kb_path}")
    ecfr_kb = load_json(ecfr_kb_path)
    print(f"   -> {len(ecfr_kb)} entries")
    
    # Backup current KB
    print(f"\n💾 Creating backup: {backup_path}")
    save_json(ecfr_kb, backup_path)
    
    # Load community knowledge
    print(f"\n📥 Loading Community KB: {community_kb_path}")
    community_kb = load_json(community_kb_path)
    print(f"   -> {len(community_kb)} entries")
    
    # Merge
    print("\n🔄 Merging knowledge bases...")
    merged_kb = ecfr_kb + community_kb
    
    # Analyze merged KB
    source_counts = Counter()
    type_counts = Counter()
    
    for entry in merged_kb:
        source = entry.get('metadata', {}).get('source', 'UNKNOWN')
        entry_type = entry.get('metadata', {}).get('type', 'unknown')
        source_counts[source] += 1
        type_counts[entry_type] += 1
    
    # Save merged KB
    print(f"\n📤 Saving merged KB to: {output_path}")
    save_json(merged_kb, output_path)
    
    # Print summary
    print("\n" + "=" * 60)
    print("💎 MERGE COMPLETE")
    print("=" * 60)
    print(f"\nTotal Entries: {len(merged_kb)}")
    print("\nBy Source:")
    for source, count in sorted(source_counts.items()):
        print(f"  - {source}: {count}")
    print("\nBy Type:")
    for entry_type, count in sorted(type_counts.items()):
        print(f"  - {entry_type}: {count}")
    print("\n" + "=" * 60)
    print("✅ Knowledge base merged successfully!")
    print(f"📁 Output: {output_path}")
    print(f"💾 Backup: {backup_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
