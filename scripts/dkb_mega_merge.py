#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DIAMOND KNOWLEDGE BASE - MEGA MERGE                                       ║
║══════════════════════════════════════════════════════════════════════════════║
║  Consolidates ALL knowledge base sources into a single unified DKB            ║
║  for use by the Vet-Rate.org app and external LLMs                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
import os
import hashlib
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Set

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"
OUTPUT_FILE = KB_DIR / "diamond_knowledge_base.json"
TRAINING_OUTPUT = KB_DIR / "va_training_dataset.jsonl"

# Source priority (higher = more authoritative)
SOURCE_PRIORITY = {
    "38_cfr": 100,      # Code of Federal Regulations
    "ecfr": 95,         # Electronic CFR
    "m21_1": 90,        # M21-1 Adjudication Manual
    "ogc": 85,          # VA Office of General Counsel
    "cavc": 80,         # Court of Appeals for Veterans Claims
    "federal_circuit": 75, # Federal Circuit Court
    "bva": 70,          # Board of Veterans Appeals
    "presumptive": 65,  # Presumptive conditions
    "secondary": 60,    # Secondary conditions
    "community": 50,    # Community knowledge
}

def get_entry_hash(entry: Dict) -> str:
    """Generate a unique hash for deduplication"""
    # Use title + citation for uniqueness
    key_data = f"{entry.get('title', '')[:100]}|{entry.get('citation', '')}|{entry.get('url', '')}"
    return hashlib.sha256(key_data.encode()).hexdigest()

def normalize_entry(entry: Dict, source: str) -> Dict:
    """Normalize entry to standard DKB format"""
    return {
        "id": entry.get("id", ""),
        "title": entry.get("title", entry.get("name", entry.get("condition", ""))),
        "content": entry.get("content", entry.get("text", entry.get("summary", ""))),
        "citation": entry.get("citation", entry.get("legal_citation", "")),
        "url": entry.get("url", entry.get("source_url", "")),
        "category": entry.get("category", entry.get("body_system", source)),
        "source": source,
        "source_priority": SOURCE_PRIORITY.get(source, 50),
        "date_added": entry.get("date_added", entry.get("dateAdded", "")),
        "keywords": entry.get("keywords", entry.get("tags", [])),
        "diagnostic_codes": entry.get("diagnostic_codes", entry.get("dc_codes", [])),
    }

def extract_entries(data: Any, source: str) -> List[Dict]:
    """Extract entries from various JSON structures"""
    entries = []
    
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict):
        # Check common keys
        for key in ['entries', 'decisions', 'cases', 'opinions', 'regulations', 'conditions', 'data']:
            if key in data and isinstance(data[key], list):
                entries = data[key]
                break
        
        # If still no entries, the dict itself might be a single entry
        if not entries and 'title' in data or 'content' in data:
            entries = [data]
    
    # Normalize all entries
    normalized = []
    for i, entry in enumerate(entries):
        if isinstance(entry, dict) and (entry.get('title') or entry.get('content') or entry.get('name')):
            norm = normalize_entry(entry, source)
            if not norm.get('id'):
                norm['id'] = f"{source}_{i+1}"
            normalized.append(norm)
    
    return normalized

def process_file(file_path: Path, source: str) -> List[Dict]:
    """Process a single JSON file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return extract_entries(data, source)
    except Exception as e:
        print(f"  ⚠️  Error reading {file_path.name}: {e}")
        return []

def scan_kb_directory() -> Dict[str, List[Path]]:
    """Scan KB directory and categorize files by source"""
    sources = defaultdict(list)
    
    # Direct files in KB root
    for f in KB_DIR.glob("*.json"):
        if "backup" not in f.name.lower() and "removed" not in f.name.lower():
            if "38cfr" in f.name.lower():
                sources["38_cfr"].append(f)
            elif "bva" in f.name.lower():
                sources["bva"].append(f)
            elif "cavc" in f.name.lower():
                sources["cavc"].append(f)
            elif "m21" in f.name.lower():
                sources["m21_1"].append(f)
            elif "ogc" in f.name.lower():
                sources["ogc"].append(f)
            elif "freg" in f.name.lower():
                sources["federal_register"].append(f)
            elif "ecfr" in f.name.lower():
                sources["ecfr"].append(f)
    
    # Subdirectory files
    subdirs = {
        "bva": ["bva"],
        "bva-diamond": ["bva"],
        "cavc": ["cavc"],
        "ecfr": ["ecfr"],
        "ecfr-fresh": ["ecfr"],
        "federal-circuit": ["federal_circuit"],
        "m21-1": ["m21_1"],
        "ogc": ["ogc"],
        "official-va": ["38_cfr"],
        "presumptive": ["presumptive"],
        "secondary": ["secondary"],
        "community": ["community"],
    }
    
    for subdir, source_names in subdirs.items():
        subdir_path = KB_DIR / subdir
        if subdir_path.exists():
            # Get top-level JSON files (skip deep nested ones for now)
            for f in subdir_path.glob("*.json"):
                if "backup" not in f.name.lower() and "progress" not in f.name.lower():
                    sources[source_names[0]].append(f)
    
    # Special handling for BVA year files (very large)
    bva_years = KB_DIR / "bva"
    if bva_years.exists():
        for f in bva_years.glob("bva_20*_complete.json"):
            sources["bva"].append(f)
    
    return sources

def merge_all_sources():
    """Main merge function"""
    print("\n" + "═" * 70)
    print("💎 DIAMOND KNOWLEDGE BASE - MEGA MERGE")
    print("═" * 70)
    print(f"📁 Source directory: {KB_DIR}")
    print(f"📅 Merge date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 70 + "\n")
    
    # Scan and categorize files
    sources = scan_kb_directory()
    
    all_entries = []
    seen_hashes: Set[str] = set()
    source_stats = defaultdict(int)
    duplicates_skipped = 0
    
    # Process each source in priority order
    sorted_sources = sorted(sources.items(), key=lambda x: SOURCE_PRIORITY.get(x[0], 50), reverse=True)
    
    for source, files in sorted_sources:
        print(f"\n📂 Processing {source.upper()} ({len(files)} files)...")
        source_entries = 0
        
        for file_path in files:
            entries = process_file(file_path, source)
            
            for entry in entries:
                entry_hash = get_entry_hash(entry)
                if entry_hash not in seen_hashes:
                    seen_hashes.add(entry_hash)
                    all_entries.append(entry)
                    source_entries += 1
                else:
                    duplicates_skipped += 1
            
            if entries:
                print(f"  ✓ {file_path.name}: {len(entries)} entries")
        
        source_stats[source] = source_entries
        print(f"  📊 Total unique from {source}: {source_entries}")
    
    # Sort entries by priority (highest first)
    all_entries.sort(key=lambda x: x.get('source_priority', 0), reverse=True)
    
    # Assign final IDs
    for i, entry in enumerate(all_entries, 1):
        entry['dkb_id'] = f"DKB-{i:06d}"
    
    # Build output structure
    output = {
        "metadata": {
            "name": "Diamond Knowledge Base",
            "version": "2.0.0",
            "description": "Comprehensive VA disability claims knowledge base from verified legal sources",
            "generated": datetime.now().isoformat(),
            "total_entries": len(all_entries),
            "sources": dict(source_stats),
            "deduplication": {
                "duplicates_removed": duplicates_skipped
            }
        },
        "entries": all_entries
    }
    
    # Write main DKB file
    print(f"\n💾 Writing {OUTPUT_FILE.name}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    file_size = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    
    # Generate JSONL training file for LLMs
    print(f"📝 Generating training dataset ({TRAINING_OUTPUT.name})...")
    with open(TRAINING_OUTPUT, 'w', encoding='utf-8') as f:
        for entry in all_entries:
            if entry.get('content') and len(entry.get('content', '')) > 50:
                training_item = {
                    "instruction": f"Provide information about: {entry.get('title', 'VA disability topic')}",
                    "input": "",
                    "output": entry.get('content', ''),
                    "source": entry.get('citation', entry.get('source', '')),
                    "category": entry.get('category', '')
                }
                f.write(json.dumps(training_item, ensure_ascii=False) + "\n")
    
    training_size = TRAINING_OUTPUT.stat().st_size / (1024 * 1024)
    
    # Print summary
    print("\n" + "═" * 70)
    print("✅ MERGE COMPLETE")
    print("═" * 70)
    print(f"\n📊 STATISTICS:")
    print(f"   Total Entries: {len(all_entries):,}")
    print(f"   Duplicates Removed: {duplicates_skipped:,}")
    print(f"   DKB File Size: {file_size:.2f} MB")
    print(f"   Training File Size: {training_size:.2f} MB")
    
    print(f"\n📂 ENTRIES BY SOURCE:")
    for source, count in sorted(source_stats.items(), key=lambda x: x[1], reverse=True):
        priority = SOURCE_PRIORITY.get(source, 50)
        print(f"   {source.upper():20} {count:>8,} entries (priority: {priority})")
    
    print(f"\n📁 OUTPUT FILES:")
    print(f"   {OUTPUT_FILE}")
    print(f"   {TRAINING_OUTPUT}")
    print("═" * 70 + "\n")
    
    return len(all_entries)

if __name__ == "__main__":
    merge_all_sources()
