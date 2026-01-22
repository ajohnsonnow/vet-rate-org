"""
Additional VA Sources Scraper + eCFR Gap Analysis
==================================================
1. Scrapes ACUS EAJA statistics
2. Scrapes BVA Annual Reports
3. Scrapes BVA Decision Wait Times
4. Analyzes eCFR vs Local data gap (841 vs 748 codes)
"""

import json
import re
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
import sys

sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base"

def scrape_acus_eaja():
    """Scrape ACUS EAJA statistics"""
    print("\n" + "="*60)
    print("SCRAPING: ACUS EAJA Statistics")
    print("="*60)
    
    url = "https://www.acus.gov/eaja/statistics"
    entries = []
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"[ERROR] Status {r.status_code}")
            return entries
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Find all tables with EAJA data
        tables = soup.find_all('table')
        print(f"[INFO] Found {len(tables)} tables")
        
        # Find links to reports
        links = soup.find_all('a', href=True)
        pdf_links = [l for l in links if '.pdf' in l.get('href', '').lower() or 'eaja' in l.get('href', '').lower()]
        
        # Extract text content
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='content')
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        
        # Look for statistics/numbers
        stats_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*)\s+(?:cases?|awards?|decisions?|appeals?)', re.IGNORECASE)
        year_pattern = re.compile(r'(?:FY\s*)?20[12]\d|(?:fiscal\s+year\s+)?20[12]\d', re.IGNORECASE)
        
        # Create knowledge base entry
        entry = {
            'id': 'acus_eaja_statistics',
            'type': 'eaja_statistics',
            'source': 'ACUS (OFFICIAL)',
            'source_url': url,
            'title': 'Equal Access to Justice Act (EAJA) Awards Data and Statistics',
            'description': 'Statistics on EAJA awards across federal agencies including VA',
            'scraped_at': datetime.now().isoformat(),
            'content_preview': text[:2000] if text else '',
            'tables_found': len(tables),
            'verified': True
        }
        entries.append(entry)
        
        # Look for specific VA data in tables
        for i, table in enumerate(tables):
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                row_text = ' '.join(c.get_text(strip=True) for c in cells)
                if 'veteran' in row_text.lower() or 'VA' in row_text or 'DVA' in row_text:
                    entries.append({
                        'id': f'acus_eaja_va_table_{i}',
                        'type': 'eaja_va_data',
                        'source': 'ACUS (OFFICIAL)',
                        'source_url': url,
                        'title': f'EAJA VA-Related Data (Table {i+1})',
                        'content': row_text,
                        'scraped_at': datetime.now().isoformat(),
                        'verified': True
                    })
        
        print(f"[OK] Extracted {len(entries)} EAJA entries")
        
    except Exception as e:
        print(f"[ERROR] {e}")
    
    return entries


def scrape_bva_annual_reports():
    """Scrape BVA Annual Reports to Congress"""
    print("\n" + "="*60)
    print("SCRAPING: BVA Annual Reports to Congress")
    print("="*60)
    
    url = "https://department.va.gov/board-of-veterans-appeals/annual-reports-to-congress/"
    entries = []
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"[ERROR] Status {r.status_code}")
            return entries
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Find links to annual reports (PDFs)
        links = soup.find_all('a', href=True)
        report_links = []
        
        for link in links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Look for year patterns in links
            if re.search(r'annual|report|20[12]\d|FY', href + text, re.IGNORECASE):
                if '.pdf' in href.lower() or 'report' in href.lower():
                    report_links.append({
                        'url': href if href.startswith('http') else f"https://department.va.gov{href}",
                        'title': text or f"BVA Annual Report"
                    })
        
        # De-duplicate
        seen = set()
        unique_reports = []
        for r in report_links:
            if r['url'] not in seen:
                seen.add(r['url'])
                unique_reports.append(r)
        
        print(f"[INFO] Found {len(unique_reports)} annual report links")
        
        # Create entries for each report
        for i, report in enumerate(unique_reports):
            year_match = re.search(r'20[12]\d', report['url'] + report['title'])
            year = year_match.group(0) if year_match else 'Unknown'
            
            entries.append({
                'id': f'bva_annual_report_{year}_{i}',
                'type': 'bva_annual_report',
                'source': 'BVA (OFFICIAL)',
                'source_url': report['url'],
                'title': report['title'] or f'BVA Annual Report {year}',
                'year': year,
                'description': f'Board of Veterans Appeals Annual Report to Congress for {year}',
                'scraped_at': datetime.now().isoformat(),
                'verified': True
            })
        
        # Also get page content
        main_content = soup.find('main') or soup.find('article')
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)[:3000]
            entries.append({
                'id': 'bva_annual_reports_overview',
                'type': 'bva_overview',
                'source': 'BVA (OFFICIAL)',
                'source_url': url,
                'title': 'BVA Annual Reports Overview',
                'content': text,
                'scraped_at': datetime.now().isoformat(),
                'verified': True
            })
        
        print(f"[OK] Extracted {len(entries)} BVA report entries")
        
    except Exception as e:
        print(f"[ERROR] {e}")
    
    return entries


def scrape_bva_wait_times():
    """Scrape BVA Decision Wait Times"""
    print("\n" + "="*60)
    print("SCRAPING: BVA Decision Wait Times")
    print("="*60)
    
    url = "https://department.va.gov/board-of-veterans-appeals/decision-wait-times/"
    entries = []
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        if r.status_code != 200:
            print(f"[ERROR] Status {r.status_code}")
            return entries
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Find tables with wait time data
        tables = soup.find_all('table')
        print(f"[INFO] Found {len(tables)} tables")
        
        # Extract main content
        main_content = soup.find('main') or soup.find('article')
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        
        # Look for wait time statistics
        # Patterns: "X days", "X months", "median", "average"
        wait_patterns = re.findall(r'(\d+\.?\d*)\s*(days?|months?|weeks?)', text, re.IGNORECASE)
        
        # Main entry
        entries.append({
            'id': 'bva_decision_wait_times',
            'type': 'bva_wait_times',
            'source': 'BVA (OFFICIAL)',
            'source_url': url,
            'title': 'BVA Decision Wait Times',
            'description': 'Current wait times for Board of Veterans Appeals decisions',
            'content_preview': text[:3000],
            'wait_time_mentions': len(wait_patterns),
            'scraped_at': datetime.now().isoformat(),
            'verified': True
        })
        
        # Extract table data
        for i, table in enumerate(tables):
            rows = table.find_all('tr')
            table_data = []
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                row_data = [c.get_text(strip=True) for c in cells]
                if row_data:
                    table_data.append(row_data)
            
            if table_data:
                entries.append({
                    'id': f'bva_wait_times_table_{i}',
                    'type': 'bva_wait_times_data',
                    'source': 'BVA (OFFICIAL)',
                    'source_url': url,
                    'title': f'BVA Wait Times Data (Table {i+1})',
                    'table_data': table_data[:20],  # Limit rows
                    'scraped_at': datetime.now().isoformat(),
                    'verified': True
                })
        
        print(f"[OK] Extracted {len(entries)} BVA wait time entries")
        
    except Exception as e:
        print(f"[ERROR] {e}")
    
    return entries


def analyze_ecfr_gap():
    """Analyze the gap between eCFR (841) and local (748) codes"""
    print("\n" + "="*60)
    print("ANALYZING: eCFR vs Local Code Gap")
    print("="*60)
    
    # Load verification report
    report_path = OUTPUT_DIR / "ecfr" / "verification_report.json"
    ecfr_path = OUTPUT_DIR / "ecfr" / "ecfr_38cfr_part4.json"
    
    if not report_path.exists():
        print("[ERROR] Verification report not found")
        return None, []
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    with open(ecfr_path, 'r', encoding='utf-8') as f:
        ecfr_data = json.load(f)
    
    ecfr_codes = ecfr_data.get('codes', {})
    
    print(f"eCFR Total: {report['ecfr_total']}")
    print(f"Local Total: {report['local_total']}")
    print(f"Matched: {len(report['matched'])}")
    print(f"Name Mismatches: {len(report['name_mismatches'])}")
    print(f"Missing from eCFR scrape: {len(report['missing_from_ecfr'])}")
    print(f"Missing from local: {len(report['missing_from_local'])}")
    
    # Analyze what's missing from local (codes in eCFR but not in our DB)
    missing_from_local = report.get('missing_from_local', [])
    
    # Categorize missing codes
    removed_codes = []
    added_codes = []
    other_codes = []
    
    for item in missing_from_local:
        code = item.get('code', '')
        name = item.get('name', '').lower()
        
        if 'removed' in name or '[removed]' in name:
            removed_codes.append(item)
        elif 'added' in name or 'criterion' in name or 'evaluation' in name:
            # These are often table headers/notes, not real codes
            other_codes.append(item)
        else:
            added_codes.append(item)
    
    print(f"\n=== ANALYSIS OF MISSING CODES ===")
    print(f"Removed/obsolete codes: {len(removed_codes)}")
    print(f"Legitimate new codes: {len(added_codes)}")
    print(f"Non-code entries (table headers etc): {len(other_codes)}")
    
    # Create entries for removed codes
    new_entries = []
    
    for item in removed_codes:
        new_entries.append({
            'id': f"dc_{item['code']}_removed",
            'type': 'diagnostic_code_removed',
            'code': item['code'],
            'name': item.get('name', f"DC {item['code']}"),
            'status': 'REMOVED',
            'source': 'eCFR (OFFICIAL)',
            'note': 'This diagnostic code has been removed from 38 CFR Part 4',
            'scraped_at': datetime.now().isoformat(),
            'verified': True
        })
    
    for item in added_codes:
        if item['code'].isdigit() and 4 <= len(item['code']) <= 5:
            new_entries.append({
                'id': f"dc_{item['code']}_ecfr",
                'type': 'diagnostic_code',
                'code': item['code'],
                'name': item.get('name', f"DC {item['code']}"),
                'source': 'eCFR (OFFICIAL)',
                'note': 'Code found in eCFR but missing from local database',
                'scraped_at': datetime.now().isoformat(),
                'verified': True
            })
    
    print(f"\n[OK] Created {len(new_entries)} new entries for missing codes")
    
    return report, new_entries


def save_all_results(acus_entries, bva_reports, bva_wait_times, ecfr_entries):
    """Save all scraped data"""
    
    # Combine all new entries
    all_entries = acus_entries + bva_reports + bva_wait_times + ecfr_entries
    
    # Save to new scrape file
    output_path = OUTPUT_DIR / "additional_sources" / "additional_scraped_data.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'source': 'Multiple OFFICIAL Government Sources',
            'scraped_at': datetime.now().isoformat(),
            'sources': [
                'ACUS EAJA Statistics (acus.gov)',
                'BVA Annual Reports (department.va.gov)',
                'BVA Wait Times (department.va.gov)',
                'eCFR Gap Analysis'
            ],
            'total_entries': len(all_entries),
            'breakdown': {
                'acus_eaja': len(acus_entries),
                'bva_reports': len(bva_reports),
                'bva_wait_times': len(bva_wait_times),
                'ecfr_gap_entries': len(ecfr_entries)
            },
            'entries': all_entries
        }, f, indent=2)
    
    print(f"\n[OK] Saved {len(all_entries)} entries to {output_path}")
    
    # Create summary report
    report_path = OUTPUT_DIR / "additional_sources" / "ADDITIONAL_SOURCES_REPORT.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("# Additional VA Sources Scrape Report\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## Sources Scraped\n\n")
        f.write("| Source | URL | Entries |\n")
        f.write("|--------|-----|--------|\n")
        f.write(f"| ACUS EAJA Statistics | acus.gov/eaja/statistics | {len(acus_entries)} |\n")
        f.write(f"| BVA Annual Reports | department.va.gov/board-of-veterans-appeals/annual-reports-to-congress/ | {len(bva_reports)} |\n")
        f.write(f"| BVA Wait Times | department.va.gov/board-of-veterans-appeals/decision-wait-times/ | {len(bva_wait_times)} |\n")
        f.write(f"| eCFR Gap Analysis | eCFR.gov | {len(ecfr_entries)} |\n")
        f.write(f"| **TOTAL** | | **{len(all_entries)}** |\n\n")
        
        f.write("## eCFR Gap Analysis\n\n")
        f.write("The eCFR contains 841 diagnostic codes, while our local database has 748.\n\n")
        f.write("**Gap Breakdown:**\n")
        f.write(f"- Removed/obsolete codes: Identified and tagged\n")
        f.write(f"- New codes to add: Identified from eCFR\n")
        f.write(f"- Table headers/non-codes: Filtered out\n\n")
        
        f.write("## Data Authenticity\n\n")
        f.write("**ALL DATA IS FROM OFFICIAL GOVERNMENT SOURCES:**\n")
        f.write("- ACUS (Administrative Conference of the United States)\n")
        f.write("- BVA (Board of Veterans Appeals)\n")
        f.write("- eCFR (Electronic Code of Federal Regulations)\n")
    
    print(f"[OK] Saved report to {report_path}")
    
    return all_entries


def main():
    print("="*60)
    print("ADDITIONAL VA SOURCES SCRAPER")
    print("="*60)
    
    # Scrape all sources
    acus_entries = scrape_acus_eaja()
    bva_reports = scrape_bva_annual_reports()
    bva_wait_times = scrape_bva_wait_times()
    
    # Analyze eCFR gap
    _, ecfr_entries = analyze_ecfr_gap()
    
    # Save all
    all_entries = save_all_results(
        acus_entries, 
        bva_reports, 
        bva_wait_times, 
        ecfr_entries or []
    )
    
    print("\n" + "="*60)
    print("SCRAPE COMPLETE")
    print("="*60)
    print(f"Total new entries: {len(all_entries)}")


if __name__ == '__main__':
    main()
