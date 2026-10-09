#!/usr/bin/env python3
"""
Separate Diamond Knowledge Base (DKB) from Community Knowledge Base (CKB)
========================================================================
DKB = Official sources only (cannot be contaminated)
CKB = Community-provided content (not for training yet)
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter

# Paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
SOURCE_KB = WORKSPACE_ROOT / "public" / "data" / "vet_rate_knowledge.json"
DKB_OUTPUT = WORKSPACE_ROOT / "public" / "data" / "diamond_knowledge.json"
CKB_OUTPUT = WORKSPACE_ROOT / "public" / "data" / "community_knowledge.json"
BACKUP_DIR = WORKSPACE_ROOT / "public" / "data" / "backups"

# Official sources (DKB)
OFFICIAL_SOURCES = {
    'eCFR_OFFICIAL',
    'FEDERAL_REGISTER_OFFICIAL', 
    'OGC_PRECEDENT_OPINION',
    'BVA_DECISIONS',
    'BVA_REPORTS_OFFICIAL',
    'M21-1_OFFICIAL',
    'PACT_ACT_OFFICIAL',
    'VA_OFFICIAL',
    'SECONDARY_CONDITIONS_MATRIX',
    'EAJA_STATISTICS_OFFICIAL',
}

# Community sources (CKB) - NOT for training
COMMUNITY_SOURCES = {
    'COMMUNITY_PROVIDED',
}

def main():
    print("=" * 70)
    print("💎 SEPARATING DKB FROM CKB")
    print("=" * 70)
    print(f"Source: {SOURCE_KB}")
    print()
    
    # Load current combined knowledge base
    with open(SOURCE_KB, 'r', encoding='utf-8-sig') as f:
        all_entries = json.load(f)
    
    print(f"📥 Loaded {len(all_entries)} total entries")
    
    # Separate by source
    dkb_entries = []
    ckb_entries = []
    source_stats = Counter()
    
    for entry in all_entries:
        source = entry.get('metadata', {}).get('source', 'UNKNOWN')
        source_stats[source] += 1
        
        if source in OFFICIAL_SOURCES:
            dkb_entries.append(entry)
        elif source in COMMUNITY_SOURCES:
            ckb_entries.append(entry)
        else:
            # Unknown source - default to DKB if seems official
            if 'OFFICIAL' in source or source.startswith('VA_'):
                dkb_entries.append(entry)
            else:
                print(f"⚠️  Unknown source: {source} - adding to CKB")
                ckb_entries.append(entry)
    
    print()
    print("📊 Source Distribution:")
    for source, count in source_stats.most_common():
        designation = "DKB" if source in OFFICIAL_SOURCES else "CKB"
        print(f"   {source}: {count} → {designation}")
    
    print()
    print(f"💎 DKB (Diamond Knowledge Base): {len(dkb_entries)} entries")
    print(f"👥 CKB (Community Knowledge Base): {len(ckb_entries)} entries")
    
    # Create backup directory
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    
    # Backup original
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = BACKUP_DIR / f"vet_rate_knowledge_pre_separation_{timestamp}.json"
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Backed up original to: {backup_path.name}")
    
    # Save DKB (official only)
    dkb_data = {
        "metadata": {
            "name": "Diamond Knowledge Base (DKB)",
            "description": "Official VA sources only - 38 CFR, M21-1, OGC, BVA, PACT Act",
            "version": "2.0.0",
            "generated": datetime.now().isoformat(),
            "total_entries": len(dkb_entries),
            "sources": dict(Counter(e.get('metadata', {}).get('source', 'UNKNOWN') for e in dkb_entries)),
            "diamond_certified": True,
            "training_approved": True
        },
        "entries": dkb_entries
    }
    
    with open(DKB_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(dkb_data, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved DKB: {DKB_OUTPUT.name} ({len(dkb_entries)} entries)")
    
    # Save CKB (community only) - NOT for training
    ckb_data = {
        "metadata": {
            "name": "Community Knowledge Base (CKB)",
            "description": "Community-provided veteran experiences and insights",
            "version": "1.0.0",
            "generated": datetime.now().isoformat(),
            "total_entries": len(ckb_entries),
            "sources": dict(Counter(e.get('metadata', {}).get('source', 'UNKNOWN') for e in ckb_entries)),
            "diamond_certified": False,
            "training_approved": False,  # CRITICAL: Cannot train on CKB yet
            "warning": "Community content - not verified by official sources"
        },
        "entries": ckb_entries
    }
    
    with open(CKB_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(ckb_data, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved CKB: {CKB_OUTPUT.name} ({len(ckb_entries)} entries)")
    
    # Update main knowledge base to be DKB only (for AI training)
    with open(SOURCE_KB, 'w', encoding='utf-8') as f:
        json.dump(dkb_entries, f, indent=2, ensure_ascii=False)
    print(f"✅ Updated main KB to DKB only: {SOURCE_KB.name} ({len(dkb_entries)} entries)")
    
    print()
    print("=" * 70)
    print("✅ SEPARATION COMPLETE")
    print("=" * 70)
    print()
    print("Files created:")
    print(f"  💎 DKB (for AI/training): {DKB_OUTPUT.name}")
    print(f"  👥 CKB (display only):    {CKB_OUTPUT.name}")
    print(f"  📁 Main KB (DKB only):    {SOURCE_KB.name}")
    print()
    print("⚠️  IMPORTANT: CKB is NOT approved for training!")
    print("   Community content is displayed separately from official sources.")
    print()

if __name__ == "__main__":
    main()
