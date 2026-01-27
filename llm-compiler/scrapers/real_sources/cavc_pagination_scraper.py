#!/usr/bin/env python3
"""
💎 CAVC Full Pagination Scraper (2007-2023)
===========================================
Fetches ALL pages of CAVC search results for each year.
Downloads all 2,275 precedential panel decisions.

Phase 2B: Complete pagination coverage
Target: ALL cases, not just first page

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
SEARCH_URL = "http://search.uscourts.cavc.gov/search/"
BASE_URL = "http://search.uscourts.cavc.gov"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "paginated_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

YEARS = list(range(2007, 2024))  # 2007-2023

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class CAVCPaginationScraper:
    """Complete pagination scraper for CAVC search"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
    
    def get_initial_search(self, year: int) -> tuple[str, int, str]:
        """Get initial search page and extract query ID"""
        form_data = {
            'IW_FIELD_WEB_STYLE': f'precedential {year}',
            'IW_DATABASE': 'PanelDecisions'
        }
        
        try:
            response = self.session.post(SEARCH_URL, data=form_data, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract total documents
            result_text = soup.find(string=re.compile(r'occurred \d+ times in (\d+) documents'))
            total_docs = 0
            if result_text:
                match = re.search(r'in (\d+) documents', result_text)
                if match:
                    total_docs = int(match.group(1))
            
            # Extract query ID from pagination links
            query_id = None
            pagination_link = soup.find('a', href=re.compile(r'/isysquery/[a-f0-9-]+/'))
            if pagination_link:
                href = pagination_link.get('href', '')
                id_match = re.search(r'/isysquery/([a-f0-9-]+)/', href)
                if id_match:
                    query_id = id_match.group(1)
            
            return response.text, total_docs, query_id
            
        except Exception as e:
            print(f"   ❌ Error getting initial search for {year}: {e}")
            return None, 0, None
    
    def get_page(self, query_id: str, start: int, end: int) -> Optional[str]:
        """Fetch a specific page of results"""
        url = f"{BASE_URL}/isysquery/{query_id}/{start}-{end}/list/"
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"      ⚠️  Error fetching page {start}-{end}: {e}")
            return None
    
    def extract_cases_from_html(self, html: str, year: int) -> List[Dict]:
        """Extract all case links from HTML"""
        soup = BeautifulSoup(html, 'html.parser')
        cases = []
        
        for link in soup.find_all('a', href=re.compile(r'/isysquery/.*/doc/')):
            href = link.get('href', '')
            title = link.get_text(strip=True)
            
            # Build full URL
            if not href.startswith('http'):
                href = f"{BASE_URL}{href}"
            
            # Extract date from parent
            parent_row = link.find_parent('tr')
            date_str = None
            if parent_row:
                date_elem = parent_row.find(string=re.compile(r'\d{1,2} [A-Z][a-z]{2} \d{4}'))
                if date_elem:
                    date_str = date_elem.strip()
            
            # Extract case number
            case_num_match = re.search(r'(\d{2})-(\d{4})', href + title)
            case_number = f"{case_num_match.group(1)}-{case_num_match.group(2)}" if case_num_match else None
            
            if not case_number:
                # Fallback - use index
                case_number = f"{year}_{len(cases):04d}"
            
            cases.append({
                'case_number': case_number,
                'title': title,
                'url': href,
                'date': date_str,
                'year': year
            })
        
        return cases
    
    def scrape_year_complete(self, year: int) -> List[Dict]:
        """Scrape all pages for a specific year"""
        print(f"\n📅 {year}:")
        
        # Get initial page
        html, total_docs, query_id = self.get_initial_search(year)
        
        if not html or not query_id:
            print(f"   ❌ Failed to get initial search")
            return []
        
        print(f"   📚 Total documents: {total_docs}")
        print(f"   🔑 Query ID: {query_id}")
        
        # Extract cases from first page
        all_cases = self.extract_cases_from_html(html, year)
        print(f"   ✅ Page 1: {len(all_cases)} cases")
        
        # Calculate total pages (20 results per page)
        results_per_page = 20
        total_pages = (total_docs + results_per_page - 1) // results_per_page
        
        # Fetch remaining pages
        if total_pages > 1:
            for page_num in range(2, total_pages + 1):
                start = (page_num - 1) * results_per_page + 1
                end = min(page_num * results_per_page, total_docs)
                
                page_html = self.get_page(query_id, start, end)
                
                if page_html:
                    page_cases = self.extract_cases_from_html(page_html, year)
                    all_cases.extend(page_cases)
                    print(f"   ✅ Page {page_num}: {len(page_cases)} cases (total: {len(all_cases)})")
                else:
                    print(f"   ⚠️  Page {page_num}: Failed")
                
                # Rate limiting
                time.sleep(1)
        
        print(f"   🎯 Year complete: {len(all_cases)}/{total_docs} cases")
        
        return all_cases
    
    def scrape_all_years(self) -> Dict:
        """Scrape all years with full pagination"""
        print("=" * 80)
        print("💎 CAVC FULL PAGINATION SCRAPER (2007-2023)")
        print("=" * 80)
        print(f"Target: ALL pages for {len(YEARS)} years")
        print()
        
        all_results = {
            'years': {},
            'summary': {
                'total_years': len(YEARS),
                'total_cases_found': 0,
                'cases_by_year': {}
            }
        }
        
        for year in YEARS:
            year_cases = self.scrape_year_complete(year)
            
            all_results['years'][year] = year_cases
            all_results['summary']['cases_by_year'][year] = len(year_cases)
            all_results['summary']['total_cases_found'] += len(year_cases)
            
            # Save individual year
            year_file = OUTPUT_DIR / f"cavc_all_cases_{year}.json"
            with open(year_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'year': year,
                    'total_cases': len(year_cases),
                    'cases': year_cases,
                    'timestamp': datetime.now().isoformat()
                }, f, indent=2, ensure_ascii=False)
            
            # Longer delay between years
            time.sleep(3)
        
        return all_results
    
    def generate_report(self, results: Dict):
        """Generate final report"""
        print("\n" + "=" * 80)
        print("📊 COMPLETE SCRAPING REPORT")
        print("=" * 80)
        
        summary = results['summary']
        print(f"\n✅ Total Cases Found: {summary['total_cases_found']:,}")
        print(f"📅 Years: {summary['total_years']}")
        
        print(f"\n📊 Cases by Year:")
        for year, count in sorted(summary['cases_by_year'].items()):
            print(f"   {year}: {count:4d} cases")
        
        # Save master file
        master_file = OUTPUT_DIR / "cavc_all_cases_2007_2023_master.json"
        with open(master_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Master file: {master_file.name}")
        print(f"📁 Individual files: {OUTPUT_DIR}")
        
        print("\n" + "=" * 80)
        print("✅ PAGINATION SCRAPING COMPLETE!")
        print("=" * 80)
        print(f"\nNext: Download and parse all {summary['total_cases_found']:,} cases")


def main():
    """Main execution"""
    scraper = CAVCPaginationScraper()
    results = scraper.scrape_all_years()
    scraper.generate_report(results)


if __name__ == "__main__":
    main()
