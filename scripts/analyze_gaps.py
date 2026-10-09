#!/usr/bin/env python3
"""Analyze current M21-1 and eCFR coverage to identify specific gaps"""
import json
from pathlib import Path
from collections import Counter

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

print("\n" + "="*80)
print("📊 DETAILED GAP ANALYSIS")
print("="*80)

# M21-1 Analysis
print("\n🔍 M21-1 MANUAL (Current: 133 entries, Target: 200)")
print("-" * 80)

m21_file = KB_DIR / "m21-1" / "m21_1_complete_merged.json"
m21_data = json.load(open(m21_file, 'r', encoding='utf-8'))
m21_entries = m21_data['entries']

# Category breakdown
categories = Counter(e['category'] for e in m21_entries)
print("\nCategory Breakdown:")
for cat, count in categories.most_common():
    print(f"  {cat:30} {count:>4} entries")

# Sample URLs to see what areas we're covering
urls = set()
for e in m21_entries:
    if e.get('url'):
        # Extract main path
        path = e['url'].split('va.gov')[-1].split('?')[0].split('#')[0]
        urls.add(path)

print(f"\nUnique VA.gov paths covered: {len(urls)}")
print("\nGaps to target:")
print(f"  • Need {200 - len(m21_entries)} more entries to reach minimum")
print("  • Weak areas: PTSD/Mental Health (1), Service Connection (1), Examinations (2)")
print("  • Could expand: Appeals procedures, Legacy claims, Benefits delivery")

# eCFR Analysis
print("\n\n🔍 RATING SCHEDULE 38 CFR Part 4 (Current: 758 entries, Target: 1000+)")
print("-" * 80)

ecfr_files = {
    'Knowledge Base': 'ecfr-fresh/ecfr_knowledge_base.json',
    'Diagnostic Codes': 'ecfr-fresh/ecfr_diagnostic_codes.json',
    'Rating Criteria': 'ecfr-fresh/ecfr_rating_criteria.json',
    'Sections': 'ecfr-fresh/ecfr_sections.json',
}

total_ecfr = 0
for name, path in ecfr_files.items():
    file_path = KB_DIR / path
    if file_path.exists():
        data = json.load(open(file_path, 'r', encoding='utf-8'))
        # Handle both dict with 'entries' key and direct arrays
        if isinstance(data, dict):
            entries = data.get('entries', [])
        elif isinstance(data, list):
            entries = data
        else:
            entries = []
        count = len(entries)
        total_ecfr += count
        print(f"  {name:20} {count:>4} entries")
        
        # Sample some entries to see coverage
        if entries and count < 10:
            print(f"    Sample: {[e.get('title', e.get('code', ''))[:50] for e in entries[:3]]}")

print(f"\n  Total: {total_ecfr} entries")
print(f"\nGaps to target:")
print(f"  • Need {1000 - total_ecfr} more entries to reach target")
print("  • Main source (knowledge_base): 755 entries")
print("  • Could expand: More diagnostic codes, rating formulas, special monthly compensation")
print("  • Opportunity: Deep scrape of 38 CFR §4.1-4.150 (General Rating, Disabled Veterans)")

print("\n" + "="*80)
print("🎯 RECOMMENDED APPROACH")
print("="*80)
print("""
M21-1 Enhancement Strategy (67+ new entries needed):
  1. Target specific VA.gov sections:
     - /decision-reviews/appeals/ (Board appeals procedures)
     - /disability/file-disability-claim-form-21-526ez/ (Claims filing guides)
     - /pension/ (Pension procedures that reference M21-1)
  2. Add more VA forms with procedural guidance (10+ forms)
  3. Scrape /resources/ category pages more deeply
  
Rating Schedule Enhancement Strategy (242+ new entries needed):
  1. Expand diagnostic code coverage (currently minimal)
  2. Add rating percentage tables and formulas
  3. Include special monthly compensation rules (38 CFR §3.350)
  4. Add combined ratings table (38 CFR §4.25)
  5. Deep scrape all of 38 CFR Part 4 Subparts A-D
""")
