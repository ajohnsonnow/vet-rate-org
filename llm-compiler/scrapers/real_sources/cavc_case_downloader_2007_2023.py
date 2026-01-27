#!/usr/bin/env python3
"""
💎 CAVC Case Downloader & Parser (2007-2023)
============================================
Downloads and parses individual CAVC precedential opinions from search results.
Extracts case metadata, holdings, and converts to DKB format.

Phase 2 of CAVC gap filling project.
Target: 2,275 precedential panel opinions (2007-2023)

Author: VetRate Diamond Team
Created: 2026-01-26
"""

import re
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
SEARCH_RESULTS_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "search_results"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "downloaded_2007_2023"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PARSED_OUTPUT = OUTPUT_DIR / "parsed_cases.json"
DKB_OUTPUT = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "cavc_2007_2023_dkb_format.json"

# Request headers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Keyword scoring (reuse from previous parser)
KEYWORD_SCORES = {
    # Mental Health (highest priority)
    'ptsd': 100, 'post-traumatic stress': 100, 'post traumatic stress': 100,
    'depression': 90, 'anxiety': 90, 'bipolar': 90, 'schizophrenia': 90,
    'mental health': 85, 'psychiatric': 85, 'psychological': 80,
    
    # TDIU (high value)
    'tdiu': 95, 'total disability': 95, 'unemployability': 90,
    'individual unemployability': 95, 'schedular tdiu': 90,
    
    # Secondary conditions (critical for claims)
    'secondary': 85, 'secondary service connection': 90, 'aggravation': 80,
    'nexus': 90, 'causal relationship': 85, 'causally related': 85,
    
    # Service connection (fundamental)
    'service connection': 75, 'direct service connection': 80,
    'presumptive': 85, 'presumptive service connection': 90,
    
    # Rating increases
    'increased rating': 70, 'rating increase': 70, 'higher rating': 65,
    'extraschedular': 85, 'extra-schedular': 85,
    
    # Effective dates (money issues)
    'effective date': 75, 'earlier effective date': 85,
    'retroactive': 80, 'clear and unmistakable error': 95, 'cue': 95,
    
    # Evidence standards
    'benefit of the doubt': 70, 'reasonable doubt': 70,
    'equipoise': 75, 'medical opinion': 65, 'competent evidence': 70,
    
    # Special categories
    'agent orange': 80, 'pact act': 85, 'burn pit': 85,
    'gulf war': 75, 'radiation': 75, 'contaminated water': 80,
    
    # DIC (survivor benefits)
    'dependency and indemnity': 60, 'dic': 60, 'survivor benefits': 60,
    
    # Common conditions
    'diabetes': 50, 'heart disease': 50, 'cancer': 50,
    'back pain': 40, 'knee': 40, 'tinnitus': 40, 'hearing loss': 40,
    'sleep apnea': 55, 'migraine': 50, 'neuropathy': 55
}


class CAVCCaseDownloader:
    """Downloads and parses CAVC cases from search results"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.cases = []
        self.failed = []
    
    def load_search_results(self, year: int) -> List[Dict]:
        """Load search results for a specific year"""
        result_file = SEARCH_RESULTS_DIR / f"cavc_search_{year}.json"
        
        if not result_file.exists():
            print(f"   ⚠️  No results file for {year}")
            return []
        
        with open(result_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        html_content = data.get('html_content', '')
        if not html_content:
            return []
        
        # Extract case links from HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        cases = []
        
        # Find all case result rows
        for i, link in enumerate(soup.find_all('a', href=re.compile(r'/isysquery/.*/doc/')), 1):
            href = link.get('href', '')
            title = link.get_text(strip=True)
            
            # Build full URL
            if not href.startswith('http'):
                href = f"http://search.uscourts.cavc.gov{href}"
            
            # Extract date from parent row
            parent_row = link.find_parent('tr')
            date_str = None
            if parent_row:
                date_elem = parent_row.find(string=re.compile(r'\d{1,2} [A-Z][a-z]{2} \d{4}'))
                if date_elem:
                    date_str = date_elem.strip()
            
            # Extract case number from title or href
            case_num_match = re.search(r'(\d{2})-(\d{4})', href + title)
            case_number = f"{case_num_match.group(1)}-{case_num_match.group(2)}" if case_num_match else f"{year}_{i:04d}"
            
            cases.append({
                'case_number': case_number,
                'title': title,
                'url': href,
                'date': date_str,
                'year': year
            })
        
        return cases
    
    def download_case(self, case: Dict) -> Optional[Dict]:
        """Download a single case document"""
        try:
            response = self.session.get(case['url'], timeout=30)
            response.raise_for_status()
            
            # Try to extract text content
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove scripts, styles
            for element in soup(['script', 'style', 'nav', 'header', 'footer']):
                element.decompose()
            
            text = soup.get_text(separator='\n', strip=True)
            
            # Extract case metadata
            metadata = self.parse_case_text(text, case)
            metadata['url'] = case['url']
            metadata['download_status'] = 'success'
            
            return metadata
            
        except Exception as e:
            return {
                'case_number': case['case_number'],
                'url': case['url'],
                'download_status': 'failed',
                'error': str(e)
            }
    
    def parse_case_text(self, text: str, case: Dict) -> Dict:
        """Parse case text for metadata and holdings"""
        # Extract veteran name
        veteran_match = re.search(r'([A-Z][A-Z\s]+)\s+v\.\s+', text[:500])
        veteran_name = veteran_match.group(1).strip() if veteran_match else "Unknown"
        
        # Extract diagnostic codes
        dc_pattern = r'(?:DC|Code|§\s*4\.)\s*(\d{4})'
        diagnostic_codes = list(set(re.findall(dc_pattern, text)))
        
        # Extract CFR citations
        cfr_pattern = r'38\s+C\.?F\.?R\.?\s+§\s*(\d+\.\d+)'
        cfr_citations = list(set(re.findall(cfr_pattern, text)))
        
        # Calculate relevance score
        relevance_score = self.score_case_relevance(text)
        
        # Categorize case
        categories = self.categorize_case(text)
        
        # Extract holding (look for conclusion/held/holding sections)
        holding = self.extract_holding(text)
        
        return {
            'case_number': case['case_number'],
            'veteran_name': veteran_name,
            'year': case.get('year'),
            'date': case.get('date'),
            'title': case.get('title', ''),
            'diagnostic_codes': diagnostic_codes,
            'cfr_citations': cfr_citations,
            'relevance_score': relevance_score,
            'categories': categories,
            'holding': holding,
            'text_length': len(text)
        }
    
    def score_case_relevance(self, text: str) -> int:
        """Score case relevance based on keywords"""
        text_lower = text.lower()
        score = 0
        
        for keyword, points in KEYWORD_SCORES.items():
            if keyword in text_lower:
                # Count occurrences (max 5 per keyword)
                count = min(text_lower.count(keyword), 5)
                score += points * count
        
        return score
    
    def categorize_case(self, text: str) -> List[str]:
        """Categorize case by issue type"""
        text_lower = text.lower()
        categories = []
        
        # Mental Health
        if any(term in text_lower for term in ['ptsd', 'depression', 'anxiety', 'mental health', 'psychiatric']):
            categories.append('Mental Health')
        
        # TDIU
        if any(term in text_lower for term in ['tdiu', 'unemployability', 'total disability']):
            categories.append('TDIU')
        
        # Secondary Conditions
        if any(term in text_lower for term in ['secondary', 'aggravation', 'nexus']):
            categories.append('Secondary Conditions')
        
        # Service Connection
        if any(term in text_lower for term in ['service connection', 'direct service', 'presumptive']):
            categories.append('Service Connection')
        
        # Rating Issues
        if any(term in text_lower for term in ['increased rating', 'rating increase', 'extraschedular']):
            categories.append('Rating Increase')
        
        # Effective Date
        if any(term in text_lower for term in ['effective date', 'retroactive', 'earlier effective']):
            categories.append('Effective Date')
        
        # CUE
        if any(term in text_lower for term in ['clear and unmistakable error', 'cue']):
            categories.append('CUE')
        
        # DIC
        if any(term in text_lower for term in ['dependency and indemnity', 'dic', 'survivor']):
            categories.append('DIC/Survivor Benefits')
        
        return categories if categories else ['General']
    
    def extract_holding(self, text: str) -> str:
        """Extract court's holding/conclusion"""
        # Look for conclusion sections
        for pattern in [
            r'(?:HELD|CONCLUSION|DECISION)[\s\S]{0,50}?[:\n]\s*(.{100,500}?)(?:\n\n|ORDERED)',
            r'(?:the Court holds?|we hold|Court concludes?)[\s\S]{0,20}?that\s+(.{50,300}?)(?:\.|;)',
            r'(?:remand|affirm|reverse|vacate)(?:ed|s)?\s+(?:the|to|for)(.{50,200}?)(?:\.|;)'
        ]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                holding = match.group(1).strip()
                # Clean up
                holding = re.sub(r'\s+', ' ', holding)
                if len(holding) > 50:
                    return holding[:500]
        
        return "See opinion text"
    
    def process_all_years(self, max_workers: int = 5):
        """Process all years with parallel downloads"""
        print("=" * 80)
        print("💎 CAVC CASE DOWNLOADER & PARSER (2007-2023)")
        print("=" * 80)
        
        # Load all case links from search results
        all_cases = []
        for year in range(2007, 2024):
            year_cases = self.load_search_results(year)
            all_cases.extend(year_cases)
            print(f"📥 {year}: {len(year_cases)} cases loaded")
        
        print(f"\n✅ Total cases to download: {len(all_cases)}")
        print(f"⚙️  Using {max_workers} parallel workers")
        print()
        
        # Download cases in parallel
        parsed_cases = []
        failed_cases = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(self.download_case, case): case for case in all_cases}
            
            for i, future in enumerate(as_completed(futures), 1):
                result = future.result()
                
                if result.get('download_status') == 'success':
                    parsed_cases.append(result)
                else:
                    failed_cases.append(result)
                
                # Progress update
                if i % 50 == 0:
                    print(f"   Progress: {i}/{len(all_cases)} cases ({i/len(all_cases)*100:.1f}%)")
        
        print(f"\n✅ Downloaded: {len(parsed_cases)}")
        print(f"❌ Failed: {len(failed_cases)}")
        
        # Save parsed cases
        output_data = {
            'generated_at': datetime.now().isoformat(),
            'total_cases': len(parsed_cases),
            'year_range': '2007-2023',
            'cases': parsed_cases
        }
        
        with open(PARSED_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Parsed cases saved: {PARSED_OUTPUT}")
        
        # Generate statistics
        self.generate_stats(parsed_cases)
        
        return parsed_cases
    
    def generate_stats(self, cases: List[Dict]):
        """Generate statistics report"""
        print("\n" + "=" * 80)
        print("📊 CASE STATISTICS")
        print("=" * 80)
        
        # Top cases by relevance
        sorted_cases = sorted(cases, key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        print(f"\n🏆 TOP 10 HIGHEST-VALUE CASES:")
        for i, case in enumerate(sorted_cases[:10], 1):
            print(f"{i}. {case['veteran_name']} ({case['case_number']}) - Score: {case['relevance_score']}")
            print(f"   Categories: {', '.join(case['categories'][:3])}")
        
        # Category breakdown
        category_counts = {}
        for case in cases:
            for cat in case.get('categories', []):
                category_counts[cat] = category_counts.get(cat, 0) + 1
        
        print(f"\n📋 CASES BY CATEGORY:")
        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat}: {count} cases")
        
        # Score distribution
        ultra_high = sum(1 for c in cases if c.get('relevance_score', 0) >= 500)
        high = sum(1 for c in cases if 300 <= c.get('relevance_score', 0) < 500)
        medium = sum(1 for c in cases if 100 <= c.get('relevance_score', 0) < 300)
        low = sum(1 for c in cases if c.get('relevance_score', 0) < 100)
        
        print(f"\n📈 SCORE DISTRIBUTION:")
        print(f"   500+: {ultra_high} cases (ULTRA HIGH VALUE)")
        print(f"   300-499: {high} cases (HIGH VALUE)")
        print(f"   100-299: {medium} cases (MEDIUM VALUE)")
        print(f"   0-99: {low} cases (LOWER VALUE)")


def main():
    """Main execution"""
    downloader = CAVCCaseDownloader()
    cases = downloader.process_all_years(max_workers=3)  # Conservative to avoid rate limiting
    
    print("\n" + "=" * 80)
    print("✅ DOWNLOAD & PARSING COMPLETE!")
    print("=" * 80)
    print("\nNext: Convert to DKB format and integrate into production KB")


if __name__ == "__main__":
    main()
