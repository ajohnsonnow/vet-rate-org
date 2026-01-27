#!/usr/bin/env python3
"""
💎 CAVC Search Scraper (2007-2023 Gap Filler)
==============================================
Scrapes precedential CAVC panel decisions from search database for years 2007-2023.
This fills the 16-year gap between archive PDFs (1989-2006) and recent decisions (2024+).

Source: http://search.uscourts.cavc.gov/
Method: POST form submissions, year-by-year queries
Target: ~2,000-2,500 precedential panel opinions

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

# Configuration
SEARCH_URL = "http://search.uscourts.cavc.gov/search/"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "cavc" / "search_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Target years (16-year gap)
YEARS = list(range(2007, 2024))  # 2007 through 2023

# Request headers
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class CAVCSearchScraper:
    """Scraper for CAVC search database"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.results = []
    
    def search_year(self, year: int) -> Dict:
        """Search for precedential panel decisions in a specific year"""
        print(f"\n🔍 Searching year {year}...")
        
        # Form data for POST request
        form_data = {
            'IW_FIELD_WEB_STYLE': f'precedential {year}',
            'IW_DATABASE': 'PanelDecisions'  # Only panel decisions (precedential)
        }
        
        try:
            response = self.session.post(SEARCH_URL, data=form_data, timeout=30)
            response.raise_for_status()
            
            # Parse results
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract result count
            result_text = soup.find(text=re.compile(r'occurred \d+ times in \d+ documents'))
            if result_text:
                match = re.search(r'occurred (\d+) times in (\d+) documents', result_text)
                if match:
                    total_docs = int(match.group(2))
                    print(f"   ✅ Found {total_docs} documents for {year}")
                    
                    return {
                        'year': year,
                        'total_documents': total_docs,
                        'search_query': f'precedential {year}',
                        'html_content': response.text,
                        'timestamp': datetime.now().isoformat()
                    }
            
            print(f"   ⚠️  Could not parse results for {year}")
            return {'year': year, 'error': 'Parse failed'}
            
        except Exception as e:
            print(f"   ❌ Error searching {year}: {e}")
            return {'year': year, 'error': str(e)}
    
    def extract_case_links(self, html_content: str) -> List[Dict]:
        """Extract case document links from search results"""
        soup = BeautifulSoup(html_content, 'html.parser')
        cases = []
        
        # Find all case result rows
        for link in soup.find_all('a', href=re.compile(r'/isysquery/.*/doc/')):
            href = link.get('href')
            title = link.get_text(strip=True)
            
            # Extract case info from parent elements
            parent_row = link.find_parent('tr')
            if parent_row:
                date_elem = parent_row.find(text=re.compile(r'\d{1,2} [A-Z][a-z]{2} \d{4}'))
                date_str = date_elem.strip() if date_elem else None
                
                cases.append({
                    'title': title,
                    'url': f"http://search.uscourts.cavc.gov{href}",
                    'date': date_str
                })
        
        return cases
    
    def scrape_all_years(self) -> Dict:
        """Scrape all target years"""
        print("=" * 80)
        print("💎 CAVC SEARCH SCRAPER (2007-2023)")
        print("=" * 80)
        print(f"Target: {len(YEARS)} years ({YEARS[0]}-{YEARS[-1]})")
        print()
        
        all_results = {
            'years': {},
            'summary': {
                'total_years_searched': 0,
                'total_documents_found': 0,
                'years_completed': [],
                'years_failed': []
            }
        }
        
        for year in YEARS:
            result = self.search_year(year)
            all_results['years'][year] = result
            
            if 'error' not in result:
                all_results['summary']['total_years_searched'] += 1
                all_results['summary']['total_documents_found'] += result.get('total_documents', 0)
                all_results['summary']['years_completed'].append(year)
                
                # Save individual year results
                year_file = OUTPUT_DIR / f"cavc_search_{year}.json"
                with open(year_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
            else:
                all_results['summary']['years_failed'].append(year)
            
            # Be polite - rate limiting
            time.sleep(2)
        
        return all_results
    
    def generate_report(self, results: Dict):
        """Generate summary report"""
        print("\n" + "=" * 80)
        print("📊 SCRAPING SUMMARY")
        print("=" * 80)
        
        summary = results['summary']
        print(f"\n✅ Years Successfully Searched: {summary['total_years_searched']}/{len(YEARS)}")
        print(f"📚 Total Documents Found: {summary['total_documents_found']:,}")
        print(f"📅 Years Completed: {', '.join(map(str, summary['years_completed']))}")
        
        if summary['years_failed']:
            print(f"❌ Years Failed: {', '.join(map(str, summary['years_failed']))}")
        
        # Breakdown by year
        print(f"\n📊 Documents by Year:")
        for year in sorted(results['years'].keys()):
            year_data = results['years'][year]
            if 'total_documents' in year_data:
                count = year_data['total_documents']
                print(f"   {year}: {count:4d} documents")
        
        # Estimated precedential opinions
        avg_per_year = summary['total_documents_found'] / summary['total_years_searched'] if summary['total_years_searched'] > 0 else 0
        print(f"\n💎 Average per year: {avg_per_year:.0f} documents")
        print(f"💎 Estimated precedential opinions: {summary['total_documents_found']:,}")
        
        # Save master results
        master_file = OUTPUT_DIR / "cavc_search_master_2007_2023.json"
        with open(master_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Master results saved: {master_file.name}")
        print(f"📁 Individual year files: {OUTPUT_DIR}")
        
        print("\n" + "=" * 80)
        print("✅ SEARCH SCRAPING COMPLETE!")
        print("=" * 80)
        print("\nNext Steps:")
        print("1. Parse HTML for each year to extract individual case links")
        print("2. Download PDF/document for each case")
        print("3. Extract case metadata (case number, parties, holdings)")
        print("4. Convert to DKB format")
        print("5. Integrate into production KB")


def main():
    """Main execution"""
    scraper = CAVCSearchScraper()
    results = scraper.scrape_all_years()
    scraper.generate_report(results)


if __name__ == "__main__":
    main()
