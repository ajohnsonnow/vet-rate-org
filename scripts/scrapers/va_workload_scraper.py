#!/usr/bin/env python3
"""
VA Workload Report Scraper
==========================

Fetches and parses VA Monday Morning Workload Reports (MMWR) and 
detailed claims data from official VA sources.

Sources:
- https://www.benefits.va.gov/REPORTS/mmwr/index.asp
- https://www.benefits.va.gov/REPORTS/detailed_claims_data.asp

These reports contain:
- Claims pending counts
- Processing times by Regional Office
- Rating vs non-rating claims
- Supplemental claims data
- Appeals inventory

Usage:
    python va_workload_scraper.py --latest
    python va_workload_scraper.py --historical --months 6
    python va_workload_scraper.py --regional-compare
"""

import json
import os
import re
import time
import random
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from collections import defaultdict

try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPING_AVAILABLE = True
except ImportError:
    SCRAPING_AVAILABLE = False
    print("⚠️ Install required packages: pip install requests beautifulsoup4")

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("⚠️ Install pandas for Excel parsing: pip install pandas openpyxl")

# Configuration
VA_REPORTS_BASE = "https://www.benefits.va.gov/REPORTS"
MMWR_URL = f"{VA_REPORTS_BASE}/mmwr/index.asp"
DETAILED_CLAIMS_URL = f"{VA_REPORTS_BASE}/detailed_claims_data.asp"
OUTPUT_DIR = Path("src/data/va_workload")

HEADERS = {
    "User-Agent": "VetRateResearch/1.0 (https://vet-rate.org; Educational research)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

MIN_DELAY = 1
MAX_DELAY = 3


class VAWorkloadScraper:
    """Scrapes VA workload reports."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
    
    def _delay(self):
        """Respectful delay."""
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
    
    def get_available_reports(self) -> List[Dict]:
        """Get list of available workload reports."""
        if not SCRAPING_AVAILABLE:
            return []
        
        print("🔍 Finding available VA workload reports...")
        
        reports = []
        
        try:
            response = self.session.get(MMWR_URL)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find Excel/PDF links
            for link in soup.select('a[href*=".xls"], a[href*=".xlsx"], a[href*=".pdf"]'):
                href = link.get('href', '')
                if not href.startswith('http'):
                    href = f"{VA_REPORTS_BASE}/{href.lstrip('/')}"
                
                text = link.get_text(strip=True)
                
                # Extract date from filename or text
                date_match = re.search(r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2})', href + text)
                
                reports.append({
                    'url': href,
                    'name': text,
                    'date': date_match.group(1) if date_match else None,
                    'type': 'excel' if 'xls' in href else 'pdf'
                })
            
            print(f"  📄 Found {len(reports)} reports")
            
        except Exception as e:
            print(f"❌ Error: {e}")
        
        return reports
    
    def download_report(self, report_url: str, save_dir: Path) -> Optional[Path]:
        """Download a workload report file."""
        save_dir.mkdir(parents=True, exist_ok=True)
        
        filename = report_url.split('/')[-1]
        filepath = save_dir / filename
        
        if filepath.exists():
            print(f"  ⏭️ Already exists: {filename}")
            return filepath
        
        try:
            self._delay()
            response = self.session.get(report_url)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            print(f"  ✅ Downloaded: {filename}")
            return filepath
            
        except Exception as e:
            print(f"  ❌ Download failed: {e}")
            return None
    
    def parse_excel_report(self, filepath: Path) -> Optional[Dict]:
        """Parse an Excel workload report."""
        if not PANDAS_AVAILABLE:
            print("❌ pandas not available for Excel parsing")
            return None
        
        try:
            # Try reading as Excel
            if filepath.suffix in ['.xls', '.xlsx']:
                xls = pd.ExcelFile(filepath)
                
                data = {
                    'filename': filepath.name,
                    'sheets': {},
                    'summary': {},
                    'parsed_date': datetime.now().isoformat()
                }
                
                for sheet_name in xls.sheet_names:
                    df = pd.read_excel(xls, sheet_name=sheet_name)
                    
                    # Convert to records, handling NaN
                    records = df.where(pd.notnull(df), None).to_dict('records')
                    data['sheets'][sheet_name] = {
                        'columns': list(df.columns),
                        'row_count': len(df),
                        'sample': records[:5]  # First 5 rows as sample
                    }
                    
                    # Extract key metrics
                    self._extract_metrics(df, sheet_name, data['summary'])
                
                return data
                
        except Exception as e:
            print(f"❌ Parse error: {e}")
            return None
    
    def _extract_metrics(self, df: pd.DataFrame, sheet_name: str, summary: Dict):
        """Extract key metrics from a dataframe."""
        columns_lower = [str(c).lower() for c in df.columns]
        
        # Look for common metric columns
        metric_patterns = {
            'pending_claims': ['pending', 'inventory', 'backlog'],
            'processing_days': ['days', 'acd', 'average', 'processing time'],
            'completed': ['completed', 'decided', 'granted', 'denied'],
            'regional_office': ['ro', 'station', 'regional', 'office']
        }
        
        for metric, patterns in metric_patterns.items():
            for i, col in enumerate(columns_lower):
                if any(p in col for p in patterns):
                    # Found a relevant column
                    col_name = df.columns[i]
                    try:
                        if df[col_name].dtype in ['int64', 'float64']:
                            summary[f"{sheet_name}_{metric}"] = {
                                'column': col_name,
                                'total': float(df[col_name].sum()) if pd.notnull(df[col_name].sum()) else None,
                                'mean': float(df[col_name].mean()) if pd.notnull(df[col_name].mean()) else None,
                                'min': float(df[col_name].min()) if pd.notnull(df[col_name].min()) else None,
                                'max': float(df[col_name].max()) if pd.notnull(df[col_name].max()) else None,
                            }
                    except:
                        pass
                    break
    
    def get_claims_processing_times(self) -> Dict:
        """
        Scrape current claims processing times from VA website.
        
        Returns average days to complete by claim type.
        """
        print("⏱️ Getting current VA processing times...")
        
        processing_url = "https://www.va.gov/claim-or-appeal-status/"
        
        try:
            response = self.session.get(processing_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            times = {}
            
            # Look for processing time elements
            for elem in soup.select('.processing-time, .average-time, [data-average-days]'):
                text = elem.get_text(strip=True)
                days_match = re.search(r'(\d+(?:\.\d+)?)\s*days?', text, re.I)
                if days_match:
                    # Try to determine claim type
                    parent_text = elem.parent.get_text() if elem.parent else ""
                    
                    if 'supplemental' in parent_text.lower():
                        times['supplemental_claim'] = float(days_match.group(1))
                    elif 'higher' in parent_text.lower() or 'hlr' in parent_text.lower():
                        times['higher_level_review'] = float(days_match.group(1))
                    elif 'board' in parent_text.lower() or 'bva' in parent_text.lower():
                        times['board_appeal'] = float(days_match.group(1))
                    elif 'original' in parent_text.lower() or 'initial' in parent_text.lower():
                        times['original_claim'] = float(days_match.group(1))
            
            return times
            
        except Exception as e:
            print(f"❌ Error: {e}")
            return {}


class VAOpenDataFetcher:
    """Fetches data from VA Open Data Portal."""
    
    BASE_URL = "https://api.va.gov/services"
    DATA_GOV_URL = "https://www.data.va.gov/api/views"
    
    # Known dataset IDs
    DATASETS = {
        'compensation_recipients': 'veteran-compensation-recipient-county',
        'claims_inventory': 'claims-backlog-inventory',
        'regional_processing': 'regional-office-processing',
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
    
    def list_available_datasets(self) -> List[Dict]:
        """List available datasets from data.va.gov."""
        print("📊 Listing VA Open Data datasets...")
        
        # Search endpoint
        search_url = "https://www.data.va.gov/api/catalog/v1"
        
        try:
            # Note: This is a public API but may require registration for heavy use
            response = self.session.get(f"{search_url}?q=compensation&per_page=50")
            
            if response.status_code == 200:
                data = response.json()
                datasets = data.get('results', [])
                
                print(f"  📄 Found {len(datasets)} datasets")
                return datasets
            else:
                print(f"  ⚠️ API returned {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return []
    
    def fetch_dataset(self, dataset_id: str, format: str = 'json') -> Optional[Dict]:
        """Fetch a specific dataset."""
        print(f"📥 Fetching dataset: {dataset_id}")
        
        # data.va.gov uses Socrata API
        url = f"https://www.data.va.gov/resource/{dataset_id}.{format}"
        
        try:
            response = self.session.get(url, params={'$limit': 10000})
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"  ⚠️ Status {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return None


def generate_js_update(workload_data: Dict, output_file: Path):
    """
    Generate JavaScript code to update bvaSuccessData.js with new stats.
    
    This creates a snippet that can be reviewed and merged.
    """
    
    js_content = f"""// VA Workload Data Update
// Generated: {datetime.now().isoformat()}
// Source: VA Monday Morning Workload Reports

export const VA_PROCESSING_STATS = {{
  lastUpdated: "{datetime.now().strftime('%Y-%m-%d')}",
  source: "VA Benefits Reports",
  
  // Claims Processing Times (days)
  processingTimes: {{
    originalClaim: {workload_data.get('original_claim', 125)},
    supplementalClaim: {workload_data.get('supplemental_claim', 46)},
    higherLevelReview: {workload_data.get('higher_level_review', 89)},
    boardAppeal: {{
      directReview: {workload_data.get('board_direct', 365)},
      evidenceSubmission: {workload_data.get('board_evidence', 547)},
      hearing: {workload_data.get('board_hearing', 912)}
    }}
  }},
  
  // Backlog/Inventory
  inventory: {{
    totalPending: {workload_data.get('total_pending', 450000)},
    rating: {workload_data.get('rating_pending', 280000)},
    nonRating: {workload_data.get('non_rating_pending', 170000)},
  }},
}};
"""
    
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w') as f:
        f.write(js_content)
    
    print(f"✅ Generated JS update: {output_file}")


def main():
    parser = argparse.ArgumentParser(description='Scrape VA workload reports')
    parser.add_argument('--latest', action='store_true', help='Get latest report')
    parser.add_argument('--historical', action='store_true', help='Get historical reports')
    parser.add_argument('--months', type=int, default=3, help='Months of history')
    parser.add_argument('--processing-times', action='store_true', help='Get current processing times')
    parser.add_argument('--open-data', action='store_true', help='Fetch from VA Open Data')
    parser.add_argument('--generate-js', action='store_true', help='Generate JS update file')
    
    args = parser.parse_args()
    
    scraper = VAWorkloadScraper()
    
    if args.processing_times:
        times = scraper.get_claims_processing_times()
        print("\n⏱️ Current VA Processing Times:")
        for claim_type, days in times.items():
            print(f"  • {claim_type}: {days} days")
        
        if args.generate_js:
            generate_js_update(times, OUTPUT_DIR / "va_stats_update.js")
        
        return
    
    if args.open_data:
        fetcher = VAOpenDataFetcher()
        datasets = fetcher.list_available_datasets()
        
        for ds in datasets[:10]:  # First 10
            print(f"\n  📊 {ds.get('title', 'Unknown')}")
            print(f"     ID: {ds.get('identifier', 'N/A')}")
        
        return
    
    # Default: get available reports
    reports = scraper.get_available_reports()
    
    if not reports:
        print("❌ No reports found")
        return
    
    # Download latest
    if args.latest and reports:
        latest = reports[0]  # Assuming sorted by date
        print(f"\n📥 Downloading latest report: {latest['name']}")
        
        filepath = scraper.download_report(latest['url'], OUTPUT_DIR / "raw")
        
        if filepath and filepath.suffix in ['.xls', '.xlsx']:
            data = scraper.parse_excel_report(filepath)
            if data:
                # Save parsed data
                json_path = OUTPUT_DIR / f"{filepath.stem}_parsed.json"
                with open(json_path, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
                print(f"✅ Saved parsed data: {json_path}")
                
                # Print summary
                print("\n📊 REPORT SUMMARY:")
                for key, value in data.get('summary', {}).items():
                    print(f"  • {key}:")
                    if isinstance(value, dict):
                        for k, v in value.items():
                            print(f"      {k}: {v}")
    
    # Download historical
    if args.historical:
        print(f"\n📥 Downloading last {args.months} months of reports...")
        
        downloaded = []
        for report in reports:
            if len(downloaded) >= args.months * 4:  # ~4 reports per month
                break
            
            filepath = scraper.download_report(report['url'], OUTPUT_DIR / "raw")
            if filepath:
                downloaded.append(filepath)
        
        print(f"\n✅ Downloaded {len(downloaded)} reports")


if __name__ == "__main__":
    main()
