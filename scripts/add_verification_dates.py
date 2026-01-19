"""
Vet-Rate.org - Add Last Verified Date to Disability Data
Copyright (c) 2024-2026 Anthony Johnson
All Rights Reserved.

This script adds the 'lastVerifiedDate' field to all disabilities in disabilityData.json
Use this to initialize the stale data detection system.

Usage:
    python add_verification_dates.py --date 2026-01-18
    
    OR to use different dates based on condition:
    python add_verification_dates.py --auto
"""

import json
import sys
from datetime import datetime, timedelta
import argparse

def add_verification_dates(input_file, output_file, date_str=None, auto=False):
    """
    Add lastVerifiedDate field to all disabilities
    
    Args:
        input_file: Path to input JSON file
        output_file: Path to output JSON file
        date_str: Date string in YYYY-MM-DD format (if auto=False)
        auto: If True, uses varying dates based on condition
    """
    # Load the data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Determine base date
    if date_str:
        base_date = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        base_date = datetime.now()
    
    # Process each disability
    count = 0
    for disability in data.get('disabilities', []):
        if 'lastVerifiedDate' not in disability:
            if auto:
                # Vary dates for testing (some current, some stale)
                # Every 10th condition gets an old date for testing
                if count % 10 == 0:
                    # Make this one stale (2 years old)
                    verification_date = base_date - timedelta(days=730)
                elif count % 7 == 0:
                    # Make this one warning (1 year old)
                    verification_date = base_date - timedelta(days=400)
                else:
                    # Most are current (within 6 months)
                    days_ago = min(count % 180, 180)
                    verification_date = base_date - timedelta(days=days_ago)
            else:
                # Use the same date for all
                verification_date = base_date
            
            # Add the field
            disability['lastVerifiedDate'] = verification_date.strftime('%Y-%m-%d')
            count += 1
    
    # Save the updated data
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Added verification dates to {count} disabilities")
    print(f"📁 Output saved to: {output_file}")
    
    if auto:
        print("\n📊 Date Distribution:")
        print("   - ~70% current (within 6 months)")
        print("   - ~14% warning (1-2 years old)")
        print("   - ~10% critical (>2 years old)")

def main():
    parser = argparse.ArgumentParser(
        description='Add lastVerifiedDate field to disability data'
    )
    parser.add_argument(
        '--input',
        default='src/data/disabilityData.json',
        help='Input JSON file (default: src/data/disabilityData.json)'
    )
    parser.add_argument(
        '--output',
        default='src/data/disabilityData.json',
        help='Output JSON file (default: overwrites input)'
    )
    parser.add_argument(
        '--date',
        help='Verification date in YYYY-MM-DD format (e.g., 2026-01-18)'
    )
    parser.add_argument(
        '--auto',
        action='store_true',
        help='Automatically vary dates for testing (some current, some stale)'
    )
    parser.add_argument(
        '--backup',
        action='store_true',
        help='Create backup before modifying'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.date and not args.auto:
        print("❌ Error: Must specify either --date or --auto")
        parser.print_help()
        sys.exit(1)
    
    # Create backup if requested
    if args.backup:
        backup_file = args.input.replace('.json', f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        with open(args.input, 'r', encoding='utf-8') as f:
            backup_data = f.read()
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        print(f"💾 Backup created: {backup_file}")
    
    # Process the file
    try:
        add_verification_dates(
            args.input,
            args.output,
            args.date,
            args.auto
        )
        print("\n✅ Success! The stale data detection system is now active.")
        print("\n🔍 To test:")
        print("   1. Search for any condition")
        print("   2. Look for stale data badges in search results")
        print("   3. Click a stale condition to see full warning banner")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
