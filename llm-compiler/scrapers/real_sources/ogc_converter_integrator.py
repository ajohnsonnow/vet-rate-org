#!/usr/bin/env python3
"""
OGC Converter & Integrator
Combines all OGC opinion files, converts to DKB format, and integrates into production KB.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Paths
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
OGC_DIR = PROJECT_ROOT / "llm-compiler" / "knowledge-base" / "ogc"
PRODUCTION_KB = PROJECT_ROOT / "public" / "data" / "vet_rate_knowledge.json"

# Input files (all OGC collections)
INPUT_FILES = [
    OGC_DIR / "ogc_all_opinions.json",  # 2019-2005 collection
    OGC_DIR / "ogc_opinions_2004_1987.json",  # 2004-1987 collection
]

# Output files
COMBINED_RAW = OGC_DIR / "ogc_all_combined_raw.json"
DKB_OUTPUT = OGC_DIR / "ogc_all_dkb_format.json"


def load_opinion_file(filepath: Path) -> List[Dict]:
    """Load opinions from a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Try multiple possible keys
            return data.get('entries', data.get('opinions', []))
    except Exception as e:
        print(f"⚠️  Error loading {filepath.name}: {e}")
        return []


def combine_all_opinions() -> List[Dict]:
    """Combine all OGC opinion files into one."""
    all_opinions = []
    seen_ids = set()
    
    for filepath in INPUT_FILES:
        if not filepath.exists():
            print(f"⚠️  File not found: {filepath.name}")
            continue
        
        opinions = load_opinion_file(filepath)
        print(f"   Loaded {len(opinions)} opinions from {filepath.name}")
        
        # Deduplicate by opinion ID
        for opinion in opinions:
            # Handle both structures
            metadata = opinion.get('metadata', {})
            opinion_id = metadata.get('citation', opinion.get('opinion_id', opinion.get('id', ''))).strip()
            
            if opinion_id and opinion_id not in seen_ids:
                all_opinions.append(opinion)
                seen_ids.add(opinion_id)
    
    return all_opinions


def convert_to_dkb_format(opinions: List[Dict]) -> List[Dict]:
    """Convert OGC opinions to DKB format."""
    dkb_entries = []
    
    for opinion in opinions:
        # Handle both old and new structures
        metadata = opinion.get('metadata', {})
        opinion_id = metadata.get('citation', opinion.get('opinion_id', opinion.get('id', 'Unknown')))
        year = metadata.get('year', opinion.get('year', ''))
        title = opinion.get('title', opinion_id)
        url = metadata.get('url', opinion.get('url', ''))
        content = opinion.get('content', '')
        
        # Extract holding/summary if available
        holding = metadata.get('held_summary', opinion.get('holding', ''))
        question = opinion.get('question_presented', '')
        cfr_citations = opinion.get('cfr_citations', metadata.get('related_statutes', []))
        
        # Build comprehensive summary
        summary_parts = []
        if holding:
            summary_parts.append(f"Holding: {holding}")
        if question:
            summary_parts.append(f"Question: {question}")
        if not summary_parts:
            # Use citation info
            summary_parts.append(f"{opinion_id} - Binding VA Office of General Counsel precedent opinion")
        
        summary = " | ".join(summary_parts) if summary_parts else "OGC precedent opinion - binding legal interpretation."
        
        # Build full text (for search)
        full_text = f"{title}\n{summary}\n{content}"
        
        # Create DKB entry
        entry = {
            "id": opinion.get('id', f"ogc_{opinion_id.lower().replace(' ', '_').replace('-', '_')}"),
            "title": title,
            "summary": summary,
            "full_text": full_text,
            "hierarchy_level": 4,  # Administrative Binding Precedent
            "source_type": "OGC Precedent Opinion",
            "citation": opinion_id,
            "date": str(year),
            "url": url,
            "cfr_citations": cfr_citations if isinstance(cfr_citations, list) else [],
            "keywords": extract_keywords(full_text),
            "color_code": "PURPLE"  # OGC opinions = PURPLE
        }
        
        dkb_entries.append(entry)
    
    return dkb_entries


def extract_keywords(text: str) -> List[str]:
    """Extract common veteran/VA keywords from text."""
    keywords = []
    keyword_map = {
        'service connection': ['service connection', 'service-connection', 'connected'],
        'rating': ['rating', 'percentage', 'disability rating'],
        'effective date': ['effective date', 'retroactive'],
        'evidence': ['evidence', 'medical evidence', 'lay evidence'],
        'appeal': ['appeal', 'BVA', 'Board of Veterans'],
        'compensation': ['compensation', 'benefits', 'VA benefits'],
        'claim': ['claim', 'filed claim', 'supplemental claim'],
        'veteran': ['veteran', 'claimant', 'appellant'],
        'decision': ['decision', 'determination', 'finding'],
        'regulation': ['CFR', '38 CFR', 'regulation', 'regulatory'],
    }
    
    text_lower = text.lower()
    for keyword, variants in keyword_map.items():
        if any(variant.lower() in text_lower for variant in variants):
            keywords.append(keyword)
    
    return keywords


def integrate_into_production(dkb_entries: List[Dict]) -> None:
    """Integrate OGC entries into production KB."""
    # Load production KB
    with open(PRODUCTION_KB, 'r', encoding='utf-8') as f:
        kb_data = json.load(f)
    
    original_count = len(kb_data)
    
    # Create backup
    backup_path = PRODUCTION_KB.parent / f"vet_rate_knowledge_backup_ogc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(kb_data, f, indent=2)
    print(f"\n💾 Backup created: {backup_path.name}")
    
    # Get existing OGC IDs (in case of re-run)
    existing_ogc_ids = {entry.get('id') for entry in kb_data if entry.get('source_type') == 'OGC Precedent Opinion'}
    
    # Add new entries (deduplicate)
    new_count = 0
    for entry in dkb_entries:
        if entry['id'] not in existing_ogc_ids:
            kb_data.append(entry)
            new_count += 1
    
    # Save updated KB
    with open(PRODUCTION_KB, 'w', encoding='utf-8') as f:
        json.dump(kb_data, f, indent=2)
    
    print(f"\n🔄 Merging {new_count} new OGC opinions into KB...\n")
    print(f"📊 Knowledge Base Statistics:")
    print(f"   Total Entries: {len(kb_data)}")
    print(f"   + New OGC Opinions: {new_count}")
    print(f"   - Duplicates Skipped: {len(dkb_entries) - new_count}")
    
    # Count by source type
    source_counts = {}
    for entry in kb_data:
        source = entry.get('source_type', 'Unknown')
        source_counts[source] = source_counts.get(source, 0) + 1
    
    print(f"\n📊 By Source Type:")
    for source, count in sorted(source_counts.items()):
        print(f"   {source}: {count}")
    
    print(f"\n✅ OGC opinions successfully integrated into DKB!")
    print(f"   📁 Main KB: {PRODUCTION_KB}")
    print(f"   💾 Backup: {backup_path}")


def main():
    print("💎 OGC Opinion Converter & Integrator")
    print("=" * 70)
    
    # Step 1: Combine all opinion files
    print("\n📥 Combining all OGC opinion files...")
    all_opinions = combine_all_opinions()
    print(f"   ✅ Total unique opinions: {len(all_opinions)}")
    
    # Save combined raw file
    combined_data = {
        'total_opinions': len(all_opinions),
        'collection_date': datetime.now().isoformat(),
        'opinions': all_opinions
    }
    with open(COMBINED_RAW, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=2)
    print(f"   💾 Saved raw combined: {COMBINED_RAW.name}")
    
    # Step 2: Convert to DKB format
    print("\n🔄 Converting to DKB format...")
    dkb_entries = convert_to_dkb_format(all_opinions)
    print(f"   ✅ Converted {len(dkb_entries)} entries")
    
    # Save DKB format
    dkb_data = {
        'total_entries': len(dkb_entries),
        'hierarchy_level': 4,
        'source_type': 'OGC Precedent Opinion',
        'color_code': 'PURPLE',
        'entries': dkb_entries
    }
    with open(DKB_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(dkb_data, f, indent=2)
    print(f"   💾 Saved DKB format: {DKB_OUTPUT.name}")
    
    # Step 3: Integrate into production
    print("\n🔗 Integrating into production KB...")
    integrate_into_production(dkb_entries)
    
    print("\n" + "=" * 70)
    print("✅ OGC INTEGRATION COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    main()
