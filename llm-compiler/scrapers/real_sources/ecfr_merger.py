"""
eCFR KNOWLEDGE BASE MERGER
===========================
Merges all scraped eCFR data into a single, comprehensive knowledge base.
Combines data from multiple parsing methods to ensure maximum coverage.
"""

import json
from pathlib import Path
from datetime import datetime
from collections import Counter
import sys

sys.stdout.reconfigure(encoding='utf-8')

class ECFRMerger:
    """Merge all eCFR scraped data into final knowledge base"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr-fresh"
        self.output_dir = Path(__file__).parent.parent.parent.parent / "public" / "data"
        self.timestamp = datetime.now().isoformat()
        
    def load_all_sources(self):
        """Load all scraped data sources"""
        sources = {}
        
        # Load XML scraper's diagnostic codes
        codes_path = self.base_dir / "ecfr_diagnostic_codes.json"
        if codes_path.exists():
            with open(codes_path, 'r', encoding='utf-8') as f:
                sources['xml_codes'] = json.load(f)
            print(f"[LOAD] XML codes: {len(sources['xml_codes'])} entries")
        
        # Load parser's knowledge base
        kb_backup = self.base_dir / "vet_rate_knowledge_backup.json"
        if kb_backup.exists():
            with open(kb_backup, 'r', encoding='utf-8') as f:
                sources['parser_kb'] = json.load(f)
            print(f"[LOAD] Parser KB: {len(sources['parser_kb'])} entries")
        
        # Load extracted text for direct parsing
        text_path = self.base_dir / "ecfr_extracted_text.txt"
        if text_path.exists():
            with open(text_path, 'r', encoding='utf-8') as f:
                sources['raw_text'] = f.read()
            print(f"[LOAD] Raw text: {len(sources['raw_text']):,} chars")
        
        return sources
    
    def get_body_system(self, code: str) -> str:
        """Get body system name from DC code"""
        systems = {
            (5000, 5299): 'Musculoskeletal System',
            (5300, 5329): 'Muscle Injuries',  # Specific range for muscle groups
            (6000, 6099): 'Eye',
            (6100, 6299): 'Ear',
            (6300, 6354): 'Infectious Diseases',
            (6350, 6399): 'Immune System',
            (6400, 6499): 'Nutritional Deficiencies',
            (6500, 6899): 'Respiratory System',
            (7000, 7199): 'Cardiovascular System',
            (7200, 7399): 'Digestive System',
            (7500, 7599): 'Genitourinary System',
            (7600, 7699): 'Gynecological Conditions',
            (7700, 7799): 'Hemic and Lymphatic System',
            (7800, 7899): 'Skin',
            (7900, 7999): 'Endocrine System',
            (8000, 8599): 'Neurological Conditions',
            (8600, 8699): 'Convulsive Disorders',
            (8700, 8999): 'Peripheral Nerves',
            (9200, 9599): 'Mental Disorders',
            (9900, 9999): 'Dental and Oral Conditions',
        }
        try:
            c = int(code)
            for (low, high), name in systems.items():
                if low <= c <= high:
                    return name
        except:
            pass
        return 'General'
    
    def get_cfr_section(self, code: str) -> str:
        """Get CFR section reference"""
        sections = {
            (5000, 5299): '38 CFR § 4.71a',
            (5300, 5329): '38 CFR § 4.73',  # Muscle injuries
            (6000, 6099): '38 CFR § 4.79',
            (6100, 6299): '38 CFR § 4.85-4.87',
            (6300, 6399): '38 CFR § 4.88a-c',
            (6500, 6899): '38 CFR § 4.97',
            (7000, 7199): '38 CFR § 4.104',
            (7200, 7399): '38 CFR § 4.114',
            (7500, 7699): '38 CFR § 4.115-4.116',
            (7700, 7799): '38 CFR § 4.117',
            (7800, 7899): '38 CFR § 4.118',
            (7900, 7999): '38 CFR § 4.119',
            (8000, 8999): '38 CFR § 4.124a',
            (9200, 9599): '38 CFR § 4.130',
            (9900, 9999): '38 CFR § 4.150',
        }
        try:
            c = int(code)
            for (low, high), section in sections.items():
                if low <= c <= high:
                    return section
        except:
            pass
        return '38 CFR Part 4'
    
    def merge_codes(self, sources: dict) -> dict:
        """Merge codes from all sources"""
        print("\n[MERGE] Combining all diagnostic codes...")
        
        merged = {}
        
        # First, add all XML codes
        if 'xml_codes' in sources:
            for code, data in sources['xml_codes'].items():
                if code not in merged:
                    name = data.get('name', f'DC {code}')
                    # Clean up name
                    if name == '[Removed]':
                        status = 'REMOVED'
                    elif name.startswith('['):
                        continue  # Skip metadata
                    else:
                        status = 'ACTIVE'
                    
                    merged[code] = {
                        'code': code,
                        'name': name,
                        'status': status,
                        'source': 'xml_scraper'
                    }
        
        # Then, add/update from parser KB
        if 'parser_kb' in sources:
            for entry in sources['parser_kb']:
                meta = entry.get('metadata', {})
                code = meta.get('dc')
                if not code:
                    continue
                
                entry_type = meta.get('type', '')
                if entry_type == 'rating_criteria':
                    continue  # Skip rating entries for now
                
                name = meta.get('condition_name', '')
                status = meta.get('status', 'ACTIVE')
                
                if code not in merged:
                    merged[code] = {
                        'code': code,
                        'name': name,
                        'status': status,
                        'source': 'text_parser'
                    }
                elif name and len(name) > len(merged[code].get('name', '')):
                    # Update if we have a longer/better name
                    merged[code]['name'] = name
        
        print(f"[MERGE] Total unique codes: {len(merged)}")
        return merged
    
    def build_final_kb(self, merged_codes: dict, sources: dict) -> list:
        """Build final knowledge base from merged codes"""
        print("\n[BUILD] Creating final knowledge base...")
        
        kb_entries = []
        
        # Create a lookup for rating criteria from parser KB
        ratings_lookup = {}
        if 'parser_kb' in sources:
            for entry in sources['parser_kb']:
                meta = entry.get('metadata', {})
                if meta.get('type') == 'rating_criteria':
                    code = meta.get('dc')
                    if code:
                        ratings_lookup[code] = entry
        
        for code in sorted(merged_codes.keys()):
            data = merged_codes[code]
            name = data.get('name', f'DC {code}')
            status = data.get('status', 'ACTIVE')
            body_system = self.get_body_system(code)
            cfr_section = self.get_cfr_section(code)
            
            # Build description
            if status == 'REMOVED':
                output = (
                    f"Diagnostic Code {code} has been REMOVED from the VA rating schedule. "
                    f"This code is no longer used for new ratings. "
                    f"Veterans with existing ratings may be re-evaluated under current diagnostic codes."
                )
                entry_type = 'diagnostic_code_removed'
            elif status == 'RESERVED':
                output = (
                    f"Diagnostic Code {code} is RESERVED. "
                    f"This code number is not currently assigned to any condition."
                )
                entry_type = 'diagnostic_code_reserved'
            else:
                output = (
                    f"Diagnostic Code {code} is {name}. "
                    f"Rated under {cfr_section}. "
                    f"Body system: {body_system}. "
                    f"This condition requires medical documentation including diagnosis, treatment history, "
                    f"and functional impact assessment for rating evaluation."
                )
                entry_type = 'diagnostic_code'
            
            # Add DC definition entry
            dc_entry = {
                'instruction': f'What is Diagnostic Code {code}?',
                'input': '',
                'output': output,
                'metadata': {
                    'source': 'eCFR_OFFICIAL',
                    'source_url': 'https://www.ecfr.gov/current/title-38/chapter-I/part-4',
                    'type': entry_type,
                    'dc': code,
                    'condition_name': name,
                    'body_system': body_system,
                    'cfr_section': cfr_section,
                    'status': status,
                    'verification_date': self.timestamp
                }
            }
            kb_entries.append(dc_entry)
            
            # Add rating criteria if available
            if code in ratings_lookup and status == 'ACTIVE':
                kb_entries.append(ratings_lookup[code])
        
        print(f"[BUILD] Created {len(kb_entries)} knowledge base entries")
        return kb_entries
    
    def save_final_kb(self, kb_entries: list):
        """Save the final knowledge base"""
        # Save to public/data
        kb_path = self.output_dir / "vet_rate_knowledge.json"
        with open(kb_path, 'w', encoding='utf-8') as f:
            json.dump(kb_entries, f, indent=2, ensure_ascii=False)
        print(f"\n[SAVED] {kb_path}")
        
        # Generate report
        self.generate_report(kb_entries)
    
    def generate_report(self, kb_entries: list):
        """Generate summary report"""
        types = Counter()
        systems = Counter()
        statuses = Counter()
        
        dc_codes = set()
        for entry in kb_entries:
            meta = entry.get('metadata', {})
            types[meta.get('type', 'unknown')] += 1
            systems[meta.get('body_system', 'unknown')] += 1
            statuses[meta.get('status', 'unknown')] += 1
            if meta.get('dc'):
                dc_codes.add(meta['dc'])
        
        print("\n" + "="*70)
        print("FINAL KNOWLEDGE BASE SUMMARY")
        print("="*70)
        print(f"Total entries: {len(kb_entries)}")
        print(f"Unique DC codes: {len(dc_codes)}")
        print("\nBy Type:")
        for t, c in types.most_common():
            print(f"  {t}: {c}")
        print("\nBy Body System:")
        for s, c in systems.most_common(15):
            print(f"  {s}: {c}")
        print("="*70)
        
        # Save report
        report = f"""# eCFR Knowledge Base - Final Build Report

**Generated:** {self.timestamp}
**Source:** eCFR.gov Official XML API
**Title:** 38 CFR Part 4 - Schedule for Rating Disabilities

## Summary

| Metric | Count |
|--------|-------|
| **Total Entries** | **{len(kb_entries)}** |
| **Unique DC Codes** | **{len(dc_codes)}** |

## By Entry Type

| Type | Count |
|------|-------|
"""
        for t, c in types.most_common():
            report += f"| {t} | {c} |\n"
        
        report += f"""
## By Body System

| Body System | Entries |
|-------------|---------|
"""
        for s, c in systems.most_common():
            report += f"| {s} | {c} |\n"
        
        report += f"""
## Data Source

- **Primary Source:** eCFR.gov XML API
- **URL:** https://www.ecfr.gov/current/title-38/chapter-I/part-4
- **Verification Date:** {self.timestamp}

## Output File

- `public/data/vet_rate_knowledge.json`
"""
        
        report_path = self.base_dir / "FINAL_BUILD_REPORT.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n[SAVED] Report: {report_path}")
    
    def run(self):
        """Execute the merge process"""
        print("="*70)
        print("eCFR KNOWLEDGE BASE MERGER")
        print("="*70)
        
        # Load all sources
        sources = self.load_all_sources()
        
        # Merge codes
        merged = self.merge_codes(sources)
        
        # Build final KB
        kb_entries = self.build_final_kb(merged, sources)
        
        # Save
        self.save_final_kb(kb_entries)
        
        return kb_entries


if __name__ == '__main__':
    merger = ECFRMerger()
    merger.run()
