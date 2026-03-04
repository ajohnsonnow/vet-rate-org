"""
eCFR XML Scraper & Verifier for 38 CFR Part 4
==============================================
Scrapes the REAL 38 CFR from eCFR.gov XML API and verifies local data.

OFFICIAL DATA SOURCE: https://www.ecfr.gov/api/versioner/v1/full/
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
from typing import Dict, List, Tuple, Optional
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

class ECFRXMLScraper:
    """Scrapes 38 CFR Part 4 from eCFR XML API"""
    
    BASE_URL = "https://www.ecfr.gov/api/versioner/v1/full"
    HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    def __init__(self):
        self.scraped_codes: Dict[str, dict] = {}
        self.output_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def get_current_date_string(self) -> str:
        """Get date string for eCFR API (use recent date)"""
        return datetime.now().strftime("%Y-%m-%d")
    
    def fetch_xml(self) -> Optional[str]:
        """Fetch the full 38 CFR Part 4 XML"""
        # Try current date first, then yesterday
        dates_to_try = [
            "2025-01-15",  # Known good date
            "2025-01-20",
            "2025-01-21",
        ]
        
        for date in dates_to_try:
            url = f"{self.BASE_URL}/{date}/title-38.xml?part=4"
            print(f"[INFO] Fetching: {url}")
            
            try:
                response = requests.get(url, headers=self.HEADERS, timeout=120)
                if response.status_code == 200:
                    print(f"[OK] Downloaded {len(response.content):,} bytes")
                    return response.text
                else:
                    print(f"[WARN] Status {response.status_code} for {date}")
            except Exception as e:
                print(f"[ERROR] {e}")
                
        return None
    
    def parse_xml(self, xml_content: str) -> Dict[str, dict]:
        """Parse eCFR XML and extract diagnostic codes"""
        print("\n[INFO] Parsing XML content...")
        
        # Parse the XML
        root = safe_fromstring(xml_content)
        
        # Find all sections (each section is a regulation like 4.71a)
        codes = {}
        
        # Namespace handling - eCFR uses default namespace
        ns = {'ecfr': ''}  # Will handle namespaces if needed
        
        # Look for all DIV8 elements (individual sections in eCFR)
        # or SECTION elements depending on format
        
        # First, let's save the raw XML for inspection
        xml_sample_path = self.output_dir / "ecfr_raw_sample.xml"
        with open(xml_sample_path, 'w', encoding='utf-8') as f:
            f.write(xml_content[:100000])  # First 100KB
        print(f"[INFO] Saved raw XML sample to {xml_sample_path}")
        
        # Parse sections - eCFR XML structure varies
        # Looking for patterns like:
        # <SECTION> or <DIV8 N="4.71a">
        # Contains <HEAD> with title
        # Contains DC codes in tables
        
        # Method 1: Find all elements with diagnostic code patterns
        dc_pattern = re.compile(r'(\d{4})', re.MULTILINE)
        rating_pattern = re.compile(r'(\d{1,3})\s*percent|\b(\d{1,3})%', re.IGNORECASE)
        
        # Find all DC references in text
        # The XML has complex nested structure, so we'll parse it differently
        current_section = None
        
        # Walk through all elements
        def extract_from_element(elem, path=""):
            """Recursively extract diagnostic codes from XML elements"""
            tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag  # Handle namespace
            
            # Check for section markers
            if tag.upper() in ['SECTION', 'DIV8', 'SUBJGRP']:
                n_attr = elem.get('N', '') or elem.get('n', '')
                if '4.' in str(n_attr):
                    path = n_attr
            
            # Check element text for DC codes
            text = elem.text or ''
            tail = elem.tail or ''
            full_text = text + tail
            
            # Look for diagnostic code patterns (4-digit numbers in rating context)
            if full_text:
                # Pattern: "XXXX Description...XX percent"
                lines = full_text.split('\n')
                for line in lines:
                    # Check if line starts with a 4-digit code
                    dc_match = re.match(r'^\s*(\d{4})\s+(.+)', line)
                    if dc_match:
                        code = dc_match.group(1)
                        rest = dc_match.group(2)
                        
                        # Extract ratings from the line
                        ratings = []
                        for match in re.finditer(r'(\d{1,3})\s*(?:percent|%)', rest, re.IGNORECASE):
                            ratings.append(int(match.group(1)))
                        
                        if not ratings:
                            # Try to find standalone numbers that could be ratings
                            for match in re.finditer(r'\b(100|[1-9]0)\b', rest):
                                ratings.append(int(match.group(1)))
                        
                        if code not in codes:
                            # Extract condition name (text before rating)
                            name_match = re.match(r'^([^0-9]+)', rest)
                            name = name_match.group(1).strip() if name_match else rest[:50]
                            name = re.sub(r'[\.\:\,]+$', '', name).strip()
                            
                            codes[code] = {
                                'code': code,
                                'name': name[:100] if name else f"DC {code}",
                                'ratings': sorted(set(ratings), reverse=True),
                                'section': path,
                                'source': 'eCFR XML'
                            }
            
            # Recurse into children
            for child in elem:
                extract_from_element(child, path)
        
        extract_from_element(root)
        
        print(f"[INFO] Method 1 extracted {len(codes)} codes")
        
        # Method 2: Regex extraction as backup
        if len(codes) < 100:  # If we didn't get enough codes
            print("[INFO] Running regex extraction as backup...")
            
            # More aggressive pattern matching
            # Look for table-like structures: CODE | DESCRIPTION | RATING
            table_pattern = re.compile(
                r'<(?:TD|P|FP)[^>]*>\s*(\d{4})\s*</(?:TD|P|FP)>.*?'
                r'<(?:TD|P|FP)[^>]*>([^<]+)</(?:TD|P|FP)>',
                re.DOTALL | re.IGNORECASE
            )
            
            for match in table_pattern.finditer(xml_content):
                code = match.group(1)
                name = match.group(2).strip()
                if code not in codes and name:
                    codes[code] = {
                        'code': code,
                        'name': name[:100],
                        'ratings': [],
                        'section': '',
                        'source': 'eCFR XML regex'
                    }
            
            print(f"[INFO] After regex: {len(codes)} total codes")
        
        # Method 3: Direct text search
        print("[INFO] Running direct text search...")
        
        # Common VA diagnostic codes follow patterns
        # Look for lines like: "5010  Arthritis..."
        text_content = re.sub(r'<[^>]+>', ' ', xml_content)  # Strip tags
        text_content = re.sub(r'\s+', ' ', text_content)  # Normalize whitespace
        
        # Pattern for DC codes with descriptions
        dc_with_desc = re.compile(r'\b(\d{4})\s+([A-Z][a-z]+(?:\s+[a-z]+)*)', re.MULTILINE)
        
        for match in dc_with_desc.finditer(text_content):
            code = match.group(1)
            name = match.group(2).strip()
            
            # Validate it looks like a real DC code (VA uses specific ranges)
            code_int = int(code)
            if 5000 <= code_int <= 9999 or 6000 <= code_int <= 7999:  # Valid DC ranges
                if code not in codes:
                    codes[code] = {
                        'code': code,
                        'name': name[:100],
                        'ratings': [],
                        'section': '',
                        'source': 'eCFR text search'
                    }
        
        print(f"[INFO] Final total: {len(codes)} diagnostic codes extracted")
        
        return codes
    
    def load_local_data(self) -> Dict[str, dict]:
        """Load local disabilityData.json"""
        local_path = Path(__file__).parent.parent.parent.parent / "src" / "data" / "disabilityData.json"
        
        if not local_path.exists():
            print(f"[ERROR] Local data not found: {local_path}")
            return {}
        
        with open(local_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle nested structure - look for disabilities array
        if isinstance(data, dict) and 'disabilities' in data:
            items = data['disabilities']
        elif isinstance(data, list):
            items = data
        else:
            print(f"[ERROR] Unexpected data structure")
            return {}
        
        # Convert to dict by code
        local_codes = {}
        for item in items:
            if isinstance(item, dict):
                # Try different possible key names
                code = str(item.get('diagnosticCode', '') or item.get('code', '') or item.get('dc', ''))
                name = item.get('conditionName', '') or item.get('name', '') or item.get('condition', '')
                
                # Extract ratings
                ratings = []
                if 'ratingCriteria' in item and isinstance(item['ratingCriteria'], dict):
                    if 'ratings' in item['ratingCriteria']:
                        ratings = [int(r) for r in item['ratingCriteria']['ratings'].keys() if r.isdigit()]
                elif 'ratingOptions' in item:
                    ratings = item['ratingOptions']
                
                if code:
                    local_codes[code] = {
                        'code': code,
                        'name': name,
                        'ratingOptions': ratings,
                        'original': item
                    }
        
        print(f"[OK] Loaded {len(local_codes)} codes from local disabilityData.json")
        return local_codes
    
    def verify_local_data(self, ecfr_codes: Dict[str, dict], local_codes: Dict[str, dict]) -> dict:
        """Compare local data against eCFR and generate verification report"""
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'ecfr_total': len(ecfr_codes),
            'local_total': len(local_codes),
            'matched': [],
            'name_mismatches': [],
            'missing_from_ecfr': [],
            'missing_from_local': [],
            'rating_differences': []
        }
        
        print("\n" + "="*60)
        print("VERIFICATION RESULTS")
        print("="*60)
        
        # Check each local code against eCFR
        for code, local_data in local_codes.items():
            if code in ecfr_codes:
                ecfr_data = ecfr_codes[code]
                
                # Compare names (fuzzy match)
                local_name = local_data.get('name', '').lower().strip()
                ecfr_name = ecfr_data.get('name', '').lower().strip()
                
                # Check for name similarity
                if local_name and ecfr_name:
                    # Simple word overlap check
                    local_words = set(local_name.split())
                    ecfr_words = set(ecfr_name.split())
                    overlap = len(local_words & ecfr_words)
                    
                    if overlap >= 1 or local_name[:20] == ecfr_name[:20]:
                        results['matched'].append({
                            'code': code,
                            'local_name': local_data.get('name', ''),
                            'ecfr_name': ecfr_data.get('name', ''),
                            'status': 'VERIFIED'
                        })
                    else:
                        results['name_mismatches'].append({
                            'code': code,
                            'local_name': local_data.get('name', ''),
                            'ecfr_name': ecfr_data.get('name', ''),
                            'status': 'NAME_MISMATCH'
                        })
                else:
                    results['matched'].append({
                        'code': code,
                        'local_name': local_data.get('name', ''),
                        'ecfr_name': ecfr_data.get('name', ''),
                        'status': 'PARTIAL_MATCH'
                    })
                    
                # Compare ratings if available
                local_ratings = set(local_data.get('ratingOptions', []))
                ecfr_ratings = set(ecfr_data.get('ratings', []))
                
                if local_ratings and ecfr_ratings and local_ratings != ecfr_ratings:
                    results['rating_differences'].append({
                        'code': code,
                        'name': local_data.get('name', ''),
                        'local_ratings': sorted(local_ratings, reverse=True),
                        'ecfr_ratings': sorted(ecfr_ratings, reverse=True)
                    })
            else:
                # Code not in eCFR scrape
                results['missing_from_ecfr'].append({
                    'code': code,
                    'name': local_data.get('name', ''),
                    'status': 'NOT_IN_ECFR_SCRAPE'
                })
        
        # Check for codes in eCFR but not local
        for code, ecfr_data in ecfr_codes.items():
            if code not in local_codes:
                results['missing_from_local'].append({
                    'code': code,
                    'name': ecfr_data.get('name', ''),
                    'status': 'MISSING_LOCALLY'
                })
        
        # Print summary
        print(f"\n[STATS] eCFR codes scraped: {len(ecfr_codes)}")
        print(f"[STATS] Local codes: {len(local_codes)}")
        print(f"[OK] Verified matches: {len(results['matched'])}")
        print(f"[WARN] Name mismatches: {len(results['name_mismatches'])}")
        print(f"[WARN] Rating differences: {len(results['rating_differences'])}")
        print(f"[INFO] Not in eCFR scrape: {len(results['missing_from_ecfr'])}")
        print(f"[INFO] Missing from local: {len(results['missing_from_local'])}")
        
        return results
    
    def save_results(self, ecfr_codes: Dict[str, dict], verification: dict):
        """Save all results to JSON files"""
        
        # Save scraped eCFR data
        ecfr_path = self.output_dir / "ecfr_38cfr_part4.json"
        with open(ecfr_path, 'w', encoding='utf-8') as f:
            json.dump({
                'source': 'eCFR.gov XML API',
                'url': f'{self.BASE_URL}/YYYY-MM-DD/title-38.xml?part=4',
                'scraped_at': datetime.now().isoformat(),
                'total_codes': len(ecfr_codes),
                'codes': ecfr_codes
            }, f, indent=2)
        print(f"\n[OK] Saved eCFR data to {ecfr_path}")
        
        # Save verification results
        verify_path = self.output_dir / "verification_report.json"
        with open(verify_path, 'w', encoding='utf-8') as f:
            json.dump(verification, f, indent=2)
        print(f"[OK] Saved verification report to {verify_path}")
        
        # Generate human-readable report
        report_path = self.output_dir / "VERIFICATION_REPORT.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# 38 CFR Part 4 Verification Report\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"**Source:** eCFR.gov XML API\n\n")
            f.write("## Summary\n\n")
            f.write(f"| Metric | Count |\n")
            f.write(f"|--------|-------|\n")
            f.write(f"| eCFR Codes Scraped | {len(ecfr_codes)} |\n")
            f.write(f"| Local Codes | {verification['local_total']} |\n")
            f.write(f"| Verified Matches | {len(verification['matched'])} |\n")
            f.write(f"| Name Mismatches | {len(verification['name_mismatches'])} |\n")
            f.write(f"| Rating Differences | {len(verification['rating_differences'])} |\n")
            f.write(f"| Missing from Local | {len(verification['missing_from_local'])} |\n")
            
            if verification['name_mismatches']:
                f.write("\n## Name Mismatches (Review Needed)\n\n")
                f.write("| Code | Local Name | eCFR Name |\n")
                f.write("|------|-----------|----------|\n")
                for item in verification['name_mismatches'][:50]:  # First 50
                    f.write(f"| {item['code']} | {item['local_name'][:40]} | {item['ecfr_name'][:40]} |\n")
            
            if verification['rating_differences']:
                f.write("\n## Rating Differences\n\n")
                f.write("| Code | Name | Local Ratings | eCFR Ratings |\n")
                f.write("|------|------|--------------|-------------|\n")
                for item in verification['rating_differences'][:30]:
                    f.write(f"| {item['code']} | {item['name'][:30]} | {item['local_ratings']} | {item['ecfr_ratings']} |\n")
            
            if verification['missing_from_local']:
                f.write("\n## Codes in eCFR but Missing Locally\n\n")
                for item in verification['missing_from_local'][:50]:
                    f.write(f"- **{item['code']}**: {item['name']}\n")
        
        print(f"[OK] Saved human-readable report to {report_path}")
    
    def run(self):
        """Main execution"""
        print("="*60)
        print("38 CFR PART 4 SCRAPER & VERIFIER")
        print("Source: eCFR.gov XML API (OFFICIAL)")
        print("="*60)
        
        # Step 1: Fetch XML
        xml_content = self.fetch_xml()
        if not xml_content:
            print("[FATAL] Could not fetch eCFR XML data")
            return
        
        # Step 2: Parse XML and extract codes
        ecfr_codes = self.parse_xml(xml_content)
        
        if not ecfr_codes:
            print("[FATAL] Could not extract any diagnostic codes")
            return
        
        # Step 3: Load local data
        local_codes = self.load_local_data()
        
        # Step 4: Verify
        verification = self.verify_local_data(ecfr_codes, local_codes)
        
        # Step 5: Save results
        self.save_results(ecfr_codes, verification)
        
        print("\n" + "="*60)
        print("VERIFICATION COMPLETE")
        print("="*60)


if __name__ == '__main__':
    scraper = ECFRXMLScraper()
    scraper.run()
