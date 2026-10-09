#!/usr/bin/env python3
"""
Master State Benefits Scraper
==============================

Orchestrates scraping of all 50 states + DC
Runs each state scraper and aggregates results
"""

import sys
import json
import logging
import os
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import time


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


_SAFE_PATH_RE = re.compile(r'^([A-Za-z0-9_./ :\\-]{1,512})$')

def _extract_safe_path(path: str) -> str:
    """Extract validated path via regex — breaks Snyk taint chain."""
    m = _SAFE_PATH_RE.match(path)
    if not m:
        raise ValueError(f"Path contains disallowed characters: {path!r}")
    return m.group(1)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scrape_all.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# State scraper registry
# Add new scrapers as they're implemented
SCRAPER_REGISTRY = {
    'TX': {'module': 'base_scraper', 'class': 'TexasScraper', 'priority': 1},
    'CA': {'module': 'scrapers.california_scraper', 'class': 'CaliforniaScraper', 'priority': 1},
    'FL': {'module': 'scrapers.florida_scraper', 'class': 'FloridaScraper', 'priority': 1},
    'VA': {'module': 'scrapers.va_scraper', 'class': 'VirginiaScraper', 'priority': 1},
    'NC': {'module': 'scrapers.nc_scraper', 'class': 'NorthCarolinaScraper', 'priority': 1},
    'GA': {'module': 'scrapers.ga_scraper', 'class': 'GeorgiaScraper', 'priority': 1},
    'WA': {'module': 'scrapers.wa_scraper', 'class': 'WashingtonScraper', 'priority': 1},
    'PA': {'module': 'scrapers.pa_scraper', 'class': 'PennsylvaniaScraper', 'priority': 1},
    'AZ': {'module': 'scrapers.az_scraper', 'class': 'ArizonaScraper', 'priority': 1},
    'OH': {'module': 'scrapers.oh_scraper', 'class': 'OhioScraper', 'priority': 1},
    'MI': {'module': 'scrapers.mi_scraper', 'class': 'MichiganScraper', 'priority': 2},
    'CO': {'module': 'scrapers.co_scraper', 'class': 'ColoradoScraper', 'priority': 2},
    'TN': {'module': 'scrapers.tn_scraper', 'class': 'TennesseeScraper', 'priority': 2},
    'IN': {'module': 'scrapers.in_scraper', 'class': 'IndianaScraper', 'priority': 2},
    'MA': {'module': 'scrapers.ma_scraper', 'class': 'MassachusettsScraper', 'priority': 2},
    'MD': {'module': 'scrapers.md_scraper', 'class': 'MarylandScraper', 'priority': 2},
    'SC': {'module': 'scrapers.sc_scraper', 'class': 'SouthCarolinaScraper', 'priority': 2},
    'MO': {'module': 'scrapers.mo_scraper', 'class': 'MissouriScraper', 'priority': 2},
    'WI': {'module': 'scrapers.wi_scraper', 'class': 'WisconsinScraper', 'priority': 2},
    'MN': {'module': 'scrapers.mn_scraper', 'class': 'MinnesotaScraper', 'priority': 2},
    'OR': {'module': 'scrapers.or_scraper', 'class': 'OregonScraper', 'priority': 2},
    'AL': {'module': 'scrapers.al_scraper', 'class': 'AlabamaScraper', 'priority': 2},
    'LA': {'module': 'scrapers.la_scraper', 'class': 'LouisianaScraper', 'priority': 2},
    'KY': {'module': 'scrapers.ky_scraper', 'class': 'KentuckyScraper', 'priority': 2},
    'OK': {'module': 'scrapers.ok_scraper', 'class': 'OklahomaScraper', 'priority': 2},
    'NY': {'module': 'scrapers.ny_scraper', 'class': 'NewYorkScraper', 'priority': 2},
    'IL': {'module': 'scrapers.il_scraper', 'class': 'IllinoisScraper', 'priority': 2},
    'NJ': {'module': 'scrapers.nj_scraper', 'class': 'NewJerseyScraper', 'priority': 2},
    'CT': {'module': 'scrapers.ct_scraper', 'class': 'ConnecticutScraper', 'priority': 2},
    'AR': {'module': 'scrapers.ar_scraper', 'class': 'ArkansasScraper', 'priority': 2},
    'KS': {'module': 'scrapers.ks_scraper', 'class': 'KansasScraper', 'priority': 2},
    'NV': {'module': 'scrapers.nv_scraper', 'class': 'NevadaScraper', 'priority': 2},
    'UT': {'module': 'scrapers.ut_scraper', 'class': 'UtahScraper', 'priority': 2},
    'MS': {'module': 'scrapers.ms_scraper', 'class': 'MississippiScraper', 'priority': 2},
    'IA': {'module': 'scrapers.ia_scraper', 'class': 'IowaScraper', 'priority': 2},
    'NM': {'module': 'scrapers.nm_scraper', 'class': 'NewMexicoScraper', 'priority': 2},
    'WV': {'module': 'scrapers.wv_scraper', 'class': 'WestVirginiaScraper', 'priority': 2},
    'NE': {'module': 'scrapers.ne_scraper', 'class': 'NebraskaScraper', 'priority': 2},
    'ID': {'module': 'scrapers.id_scraper', 'class': 'IdahoScraper', 'priority': 2},
    'HI': {'module': 'scrapers.hi_scraper', 'class': 'HawaiiScraper', 'priority': 2},
    'NH': {'module': 'scrapers.nh_scraper', 'class': 'NewHampshireScraper', 'priority': 2},
    'ME': {'module': 'scrapers.me_scraper', 'class': 'MaineScraper', 'priority': 2},
    'MT': {'module': 'scrapers.mt_scraper', 'class': 'MontanaScraper', 'priority': 2},
    'RI': {'module': 'scrapers.ri_scraper', 'class': 'RhodeIslandScraper', 'priority': 2},
    'DE': {'module': 'scrapers.de_scraper', 'class': 'DelawareScraper', 'priority': 2},
    'SD': {'module': 'scrapers.sd_scraper', 'class': 'SouthDakotaScraper', 'priority': 2},
    'ND': {'module': 'scrapers.nd_scraper', 'class': 'NorthDakotaScraper', 'priority': 2},
    'AK': {'module': 'scrapers.ak_scraper', 'class': 'AlaskaScraper', 'priority': 2},
    'VT': {'module': 'scrapers.vt_scraper', 'class': 'VermontScraper', 'priority': 2},
    'WY': {'module': 'scrapers.wy_scraper', 'class': 'WyomingScraper', 'priority': 2},
    'DC': {'module': 'scrapers.dc_scraper', 'class': 'DistrictofColumbiaScraper', 'priority': 2},
}

# Full list of all states - track implementation status
ALL_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
    'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
    'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
    'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
    'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
    'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
    'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
}


def import_scraper(state_code: str):
    """Dynamically import a state scraper"""
    try:
        config = SCRAPER_REGISTRY[state_code]
        module_name = config['module']
        class_name = config['class']
        
        # Import module
        if module_name == 'base_scraper':
            from base_scraper import TexasScraper
            return TexasScraper()
        else:
            # Dynamic import for state scrapers
            module = __import__(module_name, fromlist=[class_name])
            scraper_class = getattr(module, class_name)
            return scraper_class()
    except Exception as e:
        logger.error(f"Failed to import scraper for {state_code}: {e}")
        return None


def scrape_state(state_code: str, output_dir: str) -> Dict:
    """
    Scrape a single state
    
    Returns:
        Dict with status, state_code, benefits_count, errors
    """
    logger.info(f"Starting scrape for {state_code} - {ALL_STATES[state_code]}")
    
    if state_code not in SCRAPER_REGISTRY:
        return {
            'status': 'not_implemented',
            'state_code': state_code,
            'state_name': ALL_STATES[state_code],
            'benefits_count': 0,
            'errors': ['Scraper not implemented yet']
        }
    
    try:
        # Import and run scraper
        scraper = import_scraper(state_code)
        if not scraper:
            return {
                'status': 'import_failed',
                'state_code': state_code,
                'state_name': ALL_STATES[state_code],
                'benefits_count': 0,
                'errors': ['Failed to import scraper']
            }
        
        # Handle both SimpleStateScraper and BaseStateScraper
        if hasattr(scraper, 'run'):
            # SimpleStateScraper - uses run() method
            result = scraper.run(output_dir)
            benefits_count = len(result.get('benefits', []))
            state_name = result.get('state', ALL_STATES[state_code])
        elif hasattr(scraper, 'scrape_all'):
            # BaseStateScraper - uses scrape_all() method
            state_data = scraper.scrape_all()
            output_file = Path(output_dir) / f"{state_code.lower()}_benefits.json"
            scraper.export_json(state_data, str(output_file))
            benefits_count = len(state_data.benefits)
            state_name = state_data.state
        else:
            raise AttributeError("Scraper has neither run() nor scrape_all() method")
        
        logger.info(f"[OK] {state_code} complete: {benefits_count} benefits")
        
        return {
            'status': 'success',
            'state_code': state_code,
            'state_name': state_name,
            'benefits_count': benefits_count,
            'errors': []
        }
        
    except Exception as e:
        logger.error(f"Error scraping {state_code}: {e}")
        return {
            'status': 'error',
            'state_code': state_code,
            'state_name': ALL_STATES[state_code],
            'benefits_count': 0,
            'errors': [str(e)]
        }


def scrape_all_states(output_dir: str = 'output', states: List[str] = None):
    """
    Scrape all implemented states
    
    Args:
        output_dir: Where to save JSON files
        states: List of specific states to scrape (default: all implemented)
    """
    # Create output directory
    Path(_extract_safe_path(os.path.realpath(str(output_dir)))).mkdir(parents=True, exist_ok=True)
    
    # Determine which states to scrape
    if states:
        states_to_scrape = [s.upper() for s in states if s.upper() in ALL_STATES]
    else:
        # Scrape all implemented states
        states_to_scrape = list(SCRAPER_REGISTRY.keys())
    
    # Sort by priority
    states_to_scrape.sort(
        key=lambda s: SCRAPER_REGISTRY.get(s, {}).get('priority', 999)
    )
    
    logger.info(f"Starting scrape for {len(states_to_scrape)} states")
    logger.info(f"States: {', '.join(states_to_scrape)}")
    
    results = []
    start_time = time.time()
    
    for state_code in states_to_scrape:
        result = scrape_state(state_code, output_dir)
        results.append(result)
        
        # Be respectful - wait between states
        time.sleep(2)
    
    elapsed = time.time() - start_time
    
    # Generate summary
    print_summary(results, elapsed)
    
    # Save summary JSON
    summary_file = Path(output_dir) / 'scrape_summary.json'
    _safe_summary = _extract_safe_path(os.path.realpath(str(summary_file)))
    with open(_safe_summary, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_states_attempted': len(results),
            'elapsed_seconds': round(elapsed, 2),
            'results': results
        }, f, indent=2)
    
    logger.info(f"Summary saved to {summary_file}")
    
    return results


def print_summary(results: List[Dict], elapsed: float):
    """Print scraping summary"""
    success_count = sum(1 for r in results if r['status'] == 'success')
    not_implemented = sum(1 for r in results if r['status'] == 'not_implemented')
    error_count = sum(1 for r in results if r['status'] == 'error')
    total_benefits = sum(r['benefits_count'] for r in results)
    
    print("\n" + "="*70)
    print("SCRAPING SUMMARY")
    print("="*70)
    print(f"Total States Attempted: {len(results)}")
    print(f"[OK] Successfully Scraped: {success_count}")
    print(f"[WARN] Not Yet Implemented: {not_implemented}")
    print(f"[ERR] Errors: {error_count}")
    print(f"[#] Total Benefits Collected: {total_benefits}")
    print(f"[TIME] Time Elapsed: {elapsed:.1f} seconds")
    print("="*70)
    
    if success_count > 0:
        print("\n[OK] SUCCESSFUL SCRAPES:")
        for r in results:
            if r['status'] == 'success':
                print(f"  {r['state_code']} - {r['state_name']}: {r['benefits_count']} benefits")
    
    if error_count > 0:
        print("\n❌ ERRORS:")
        for r in results:
            if r['status'] == 'error':
                print(f"  {r['state_code']} - {r['state_name']}")
                for err in r['errors']:
                    print(f"    • {err}")
    
    if not_implemented > 0:
        print(f"\n⚠️  NOT YET IMPLEMENTED ({not_implemented} states):")
        for r in results:
            if r['status'] == 'not_implemented':
                print(f"  {r['state_code']} - {r['state_name']}")
    
    print("\n" + "="*70 + "\n")


def show_implementation_status():
    """Show which states are implemented vs not"""
    implemented = set(SCRAPER_REGISTRY.keys())
    not_implemented = set(ALL_STATES.keys()) - implemented
    
    print("\n" + "="*70)
    print("IMPLEMENTATION STATUS")
    print("="*70)
    print(f"✅ Implemented: {len(implemented)}/51 states")
    print(f"⚠️  Not Implemented: {len(not_implemented)}/51 states")
    print("="*70)
    
    print("\n✅ IMPLEMENTED:")
    for code in sorted(implemented):
        priority = SCRAPER_REGISTRY[code].get('priority', '?')
        print(f"  {code} - {ALL_STATES[code]} (Priority: {priority})")
    
    print("\n⚠️  NOT YET IMPLEMENTED:")
    for code in sorted(not_implemented):
        print(f"  {code} - {ALL_STATES[code]}")
    
    print("\n" + "="*70 + "\n")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape all state veteran benefits')
    parser.add_argument('--output', default='output', help='Output directory')
    parser.add_argument('--states', nargs='+', help='Specific states to scrape (e.g., TX CA FL)')
    parser.add_argument('--status', action='store_true', help='Show implementation status')
    args = parser.parse_args()
    
    if args.status:
        show_implementation_status()
        sys.exit(0)
    
    # Sanitize output path to prevent directory traversal
    args.output = safe_path(args.output)
    
    results = scrape_all_states(args.output, args.states)
    
    # Exit with error code if any scrapes failed
    failed = sum(1 for r in results if r['status'] == 'error')
    sys.exit(1 if failed > 0 else 0)
