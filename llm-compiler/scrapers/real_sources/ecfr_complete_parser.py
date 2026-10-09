"""
eCFR COMPLETE PARSER - Build Clean Knowledge Base
==================================================
Parses the extracted eCFR text to build a complete, accurate knowledge base.
Handles the specific format of eCFR output with DC codes, names, and rating criteria.
"""

import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import sys

sys.stdout.reconfigure(encoding='utf-8')

class ECFRCompleteParser:
    """Parse eCFR extracted text into a clean knowledge base"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr-fresh"
        self.output_dir = Path(__file__).parent.parent.parent.parent / "public" / "data"
        self.diagnostic_codes = {}
        self.rating_criteria = {}
        self.notes = defaultdict(list)
        self.timestamp = datetime.now().isoformat()
        
    def load_extracted_text(self) -> str:
        """Load the extracted text from eCFR XML"""
        text_path = self.base_dir / "ecfr_extracted_text.txt"
        with open(text_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def parse_diagnostic_codes(self, text: str) -> Dict[str, dict]:
        """Parse all diagnostic codes with their names and rating criteria"""
        print("[PARSE] Extracting diagnostic codes with full criteria...")
        
        codes = {}
        lines = text.split('\n')
        
        # Valid DC code ranges for 38 CFR Part 4
        valid_ranges = [
            (5000, 5299),   # Musculoskeletal
            (6000, 6099),   # Eye
            (6100, 6299),   # Ear
            (6300, 6399),   # Infectious/Immune
            (6400, 6499),   # Nutritional
            (6500, 6899),   # Respiratory
            (7000, 7199),   # Cardiovascular
            (7200, 7399),   # Digestive
            (7500, 7699),   # Genitourinary/Gynecological
            (7700, 7799),   # Hemic/Lymphatic
            (7800, 7899),   # Skin
            (7900, 7999),   # Endocrine
            (8000, 8999),   # Neurological
            (9200, 9599),   # Mental Disorders
            (9900, 9999),   # Dental/Oral
        ]
        
        def is_valid_dc(code_str):
            try:
                code = int(code_str)
                for low, high in valid_ranges:
                    if low <= code <= high:
                        return True
            except:
                pass
            return False
        
        # Find patterns like "5000 Osteomyelitis, acute, subacute, or chronic:"
        # DC code at start of line followed by condition name
        # Also handle muscle groups like "5301 Group I. Function: ..."
        dc_pattern = re.compile(r'^(\d{4})\s+([A-Z][^\n]+)', re.MULTILINE)
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check if line starts with a 4-digit DC code followed by text
            if re.match(r'^\d{4}\s+\S', line):
                match = re.match(r'^(\d{4})\s+(.+)', line)
                if match:
                    code = match.group(1)
                    rest = match.group(2).strip()
                    
                    if is_valid_dc(code):
                        # Check for [Removed] or [Reserved]
                        if '[Removed]' in rest or '[Reserved]' in rest:
                            codes[code] = {
                                'code': code,
                                'name': rest.replace('[Removed]', '').replace('[Reserved]', '').strip() or f'[DC {code}]',
                                'status': 'REMOVED' if '[Removed]' in rest else 'RESERVED',
                                'ratings': [],
                                'criteria_text': '',
                                'notes': []
                            }
                        else:
                            # Extract condition name (up to colon or period)
                            name_match = re.match(r'^([^:]+?)(?::|\.|\s{3,}|$)', rest)
                            name = name_match.group(1).strip() if name_match else rest[:100]
                            name = re.sub(r'[:\.]$', '', name).strip()
                            
                            # Now gather rating criteria from subsequent lines
                            ratings = []
                            criteria_text = []
                            notes = []
                            
                            j = i + 1
                            # Look ahead for rating criteria and notes
                            while j < len(lines) and j < i + 50:
                                next_line = lines[j].strip()
                                
                                # Stop if we hit another DC code
                                if re.match(r'^\d{4}\s+[A-Z]', next_line):
                                    break
                                
                                # Check for rating percentages (standalone numbers or "XX percent")
                                rating_match = re.match(r'^(100|[1-9]0|0)\s*$', next_line)
                                if rating_match:
                                    pct = int(rating_match.group(1))
                                    # Look back for criteria description
                                    if criteria_text and pct <= 100:
                                        desc = criteria_text[-1] if criteria_text else ''
                                        ratings.append({
                                            'percentage': pct,
                                            'criteria': desc
                                        })
                                
                                # Check for "XX percent" format
                                percent_match = re.search(r'(\d{1,3})\s*(?:percent|pct|%)', next_line, re.IGNORECASE)
                                if percent_match:
                                    pct = int(percent_match.group(1))
                                    if pct <= 100:
                                        ratings.append({
                                            'percentage': pct,
                                            'criteria': next_line
                                        })
                                
                                # Capture notes
                                if next_line.lower().startswith('note'):
                                    notes.append(next_line)
                                
                                # Capture criteria descriptions
                                if next_line and not next_line.isdigit() and len(next_line) > 10:
                                    if not next_line.startswith('§') and not next_line.startswith('['):
                                        criteria_text.append(next_line)
                                
                                j += 1
                            
                            # Deduplicate ratings
                            seen_pcts = set()
                            unique_ratings = []
                            for r in ratings:
                                if r['percentage'] not in seen_pcts:
                                    seen_pcts.add(r['percentage'])
                                    unique_ratings.append(r)
                            
                            codes[code] = {
                                'code': code,
                                'name': name,
                                'status': 'ACTIVE',
                                'ratings': sorted(unique_ratings, key=lambda x: -x['percentage']),
                                'criteria_text': '\n'.join(criteria_text[:10]),  # First 10 lines
                                'notes': notes
                            }
            i += 1
        
        print(f"[PARSE] Found {len(codes)} diagnostic codes")
        return codes
    
    def extract_rating_tables(self, text: str) -> Dict[str, List[dict]]:
        """Extract rating tables from specific sections"""
        print("[RATINGS] Parsing rating tables...")
        
        ratings = {}
        
        # Pattern for rating criteria blocks:
        # Description text followed by percentage on next line
        # Example:
        # "With constitutional manifestations associated with active joint involvement, totally incapacitating"
        # "100"
        
        # Look for DC codes followed by rating tables
        # Format in eCFR: description line, then rating percentage
        
        dc_sections = re.split(r'\n(?=\d{4}\s+[A-Z])', text)
        
        for section in dc_sections:
            lines = section.strip().split('\n')
            if not lines:
                continue
            
            # First line should have DC code
            first_line = lines[0]
            dc_match = re.match(r'^(\d{4})\s+', first_line)
            if not dc_match:
                continue
            
            code = dc_match.group(1)
            section_ratings = []
            current_criteria = []
            
            for i, line in enumerate(lines[1:], 1):
                line = line.strip()
                if not line:
                    continue
                
                # Check if this line is a rating percentage
                if re.match(r'^(100|[1-9]0|0)$', line):
                    pct = int(line)
                    # Use accumulated criteria
                    if current_criteria:
                        criteria_text = ' '.join(current_criteria)
                        section_ratings.append({
                            'percentage': pct,
                            'criteria': criteria_text
                        })
                        current_criteria = []
                elif len(line) > 5 and not line.startswith('Note') and not line.startswith('§'):
                    # This is criteria text
                    current_criteria.append(line)
            
            if section_ratings:
                ratings[code] = sorted(section_ratings, key=lambda x: -x['percentage'])
        
        print(f"[RATINGS] Extracted rating tables for {len(ratings)} codes")
        return ratings
    
    def get_body_system(self, code: str) -> str:
        """Get body system name from DC code"""
        systems = {
            (5000, 5299): 'Musculoskeletal System',
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
    
    def build_knowledge_base(self, codes: Dict[str, dict], ratings: Dict[str, List[dict]]) -> List[dict]:
        """Build the final knowledge base"""
        print("\n[BUILD] Creating knowledge base entries...")
        
        kb_entries = []
        
        for code in sorted(codes.keys()):
            data = codes[code]
            name = data['name']
            status = data.get('status', 'ACTIVE')
            body_system = self.get_body_system(code)
            cfr_section = self.get_cfr_section(code)
            
            # Get rating criteria (prefer from ratings dict, fall back to codes dict)
            code_ratings = ratings.get(code, data.get('ratings', []))
            
            # Build DC definition entry
            if status == 'REMOVED':
                output = (
                    f"Diagnostic Code {code} has been REMOVED from the VA rating schedule. "
                    f"This code is no longer used for new ratings. "
                    f"Veterans with existing ratings may be re-evaluated under current diagnostic codes."
                )
            elif status == 'RESERVED':
                output = (
                    f"Diagnostic Code {code} is RESERVED. "
                    f"This code number is not currently assigned to any condition."
                )
            else:
                output = (
                    f"Diagnostic Code {code} is {name}. "
                    f"Rated under {cfr_section}. "
                    f"Body system: {body_system}. "
                    f"This condition requires medical documentation including diagnosis, treatment history, "
                    f"and functional impact assessment for rating evaluation."
                )
            
            dc_entry = {
                'instruction': f'What is Diagnostic Code {code}?',
                'input': '',
                'output': output,
                'metadata': {
                    'source': 'eCFR_OFFICIAL',
                    'source_url': 'https://www.ecfr.gov/current/title-38/chapter-I/part-4',
                    'type': 'diagnostic_code' if status == 'ACTIVE' else f'diagnostic_code_{status.lower()}',
                    'dc': code,
                    'condition_name': name,
                    'body_system': body_system,
                    'cfr_section': cfr_section,
                    'status': status,
                    'verification_date': self.timestamp
                }
            }
            kb_entries.append(dc_entry)
            
            # Build rating criteria entry (only for active codes with ratings)
            if status == 'ACTIVE' and code_ratings:
                ratings_text = f"Rating criteria for {name} (DC {code}) under {cfr_section}:\n\n"
                for r in sorted(code_ratings, key=lambda x: -x.get('percentage', 0)):
                    pct = r.get('percentage', 0)
                    criteria = r.get('criteria', 'See CFR for specific criteria')
                    ratings_text += f"• {pct}%: {criteria}\n"
                
                # Add notes if available
                if data.get('notes'):
                    ratings_text += "\nNotes:\n"
                    for note in data['notes'][:3]:  # First 3 notes
                        ratings_text += f"- {note}\n"
                
                rating_entry = {
                    'instruction': f'What are the rating criteria for {name} (DC {code})?',
                    'input': '',
                    'output': ratings_text.strip(),
                    'metadata': {
                        'source': 'eCFR_OFFICIAL',
                        'source_url': 'https://www.ecfr.gov/current/title-38/chapter-I/part-4',
                        'type': 'rating_criteria',
                        'dc': code,
                        'condition_name': name,
                        'body_system': body_system,
                        'cfr_section': cfr_section,
                        'rating_percentages': [r.get('percentage', 0) for r in code_ratings],
                        'verification_date': self.timestamp
                    }
                }
                kb_entries.append(rating_entry)
        
        print(f"[BUILD] Created {len(kb_entries)} total entries")
        return kb_entries
    
    def save_knowledge_base(self, kb_entries: List[dict]):
        """Save the knowledge base to the public data directory"""
        # Save to public/data for the app
        kb_path = self.output_dir / "vet_rate_knowledge.json"
        with open(kb_path, 'w', encoding='utf-8') as f:
            json.dump(kb_entries, f, indent=2, ensure_ascii=False)
        print(f"[SAVED] Knowledge base: {kb_path}")
        
        # Also save a backup to ecfr-fresh directory
        backup_path = self.base_dir / "vet_rate_knowledge_backup.json"
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(kb_entries, f, indent=2, ensure_ascii=False)
        print(f"[SAVED] Backup: {backup_path}")
        
        # Generate summary report
        self.generate_report(kb_entries)
    
    def generate_report(self, kb_entries: List[dict]):
        """Generate a summary report"""
        from collections import Counter
        
        types = Counter()
        systems = Counter()
        statuses = Counter()
        
        for entry in kb_entries:
            meta = entry.get('metadata', {})
            types[meta.get('type', 'unknown')] += 1
            systems[meta.get('body_system', 'unknown')] += 1
            statuses[meta.get('status', 'unknown')] += 1
        
        report = f"""# eCFR Knowledge Base - Fresh Build Report

**Generated:** {self.timestamp}
**Source:** eCFR.gov Official XML API
**Title:** 38 CFR Part 4 - Schedule for Rating Disabilities

## Summary

| Metric | Count |
|--------|-------|
| **Total Entries** | **{len(kb_entries)}** |
| Diagnostic Codes | {types.get('diagnostic_code', 0)} |
| Rating Criteria | {types.get('rating_criteria', 0)} |
| Removed Codes | {types.get('diagnostic_code_removed', 0)} |
| Reserved Codes | {types.get('diagnostic_code_reserved', 0)} |

## By Body System

| Body System | Entries |
|-------------|---------|
"""
        for system, count in systems.most_common(20):
            report += f"| {system} | {count} |\n"
        
        report += f"""
## Data Quality

- **Source Verification:** All data extracted directly from eCFR.gov XML
- **Parsing Method:** XML → Text → Structured JSON
- **Status Tags:** ACTIVE, REMOVED, RESERVED

## Output Files

- `public/data/vet_rate_knowledge.json` - Main knowledge base
- `llm-compiler/knowledge-base/ecfr-fresh/` - Raw data and backups
"""
        
        report_path = self.base_dir / "BUILD_REPORT.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"[SAVED] Report: {report_path}")
    
    def run(self):
        """Execute the complete parsing pipeline"""
        print("="*70)
        print("eCFR COMPLETE PARSER - Building Fresh Knowledge Base")
        print("="*70)
        
        # Step 1: Load extracted text
        print("\n[STEP 1] Loading extracted eCFR text...")
        text = self.load_extracted_text()
        print(f"  Loaded {len(text):,} characters")
        
        # Step 2: Parse diagnostic codes
        print("\n[STEP 2] Parsing diagnostic codes...")
        codes = self.parse_diagnostic_codes(text)
        
        # Step 3: Extract rating criteria
        print("\n[STEP 3] Extracting rating criteria...")
        ratings = self.extract_rating_tables(text)
        
        # Step 4: Build knowledge base
        print("\n[STEP 4] Building knowledge base...")
        kb_entries = self.build_knowledge_base(codes, ratings)
        
        # Step 5: Save outputs
        print("\n[STEP 5] Saving outputs...")
        self.save_knowledge_base(kb_entries)
        
        # Print summary
        print("\n" + "="*70)
        print("BUILD COMPLETE")
        print("="*70)
        
        # Count by type
        types = {}
        for entry in kb_entries:
            t = entry.get('metadata', {}).get('type', 'unknown')
            types[t] = types.get(t, 0) + 1
        
        print(f"\nTotal entries: {len(kb_entries)}")
        for t, c in sorted(types.items()):
            print(f"  {t}: {c}")
        
        return kb_entries


if __name__ == '__main__':
    parser = ECFRCompleteParser()
    kb = parser.run()
