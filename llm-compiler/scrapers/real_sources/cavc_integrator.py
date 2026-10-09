#!/usr/bin/env python3
"""
💎 CAVC Decision Integrator
============================
Integrates CAVC decisions into the main Diamond Knowledge Base.

Source: U.S. Court of Appeals for Veterans Claims (uscourts.cavc.gov)
Authority: Judicial Precedent (Level 2)
Color Code: GREEN
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
    workspace_root = Path("E:/VS_Studio/vet-rate-org-official")
    
    # Paths
    main_kb_path = workspace_root / "public" / "data" / "vet_rate_knowledge.json"
    cavc_decisions_path = workspace_root / "llm-compiler" / "knowledge-base" / "cavc" / "cavc_2007_2023_dkb_format.json"
    backup_path = workspace_root / "public" / "data" / f"vet_rate_knowledge_backup_cavc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    print("=" * 70)
    print("💎 CAVC Decision Integrator - 2007-2023 MASS INTEGRATION")
    print("=" * 70)
    
    # Load existing knowledge base
    print(f"\n📥 Loading Main Knowledge Base...")
    if main_kb_path.exists():
        main_kb = load_json(main_kb_path)
        print(f"   -> {len(main_kb)} entries currently in KB")
    else:
        print(f"   -> Creating new knowledge base")
        main_kb = []
    
    # Backup current KB
    if main_kb:
        print(f"\n💾 Creating backup: {backup_path.name}")
        save_json(main_kb, backup_path)
    
    # Load CAVC decisions
    print(f"\n📥 Loading CAVC Decisions...")
    
    # Try loading from multiple sources
    # __file__ is in llm-compiler/scrapers/real_sources/
    # workspace root is 3 levels up
    workspace = Path(__file__).resolve().parent.parent.parent.parent
    cavc_sources = [
        cavc_decisions_path,
        workspace / "llm-compiler" / "knowledge-base" / "cavc" / "cavc_all_dkb_format.json",  # ALL 1127 cases
        workspace / "llm-compiler" / "knowledge-base" / "cavc" / "cavc_top_200_dkb_format.json"
    ]
    
    cavc_entries = []
    for source_path in cavc_sources:
        print(f"   -> Checking: {source_path}")
        if source_path.exists():
            print(f"      ✓ File exists, loading...")
            cavc_data = load_json(source_path)
            if 'entries' in cavc_data:
                cavc_entries.extend(cavc_data['entries'])
                print(f"      ✓ Loaded {len(cavc_data['entries'])} from {source_path.name}")
            else:
                print(f"      ⚠ No 'entries' key found in {source_path.name}")
        else:
            print(f"      ✗ File not found")
    
    if not cavc_entries:
        print("   -> ERROR: No CAVC entries found!")
        return
    
    print(f"   -> Total CAVC decisions to integrate: {len(cavc_entries)}")
    total_precedential = sum(1 for e in cavc_entries if e.get('decision_type') == 'precedential')
    total_non_prec = len(cavc_entries) - total_precedential
    print(f"   -> Precedential: {total_precedential}")
    print(f"   -> Non-Precedential: {total_non_prec}")
    
    # Check for duplicates
    existing_ids = {entry.get('id') for entry in main_kb}
    new_entries = []
    skipped = []
    
    for entry in cavc_entries:
        entry_id = entry.get('id')
        if entry_id in existing_ids:
            skipped.append(entry_id)
        else:
            new_entries.append(entry)
            existing_ids.add(entry_id)
    
    if skipped:
        print(f"\n⚠️  Skipped {len(skipped)} duplicate entries:")
        for skip_id in skipped:
            print(f"     - {skip_id}")
    
    # Merge
    print(f"\n🔄 Merging {len(new_entries)} new CAVC decisions into KB...")
    merged_kb = main_kb + new_entries
    
    # Analyze merged KB
    source_counts = Counter()
    hierarchy_counts = Counter()
    cavc_by_type = Counter()
    
    for entry in merged_kb:
        source = entry.get('data_source', entry.get('source', 'UNKNOWN'))
        hierarchy = entry.get('hierarchy_level', 'unknown')
        source_counts[source] += 1
        hierarchy_counts[hierarchy] += 1
        
        # Count CAVC decisions by type
        if entry.get('type') == 'cavc_decision':
            decision_type = entry.get('decision_type', 'unknown')
            cavc_by_type[decision_type] += 1
    
    # Save merged KB
    print(f"\n📤 Saving updated KB to: {main_kb_path.name}")
    save_json(merged_kb, main_kb_path)
    
    # Print summary
    print("\n" + "=" * 70)
    print("💎 INTEGRATION COMPLETE")
    print("=" * 70)
    print(f"\n📊 Knowledge Base Statistics:")
    print(f"   Total Entries: {len(merged_kb)}")
    print(f"   + New CAVC Decisions: {len(new_entries)}")
    print(f"   - Duplicates Skipped: {len(skipped)}")
    
    print(f"\n⚖️  CAVC Decisions Breakdown:")
    for dec_type, count in sorted(cavc_by_type.items()):
        print(f"   - {dec_type.title()}: {count}")
    
    print(f"\n📊 By Hierarchy Level:")
    for level, count in sorted(hierarchy_counts.items(), key=lambda x: (str(x[0]), x[1])):
        level_name = {
            1: "Level 1 - Statutory Law (38 CFR)",
            2: "Level 2 - Judicial Precedent (CAVC)",
            3: "Level 3 - Administrative (BVA)",
            4: "Level 4 - Federal Register",
            5: "Level 5 - VA Procedures (M21-1)"
        }.get(level, f"Level {level}")
        print(f"   {level_name}: {count}")
    
    print(f"\n✅ CAVC decisions successfully integrated into DKB!")
    print(f"   📁 Main KB: {main_kb_path}")
    if main_kb:
        print(f"   💾 Backup: {backup_path}")
    print(f"   📅 Integration Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    # Print impact statement
    print(f"\n💡 Impact:")
    print(f"   Veterans now have access to {len(new_entries)} recent CAVC court decisions")
    print(f"   These decisions represent binding judicial precedent for VA claims")
    print(f"   AI responses can now cite actual court rulings from 2026")
    print("=" * 70)

if __name__ == "__main__":
    main()
