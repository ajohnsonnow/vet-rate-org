#!/usr/bin/env python3
"""
BVA Batch File Merger
Consolidates all BVA batch files into a single knowledge base file.
"""

import json
import os
from pathlib import Path
from datetime import datetime

def merge_bva_batches():
    """Merge all BVA batch files into consolidated files by year."""
    
    decisions_dir = Path("llm-compiler/knowledge-base/bva/decisions")
    output_dir = Path("llm-compiler/knowledge-base/bva")
    
    # Stats tracking
    stats = {
        "25": {"count": 0, "decisions": []},
        "24": {"count": 0, "decisions": []},
        "23": {"count": 0, "decisions": []}
    }
    
    # Process all batch files
    for batch_file in sorted(decisions_dir.glob("bva_*.json")):
        filename = batch_file.name
        
        # Extract year from filename (bva_25_batch_0001.json -> 25)
        if "_batch_" in filename:
            year = filename.split("_")[1]
            if year in stats:
                try:
                    with open(batch_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        # Handle dict format with 'entries' key
                        if isinstance(data, dict) and 'entries' in data:
                            decisions = data['entries']
                        elif isinstance(data, list):
                            decisions = data
                        else:
                            print(f"Unknown format in {filename}")
                            continue
                        
                        stats[year]["decisions"].extend(decisions)
                        stats[year]["count"] += len(decisions)
                        print(f"Loaded {len(decisions)} from {filename}")
                except Exception as e:
                    print(f"Error loading {filename}: {e}")
    
    # Save consolidated files by year
    total_decisions = 0
    for year, data in stats.items():
        if data["count"] > 0:
            output_file = output_dir / f"bva_20{year}_complete.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data["decisions"], f, indent=2)
            print(f"Saved {data['count']} decisions to {output_file.name}")
            total_decisions += data["count"]
    
    # Create master index
    master_index = {
        "metadata": {
            "source": "Board of Veterans Appeals (BVA)",
            "url": "https://www.va.gov/vetapp/",
            "scraped_date": datetime.now().isoformat(),
            "total_decisions": total_decisions
        },
        "years": {
            "2025": stats["25"]["count"],
            "2024": stats["24"]["count"],
            "2023": stats["23"]["count"]
        },
        "files": [
            "bva_2025_complete.json",
            "bva_2024_complete.json",
            "bva_2023_complete.json"
        ]
    }
    
    index_file = output_dir / "BVA_INDEX.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(master_index, f, indent=2)
    
    print(f"\n=== BVA Merger Complete ===")
    print(f"Total Decisions: {total_decisions:,}")
    print(f"2025: {stats['25']['count']:,}")
    print(f"2024: {stats['24']['count']:,}")
    print(f"2023: {stats['23']['count']:,}")
    
    return total_decisions, stats

if __name__ == "__main__":
    merge_bva_batches()
