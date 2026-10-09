"""
Complete eCFR Code Reconciliation
=================================
Fully reconciles all 841 eCFR codes against local 748 codes.
Creates a complete inventory with proper status tagging.
"""

import json
import re
from pathlib import Path
from datetime import datetime
import sys

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base"


def load_all_data():
    """Load both eCFR scraped data and local data"""
    
    # Load eCFR scraped codes
    ecfr_path = OUTPUT_DIR / "ecfr" / "ecfr_38cfr_part4.json"
    with open(ecfr_path, 'r', encoding='utf-8') as f:
        ecfr_data = json.load(f)
    ecfr_codes = ecfr_data.get('codes', {})
    
    # Load local disability data
    local_path = Path(__file__).parent.parent.parent.parent / "src" / "data" / "disabilityData.json"
    with open(local_path, 'r', encoding='utf-8-sig') as f:
        local_data = json.load(f)
    
    # Handle nested structure
    if isinstance(local_data, dict) and 'disabilities' in local_data:
        items = local_data['disabilities']
    elif isinstance(local_data, list):
        items = local_data
    else:
        items = []
    
    # Build local codes dict
    local_codes = {}
    for item in items:
        if isinstance(item, dict):
            code = str(item.get('diagnosticCode', '') or item.get('code', ''))
            if code:
                local_codes[code] = {
                    'code': code,
                    'name': item.get('conditionName', '') or item.get('name', ''),
                    'original': item
                }
    
    return ecfr_codes, local_codes


def categorize_ecfr_code(code: str, name: str) -> dict:
    """Categorize an eCFR code based on its content"""
    
    name_lower = name.lower() if name else ''
    
    # Check if it's a removed code
    if '[removed]' in name_lower or 'removed' == name_lower.strip():
        return {
            'status': 'REMOVED',
            'reason': 'Code has been removed from 38 CFR Part 4',
            'include_in_kb': True,
            'tag': 'obsolete'
        }
    
    # Check if it's table metadata (not a real code)
    metadata_patterns = ['criterion', 'evaluation', 'rating', 'note', 'percent', 
                         'september', 'march', 'january', 'added', 'see', 'minimum']
    if any(p in name_lower for p in metadata_patterns) and len(name) < 30:
        return {
            'status': 'METADATA',
            'reason': 'This is table metadata, not a diagnostic code',
            'include_in_kb': False,
            'tag': 'metadata'
        }
    
    # Check if it looks like a valid diagnostic code
    try:
        code_int = int(code)
        # Valid VA DC ranges: 5000-9499 (musculoskeletal through mental)
        if 5000 <= code_int <= 9999:
            return {
                'status': 'VALID',
                'reason': 'Valid diagnostic code in standard range',
                'include_in_kb': True,
                'tag': 'active'
            }
        elif 6000 <= code_int <= 7999:
            return {
                'status': 'VALID',
                'reason': 'Valid diagnostic code',
                'include_in_kb': True,
                'tag': 'active'
            }
        else:
            return {
                'status': 'UNKNOWN',
                'reason': f'Code {code} outside typical DC range',
                'include_in_kb': True,
                'tag': 'review'
            }
    except ValueError:
        return {
            'status': 'INVALID',
            'reason': 'Not a numeric code',
            'include_in_kb': False,
            'tag': 'invalid'
        }


def reconcile_codes():
    """Full reconciliation of eCFR vs local codes"""
    
    print("="*60)
    print("eCFR CODE RECONCILIATION")
    print("="*60)
    
    ecfr_codes, local_codes = load_all_data()
    
    print(f"\neCFR codes scraped: {len(ecfr_codes)}")
    print(f"Local codes: {len(local_codes)}")
    
    # Create full reconciliation
    reconciliation = {
        'matched': [],           # In both, names match
        'name_mismatch': [],     # In both, names differ
        'local_only': [],        # In local but not eCFR
        'ecfr_only_valid': [],   # In eCFR only, valid codes
        'ecfr_only_removed': [], # In eCFR only, marked as removed
        'ecfr_metadata': [],     # eCFR entries that are table metadata
        'ecfr_invalid': []       # eCFR entries with invalid codes
    }
    
    # Process all eCFR codes
    for code, ecfr_entry in ecfr_codes.items():
        ecfr_name = ecfr_entry.get('name', '')
        category = categorize_ecfr_code(code, ecfr_name)
        
        if code in local_codes:
            local_name = local_codes[code].get('name', '')
            
            # Compare names (fuzzy)
            ecfr_lower = ecfr_name.lower().strip()
            local_lower = local_name.lower().strip()
            
            # Check for reasonable match
            ecfr_words = set(ecfr_lower.split())
            local_words = set(local_lower.split())
            overlap = len(ecfr_words & local_words)
            
            if overlap >= 1 or ecfr_lower[:20] == local_lower[:20]:
                reconciliation['matched'].append({
                    'code': code,
                    'ecfr_name': ecfr_name,
                    'local_name': local_name,
                    'status': 'VERIFIED'
                })
            else:
                reconciliation['name_mismatch'].append({
                    'code': code,
                    'ecfr_name': ecfr_name,
                    'local_name': local_name,
                    'status': 'NAME_MISMATCH'
                })
        else:
            # Code in eCFR but not local
            if category['status'] == 'REMOVED':
                reconciliation['ecfr_only_removed'].append({
                    'code': code,
                    'name': ecfr_name,
                    'status': 'REMOVED',
                    'reason': category['reason']
                })
            elif category['status'] == 'METADATA':
                reconciliation['ecfr_metadata'].append({
                    'code': code,
                    'name': ecfr_name,
                    'status': 'METADATA',
                    'reason': category['reason']
                })
            elif category['status'] == 'VALID':
                reconciliation['ecfr_only_valid'].append({
                    'code': code,
                    'name': ecfr_name,
                    'status': 'MISSING_FROM_LOCAL',
                    'reason': 'Valid code not in local database'
                })
            else:
                reconciliation['ecfr_invalid'].append({
                    'code': code,
                    'name': ecfr_name,
                    'status': category['status'],
                    'reason': category['reason']
                })
    
    # Find codes in local but not in eCFR
    for code, local_entry in local_codes.items():
        if code not in ecfr_codes:
            reconciliation['local_only'].append({
                'code': code,
                'name': local_entry.get('name', ''),
                'status': 'NOT_IN_ECFR_SCRAPE',
                'reason': 'May need manual verification'
            })
    
    # Print summary
    print("\n" + "="*60)
    print("RECONCILIATION SUMMARY")
    print("="*60)
    print(f"\nMatched (verified): {len(reconciliation['matched'])}")
    print(f"Name mismatches: {len(reconciliation['name_mismatch'])}")
    print(f"Local only (not in eCFR): {len(reconciliation['local_only'])}")
    print(f"eCFR only - Valid codes: {len(reconciliation['ecfr_only_valid'])}")
    print(f"eCFR only - Removed: {len(reconciliation['ecfr_only_removed'])}")
    print(f"eCFR only - Metadata/headers: {len(reconciliation['ecfr_metadata'])}")
    print(f"eCFR only - Invalid: {len(reconciliation['ecfr_invalid'])}")
    
    # Show samples of each category
    if reconciliation['ecfr_only_valid']:
        print("\n=== VALID eCFR CODES MISSING FROM LOCAL ===")
        for item in reconciliation['ecfr_only_valid'][:15]:
            print(f"  {item['code']}: {item['name'][:50]}")
    
    if reconciliation['ecfr_only_removed']:
        print("\n=== REMOVED CODES (should be tagged) ===")
        for item in reconciliation['ecfr_only_removed'][:15]:
            print(f"  {item['code']}: {item['name'][:50]}")
    
    return reconciliation


def create_complete_code_inventory(reconciliation: dict):
    """Create complete inventory including all eCFR codes with proper status"""
    
    inventory = []
    
    # Add matched codes
    for item in reconciliation['matched']:
        inventory.append({
            'code': item['code'],
            'name': item['local_name'],
            'ecfr_name': item['ecfr_name'],
            'status': 'ACTIVE',
            'in_local_db': True,
            'verified_against_ecfr': True
        })
    
    # Add name mismatches (still active, may need name update)
    for item in reconciliation['name_mismatch']:
        inventory.append({
            'code': item['code'],
            'name': item['local_name'],
            'ecfr_name': item['ecfr_name'],
            'status': 'ACTIVE_NAME_REVIEW',
            'in_local_db': True,
            'verified_against_ecfr': True,
            'note': 'Name differs from eCFR - may need update'
        })
    
    # Add valid eCFR codes missing from local
    for item in reconciliation['ecfr_only_valid']:
        inventory.append({
            'code': item['code'],
            'name': item['name'],
            'ecfr_name': item['name'],
            'status': 'MISSING_FROM_LOCAL',
            'in_local_db': False,
            'verified_against_ecfr': True,
            'note': 'Add to local database'
        })
    
    # Add removed codes (important for historical reference)
    for item in reconciliation['ecfr_only_removed']:
        inventory.append({
            'code': item['code'],
            'name': item['name'] if item['name'] != 'Removed' else f"DC {item['code']} (Removed)",
            'ecfr_name': item['name'],
            'status': 'REMOVED',
            'in_local_db': False,
            'verified_against_ecfr': True,
            'note': 'This diagnostic code has been removed from 38 CFR'
        })
    
    # Add local-only codes (may be our additions or older codes)
    for item in reconciliation['local_only']:
        inventory.append({
            'code': item['code'],
            'name': item['name'],
            'ecfr_name': None,
            'status': 'LOCAL_ONLY',
            'in_local_db': True,
            'verified_against_ecfr': False,
            'note': 'Not found in eCFR scrape - verify manually'
        })
    
    return inventory


def save_reconciliation(reconciliation: dict, inventory: list):
    """Save reconciliation results"""
    
    output_dir = OUTPUT_DIR / "ecfr"
    
    # Save full reconciliation
    recon_path = output_dir / "full_reconciliation.json"
    with open(recon_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'matched': len(reconciliation['matched']),
                'name_mismatches': len(reconciliation['name_mismatch']),
                'local_only': len(reconciliation['local_only']),
                'ecfr_valid_missing': len(reconciliation['ecfr_only_valid']),
                'ecfr_removed': len(reconciliation['ecfr_only_removed']),
                'ecfr_metadata': len(reconciliation['ecfr_metadata'])
            },
            'reconciliation': reconciliation
        }, f, indent=2)
    print(f"\n[OK] Saved reconciliation to {recon_path}")
    
    # Save complete inventory
    inv_path = output_dir / "complete_dc_inventory.json"
    with open(inv_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'source': 'eCFR.gov + Local disabilityData.json',
            'total_codes': len(inventory),
            'codes': inventory
        }, f, indent=2)
    print(f"[OK] Saved inventory to {inv_path}")
    
    # Create markdown report
    report_path = output_dir / "ECFR_RECONCILIATION_REPORT.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# eCFR vs Local Database Reconciliation\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Summary\n\n")
        f.write("| Category | Count |\n")
        f.write("|----------|-------|\n")
        f.write(f"| Matched (verified) | {len(reconciliation['matched'])} |\n")
        f.write(f"| Name mismatches | {len(reconciliation['name_mismatch'])} |\n")
        f.write(f"| Local only | {len(reconciliation['local_only'])} |\n")
        f.write(f"| eCFR valid missing from local | {len(reconciliation['ecfr_only_valid'])} |\n")
        f.write(f"| eCFR removed codes | {len(reconciliation['ecfr_only_removed'])} |\n")
        f.write(f"| eCFR metadata (not codes) | {len(reconciliation['ecfr_metadata'])} |\n")
        f.write(f"| **Total inventory** | **{len(inventory)}** |\n\n")
        
        f.write("## Explanation of 841 vs 748 Discrepancy\n\n")
        f.write("The eCFR scrape found 841 entries, but many are NOT diagnostic codes:\n\n")
        f.write(f"- **{len(reconciliation['ecfr_metadata'])} entries** are table headers/metadata\n")
        f.write(f"- **{len(reconciliation['ecfr_only_removed'])} codes** have been officially REMOVED\n")
        f.write(f"- **{len(reconciliation['ecfr_only_valid'])} codes** are legitimately missing from our DB\n\n")
        
        f.write("## Removed Codes (Officially Obsolete)\n\n")
        f.write("These codes are marked as [Removed] in 38 CFR and should be tagged as obsolete:\n\n")
        f.write("| Code | Status |\n")
        f.write("|------|--------|\n")
        for item in reconciliation['ecfr_only_removed'][:50]:
            f.write(f"| {item['code']} | REMOVED |\n")
        
        if reconciliation['ecfr_only_valid']:
            f.write("\n## Missing Valid Codes (Need to Add)\n\n")
            f.write("These are valid DC codes found in eCFR but missing from our database:\n\n")
            f.write("| Code | Name |\n")
            f.write("|------|------|\n")
            for item in reconciliation['ecfr_only_valid']:
                f.write(f"| {item['code']} | {item['name'][:50]} |\n")
        
        if reconciliation['name_mismatch']:
            f.write("\n## Name Mismatches (Consider Updating)\n\n")
            f.write("| Code | Local Name | eCFR Name |\n")
            f.write("|------|-----------|----------|\n")
            for item in reconciliation['name_mismatch'][:30]:
                f.write(f"| {item['code']} | {item['local_name'][:30]} | {item['ecfr_name'][:30]} |\n")
    
    print(f"[OK] Saved report to {report_path}")
    
    # Return stats
    return {
        'total_inventory': len(inventory),
        'active_codes': len([i for i in inventory if i['status'] in ['ACTIVE', 'ACTIVE_NAME_REVIEW']]),
        'removed_codes': len([i for i in inventory if i['status'] == 'REMOVED']),
        'missing_from_local': len([i for i in inventory if i['status'] == 'MISSING_FROM_LOCAL'])
    }


def main():
    print("="*60)
    print("COMPLETE eCFR RECONCILIATION")
    print("="*60)
    
    # Reconcile
    reconciliation = reconcile_codes()
    
    # Create complete inventory
    inventory = create_complete_code_inventory(reconciliation)
    
    # Save
    stats = save_reconciliation(reconciliation, inventory)
    
    print("\n" + "="*60)
    print("RECONCILIATION COMPLETE")
    print("="*60)
    print(f"\nTotal codes in inventory: {stats['total_inventory']}")
    print(f"Active codes: {stats['active_codes']}")
    print(f"Removed codes: {stats['removed_codes']}")
    print(f"Missing from local (to add): {stats['missing_from_local']}")


if __name__ == '__main__':
    main()
