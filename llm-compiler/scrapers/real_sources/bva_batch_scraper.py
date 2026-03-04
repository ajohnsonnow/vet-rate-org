#!/usr/bin/env python3
"""
BVA Batch Scraper - Downloads ALL BVA decisions
================================================
Runs in background, saves incrementally, handles interruptions gracefully.

Usage: python bva_batch_scraper.py [--year 25] [--batch-size 1000] [--resume]
"""

import os
import re
import json
import time
import logging
import requests
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any
from xml.etree import ElementTree as ET


def safe_path(user_path, allowed_dir=None):
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('bva_scrape.log')
    ]
)
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "bva"
OUTPUT_DIR = BASE_DIR / "decisions"
PROGRESS_FILE = BASE_DIR / "scrape_progress.json"

YEARLY_SITEMAPS = {
    "25": "https://www.va.gov/vetapp25/sitemap.xml",
    "24": "https://www.va.gov/vetapp24/sitemap.xml",
    "23": "https://www.va.gov/vetapp23/sitemap.xml",
    "22": "https://www.va.gov/vetapp22/sitemap.xml",
    "21": "https://www.va.gov/vetapp21/sitemap.xml",
    "20": "https://www.va.gov/vetapp20/sitemap.xml",
    "19": "https://www.va.gov/vetapp19/sitemap.xml",
    "18": "https://www.va.gov/vetapp18/sitemap.xml",
    "17": "https://www.va.gov/vetapp17/sitemap.xml",
}

# CFR patterns
CFR_PATTERN = re.compile(r'38\s*(?:C\.?F\.?R\.?|CFR)\s*§?\s*([\d\.]+(?:\s*,\s*[\d\.]+)*)', re.IGNORECASE)
USC_PATTERN = re.compile(r'38\s*U\.?S\.?C\.?\s*§?\s*([\d]+(?:\s*,\s*[\d]+)*)', re.IGNORECASE)

# Priority conditions for tagging
PRIORITY_CONDITIONS = [
    "ptsd", "post-traumatic stress", "posttraumatic stress",
    "sleep apnea", "obstructive sleep apnea",
    "tinnitus", "depression", "major depressive disorder",
    "anxiety", "tbi", "traumatic brain injury",
    "back", "lumbar", "spine", "knee",
    "migraine", "headache", "gerd", "diabetes",
    "hypertension", "hearing loss", "radiculopathy",
    "shoulder", "neck", "cervical", "hip",
    "erectile dysfunction", "agent orange",
    "burn pit", "pact act", "gulf war", "secondary"
]


class BVABatchScraper:
    """Batch scraper for ALL BVA decisions"""
    
    def __init__(self):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        self.progress = self.load_progress()
    
    def load_progress(self) -> Dict:
        """Load progress from file"""
        if PROGRESS_FILE.exists():
            with open(PROGRESS_FILE, 'r') as f:
                return json.load(f)
        return {
            "years_completed": [],
            "current_year": None,
            "urls_processed": [],
            "total_scraped": 0,
            "started_at": datetime.now().isoformat()
        }
    
    def save_progress(self):
        """Save progress to file"""
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(self.progress, f, indent=2)
    
    def get_all_decision_urls(self, year: str) -> List[str]:
        """Get ALL decision URLs from a yearly sitemap"""
        sitemap_url = YEARLY_SITEMAPS.get(year)
        if not sitemap_url:
            logger.error(f"No sitemap for year {year}")
            return []
        
        logger.info(f"Fetching sitemap for year 20{year}: {sitemap_url}")
        
        try:
            resp = self.session.get(sitemap_url, timeout=120)
            resp.raise_for_status()
            
            # Parse URLs from sitemap
            urls = re.findall(r'https://www\.va\.gov/vetapp\d+/Files\d*/\d+\.txt', resp.text)
            urls = list(set(urls))  # Dedupe
            
            logger.info(f"Found {len(urls)} decisions for year 20{year}")
            return urls
            
        except Exception as e:
            logger.error(f"Error fetching sitemap: {e}")
            return []
    
    def download_decision(self, url: str) -> Optional[str]:
        """Download a single decision"""
        try:
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            logger.debug(f"Error downloading {url}: {e}")
            return None
    
    def parse_decision(self, text: str, url: str) -> Dict[str, Any]:
        """Parse decision text into structured data"""
        decision = {
            "source": "BVA_DECISIONS",
            "source_url": url,
            "hierarchy_level": 3,
            "color_code": "GREEN",
            "scraped_at": datetime.now().isoformat(),
        }
        
        # Citation
        citation_match = re.search(r'Citation\s*N[ro]\.?:?\s*(\d+)', text, re.IGNORECASE)
        if citation_match:
            decision["citation"] = f"BVA-{citation_match.group(1)}"
        else:
            filename = url.split('/')[-1].replace('.txt', '')
            decision["citation"] = f"BVA-{filename}"
        
        # Date
        date_match = re.search(r'Decision\s*Date:?\s*(\d{1,2}/\d{1,2}/\d{2,4})', text, re.IGNORECASE)
        if date_match:
            decision["effective_date"] = date_match.group(1)
        
        # Docket
        docket_match = re.search(r'DOCKET\s*N[Oo]\.?\s*([\d\-\s]+)', text, re.IGNORECASE)
        if docket_match:
            decision["docket_number"] = docket_match.group(1).strip()
        
        # ORDER
        order_match = re.search(r'ORDER\s*\n+(.*?)(?=\n\s*\n|\nFINDING|\nREASON)', text, re.IGNORECASE | re.DOTALL)
        if order_match:
            order_text = order_match.group(1).strip()[:500]
            decision["order"] = order_text
            
            order_lower = order_text.lower()
            if any(w in order_lower for w in ['granted', 'allowed', 'is warranted']):
                if 'denied' not in order_lower:
                    decision["outcome"] = "GRANTED"
                else:
                    decision["outcome"] = "DENIED"
            elif any(w in order_lower for w in ['denied', 'not warranted']):
                decision["outcome"] = "DENIED"
            elif any(w in order_lower for w in ['remand', 'vacated']):
                decision["outcome"] = "REMANDED"
            else:
                decision["outcome"] = "UNKNOWN"
        
        # FINDING
        fact_match = re.search(r'FINDING[S]?\s*OF\s*FACT\s*\n+(.*?)(?=\nCONCLUSION|\nREASON|\nORDER)', text, re.IGNORECASE | re.DOTALL)
        if fact_match:
            decision["finding_of_fact"] = fact_match.group(1).strip()[:1000]
        
        # CONCLUSION
        conclusion_match = re.search(r'CONCLUSION[S]?\s*OF\s*LAW\s*\n+(.*?)(?=\nREASON|\nFINDING|\nORDER|$)', text, re.IGNORECASE | re.DOTALL)
        if conclusion_match:
            decision["conclusion_of_law"] = conclusion_match.group(1).strip()[:1000]
        
        # CFR/USC citations
        cfr_matches = CFR_PATTERN.findall(text)
        usc_matches = USC_PATTERN.findall(text)
        decision["related_codes"] = list(set([f"38 CFR § {m}" for m in cfr_matches]))[:15]
        decision["usc_citations"] = list(set([f"38 U.S.C. § {m}" for m in usc_matches]))[:10]
        
        # Conditions
        text_lower = text.lower()
        conditions = [c for c in PRIORITY_CONDITIONS if c in text_lower]
        decision["conditions"] = list(set(conditions))[:5]
        
        # Title
        cond_str = ", ".join(decision.get("conditions", [])[:2]) or "General"
        outcome_str = decision.get("outcome", "Decision")
        decision["title"] = f"BVA {outcome_str} - {cond_str.title()}"
        
        # Content summary
        parts = []
        if decision.get("order"):
            parts.append(f"ORDER: {decision['order']}")
        if decision.get("finding_of_fact"):
            parts.append(f"FINDING: {decision['finding_of_fact'][:300]}...")
        if decision.get("conclusion_of_law"):
            parts.append(f"CONCLUSION: {decision['conclusion_of_law'][:300]}...")
        decision["content"] = " | ".join(parts) or text[:500]
        
        return decision
    
    def scrape_year(self, year: str, batch_size: int = 1000, delay: float = 0.1):
        """Scrape all decisions for a year, saving in batches"""
        logger.info(f"Starting scrape for year 20{year}")
        
        # Get all URLs
        all_urls = self.get_all_decision_urls(year)
        if not all_urls:
            return
        
        # Filter out already processed
        processed = set(self.progress.get("urls_processed", []))
        urls_to_process = [u for u in all_urls if u not in processed]
        
        logger.info(f"Processing {len(urls_to_process)} URLs ({len(processed)} already done)")
        
        batch = []
        batch_num = 0
        total_scraped = 0
        
        for i, url in enumerate(urls_to_process):
            # Rate limiting
            time.sleep(delay)
            
            text = self.download_decision(url)
            if text:
                decision = self.parse_decision(text, url)
                batch.append(decision)
                total_scraped += 1
            
            # Track progress
            self.progress["urls_processed"].append(url)
            self.progress["total_scraped"] = self.progress.get("total_scraped", 0) + 1
            
            # Save batch
            if len(batch) >= batch_size or i == len(urls_to_process) - 1:
                batch_num += 1
                filename = f"bva_{year}_batch_{batch_num:04d}.json"
                output_path = OUTPUT_DIR / filename
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "metadata": {
                            "year": f"20{year}",
                            "batch": batch_num,
                            "count": len(batch),
                            "scraped_at": datetime.now().isoformat()
                        },
                        "entries": batch
                    }, f, indent=2, ensure_ascii=False)
                
                logger.info(f"Saved batch {batch_num}: {len(batch)} decisions to {filename}")
                batch = []
                
                # Save progress
                self.save_progress()
            
            # Progress logging
            if (i + 1) % 100 == 0:
                logger.info(f"Progress: {i + 1}/{len(urls_to_process)} ({(i+1)/len(urls_to_process)*100:.1f}%)")
        
        self.progress["years_completed"].append(year)
        self.save_progress()
        
        logger.info(f"Completed year 20{year}: {total_scraped} decisions scraped")
    
    def scrape_all_years(self, years: List[str] = None, batch_size: int = 1000):
        """Scrape multiple years"""
        if years is None:
            years = ['25', '24', '23', '22', '21']
        
        for year in years:
            if year in self.progress.get("years_completed", []):
                logger.info(f"Skipping year 20{year} (already completed)")
                continue
            
            self.scrape_year(year, batch_size)
        
        logger.info("All years completed!")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Batch scrape ALL BVA decisions')
    parser.add_argument('--year', default='25', help='Year to scrape (25=2025)')
    parser.add_argument('--batch-size', type=int, default=1000, help='Save batch size')
    parser.add_argument('--all-years', action='store_true', help='Scrape all years')
    parser.add_argument('--delay', type=float, default=0.1, help='Delay between requests')
    
    args = parser.parse_args()
    
    scraper = BVABatchScraper()
    
    # Sanitize year arg to prevent path traversal in filenames
    args.year = re.sub(r'[^\w]', '', args.year)
    
    if args.all_years:
        scraper.scrape_all_years(batch_size=args.batch_size)
    else:
        scraper.scrape_year(args.year, batch_size=args.batch_size, delay=args.delay)
    
    print(f"\n[DONE] Total scraped: {scraper.progress['total_scraped']}")


if __name__ == "__main__":
    main()
