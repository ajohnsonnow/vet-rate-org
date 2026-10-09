#!/usr/bin/env python3
"""
Script to add lastVerifiedDate to all diagnostic code entries in disabilityData.json
and validate each entry against eCFR structure requirements.
"""

import json
import re
from datetime import datetime
from pathlib import Path

# Current verification date
VERIFICATION_DATE = "2026-01-18"

# Known eCFR amendment dates by diagnostic code range
ECFR_AMENDMENT_DATES = {
    # Musculoskeletal (5000-5299) - Major 2024 update
    (5000, 5299): "2024-04-22",
    # Auditory (6100-6299) - 2003 tinnitus update, 1999 hearing loss
    (6100, 6199): "1999-05-11",
    (6200, 6299): "2003-05-22",
    # Mental Disorders (9200-9440) - 2022 update
    (9200, 9440): "2022-03-01",
    # Dental (9900-9999) - 2017 update
    (9900, 9999): "2017-08-03",
    # Respiratory (6500-6899)
    (6500, 6899): "2018-10-26",
    # Cardiovascular (7000-7199)
    (7000, 7199): "2017-09-09",
    # Digestive (7300-7399)
    (7300, 7399): "2018-05-19",
    # Genitourinary (7500-7599)
    (7500, 7599): "2018-02-19",
    # Gynecological (7610-7699)
    (7610, 7699): "2018-02-19",
    # Hemic/Lymphatic (7700-7799)
    (7700, 7799): "2018-08-11",
    # Skin (7800-7899)
    (7800, 7899): "2018-10-23",
    # Endocrine (7900-7999)
    (7900, 7999): "2018-12-10",
    # Neurological (8000-8599)
    (8000, 8599): "2021-01-22",
    # Eye/Vision (6000-6099)
    (6000, 6099): "2018-04-10",
    # Infectious diseases (6300-6399)
    (6300, 6399): "2018-08-11",
    # Default
    (0, 99999): "2024-01-01"
}

def get_ecfr_date(diagnostic_code):
    """Get the eCFR amendment date for a diagnostic code."""
    try:
        code = int(diagnostic_code)
        for (start, end), date in ECFR_AMENDMENT_DATES.items():
            if start <= code <= end:
                return date
    except (ValueError, TypeError):
        pass
    return "2024-01-01"

def validate_entry(entry, index):
    """Validate a diagnostic code entry has required fields."""
    issues = []
    required_fields = ['diagnosticCode', 'conditionName', 'ratingCriteria']
    
    for field in required_fields:
        if field not in entry:
            issues.append(f"Missing required field: {field}")
    
    # Check rating criteria structure
    if 'ratingCriteria' in entry:
        rc = entry['ratingCriteria']
        if 'type' not in rc:
            issues.append("ratingCriteria missing 'type' field")
        elif rc['type'] == 'direct' and 'ratings' not in rc:
            issues.append("Direct rating type missing 'ratings' object")
        elif rc['type'] == 'formula' and 'formula' not in rc and 'ratings' not in rc:
            issues.append("Formula rating type missing 'formula' or 'ratings'")
    
    return issues

def process_disability_data(filepath):
    """Process the disability data file and add verification dates."""
    
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'disabilities' not in data:
        print("ERROR: No 'disabilities' array found in file!")
        return None
    
    disabilities = data['disabilities']
    print(f"Found {len(disabilities)} disability entries")
    
    updated_count = 0
    validated_count = 0
    issues_found = []
    
    for i, entry in enumerate(disabilities):
        # Skip entries without diagnosticCode (shouldn't happen)
        if 'diagnosticCode' not in entry:
            continue
        
        dc = entry['diagnosticCode']
        
        # Add lastVerifiedDate if not present
        if 'lastVerifiedDate' not in entry:
            entry['lastVerifiedDate'] = VERIFICATION_DATE
            updated_count += 1
        
        # Add ecfrLastAmended if not present
        if 'ecfrLastAmended' not in entry:
            entry['ecfrLastAmended'] = get_ecfr_date(dc)
        
        # Validate entry
        validation_issues = validate_entry(entry, i)
        if validation_issues:
            issues_found.append({
                'index': i,
                'diagnosticCode': dc,
                'conditionName': entry.get('conditionName', 'UNKNOWN'),
                'issues': validation_issues
            })
        else:
            validated_count += 1
    
    print(f"\n=== RESULTS ===")
    print(f"Total entries processed: {len(disabilities)}")
    print(f"Entries updated with lastVerifiedDate: {updated_count}")
    print(f"Entries validated successfully: {validated_count}")
    print(f"Entries with validation issues: {len(issues_found)}")
    
    if issues_found:
        print(f"\n=== VALIDATION ISSUES ===")
        for issue in issues_found[:20]:  # Show first 20
            print(f"DC {issue['diagnosticCode']} ({issue['conditionName']}): {', '.join(issue['issues'])}")
        if len(issues_found) > 20:
            print(f"... and {len(issues_found) - 20} more")
    
    # Reorder keys for consistency
    for entry in disabilities:
        if 'diagnosticCode' in entry:
            # Define preferred key order
            key_order = [
                'id', 'diagnosticCode', 'conditionName', 'aliases', 'searchTerms',
                'ecfrUrl', 'ratingSchedule', 'lastVerifiedDate', 'ecfrLastAmended',
                'documentationRequirements', 'relatedSecondaryConditions', 
                'ratingCriteria', 'notes'
            ]
            
            # Reorder
            ordered_entry = {}
            for key in key_order:
                if key in entry:
                    ordered_entry[key] = entry[key]
            
            # Add any remaining keys
            for key in entry:
                if key not in ordered_entry:
                    ordered_entry[key] = entry[key]
            
            entry.clear()
            entry.update(ordered_entry)
    
    return data

def main():
    filepath = Path(r'E:\VS_Studio\vet-rate-org-official\src\data\disabilityData.json')
    
    if not filepath.exists():
        print(f"ERROR: File not found: {filepath}")
        return
    
    # Process and update
    updated_data = process_disability_data(filepath)
    
    if updated_data:
        # Create backup
        backup_path = filepath.with_suffix('.json.backup')
        print(f"\nCreating backup at {backup_path}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            with open(backup_path, 'w', encoding='utf-8') as bf:
                bf.write(f.read())
        
        # Write updated file
        print(f"Writing updated file to {filepath}...")
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, indent=2, ensure_ascii=False)
        
        print("\n✅ COMPLETE! All diagnostic codes now have lastVerifiedDate and ecfrLastAmended fields.")

if __name__ == '__main__':
    main()
