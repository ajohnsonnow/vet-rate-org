#!/usr/bin/env python3
"""
💎 M21-1 Knowledge Base Merger
================================
Combines all M21-1 scraper outputs into one comprehensive knowledge base.
Deduplicates entries and renumbers IDs.
"""

import json
from pathlib import Path
from datetime import datetime

WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
KB_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "m21-1"

# Source files
SOURCES = [
    KB_DIR / "m21_1_comprehensive_knowledge.json",  # 85 entries
    KB_DIR / "m21_1_ultra_comprehensive.json",       # 127 entries
]

OUTPUT_FILE = KB_DIR / "m21_1_complete_merged.json"


def load_entries(file_path: Path) -> list:
    """Load entries from a JSON file."""
    if not file_path.exists():
        print(f"   ⚠️  File not found: {file_path}")
        return []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entries = data.get('entries', [])
    print(f"   ✅ Loaded {len(entries)} entries from {file_path.name}")
    return entries


def deduplicate_entries(all_entries: list) -> list:
    """Deduplicate entries based on URL and title similarity."""
    seen_urls = set()
    seen_titles = set()
    unique_entries = []
    
    for entry in all_entries:
        url = entry.get('url', '').split('?')[0].split('#')[0]  # Clean URL
        title = entry.get('title', '').lower().strip()
        
        # Create a fingerprint
        fingerprint = f"{url}::{title[:50]}"
        
        if fingerprint not in seen_titles and url not in seen_urls:
            seen_urls.add(url)
            seen_titles.add(fingerprint)
            unique_entries.append(entry)
    
    print(f"   Deduplication: {len(all_entries)} → {len(unique_entries)} entries")
    return unique_entries


def renumber_entries(entries: list) -> list:
    """Renumber entry IDs sequentially."""
    for idx, entry in enumerate(entries, 1):
        entry['id'] = f"m21_1_{idx:04d}"
    return entries


def main():
    print("=" * 70)
    print("💎 M21-1 Knowledge Base Merger")
    print("=" * 70)
    
    # Load all entries
    print("\n📥 Loading entries from source files...")
    all_entries = []
    for source_file in SOURCES:
        entries = load_entries(source_file)
        all_entries.extend(entries)
    
    print(f"\n📊 Total entries loaded: {len(all_entries)}")
    
    # Deduplicate
    print("\n🔍 Deduplicating entries...")
    unique_entries = deduplicate_entries(all_entries)
    
    # Renumber
    print("\n🔢 Renumbering entries...")
    final_entries = renumber_entries(unique_entries)
    
    # Create category breakdown
    categories = {}
    for entry in final_entries:
        cat = entry.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    # Create output
    output_data = {
        "source": "M21-1 Adjudication Procedures Manual (Comprehensive Merged Collection)",
        "description": "Complete merged collection of ALL M21-1 procedural guidance from multiple scraping runs",
        "merged_at": datetime.now().isoformat(),
        "statistics": {
            "total_entries": len(final_entries),
            "source_files": len(SOURCES),
            "original_count": len(all_entries),
            "duplicates_removed": len(all_entries) - len(final_entries),
        },
        "total_entries": len(final_entries),
        "entries": final_entries
    }
    
    # Save
    print(f"\n💾 Saving merged knowledge base...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Summary
    print("\n" + "=" * 70)
    print("💎 M21-1 MERGE COMPLETE")
    print("=" * 70)
    
    print(f"\n📊 Statistics:")
    print(f"   Source Files: {len(SOURCES)}")
    print(f"   Total Loaded: {len(all_entries)}")
    print(f"   Duplicates Removed: {len(all_entries) - len(final_entries)}")
    print(f"   Final Entry Count: {len(final_entries)}")
    
    print(f"\n📋 Entries by Category:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"   {cat:35} {count:4} entries")
    
    print(f"\n📁 Output: {OUTPUT_FILE}")
    
    # Target assessment
    if len(final_entries) >= 200:
        print(f"\n✅ TARGET MET: {len(final_entries)} entries (200+ minimum)")
    else:
        print(f"\n📈 Progress: {len(final_entries)} entries ({len(final_entries)/200*100:.1f}% of 200 minimum)")
    
    print("=" * 70)


if __name__ == "__main__":
    main()
