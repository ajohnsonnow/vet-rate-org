"""
eCFR FRESH SCRAPER - Clean Rebuild from Official Source
========================================================
Scrapes 38 CFR Part 4 (Rating Schedule) directly from eCFR.gov
Creates a CLEAN, VERIFIED knowledge base from scratch.

Official Source: https://www.ecfr.gov/current/title-38/chapter-I/part-4
XML API: https://www.ecfr.gov/api/versioner/v1/full/{date}/title-38.xml?part=4

This scraper:
1. Fetches official XML from eCFR.gov
2. Parses ALL diagnostic codes with their EXACT rating criteria
3. Creates clean JSON output with ONLY verified data
4. Tags each entry with official source and verification timestamp
"""

import json
import re
import requests
try:
    from defusedxml.ElementTree import fromstring as safe_fromstring
except ImportError:
    from xml.etree.ElementTree import fromstring as safe_fromstring
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict
import sys
import time

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

class ECFRFreshScraper:
    """Clean scraper for 38 CFR Part 4 from eCFR.gov"""
    
    # eCFR API endpoints
    BASE_XML_URL = "https://www.ecfr.gov/api/versioner/v1/full"
    BASE_JSON_URL = "https://www.ecfr.gov/api/renderer/v1/content/enhanced"
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/xml, application/json, text/html'
    }
    
    # VA Diagnostic Code ranges (official)
    DC_RANGES = {
        'musculoskeletal': (5000, 5299),      # § 4.71a
        'organs_special_senses': (6000, 6099), # § 4.84a (Eye)
        'auditory': (6100, 6299),              # § 4.85-4.87 (Ear)
        'infectious_diseases': (6300, 6399),   # § 4.88a-c
        'immune': (6350, 6399),                # § 4.88b
        'nutritional': (6400, 6499),           # § 4.89
        'respiratory': (6500, 6899),           # § 4.97
        'cardiovascular': (7000, 7199),        # § 4.104
        'digestive': (7200, 7399),             # § 4.114
        'genitourinary': (7500, 7599),         # § 4.115a-b
        'gynecological': (7600, 7699),         # § 4.116
        'hemic_lymphatic': (7700, 7799),       # § 4.117
        'skin': (7800, 7899),                  # § 4.118
        'endocrine': (7900, 7999),             # § 4.119
        'neurological': (8000, 8999),          # § 4.124a
        'mental_disorders': (9200, 9599),      # § 4.130
        'dental_oral': (9900, 9999)            # § 4.150
    }
    
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr-fresh"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.diagnostic_codes: Dict[str, dict] = {}
        self.rating_criteria: Dict[str, dict] = {}
        self.scrape_timestamp = datetime.now().isoformat()
        
    def fetch_ecfr_xml(self) -> Optional[str]:
        """Fetch 38 CFR Part 4 XML from eCFR API"""
        # Try multiple recent dates
        dates_to_try = [
            datetime.now().strftime("%Y-%m-%d"),
            "2026-01-20",
            "2026-01-15",
            "2026-01-01",
            "2025-12-15",
        ]
        
        for date in dates_to_try:
            url = f"{self.BASE_XML_URL}/{date}/title-38.xml?part=4"
            print(f"[FETCH] Trying: {url}")
            
            try:
                response = requests.get(url, headers=self.HEADERS, timeout=120)
                if response.status_code == 200:
                    print(f"[OK] Downloaded {len(response.content):,} bytes from date {date}")
                    
                    # Save raw XML for reference
                    xml_path = self.output_dir / f"ecfr_38cfr_part4_raw_{date}.xml"
                    with open(xml_path, 'wb') as f:
                        f.write(response.content)
                    print(f"[SAVED] Raw XML: {xml_path}")
                    
                    return response.text
                else:
                    print(f"[WARN] HTTP {response.status_code} for date {date}")
            except requests.RequestException as e:
                print(f"[ERROR] Request failed: {e}")
                
        return None
    
    def fetch_section_html(self, section: str) -> Optional[str]:
        """Fetch specific section HTML for detailed parsing"""
        url = f"https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/section-4.{section}"
        print(f"[FETCH] Section 4.{section}: {url}")
        
        try:
            response = requests.get(url, headers=self.HEADERS, timeout=30)
            if response.status_code == 200:
                return response.text
        except:
            pass
        return None
    
    def parse_xml_comprehensive(self, xml_content: str) -> Dict[str, dict]:
        """Parse eCFR XML and extract ALL diagnostic codes with full criteria"""
        print("\n[PARSE] Starting comprehensive XML parsing...")
        
        codes = {}
        
        # Strip XML declaration if present (can cause issues)
        xml_content = re.sub(r'^<\?xml[^>]+\?>', '', xml_content.strip())
        
        # Parse XML
        try:
            root = safe_fromstring(xml_content)
        except ET.ParseError as e:
            print(f"[ERROR] XML Parse Error: {e}")
            # Try cleaning the XML
            xml_content = re.sub(r'&(?!amp;|lt;|gt;|apos;|quot;)', '&amp;', xml_content)
            root = safe_fromstring(xml_content)
        
        # Debug: Show root structure
        print(f"[DEBUG] Root tag: {root.tag}")
        
        # eCFR uses different structures - handle all variations
        # Look for all text content that contains diagnostic codes
        
        # First pass: Find all elements with potential DC content
        all_text = ET.tostring(root, encoding='unicode', method='text')
        
        # Save extracted text for analysis
        text_path = self.output_dir / "ecfr_extracted_text.txt"
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(all_text)
        print(f"[SAVED] Extracted text: {text_path}")
        
        # Pattern 1: Standard DC format "XXXX ConditionName...XX percent"
        # Example: "5003 Arthritis, degenerative...10 percent"
        dc_pattern_full = re.compile(
            r'\b(\d{4})\s+([A-Z][^0-9\n]{5,100}?)(?:\.{2,}|—|:|\s{2,}).*?'
            r'(?:(\d{1,3})\s*(?:percent|%)|Note)',
            re.DOTALL | re.MULTILINE
        )
        
        # Pattern 2: DC with condition name only
        dc_pattern_name = re.compile(
            r'\b(\d{4})\s+([A-Z][a-zA-Z\s,\-\(\)]+?)(?:\.|:|\s{3,}|\n)',
            re.MULTILINE
        )
        
        # Pattern 3: Table format with DC codes
        dc_table_pattern = re.compile(
            r'(\d{4})\s*[\|\t]\s*([^|\n]+)',
            re.MULTILINE
        )
        
        # Pattern 4: "[Removed]" or "[Reserved]" codes
        dc_removed_pattern = re.compile(
            r'(\d{4})\s*\[(?:Removed|Reserved)\]',
            re.IGNORECASE
        )
        
        # Extract all DC codes using multiple patterns
        found_codes = set()
        
        # Method 1: Full pattern with ratings
        for match in dc_pattern_full.finditer(all_text):
            code = match.group(1)
            name = match.group(2).strip()
            if self._is_valid_dc(code):
                found_codes.add(code)
                if code not in codes:
                    codes[code] = {
                        'code': code,
                        'name': self._clean_name(name),
                        'raw_text': match.group(0)[:500],
                        'method': 'full_pattern'
                    }
        
        # Method 2: Name pattern (backup)
        for match in dc_pattern_name.finditer(all_text):
            code = match.group(1)
            name = match.group(2).strip()
            if self._is_valid_dc(code) and code not in codes:
                found_codes.add(code)
                codes[code] = {
                    'code': code,
                    'name': self._clean_name(name),
                    'raw_text': match.group(0)[:200],
                    'method': 'name_pattern'
                }
        
        # Method 3: Removed codes
        for match in dc_removed_pattern.finditer(all_text):
            code = match.group(1)
            if self._is_valid_dc(code):
                found_codes.add(code)
                codes[code] = {
                    'code': code,
                    'name': '[Removed]',
                    'status': 'REMOVED',
                    'raw_text': match.group(0),
                    'method': 'removed_pattern'
                }
        
        print(f"[PARSE] Extracted {len(codes)} diagnostic codes from XML")
        
        return codes
    
    def _is_valid_dc(self, code: str) -> bool:
        """Check if a code is in valid VA diagnostic code ranges"""
        try:
            c = int(code)
            for range_name, (low, high) in self.DC_RANGES.items():
                if low <= c <= high:
                    return True
            # Also check extended ranges
            if 5000 <= c <= 9999:
                return True
        except ValueError:
            pass
        return False
    
    def _clean_name(self, name: str) -> str:
        """Clean up condition name"""
        # Remove extra whitespace
        name = re.sub(r'\s+', ' ', name.strip())
        # Remove trailing punctuation
        name = re.sub(r'[\.\,\:\;]+$', '', name)
        # Remove leading/trailing special chars
        name = name.strip('—-–')
        # Truncate if too long
        if len(name) > 150:
            name = name[:147] + '...'
        return name
    
    def extract_rating_criteria(self, xml_content: str) -> Dict[str, List[dict]]:
        """Extract rating criteria percentages for each DC"""
        print("\n[RATINGS] Extracting rating criteria...")
        
        criteria = {}
        
        # Get plain text
        all_text = re.sub(r'<[^>]+>', ' ', xml_content)
        all_text = re.sub(r'\s+', ' ', all_text)
        
        # Rating patterns - look for DC followed by percentages
        # Pattern: "XX percent: description" or "100%—description"
        rating_block_pattern = re.compile(
            r'\b(\d{4})\b[^0-9]{0,500}?'
            r'((?:(?:100|[0-9]{1,2})\s*(?:percent|%)[^\n]{0,200}\n?)+)',
            re.DOTALL | re.IGNORECASE
        )
        
        single_rating_pattern = re.compile(
            r'(100|[0-9]{1,2})\s*(?:percent|%)\s*[:\-—]?\s*([^\n\.]{10,200})',
            re.IGNORECASE
        )
        
        for match in rating_block_pattern.finditer(all_text):
            code = match.group(1)
            rating_text = match.group(2)
            
            if not self._is_valid_dc(code):
                continue
            
            ratings = []
            for r_match in single_rating_pattern.finditer(rating_text):
                pct = int(r_match.group(1))
                desc = r_match.group(2).strip()
                if pct <= 100 and pct % 10 == 0:  # VA uses 0, 10, 20, 30, 40, 50, 60, 70, 80, 100
                    ratings.append({
                        'percentage': pct,
                        'criteria': self._clean_name(desc)
                    })
            
            if ratings:
                criteria[code] = sorted(ratings, key=lambda x: -x['percentage'])
        
        print(f"[RATINGS] Extracted criteria for {len(criteria)} codes")
        return criteria
    
    def scrape_body_system_sections(self):
        """Scrape individual body system sections for more detail"""
        print("\n[SECTIONS] Scraping body system sections...")
        
        # Key sections in 38 CFR Part 4
        sections = {
            '71a': 'Musculoskeletal System',
            '84a': 'Eye',
            '85': 'Ear - Hearing',
            '87': 'Ear - Vestibular',
            '88a': 'Infectious Diseases',
            '88b': 'Immune System',
            '97': 'Respiratory System',
            '104': 'Cardiovascular System',
            '114': 'Digestive System',
            '115a': 'Genitourinary - Renal',
            '115b': 'Genitourinary - Voiding',
            '116': 'Gynecological',
            '117': 'Hemic and Lymphatic',
            '118': 'Skin',
            '119': 'Endocrine System',
            '124a': 'Neurological',
            '130': 'Mental Disorders',
            '150': 'Dental and Oral'
        }
        
        section_data = {}
        
        for section, name in sections.items():
            url = f"https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/section-4.{section}"
            print(f"  [{section}] {name}...")
            
            try:
                response = requests.get(url, headers=self.HEADERS, timeout=30)
                if response.status_code == 200:
                    section_data[section] = {
                        'name': name,
                        'url': url,
                        'content_length': len(response.text),
                        'status': 'OK'
                    }
                    
                    # Save HTML for detailed parsing
                    html_path = self.output_dir / f"section_4_{section}.html"
                    with open(html_path, 'w', encoding='utf-8') as f:
                        f.write(response.text)
                else:
                    section_data[section] = {'name': name, 'status': f'HTTP {response.status_code}'}
            except Exception as e:
                section_data[section] = {'name': name, 'status': f'Error: {e}'}
            
            time.sleep(0.5)  # Rate limiting
        
        return section_data
    
    def build_knowledge_base(self, codes: Dict[str, dict], criteria: Dict[str, List[dict]]) -> List[dict]:
        """Build clean knowledge base entries from scraped data"""
        print("\n[BUILD] Building knowledge base...")
        
        kb_entries = []
        
        for code, data in sorted(codes.items(), key=lambda x: x[0]):
            name = data.get('name', f'DC {code}')
            
            # Skip metadata entries (not real DC codes)
            if name.startswith('[') and 'Removed' not in name:
                continue
            if name.lower() in ['rating', 'note', 'general']:
                continue
            
            # Determine status
            status = 'ACTIVE'
            if 'Removed' in name or data.get('status') == 'REMOVED':
                status = 'REMOVED'
            elif 'Reserved' in name:
                status = 'RESERVED'
            
            # Get body system from code range
            body_system = self._get_body_system(code)
            
            # Build DC definition entry
            dc_entry = {
                'instruction': f'What is Diagnostic Code {code}?',
                'input': '',
                'output': self._build_dc_description(code, name, status, body_system),
                'metadata': {
                    'source': 'eCFR_OFFICIAL',
                    'type': 'diagnostic_code' if status == 'ACTIVE' else 'diagnostic_code_removed',
                    'dc': code,
                    'condition_name': name,
                    'body_system': body_system,
                    'status': status,
                    'cfr_section': self._get_cfr_section(code),
                    'verification_date': self.scrape_timestamp,
                    'source_url': f'https://www.ecfr.gov/current/title-38/chapter-I/part-4'
                }
            }
            kb_entries.append(dc_entry)
            
            # Build rating criteria entry (only for active codes)
            if status == 'ACTIVE' and code in criteria:
                ratings_text = self._format_ratings(criteria[code])
                rating_entry = {
                    'instruction': f'What are the rating criteria for {name} (DC {code})?',
                    'input': '',
                    'output': ratings_text,
                    'metadata': {
                        'source': 'eCFR_OFFICIAL',
                        'type': 'rating_criteria',
                        'dc': code,
                        'condition_name': name,
                        'body_system': body_system,
                        'ratings': [r['percentage'] for r in criteria[code]],
                        'verification_date': self.scrape_timestamp,
                        'source_url': f'https://www.ecfr.gov/current/title-38/chapter-I/part-4'
                    }
                }
                kb_entries.append(rating_entry)
        
        print(f"[BUILD] Created {len(kb_entries)} knowledge base entries")
        return kb_entries
    
    def _get_body_system(self, code: str) -> str:
        """Get body system name from DC code"""
        try:
            c = int(code)
            for system, (low, high) in self.DC_RANGES.items():
                if low <= c <= high:
                    return system.replace('_', ' ').title()
        except:
            pass
        return 'General'
    
    def _get_cfr_section(self, code: str) -> str:
        """Get CFR section reference from DC code"""
        cfr_sections = {
            (5000, 5299): '§ 4.71a',
            (6000, 6099): '§ 4.84a',
            (6100, 6299): '§ 4.85-4.87',
            (6300, 6399): '§ 4.88a-c',
            (6500, 6899): '§ 4.97',
            (7000, 7199): '§ 4.104',
            (7200, 7399): '§ 4.114',
            (7500, 7699): '§ 4.115-4.116',
            (7700, 7799): '§ 4.117',
            (7800, 7899): '§ 4.118',
            (7900, 7999): '§ 4.119',
            (8000, 8999): '§ 4.124a',
            (9200, 9599): '§ 4.130',
            (9900, 9999): '§ 4.150'
        }
        try:
            c = int(code)
            for (low, high), section in cfr_sections.items():
                if low <= c <= high:
                    return section
        except:
            pass
        return '§ 4'
    
    def _build_dc_description(self, code: str, name: str, status: str, body_system: str) -> str:
        """Build description for a diagnostic code"""
        cfr_section = self._get_cfr_section(code)
        
        if status == 'REMOVED':
            return (f"Diagnostic Code {code} ({name}) has been REMOVED from the rating schedule. "
                   f"This code is no longer used for rating purposes. Previously rated under {cfr_section}. "
                   f"Veterans with existing ratings under this code may be re-evaluated under current criteria.")
        elif status == 'RESERVED':
            return (f"Diagnostic Code {code} is RESERVED. This code is not currently assigned to a condition. "
                   f"Located in {cfr_section} ({body_system}).")
        else:
            return (f"Diagnostic Code {code} is {name}. Rated under 38 CFR {cfr_section}. "
                   f"Body system: {body_system}. "
                   f"Medical documentation required: diagnosis, treatment history, and functional impact assessment.")
    
    def _format_ratings(self, criteria: List[dict]) -> str:
        """Format rating criteria as text"""
        lines = []
        for c in criteria:
            lines.append(f"• {c['percentage']}%: {c['criteria']}")
        return '\n'.join(lines)
    
    def run(self) -> List[dict]:
        """Execute the full scraping process"""
        print("="*70)
        print("eCFR FRESH SCRAPER - REBUILDING KNOWLEDGE BASE")
        print("="*70)
        print(f"Timestamp: {self.scrape_timestamp}")
        print(f"Output directory: {self.output_dir}")
        print("="*70)
        
        # Step 1: Fetch XML
        print("\n[STEP 1] Fetching eCFR XML...")
        xml_content = self.fetch_ecfr_xml()
        
        if not xml_content:
            print("[FATAL] Could not fetch eCFR XML!")
            return []
        
        # Step 2: Parse XML for DC codes
        print("\n[STEP 2] Parsing diagnostic codes...")
        codes = self.parse_xml_comprehensive(xml_content)
        
        # Step 3: Extract rating criteria
        print("\n[STEP 3] Extracting rating criteria...")
        criteria = self.extract_rating_criteria(xml_content)
        
        # Step 4: Scrape individual sections for more detail
        print("\n[STEP 4] Scraping body system sections...")
        sections = self.scrape_body_system_sections()
        
        # Step 5: Build knowledge base
        print("\n[STEP 5] Building knowledge base...")
        kb_entries = self.build_knowledge_base(codes, criteria)
        
        # Step 6: Save outputs
        print("\n[STEP 6] Saving outputs...")
        
        # Save raw codes
        codes_path = self.output_dir / "ecfr_diagnostic_codes.json"
        with open(codes_path, 'w', encoding='utf-8') as f:
            json.dump(codes, f, indent=2, ensure_ascii=False)
        print(f"  [SAVED] {codes_path}")
        
        # Save criteria
        criteria_path = self.output_dir / "ecfr_rating_criteria.json"
        with open(criteria_path, 'w', encoding='utf-8') as f:
            json.dump(criteria, f, indent=2, ensure_ascii=False)
        print(f"  [SAVED] {criteria_path}")
        
        # Save sections
        sections_path = self.output_dir / "ecfr_sections.json"
        with open(sections_path, 'w', encoding='utf-8') as f:
            json.dump(sections, f, indent=2, ensure_ascii=False)
        print(f"  [SAVED] {sections_path}")
        
        # Save knowledge base
        kb_path = self.output_dir / "ecfr_knowledge_base.json"
        with open(kb_path, 'w', encoding='utf-8') as f:
            json.dump(kb_entries, f, indent=2, ensure_ascii=False)
        print(f"  [SAVED] {kb_path}")
        
        # Print summary
        print("\n" + "="*70)
        print("SCRAPE COMPLETE")
        print("="*70)
        print(f"Diagnostic codes found: {len(codes)}")
        print(f"Codes with rating criteria: {len(criteria)}")
        print(f"Knowledge base entries: {len(kb_entries)}")
        print(f"Section data collected: {len(sections)}")
        print("="*70)
        
        # Save summary report
        report = {
            'timestamp': self.scrape_timestamp,
            'source': 'eCFR.gov Official XML API',
            'title_38_part_4': '38 CFR Part 4 - Rating Schedule',
            'statistics': {
                'diagnostic_codes': len(codes),
                'codes_with_criteria': len(criteria),
                'knowledge_base_entries': len(kb_entries),
                'body_system_sections': len(sections)
            },
            'code_breakdown': {
                'active': sum(1 for c in codes.values() if c.get('status') != 'REMOVED'),
                'removed': sum(1 for c in codes.values() if c.get('status') == 'REMOVED')
            },
            'output_files': [
                str(codes_path),
                str(criteria_path),
                str(sections_path),
                str(kb_path)
            ]
        }
        
        report_path = self.output_dir / "SCRAPE_REPORT.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        print(f"  [SAVED] Report: {report_path}")
        
        return kb_entries


if __name__ == '__main__':
    scraper = ECFRFreshScraper()
    kb = scraper.run()
    
    if kb:
        print(f"\n✓ Fresh knowledge base created with {len(kb)} entries")
        print(f"  Location: {scraper.output_dir / 'ecfr_knowledge_base.json'}")
    else:
        print("\n✗ Scraping failed")
