#!/usr/bin/env python3
"""
💎 DIAMOND Knowledge Base Mega-Merger
======================================
Merges ALL scraped knowledge sources into the main vet_rate_knowledge.json

Sources:
1. eCFR Official (38 CFR Part 4) - OFFICIAL regulations
2. Community Knowledge (VeteransBenefitsKB) - COMMUNITY_PROVIDED
3. Federal Register - Recent VA rules/regulations
4. Additional Sources (EAJA, BVA Reports, Wait Times, eCFR Gaps)
5. M21-1 Manual - VA procedures guidance
6. OGC Opinions - General Counsel precedents
7. BVA Knowledge - Board decisions (placeholder until API token)

Each source maintains clear tagging for transparency.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter
import hashlib

# Workspace root
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")

def load_json(filepath):
    """Load a JSON file, return empty structure if not found."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"   ⚠️ File not found: {filepath}")
        return []
    except json.JSONDecodeError as e:
        print(f"   ❌ JSON decode error in {filepath}: {e}")
        return []

def save_json(data, filepath):
    """Save data to JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def generate_id(prefix, content):
    """Generate a unique ID from content."""
    content_hash = hashlib.sha256(content.encode()).hexdigest()[:8]
    return f"{prefix}_{content_hash}"

def transform_freg_entry(entry):
    """Transform Federal Register entry to standard format."""
    return {
        "id": generate_id("freg", entry.get('title', '')),
        "title": entry.get('title', 'Unknown'),
        "content": entry.get('content', ''),
        "metadata": {
            "source": "FEDERAL_REGISTER_OFFICIAL",
            "type": "regulatory_notice",
            "citation": entry.get('citation', 'Federal Register'),
            "url": entry.get('url', ''),
            "effective_date": entry.get('effective_date', ''),
            "hierarchy_level": entry.get('hierarchy_level', 5),
            "color_code": "ORANGE",
            "source_disclaimer": "Official VA rulemaking - Federal Register publication",
            "scraped_at": entry.get('effective_date', datetime.now().isoformat())
        }
    }

def transform_additional_entry(entry):
    """Transform additional sources entry to standard format."""
    entry_type = entry.get('type', 'unknown')
    
    # Determine source category
    if 'acus' in entry.get('source', '').lower() or 'eaja' in entry_type:
        source = "EAJA_STATISTICS_OFFICIAL"
        source_desc = "Equal Access to Justice Act data - ACUS"
    elif 'bva' in entry.get('source', '').lower():
        source = "BVA_REPORTS_OFFICIAL"
        source_desc = "Board of Veterans Appeals official reports"
    elif 'ecfr_gap' in entry_type or 'gap' in entry.get('id', ''):
        source = "eCFR_OFFICIAL"
        source_desc = "eCFR gap analysis - missing diagnostic codes"
    else:
        source = "VA_OFFICIAL"
        source_desc = "Official VA government source"
    
    content = entry.get('content_preview') or entry.get('description', '')
    
    return {
        "id": entry.get('id', generate_id("add", content)),
        "title": entry.get('title', 'Unknown'),
        "content": content,
        "metadata": {
            "source": source,
            "type": entry_type,
            "url": entry.get('source_url', ''),
            "year": entry.get('year', ''),
            "verified": entry.get('verified', False),
            "source_disclaimer": source_desc,
            "scraped_at": entry.get('scraped_at', datetime.now().isoformat())
        }
    }

def transform_m21_entry(entry):
    """Transform M21-1 Manual entry to standard format."""
    return {
        "id": generate_id("m21", entry.get('citation', '')),
        "title": entry.get('title', 'Unknown'),
        "content": entry.get('content', ''),
        "metadata": {
            "source": "M21-1_OFFICIAL",
            "type": "procedural_guidance",
            "citation": entry.get('citation', ''),
            "url": entry.get('url', ''),
            "hierarchy_level": entry.get('hierarchy_level', 2),
            "color_code": "BLUE",
            "source_disclaimer": "VA M21-1 Adjudication Procedures Manual - Internal VA guidance",
            "scraped_at": datetime.now().isoformat()
        }
    }

def transform_ogc_entry(entry):
    """Transform OGC opinion entry to standard format."""
    return {
        "id": generate_id("ogc", entry.get('citation', '')),
        "title": entry.get('title', 'Unknown'),
        "content": entry.get('content', ''),
        "metadata": {
            "source": "OGC_PRECEDENT_OPINION",
            "type": "legal_opinion",
            "citation": entry.get('citation', ''),
            "url": entry.get('url', ''),
            "hierarchy_level": entry.get('hierarchy_level', 4),
            "color_code": "PURPLE",
            "source_disclaimer": "VA Office of General Counsel Precedent Opinion - Binding interpretation",
            "scraped_at": datetime.now().isoformat()
        }
    }

def transform_bva_entry(entry):
    """Transform BVA knowledge entry to standard format."""
    return {
        "id": entry.get('id', generate_id("bva", entry.get('title', ''))),
        "title": entry.get('title', 'Unknown'),
        "content": entry.get('content', ''),
        "metadata": {
            "source": "BVA_DECISIONS",
            "type": entry.get('type', 'bva_decision'),
            "citation": entry.get('citation', ''),
            "url": entry.get('url', ''),
            "hierarchy_level": 4,
            "color_code": "PURPLE",
            "source_disclaimer": "Board of Veterans Appeals decision - Persuasive authority",
            "scraped_at": entry.get('scraped_at', datetime.now().isoformat())
        }
    }

def deduplicate_entries(entries):
    """Remove duplicate entries based on unique key combination."""
    seen_keys = set()
    unique_entries = []
    
    for entry in entries:
        # Create unique key based on structure type
        source = entry.get('metadata', {}).get('source', '')
        
        # For eCFR/Community entries (instruction-based format)
        if 'instruction' in entry:
            dc = entry.get('metadata', {}).get('dc', '')
            entry_type = entry.get('metadata', {}).get('type', '')
            instruction = entry.get('instruction', '')[:100]  # First 100 chars
            unique_key = f"{source}_{entry_type}_{dc}_{instruction}"
        # For entries with explicit ID
        elif 'id' in entry:
            unique_key = f"{source}_{entry.get('id', '')}"
        # For entries with title
        elif 'title' in entry:
            title = entry.get('title', '')
            unique_key = f"{source}_{title}"
        else:
            # Fallback: use content hash
            content = str(entry)[:200]
            unique_key = hashlib.sha256(content.encode()).hexdigest()
        
        if unique_key not in seen_keys:
            seen_keys.add(unique_key)
            unique_entries.append(entry)
    
    return unique_entries

def main():
    print("=" * 70)
    print("💎 DIAMOND Knowledge Base Mega-Merger")
    print("=" * 70)
    print(f"Workspace: {WORKSPACE_ROOT}")
    print("=" * 70)
    
    all_entries = []
    source_stats = {}
    
    # 1. Load existing eCFR + Community KB (already merged)
    print("\n📥 Loading current knowledge base...")
    current_kb_path = WORKSPACE_ROOT / "public" / "data" / "vet_rate_knowledge.json"
    current_kb = load_json(current_kb_path)
    print(f"   ✅ Current KB: {len(current_kb)} entries")
    all_entries.extend(current_kb)
    
    # Count existing sources
    for entry in current_kb:
        source = entry.get('metadata', {}).get('source', 'UNKNOWN')
        source_stats[source] = source_stats.get(source, 0) + 1
    
    # 2. Load Federal Register notices
    print("\n📥 Loading Federal Register notices...")
    freg_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "freg_knowledge.json"
    freg_data = load_json(freg_path)
    if freg_data:
        freg_entries = [transform_freg_entry(e) for e in freg_data]
        all_entries.extend(freg_entries)
        source_stats['FEDERAL_REGISTER_OFFICIAL'] = len(freg_entries)
        print(f"   ✅ Federal Register: {len(freg_entries)} entries")
    
    # 3. Load Additional Sources (EAJA, BVA Reports, etc.)
    print("\n📥 Loading additional sources...")
    additional_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "additional_sources" / "additional_scraped_data.json"
    additional_data = load_json(additional_path)
    if additional_data and 'entries' in additional_data:
        add_entries = [transform_additional_entry(e) for e in additional_data['entries']]
        all_entries.extend(add_entries)
        # Count by transformed source
        for e in add_entries:
            src = e.get('metadata', {}).get('source', 'VA_OFFICIAL')
            source_stats[src] = source_stats.get(src, 0) + 1
        print(f"   ✅ Additional Sources: {len(add_entries)} entries")
        print(f"      - EAJA Statistics, BVA Reports, Wait Times, eCFR Gaps")
    
    # 4. Load M21-1 Manual guidance
    print("\n📥 Loading M21-1 Manual guidance...")
    m21_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "m21-1_knowledge.json"
    m21_data = load_json(m21_path)
    if m21_data:
        # Filter out 404 error pages
        valid_m21 = [e for e in m21_data if "Sorry — we can't find that page" not in e.get('content', '')]
        m21_entries = [transform_m21_entry(e) for e in valid_m21]
        all_entries.extend(m21_entries)
        source_stats['M21-1_OFFICIAL'] = len(m21_entries)
        print(f"   ✅ M21-1 Manual: {len(m21_entries)} entries (filtered {len(m21_data) - len(valid_m21)} 404s)")
    
    # 5. Load OGC Precedent Opinions (comprehensive)
    print("\n📥 Loading OGC Precedent Opinions...")
    ogc_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "ogc" / "ogc_comprehensive.json"
    ogc_data = load_json(ogc_path)
    if ogc_data and 'entries' in ogc_data:
        all_entries.extend(ogc_data['entries'])
        source_stats['OGC_PRECEDENT_OPINION'] = len(ogc_data['entries'])
        print(f"   ✅ OGC Opinions: {len(ogc_data['entries'])} entries")
    elif isinstance(ogc_data, list):
        ogc_entries = [transform_ogc_entry(e) for e in ogc_data]
        all_entries.extend(ogc_entries)
        source_stats['OGC_PRECEDENT_OPINION'] = len(ogc_entries)
        print(f"   ✅ OGC Opinions: {len(ogc_entries)} entries")
    
    # 5a. Load Presumptive Conditions Database
    print("\n📥 Loading Presumptive Conditions Database...")
    presumptive_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "presumptive" / "presumptive_conditions.json"
    presumptive_data = load_json(presumptive_path)
    if presumptive_data and 'entries' in presumptive_data:
        all_entries.extend(presumptive_data['entries'])
        source_stats['PRESUMPTIVE_CONDITIONS'] = len(presumptive_data['entries'])
        print(f"   ✅ Presumptive Conditions: {len(presumptive_data['entries'])} entries")
    
    # 5b. Load Secondary Conditions Matrix
    print("\n📥 Loading Secondary Conditions Matrix...")
    secondary_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "secondary" / "secondary_conditions_matrix.json"
    secondary_data = load_json(secondary_path)
    if secondary_data and 'entries' in secondary_data:
        all_entries.extend(secondary_data['entries'])
        source_stats['SECONDARY_CONDITIONS'] = len(secondary_data['entries'])
        print(f"   ✅ Secondary Conditions: {len(secondary_data['entries'])} entries")
    
    # 6. Load BVA Knowledge (placeholder - small set until API token)
    print("\n📥 Loading BVA Knowledge...")
    bva_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "bva_knowledge.json"
    bva_data = load_json(bva_path)
    if bva_data and 'entries' in bva_data:
        bva_entries = [transform_bva_entry(e) for e in bva_data['entries']]
        all_entries.extend(bva_entries)
        source_stats['BVA_DECISIONS'] = len(bva_entries)
        print(f"   ✅ BVA Knowledge: {len(bva_entries)} entries (pending full scrape)")
    elif isinstance(bva_data, list):
        bva_entries = [transform_bva_entry(e) for e in bva_data]
        all_entries.extend(bva_entries)
        source_stats['BVA_DECISIONS'] = len(bva_entries)
        print(f"   ✅ BVA Knowledge: {len(bva_entries)} entries (pending full scrape)")
    
    # Deduplicate
    print("\n🔄 Deduplicating entries...")
    before_dedup = len(all_entries)
    all_entries = deduplicate_entries(all_entries)
    after_dedup = len(all_entries)
    print(f"   Removed {before_dedup - after_dedup} duplicates")
    
    # Create backup
    backup_path = WORKSPACE_ROOT / "public" / "data" / f"vet_rate_knowledge_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    print(f"\n💾 Creating backup: {backup_path.name}")
    save_json(current_kb, backup_path)
    
    # Save merged KB
    print(f"\n📤 Saving DIAMOND knowledge base...")
    save_json(all_entries, current_kb_path)
    
    # Final statistics
    print("\n" + "=" * 70)
    print("💎 DIAMOND MERGE COMPLETE")
    print("=" * 70)
    
    # Recalculate source stats from final entries
    final_source_stats = Counter()
    final_type_stats = Counter()
    for entry in all_entries:
        src = entry.get('metadata', {}).get('source', 'UNKNOWN')
        typ = entry.get('metadata', {}).get('type', 'unknown')
        final_source_stats[src] += 1
        final_type_stats[typ] += 1
    
    print(f"\n📊 TOTAL ENTRIES: {len(all_entries)}")
    
    print("\n📁 By Source:")
    print("-" * 50)
    for source, count in sorted(final_source_stats.items(), key=lambda x: -x[1]):
        icon = "🏛️" if "OFFICIAL" in source else "🤝" if "COMMUNITY" in source else "⚖️"
        print(f"  {icon} {source}: {count}")
    
    print("\n📋 By Type:")
    print("-" * 50)
    for typ, count in sorted(final_type_stats.items(), key=lambda x: -x[1]):
        print(f"  - {typ}: {count}")
    
    print("\n" + "=" * 70)
    print("✅ Knowledge base upgraded to DIAMOND status!")
    print(f"📁 Output: {current_kb_path}")
    print(f"💾 Backup: {backup_path}")
    print("=" * 70)
    
    # Create summary JSON
    summary = {
        "merged_at": datetime.now().isoformat(),
        "total_entries": len(all_entries),
        "sources": dict(final_source_stats),
        "types": dict(final_type_stats),
        "status": "DIAMOND"
    }
    summary_path = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "DIAMOND_MERGE_SUMMARY.json"
    save_json(summary, summary_path)
    print(f"📋 Summary: {summary_path}")

if __name__ == "__main__":
    main()
