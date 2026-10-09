"""
Knowledge Base Updater - Add All New Data
==========================================
Merges all scraped data into the main knowledge base:
1. Additional sources (ACUS, BVA reports, wait times)
2. Removed DC codes (tagged as obsolete)
3. Missing DC code (6037 Pinguecula)
"""

import json
from pathlib import Path
from datetime import datetime
import sys

sys.stdout.reconfigure(encoding='utf-8')

KB_PATH = Path(r"E:\VS_Studio\vet-rate-org-official\public\data\vet_rate_knowledge.json")
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base"


def load_additional_sources():
    """Load additional scraped data"""
    path = OUTPUT_DIR / "additional_sources" / "additional_scraped_data.json"
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('entries', [])
    return []


def load_ecfr_inventory():
    """Load complete DC inventory"""
    path = OUTPUT_DIR / "ecfr" / "complete_dc_inventory.json"
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('codes', [])
    return []


def create_kb_entries_for_removed_codes(inventory):
    """Create knowledge base entries for removed codes"""
    entries = []
    
    for item in inventory:
        if item.get('status') == 'REMOVED':
            code = item['code']
            entries.append({
                'instruction': f"What is Diagnostic Code {code}?",
                'input': '',
                'output': f"Diagnostic Code {code} has been REMOVED from 38 CFR Part 4. This code is no longer used for rating purposes. Veterans with conditions previously rated under DC {code} may have been re-coded to a different diagnostic code. Consult the current 38 CFR for applicable diagnostic codes.",
                'metadata': {
                    'source': 'eCFR (OFFICIAL)',
                    'type': 'diagnostic_code_removed',
                    'dc': code,
                    'status': 'REMOVED',
                    'verified': True,
                    'verified_date': datetime.now().strftime('%Y-%m-%d')
                }
            })
    
    return entries


def create_kb_entries_for_missing_codes(inventory):
    """Create entries for codes missing from local DB"""
    entries = []
    
    for item in inventory:
        if item.get('status') == 'MISSING_FROM_LOCAL':
            code = item['code']
            name = item.get('name', f'DC {code}')
            
            entries.append({
                'instruction': f"What is Diagnostic Code {code}?",
                'input': '',
                'output': f"Diagnostic Code {code} is {name}. This diagnostic code is listed in 38 CFR Part 4. Consult the current eCFR for specific rating criteria.",
                'metadata': {
                    'source': 'eCFR (OFFICIAL)',
                    'type': 'diagnostic_code',
                    'dc': code,
                    'status': 'ACTIVE',
                    'verified': True,
                    'verified_date': datetime.now().strftime('%Y-%m-%d')
                }
            })
    
    return entries


def create_kb_entries_for_additional_sources(sources):
    """Create KB entries from additional sources"""
    entries = []
    
    for item in sources:
        item_type = item.get('type', '')
        
        if 'eaja' in item_type.lower():
            entries.append({
                'instruction': "What is EAJA and how does it relate to VA claims?",
                'input': '',
                'output': f"The Equal Access to Justice Act (EAJA) allows veterans to recover attorney fees if they substantially prevail in their VA claims. Source: {item.get('source_url', 'acus.gov/eaja/statistics')}. EAJA statistics track awards across federal agencies including VA appeals.",
                'metadata': {
                    'source': 'ACUS (OFFICIAL)',
                    'type': 'eaja_info',
                    'source_url': item.get('source_url', ''),
                    'verified': True
                }
            })
        
        elif 'bva_annual_report' in item_type:
            year = item.get('year', 'Unknown')
            title = item.get('title', f'BVA Annual Report {year}')
            entries.append({
                'instruction': f"Where can I find BVA statistics for {year}?",
                'input': '',
                'output': f"The BVA Annual Report for {year} contains statistics on appeals processed, decisions issued, and average wait times. Title: {title}. Available at: {item.get('source_url', 'department.va.gov/board-of-veterans-appeals/annual-reports-to-congress/')}",
                'metadata': {
                    'source': 'BVA (OFFICIAL)',
                    'type': 'bva_annual_report',
                    'year': year,
                    'source_url': item.get('source_url', ''),
                    'verified': True
                }
            })
        
        elif 'wait_time' in item_type.lower():
            entries.append({
                'instruction': "What are current BVA decision wait times?",
                'input': '',
                'output': f"BVA decision wait times vary by docket type. Current statistics are available at: {item.get('source_url', 'department.va.gov/board-of-veterans-appeals/decision-wait-times/')}. The Direct Review docket typically has the shortest wait times, while Evidence and Hearing dockets may take longer.",
                'metadata': {
                    'source': 'BVA (OFFICIAL)',
                    'type': 'bva_wait_times',
                    'source_url': item.get('source_url', ''),
                    'verified': True
                }
            })
    
    return entries


def update_knowledge_base():
    """Update the main knowledge base with all new data"""
    
    print("="*60)
    print("KNOWLEDGE BASE UPDATE")
    print("="*60)
    
    # Load current KB
    with open(KB_PATH, 'r', encoding='utf-8-sig') as f:
        kb = json.load(f)
    
    print(f"Current KB entries: {len(kb)}")
    
    # Load additional data
    additional_sources = load_additional_sources()
    inventory = load_ecfr_inventory()
    
    # Create new entries
    removed_entries = create_kb_entries_for_removed_codes(inventory)
    missing_entries = create_kb_entries_for_missing_codes(inventory)
    source_entries = create_kb_entries_for_additional_sources(additional_sources)
    
    print(f"\nNew entries to add:")
    print(f"  Removed DC codes: {len(removed_entries)}")
    print(f"  Missing DC codes: {len(missing_entries)}")
    print(f"  Additional sources: {len(source_entries)}")
    
    # Deduplicate - don't add entries for codes already in KB
    existing_codes = set()
    for entry in kb:
        meta = entry.get('metadata', {})
        dc = meta.get('dc', '')
        if dc:
            existing_codes.add(dc)
    
    # Filter out duplicates
    new_removed = [e for e in removed_entries if e['metadata']['dc'] not in existing_codes]
    new_missing = [e for e in missing_entries if e['metadata']['dc'] not in existing_codes]
    
    print(f"\nAfter deduplication:")
    print(f"  New removed codes: {len(new_removed)}")
    print(f"  New missing codes: {len(new_missing)}")
    
    # Add all new entries
    all_new = new_removed + new_missing + source_entries
    kb.extend(all_new)
    
    print(f"\nTotal new entries added: {len(all_new)}")
    print(f"Final KB size: {len(kb)}")
    
    # Backup current KB
    backup_path = OUTPUT_DIR / "backups" / f"kb_backup_before_update_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    with open(KB_PATH, 'r', encoding='utf-8-sig') as f:
        backup_data = f.read()
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(backup_data)
    print(f"\n[OK] Backed up to {backup_path}")
    
    # Save updated KB
    with open(KB_PATH, 'w', encoding='utf-8') as f:
        json.dump(kb, f, indent=2, ensure_ascii=False)
    print(f"[OK] Updated KB saved to {KB_PATH}")
    
    # Create update summary
    summary = {
        'updated_at': datetime.now().isoformat(),
        'previous_count': len(kb) - len(all_new),
        'new_count': len(kb),
        'entries_added': len(all_new),
        'breakdown': {
            'removed_dc_codes': len(new_removed),
            'missing_dc_codes': len(new_missing),
            'additional_sources': len(source_entries)
        },
        'sources_added': [
            'ACUS EAJA Statistics (acus.gov)',
            'BVA Annual Reports (department.va.gov)',
            'BVA Wait Times (department.va.gov)',
            'eCFR Removed DC Codes',
            'eCFR Missing DC Codes'
        ]
    }
    
    summary_path = OUTPUT_DIR / "KB_UPDATE_SUMMARY.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    print(f"[OK] Saved update summary to {summary_path}")
    
    return summary


def main():
    summary = update_knowledge_base()
    
    print("\n" + "="*60)
    print("UPDATE COMPLETE")
    print("="*60)
    print(f"Added {summary['entries_added']} entries")
    print(f"Knowledge base now has {summary['new_count']} total entries")


if __name__ == '__main__':
    main()
