#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DKB WEB OPTIMIZER - Create browser-friendly knowledge base                ║
║══════════════════════════════════════════════════════════════════════════════║
║  Creates a compressed version for the web app (< 5MB target)                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"
PUBLIC_DIR = Path(__file__).parent.parent / "public" / "data"
SOURCE_FILE = KB_DIR / "diamond_knowledge_base.json"

# Target sizes
MAX_ENTRIES = 8000  # High-value entries only (aiming for ~5MB)
MAX_CONTENT_LENGTH = 1500  # Truncate long content

def optimize_for_web():
    print("\n" + "═" * 60)
    print("💎 DKB WEB OPTIMIZER")
    print("═" * 60)
    
    # Ensure output directory exists
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load full DKB
    print(f"📖 Loading {SOURCE_FILE.name}...")
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entries = data.get('entries', [])
    print(f"   Total entries: {len(entries):,}")
    
    # Filter and prioritize entries
    print(f"\n🔍 Selecting top {MAX_ENTRIES:,} high-value entries...")
    
    # Score entries by quality + priority
    def entry_score(e):
        score = e.get('source_priority', 50)
        if e.get('citation'): score += 20
        if e.get('url'): score += 10
        if e.get('diagnostic_codes'): score += 15
        content = e.get('content', '') or ''
        title = e.get('title', '') or ''
        content_len = len(content)
        if content_len > 500: score += 10
        if content_len > 1000: score += 5
        
        # QUALITY FILTERS - penalize low-quality entries
        # Penalize entries with "Unknown" in title
        if 'unknown' in title.lower(): score -= 50
        # Penalize entries that look like metadata/dates
        if 'view on this date' in content.lower(): score -= 100
        if 'view change introduced' in content.lower(): score -= 100
        # Penalize very short or repetitive content
        if content_len < 100: score -= 30
        # Boost entries with actual legal content
        if '§' in content or 'CFR' in content: score += 10
        if 'veteran' in content.lower(): score += 5
        if 'disability' in content.lower(): score += 5
        # Boost entries with diagnostic codes in title
        if any(c.isdigit() for c in title[:10]): score += 5
        
        return score
    
    # Sort by score and take top entries
    entries.sort(key=entry_score, reverse=True)
    top_entries = entries[:MAX_ENTRIES]
    
    # Optimize each entry for web - use format expected by aiSystemPrompts.js
    optimized = []
    for e in top_entries:
        # Map to the expected format: instruction, output, metadata
        title = (e.get('title', '') or '')[:200]
        content = (e.get('content', '') or '')[:MAX_CONTENT_LENGTH]
        source = e.get('source', '')
        category = e.get('category', '')
        
        # Skip entries with poor titles
        if not title or 'unknown' in title.lower() or len(title) < 10:
            continue
            
        # Skip entries with poor content
        if not content or len(content) < 100:
            continue
        
        # Build better instruction based on source type
        if 'bva' in source.lower():
            instruction = f"What was the BVA decision in: {title}?"
        elif 'cavc' in source.lower():
            instruction = f"What did the Court decide in: {title}?"
        elif 'ogc' in source.lower():
            instruction = f"What is the VA's official position on: {title}?"
        elif 'cfr' in source.lower() or 'ecfr' in source.lower():
            instruction = f"What are the VA regulations for: {title}?"
        elif 'm21' in source.lower():
            instruction = f"What is the M21-1 guidance on: {title}?"
        elif 'secondary' in source.lower():
            instruction = f"What conditions are secondary to: {title}?"
        elif 'presumptive' in source.lower():
            instruction = f"What are the presumptive conditions for: {title}?"
        else:
            instruction = f"What is {title}?"
        
        # Build metadata object
        metadata = {
            "source": source.upper().replace(' ', '_').replace('-', '_'),
            "citation": e.get('citation', ''),
            "url": e.get('url', ''),
            "category": category,
            "type": "regulation" if "cfr" in source.lower() else "case_law" if "bva" in source.lower() or "cavc" in source.lower() else "manual",
        }
        
        # Add diagnostic codes if present
        dc_codes = e.get('diagnostic_codes', [])
        if dc_codes:
            metadata["dc"] = dc_codes[0] if isinstance(dc_codes, list) and dc_codes else dc_codes
            
        # Add condition name from title
        if title:
            metadata["condition_name"] = title
        
        opt = {
            "id": e.get('dkb_id', e.get('id', '')),
            "instruction": instruction,
            "output": content,
            "metadata": {k: v for k, v in metadata.items() if v}  # Remove empty
        }
        optimized.append(opt)
        
        # Stop when we have enough entries
        if len(optimized) >= MAX_ENTRIES:
            break
    
    # Build web output - use 'entries' key as expected by aiSystemPrompts.js
    web_output = {
        "version": "2.0.0",
        "generated": datetime.now().isoformat(),
        "total_entries": len(optimized),
        "full_database_count": len(entries),
        "entries": optimized
    }
    
    # Write compressed JSON (no pretty print)
    output_file = PUBLIC_DIR / "diamond_knowledge.json"
    print(f"\n💾 Writing {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(web_output, f, ensure_ascii=False, separators=(',', ':'))
    
    file_size = output_file.stat().st_size / (1024 * 1024)
    
    # Also create a search index (titles + categories only)
    print(f"📝 Creating search index...")
    search_index = {
        "v": "2.0.0",
        "entries": [
            {
                "id": e.get('id', ''),
                "t": e.get('t', ''),
                "cat": e.get('cat', ''),
                "s": e.get('s', ''),
                "dc": e.get('dc', []),
            }
            for e in optimized
        ]
    }
    
    index_file = PUBLIC_DIR / "dkb_search_index.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False, separators=(',', ':'))
    
    index_size = index_file.stat().st_size / (1024 * 1024)
    
    # Summary
    print("\n" + "═" * 60)
    print("✅ WEB OPTIMIZATION COMPLETE")
    print("═" * 60)
    print(f"\n📊 RESULTS:")
    print(f"   Entries selected: {len(optimized):,} / {len(entries):,}")
    print(f"   DKB file size: {file_size:.2f} MB")
    print(f"   Index file size: {index_size:.2f} MB")
    print(f"\n📂 OUTPUT FILES:")
    print(f"   {output_file}")
    print(f"   {index_file}")
    print("═" * 60 + "\n")
    
    return len(optimized)

if __name__ == "__main__":
    optimize_for_web()
