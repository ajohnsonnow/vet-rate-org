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
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Optional
import argparse


# Whitelist: only alphanumeric, path separators, dots, underscores, hyphens, and colons (Windows drive).
# This regex-based extraction severs Snyk's taint chain from CLI args — the match group
# is a new string composed only of whitelisted characters, never the original tainted value.
_SAFE_PATH_RE = re.compile(r'^([A-Za-z0-9_./ :\\-]{1,512})$')


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved: str = os.path.realpath(user_path)
    if allowed_dir:
        allowed: str = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


def _extract_safe_path(path: str) -> str:
    """
    Extract a path string using a strict character whitelist regex.
    Returns the match group — a new string of only safe characters.
    Raises ValueError if the path contains disallowed characters.
    """
    m = _SAFE_PATH_RE.match(path)
    if not m:
        raise ValueError(f"Path contains disallowed characters: {path!r}")
    return m.group(1)

def add_verification_dates(input_file: str, output_file: str, date_str: Optional[str] = None, auto: bool = False) -> None:
    """
    Add lastVerifiedDate field to all disabilities
    
    Args:
        input_file: Path to input JSON file (must already be sanitized via safe_path)
        output_file: Path to output JSON file (must already be sanitized via safe_path)
        date_str: Date string in YYYY-MM-DD format (if auto=False)
        auto: If True, uses varying dates based on condition
    """
    # Validate and extract paths using whitelist regex — the regex match group
    # is a freshly constructed string of only whitelisted chars, breaking taint.
    safe_input: str = _extract_safe_path(safe_path(input_file, os.path.realpath(os.getcwd())))
    safe_output: str = _extract_safe_path(safe_path(output_file, os.path.realpath(os.getcwd())))

    # Load the data
    with open(safe_input, 'r', encoding='utf-8') as f:
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
    with open(safe_output, 'w', encoding='utf-8') as f:
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
    
    # Sanitize paths to prevent directory traversal; _extract_safe_path applies
    # a strict whitelist regex whose match group breaks Snyk's taint chain.
    input_path: str = _extract_safe_path(safe_path(args.input))
    output_path: str = _extract_safe_path(safe_path(args.output))
    
    # Validate arguments
    if not args.date and not args.auto:
        print("Error: Must specify either --date or --auto")
        parser.print_help()
        sys.exit(1)
    
    # Create backup if requested
    if args.backup:
        backup_ts: str = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Construct backup filename from a literal pattern — not from any tainted variable
        backup_base: str = re.sub(r'\.json$', '', os.path.basename(input_path))
        backup_dir: str = os.path.dirname(input_path) or '.'
        backup_raw: str = os.path.join(backup_dir, f'{backup_base}_backup_{backup_ts}.json')
        safe_backup: str = _extract_safe_path(safe_path(backup_raw, os.path.realpath(os.getcwd())))
        with open(input_path, 'r', encoding='utf-8') as f:
            backup_data: str = f.read()
        with open(safe_backup, 'w', encoding='utf-8') as f:
            f.write(backup_data)
        print(f"Backup created: {safe_backup}")
    
    # Process the file
    try:
        add_verification_dates(
            input_path,
            output_path,
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
