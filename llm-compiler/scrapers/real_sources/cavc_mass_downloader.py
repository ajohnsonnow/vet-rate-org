#!/usr/bin/env python3
"""
💎 CAVC Mass Downloader & Parser - FULL COLLECTION
==================================================
Downloads and parses ALL 4,210+ CAVC cases from paginated results (2007-2023).
Automatically deduplicates, extracts metadata, scores relevance.

This is the BIG ONE - complete CAVC gap filling!

Author: VetRate Diamond Team
Created: 2026-01-26
"""

import re
import json
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Set
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
PAGINATED_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "paginated_results"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "full_download_2007_2023"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PARSED_OUTPUT = OUTPUT_DIR / "all_parsed_cases.json"
PROGRESS_FILE = OUTPUT_DIR / "download_progress.json"

# Request headers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Keyword scoring (comprehensive veteran-focused)
KEYWORD_SCORES = {
    'ptsd': 100, 'post-traumatic stress': 100, 'depression': 90, 'anxiety': 90,
    'bipolar': 90, 'schizophrenia': 90, 'mental health': 85, 'psychiatric': 85,
    'tdiu': 95, 'total disability': 95, 'unemployability': 90,
    'secondary': 85, 'secondary service connection': 90, 'aggravation': 80,
    'nexus': 90, 'causal relationship': 85,
    'service connection': 75, 'direct service connection': 80, 'presumptive': 85,
    'increased rating': 70, 'rating increase': 70, 'extraschedular': 85,
    'effective date': 75, 'earlier effective date': 85, 'retroactive': 80,
    'clear and unmistakable error': 95, 'cue': 95,
    'benefit of the doubt': 70, 'reasonable doubt': 70, 'equipoise': 75,
    'agent orange': 80, 'pact act': 85, 'burn pit': 85, 'gulf war': 75,
    'dependency and indemnity': 60, 'dic': 60, 'survivor benefits': 60,
    'diabetes': 50, 'heart disease': 50, 'cancer': 50, 'sleep apnea': 55,
    'tinnitus': 40, 'hearing loss': 40, 'neuropathy': 55, 'migraine': 50
}


class CAVCMassDownloader:
    """Mass downloader for all CAVC cases"""
    
    def __init__(self, max_workers: int = 5):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.max_workers = max_workers
        self.downloaded_urls: Set[str] = set()
        self.progress = {'completed': 0, 'failed': 0, 'total': 0}
    
    def load_all_cases(self) -> List[Dict]:
        """Load all cases from paginated results"""
        print("📥 Loading all paginated case links...")
        
        all_cases = []
        case_numbers_seen = set()
        
        # Load from individual year files
        for year in range(2007, 2024):
            year_file = PAGINATED_DIR / f"cavc_all_cases_{year}.json"
            
            if year_file.exists():
                with open(year_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    year_cases = data.get('cases', [])
                    
                    # Deduplicate by case number
                    unique_cases = []
                    for case in year_cases:
                        case_num = case.get('case_number')
                        if case_num and case_num not in case_numbers_seen:
                            case_numbers_seen.add(case_num)
                            unique_cases.append(case)
                    
                    all_cases.extend(unique_cases)
                    print(f"   {year}: {len(unique_cases)} unique cases (from {len(year_cases)} total)")
        
        print(f"\n✅ Loaded {len(all_cases)} unique cases (deduplicated from 4,210)")
        return all_cases
    
    def download_case(self, case: Dict) -> Optional[Dict]:
        """Download and parse a single case"""
        url = case.get('url')
        
        # Skip if already downloaded
        if url in self.downloaded_urls:
            return None
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer']):
                element.decompose()
            
            text = soup.get_text(separator='\n', strip=True)
            
            # Parse metadata
            metadata = self.parse_case_text(text, case)
            metadata['url'] = url
            metadata['download_status'] = 'success'
            metadata['download_timestamp'] = datetime.now().isoformat()
            
            self.downloaded_urls.add(url)
            return metadata
            
        except Exception as e:
            return {
                'case_number': case.get('case_number'),
                'url': url,
                'download_status': 'failed',
                'error': str(e),
                'download_timestamp': datetime.now().isoformat()
            }
    
    def parse_case_text(self, text: str, case: Dict) -> Dict:
        """Parse case text for metadata"""
        # Extract veteran name
        veteran_match = re.search(r'([A-Z][A-Z\s]+)\s+v\.\s+', text[:500])
        veteran_name = veteran_match.group(1).strip() if veteran_match else case.get('title', 'Unknown')
        
        # Clean up veteran name
        if len(veteran_name) > 50 or not veteran_name.replace(' ', '').isalpha():
            veteran_name = "Unknown"
        
        # Extract diagnostic codes
        dc_pattern = r'(?:DC|Code|§\s*4\.)\s*(\d{4})'
        diagnostic_codes = list(set(re.findall(dc_pattern, text)))[:20]  # Limit to 20
        
        # Extract CFR citations
        cfr_pattern = r'38\s+C\.?F\.?R\.?\s+§\s*(\d+\.\d+)'
        cfr_citations = list(set(re.findall(cfr_pattern, text)))[:20]  # Limit to 20
        
        # Calculate relevance score
        relevance_score = self.score_case_relevance(text)
        
        # Categorize
        categories = self.categorize_case(text)
        
        # Extract holding
        holding = self.extract_holding(text)
        
        return {
            'case_number': case.get('case_number'),
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
        """Score case relevance"""
        text_lower = text.lower()
        score = 0
        
        for keyword, points in KEYWORD_SCORES.items():
            if keyword in text_lower:
                count = min(text_lower.count(keyword), 5)
                score += points * count
        
        return score
    
    def categorize_case(self, text: str) -> List[str]:
        """Categorize case by issue type"""
        text_lower = text.lower()
        categories = []
        
        if any(term in text_lower for term in ['ptsd', 'depression', 'anxiety', 'mental health', 'psychiatric']):
            categories.append('Mental Health')
        if any(term in text_lower for term in ['tdiu', 'unemployability', 'total disability']):
            categories.append('TDIU')
        if any(term in text_lower for term in ['secondary', 'aggravation', 'nexus']):
            categories.append('Secondary Conditions')
        if any(term in text_lower for term in ['service connection', 'direct service', 'presumptive']):
            categories.append('Service Connection')
        if any(term in text_lower for term in ['increased rating', 'rating increase', 'extraschedular']):
            categories.append('Rating Increase')
        if any(term in text_lower for term in ['effective date', 'retroactive', 'earlier effective']):
            categories.append('Effective Date')
        if any(term in text_lower for term in ['clear and unmistakable error', 'cue']):
            categories.append('CUE')
        if any(term in text_lower for term in ['dependency and indemnity', 'dic', 'survivor']):
            categories.append('DIC/Survivor Benefits')
        
        return categories if categories else ['General']
    
    def extract_holding(self, text: str) -> str:
        """Extract court's holding"""
        for pattern in [
            r'(?:HELD|CONCLUSION|DECISION)[\s\S]{0,50}?[:\n]\s*(.{100,500}?)(?:\n\n|ORDERED)',
            r'(?:the Court holds?|we hold|Court concludes?)[\s\S]{0,20}?that\s+(.{50,300}?)(?:\.|;)',
            r'(?:remand|affirm|reverse|vacate)(?:ed|s)?\s+(?:the|to|for)(.{50,200}?)(?:\.|;)'
        ]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                holding = match.group(1).strip()
                holding = re.sub(r'\s+', ' ', holding)
                if len(holding) > 50:
                    return holding[:500]
        
        return "See opinion text"
    
    def save_progress(self, parsed_cases: List[Dict]):
        """Save incremental progress"""
        progress_data = {
            'timestamp': datetime.now().isoformat(),
            'total_parsed': len(parsed_cases),
            'progress': self.progress
        }
        
        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            json.dump(progress_data, f, indent=2)
    
    def process_all_cases(self):
        """Download and parse all cases with parallel processing"""
        print("=" * 80)
        print("💎 CAVC MASS DOWNLOADER - COMPLETE COLLECTION (2007-2023)")
        print("=" * 80)
        
        # Load all cases
        all_cases = self.load_all_cases()
        self.progress['total'] = len(all_cases)
        
        print(f"\n⚙️  Using {self.max_workers} parallel workers")
        print(f"📊 Estimated time: ~{len(all_cases) // 60} minutes")
        print()
        
        parsed_cases = []
        failed_cases = []
        
        # Process in batches with progress saving
        batch_size = 100
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(self.download_case, case): case for case in all_cases}
            
            for i, future in enumerate(as_completed(futures), 1):
                result = future.result()
                
                if result:
                    if result.get('download_status') == 'success':
                        parsed_cases.append(result)
                        self.progress['completed'] += 1
                    else:
                        failed_cases.append(result)
                        self.progress['failed'] += 1
                
                # Progress updates every 50 cases
                if i % 50 == 0:
                    pct = (i / len(all_cases)) * 100
                    print(f"   Progress: {i}/{len(all_cases)} ({pct:.1f}%) | ✅ {len(parsed_cases)} | ❌ {len(failed_cases)}")
                
                # Save progress every batch
                if i % batch_size == 0:
                    self.save_progress(parsed_cases)
        
        print(f"\n✅ Downloaded: {len(parsed_cases)}")
        print(f"❌ Failed: {len(failed_cases)}")
        
        # Save final results
        output_data = {
            'generated_at': datetime.now().isoformat(),
            'total_cases': len(parsed_cases),
            'failed_cases': len(failed_cases),
            'year_range': '2007-2023',
            'source': 'CAVC Search Database - Full Pagination',
            'cases': parsed_cases
        }
        
        with open(PARSED_OUTPUT, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 All parsed cases saved: {PARSED_OUTPUT}")
        
        # Save failed cases separately
        if failed_cases:
            failed_file = OUTPUT_DIR / "failed_downloads.json"
            with open(failed_file, 'w', encoding='utf-8') as f:
                json.dump({'failed': failed_cases}, f, indent=2)
            print(f"⚠️  Failed cases saved: {failed_file}")
        
        # Generate statistics
        self.generate_stats(parsed_cases)
        
        return parsed_cases
    
    def generate_stats(self, cases: List[Dict]):
        """Generate comprehensive statistics"""
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE STATISTICS")
        print("=" * 80)
        
        # Top cases by relevance
        sorted_cases = sorted(cases, key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        print(f"\n🏆 TOP 20 HIGHEST-VALUE CASES:")
        for i, case in enumerate(sorted_cases[:20], 1):
            name = case['veteran_name'][:30]
            print(f"{i:2d}. {name} ({case['case_number']}) - Score: {case['relevance_score']}")
            if case.get('categories'):
                print(f"    {', '.join(case['categories'][:3])}")
        
        # Category breakdown
        category_counts = {}
        for case in cases:
            for cat in case.get('categories', []):
                category_counts[cat] = category_counts.get(cat, 0) + 1
        
        print(f"\n📋 CASES BY CATEGORY:")
        for cat, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat:30s} {count:4d} cases")
        
        # Score distribution
        ultra_high = sum(1 for c in cases if c.get('relevance_score', 0) >= 500)
        high = sum(1 for c in cases if 300 <= c.get('relevance_score', 0) < 500)
        medium = sum(1 for c in cases if 100 <= c.get('relevance_score', 0) < 300)
        low = sum(1 for c in cases if c.get('relevance_score', 0) < 100)
        
        print(f"\n📈 SCORE DISTRIBUTION:")
        print(f"   🔥 500+:     {ultra_high:4d} cases (ULTRA HIGH VALUE)")
        print(f"   ⭐ 300-499:  {high:4d} cases (HIGH VALUE)")
        print(f"   📊 100-299:  {medium:4d} cases (MEDIUM VALUE)")
        print(f"   📋 0-99:     {low:4d} cases (LOWER VALUE)")
        
        # Year breakdown
        year_counts = {}
        for case in cases:
            year = case.get('year')
            if year:
                year_counts[year] = year_counts.get(year, 0) + 1
        
        print(f"\n📅 CASES BY YEAR:")
        for year in sorted(year_counts.keys()):
            print(f"   {year}: {year_counts[year]:4d} cases")


def main():
    """Main execution"""
    print("\n🚀 Starting COMPLETE CAVC download...")
    print("   This will take approximately 30-60 minutes")
    print("   Progress is saved every 100 cases")
    print()
    
    downloader = CAVCMassDownloader(max_workers=5)
    cases = downloader.process_all_cases()
    
    print("\n" + "=" * 80)
    print("✅ MASS DOWNLOAD COMPLETE!")
    print("=" * 80)
    print(f"\n💎 {len(cases)} precedential CAVC opinions ready for DKB conversion!")
    print("\nNext: Convert to DKB format and integrate into production KB")


if __name__ == "__main__":
    main()
