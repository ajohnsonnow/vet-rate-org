#!/usr/bin/env python3
"""
BVA Decision Scraper for Diamond Knowledge Base
================================================
Scrapes Board of Veterans Appeals decisions from VA.gov sitemaps.

Data Source: https://www.va.gov/vetapp/sitemap.xml
Referenced by: https://catalog.data.gov/dataset/board-of-veterans-appeals

Author: VetRate Diamond Team
Created: 2026-01-27
"""

import os
import re
import json
import time
import logging
import hashlib
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any
from xml.etree import ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "bva"
OUTPUT_DIR = BASE_DIR / "decisions"
# The main sitemap index - note: sometimes returns 404, use direct year URLs as backup
SITEMAP_INDEX_URL = "https://www.bva.va.gov/sitemap.xml"

# Direct yearly sitemap URLs (more reliable)
YEARLY_SITEMAPS = {
    "25": "https://www.va.gov/vetapp25/sitemap.xml",
    "24": "https://www.va.gov/vetapp24/sitemap.xml",
    "23": "https://www.va.gov/vetapp23/sitemap.xml",
    "22": "https://www.va.gov/vetapp22/sitemap.xml",
    "21": "https://www.va.gov/vetapp21/sitemap.xml",
    "20": "https://www.va.gov/vetapp20/sitemap.xml",
}

# Priority conditions to focus on (these are most useful for veterans)
PRIORITY_CONDITIONS = [
    "ptsd", "post-traumatic stress", "posttraumatic stress",
    "sleep apnea", "obstructive sleep apnea",
    "tinnitus",
    "depression", "major depressive disorder", "mdd",
    "anxiety", "generalized anxiety",
    "tbi", "traumatic brain injury",
    "back", "lumbar", "spine", "degenerative disc",
    "knee", "patellofemoral",
    "migraine", "headache",
    "gerd", "gastroesophageal reflux",
    "diabetes", "diabetic",
    "hypertension", "high blood pressure",
    "hearing loss", "bilateral hearing",
    "radiculopathy", "sciatic",
    "shoulder", "rotator cuff",
    "neck", "cervical",
    "hip",
    "erectile dysfunction", "ed",
    "agent orange", "presumptive",
    "burn pit", "pact act",
    "gulf war", "southwest asia",
    "secondary", "aggravated by"
]

# CFR patterns to extract
CFR_PATTERN = re.compile(r'38\s*(?:C\.?F\.?R\.?|CFR)\s*§?\s*([\d\.]+(?:\s*,\s*[\d\.]+)*)', re.IGNORECASE)
USC_PATTERN = re.compile(r'38\s*U\.?S\.?C\.?\s*§?\s*([\d]+(?:\s*,\s*[\d]+)*)', re.IGNORECASE)


class BVAScraper:
    """Scrapes BVA decisions from VA.gov"""
    
    def __init__(self, output_dir: Path = OUTPUT_DIR):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        # Use browser-like headers to avoid 406 errors
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'max-age=0',
        })
        self.stats = {
            "sitemaps_processed": 0,
            "decisions_found": 0,
            "decisions_downloaded": 0,
            "decisions_parsed": 0,
            "grants": 0,
            "denials": 0,
            "remands": 0,
            "errors": 0,
            "priority_conditions": 0
        }
    
    def fetch_sitemap_index(self) -> List[str]:
        """Fetch the main sitemap index and extract yearly sitemap URLs"""
        logger.info(f"Fetching sitemap index: {SITEMAP_INDEX_URL}")
        
        try:
            resp = self.session.get(SITEMAP_INDEX_URL, timeout=30)
            resp.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(resp.content)
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            sitemap_urls = []
            for sitemap in root.findall('.//sm:sitemap', ns):
                loc = sitemap.find('sm:loc', ns)
                if loc is not None:
                    sitemap_urls.append(loc.text)
            
            # If namespace parsing fails, try without
            if not sitemap_urls:
                for loc in root.iter():
                    if 'loc' in loc.tag.lower() and loc.text:
                        if 'sitemap.xml' in loc.text:
                            sitemap_urls.append(loc.text)
            
            logger.info(f"Found {len(sitemap_urls)} yearly sitemaps")
            return sitemap_urls
            
        except Exception as e:
            logger.error(f"Error fetching sitemap index: {e}")
            return []
    
    def fetch_decision_urls_from_sitemap(self, sitemap_url: str, limit: int = None) -> List[str]:
        """Fetch individual decision URLs from a yearly sitemap"""
        logger.info(f"Fetching sitemap: {sitemap_url}")
        
        try:
            resp = self.session.get(sitemap_url, timeout=60)
            resp.raise_for_status()
            
            # Parse XML
            root = ET.fromstring(resp.content)
            ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            decision_urls = []
            for url_elem in root.findall('.//sm:url', ns):
                loc = url_elem.find('sm:loc', ns)
                if loc is not None and loc.text and '.txt' in loc.text:
                    decision_urls.append(loc.text)
            
            # If namespace parsing fails, try regex
            if not decision_urls:
                urls = re.findall(r'https://www\.va\.gov/vetapp\d+/Files\d*/\d+\.txt', resp.text)
                decision_urls = list(set(urls))
            
            self.stats["sitemaps_processed"] += 1
            self.stats["decisions_found"] += len(decision_urls)
            
            if limit:
                decision_urls = decision_urls[:limit]
            
            logger.info(f"Found {len(decision_urls)} decisions in {sitemap_url}")
            return decision_urls
            
        except Exception as e:
            logger.error(f"Error fetching sitemap {sitemap_url}: {e}")
            self.stats["errors"] += 1
            return []
    
    def download_decision(self, url: str) -> Optional[str]:
        """Download a single BVA decision text file"""
        try:
            resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            self.stats["decisions_downloaded"] += 1
            return resp.text
        except Exception as e:
            logger.debug(f"Error downloading {url}: {e}")
            self.stats["errors"] += 1
            return None
    
    def parse_decision(self, text: str, url: str) -> Optional[Dict[str, Any]]:
        """Parse a BVA decision text into structured data"""
        if not text:
            return None
        
        try:
            decision = {
                "source": "BVA",
                "source_url": url,
                "hierarchy_level": 3,  # Administrative
                "color_code": "GREEN",
                "scraped_at": datetime.now().isoformat(),
            }
            
            # Extract Citation Number
            citation_match = re.search(r'Citation\s*N[ro]\.?:?\s*(\d+)', text, re.IGNORECASE)
            if citation_match:
                decision["citation"] = f"BVA-{citation_match.group(1)}"
            else:
                # Use filename as citation
                filename = url.split('/')[-1].replace('.txt', '')
                decision["citation"] = f"BVA-{filename}"
            
            # Extract Decision Date
            date_match = re.search(r'Decision\s*Date:?\s*(\d{1,2}/\d{1,2}/\d{2,4})', text, re.IGNORECASE)
            if date_match:
                decision["decision_date"] = date_match.group(1)
            
            # Extract Docket Number
            docket_match = re.search(r'DOCKET\s*N[Oo]\.?\s*([\d\-\s]+)', text, re.IGNORECASE)
            if docket_match:
                decision["docket_number"] = docket_match.group(1).strip()
            
            # Extract ORDER (the outcome)
            order_match = re.search(r'ORDER\s*\n+(.*?)(?=\n\s*\n|\nFINDING|\nREASON)', text, re.IGNORECASE | re.DOTALL)
            if order_match:
                order_text = order_match.group(1).strip()
                decision["order"] = order_text[:500]  # Limit length
                
                # Determine outcome
                order_lower = order_text.lower()
                if any(word in order_lower for word in ['granted', 'allowed', 'service connection for', 'is warranted']):
                    if 'denied' not in order_lower and 'not warranted' not in order_lower:
                        decision["outcome"] = "GRANTED"
                        self.stats["grants"] += 1
                    else:
                        decision["outcome"] = "DENIED"
                        self.stats["denials"] += 1
                elif any(word in order_lower for word in ['denied', 'not warranted', 'not met']):
                    decision["outcome"] = "DENIED"
                    self.stats["denials"] += 1
                elif any(word in order_lower for word in ['remand', 'vacated']):
                    decision["outcome"] = "REMANDED"
                    self.stats["remands"] += 1
                else:
                    decision["outcome"] = "UNKNOWN"
            
            # Extract FINDING OF FACT
            fact_match = re.search(r'FINDING[S]?\s*OF\s*FACT\s*\n+(.*?)(?=\nCONCLUSION|\nREASON|\nORDER)', text, re.IGNORECASE | re.DOTALL)
            if fact_match:
                decision["finding_of_fact"] = fact_match.group(1).strip()[:1000]
            
            # Extract CONCLUSION OF LAW
            conclusion_match = re.search(r'CONCLUSION[S]?\s*OF\s*LAW\s*\n+(.*?)(?=\nREASON|\nFINDING|\nORDER|$)', text, re.IGNORECASE | re.DOTALL)
            if conclusion_match:
                decision["conclusion_of_law"] = conclusion_match.group(1).strip()[:1000]
            
            # Extract CFR and USC citations
            cfr_matches = CFR_PATTERN.findall(text)
            usc_matches = USC_PATTERN.findall(text)
            decision["cfr_citations"] = list(set([f"38 CFR § {m}" for m in cfr_matches]))[:10]
            decision["usc_citations"] = list(set([f"38 U.S.C. § {m}" for m in usc_matches]))[:10]
            
            # Detect condition type
            text_lower = text.lower()
            conditions_found = []
            for condition in PRIORITY_CONDITIONS:
                if condition in text_lower:
                    conditions_found.append(condition)
            
            if conditions_found:
                decision["conditions"] = list(set(conditions_found))[:5]
                decision["is_priority"] = True
                self.stats["priority_conditions"] += 1
            else:
                decision["conditions"] = []
                decision["is_priority"] = False
            
            # Create title
            condition_str = ", ".join(decision.get("conditions", [])[:2]) or "General"
            outcome_str = decision.get("outcome", "Decision")
            decision["title"] = f"BVA {outcome_str} - {condition_str.title()}"
            
            # Create content summary
            decision["content"] = self._create_content_summary(decision, text)
            
            # Generate unique ID
            decision["id"] = hashlib.md5(decision["citation"].encode()).hexdigest()[:12]
            
            self.stats["decisions_parsed"] += 1
            return decision
            
        except Exception as e:
            logger.error(f"Error parsing decision {url}: {e}")
            self.stats["errors"] += 1
            return None
    
    def _create_content_summary(self, decision: Dict, full_text: str) -> str:
        """Create a concise content summary for the knowledge base"""
        parts = []
        
        if decision.get("order"):
            parts.append(f"ORDER: {decision['order']}")
        
        if decision.get("finding_of_fact"):
            parts.append(f"FINDING: {decision['finding_of_fact'][:300]}...")
        
        if decision.get("conclusion_of_law"):
            parts.append(f"CONCLUSION: {decision['conclusion_of_law'][:300]}...")
        
        if decision.get("cfr_citations"):
            parts.append(f"CFR: {', '.join(decision['cfr_citations'][:3])}")
        
        return " | ".join(parts) or full_text[:500]
    
    def is_priority_decision(self, text: str) -> bool:
        """Check if decision covers a priority condition"""
        text_lower = text.lower()
        return any(cond in text_lower for cond in PRIORITY_CONDITIONS)
    
    def scrape_recent_decisions(self, years: List[str] = None, max_per_year: int = 500,
                                priority_only: bool = True) -> List[Dict]:
        """
        Scrape recent BVA decisions
        
        Args:
            years: List of years to scrape (e.g., ['25', '24', '23'])
            max_per_year: Maximum decisions to download per year
            priority_only: Only keep decisions about priority conditions
        
        Returns:
            List of parsed decision dictionaries
        """
        if years is None:
            years = ['25', '24']  # 2025 and 2024 by default
        
        all_decisions = []
        
        # Use direct yearly sitemap URLs (more reliable than sitemap index)
        for year in years:
            if year in YEARLY_SITEMAPS:
                sitemap_url = YEARLY_SITEMAPS[year]
                logger.info(f"Processing year 20{year} from {sitemap_url}")
                
                decision_urls = self.fetch_decision_urls_from_sitemap(sitemap_url, limit=max_per_year * 3)
                
                # Download and parse decisions
                parsed_count = 0
                for url in decision_urls:
                    if parsed_count >= max_per_year:
                        break
                    
                    # Rate limiting
                    time.sleep(0.2)
                    
                    text = self.download_decision(url)
                    if not text:
                        continue
                    
                    # Skip non-priority if filtering
                    if priority_only and not self.is_priority_decision(text):
                        continue
                    
                    decision = self.parse_decision(text, url)
                    if decision:
                        all_decisions.append(decision)
                        parsed_count += 1
                        
                        if parsed_count % 50 == 0:
                            logger.info(f"Parsed {parsed_count} decisions from year 20{year}")
            else:
                logger.warning(f"No sitemap URL configured for year {year}")
        
        return all_decisions
    
    def scrape_by_search(self, search_terms: List[str], max_results: int = 100) -> List[Dict]:
        """
        Scrape decisions by searching for specific terms
        This uses the search.usa.gov interface indirectly
        
        For now, we scrape from sitemaps and filter by terms
        """
        logger.info(f"Searching for: {search_terms}")
        
        all_decisions = []
        sitemap_urls = self.fetch_sitemap_index()
        
        # Focus on recent years
        recent_sitemaps = [url for url in sitemap_urls if any(y in url for y in ['25', '24', '23'])]
        
        for sitemap_url in recent_sitemaps[:3]:  # Last 3 years
            decision_urls = self.fetch_decision_urls_from_sitemap(sitemap_url, limit=1000)
            
            found = 0
            for url in decision_urls:
                if found >= max_results:
                    break
                
                time.sleep(0.2)
                text = self.download_decision(url)
                if not text:
                    continue
                
                # Check if any search term matches
                text_lower = text.lower()
                if any(term.lower() in text_lower for term in search_terms):
                    decision = self.parse_decision(text, url)
                    if decision:
                        all_decisions.append(decision)
                        found += 1
        
        return all_decisions
    
    def convert_to_dkb_format(self, decisions: List[Dict]) -> List[Dict]:
        """Convert decisions to Diamond Knowledge Base format"""
        dkb_entries = []
        
        for d in decisions:
            entry = {
                "source": "BVA_DECISIONS",
                "citation": d.get("citation", ""),
                "title": d.get("title", ""),
                "content": d.get("content", ""),
                "hierarchy_level": 3,
                "color_code": "GREEN",
                "effective_date": d.get("decision_date"),
                "superseded_by": None,
                "related_codes": d.get("cfr_citations", []),
                "url": d.get("source_url", ""),
                "metadata": {
                    "docket_number": d.get("docket_number"),
                    "outcome": d.get("outcome"),
                    "conditions": d.get("conditions", []),
                    "usc_citations": d.get("usc_citations", []),
                    "scraped_at": d.get("scraped_at"),
                    "is_priority": d.get("is_priority", False)
                }
            }
            dkb_entries.append(entry)
        
        return dkb_entries
    
    def save_results(self, decisions: List[Dict], filename: str = None) -> str:
        """Save scraped decisions to JSON"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"bva_decisions_{timestamp}.json"
        
        output_path = self.output_dir / filename
        
        # Convert to DKB format
        dkb_entries = self.convert_to_dkb_format(decisions)
        
        output = {
            "metadata": {
                "scraped_at": datetime.now().isoformat(),
                "source": "VA Board of Veterans Appeals",
                "source_url": "https://www.va.gov/vetapp/",
                "reference": "https://catalog.data.gov/dataset/board-of-veterans-appeals",
                "total_decisions": len(dkb_entries),
                "stats": self.stats
            },
            "entries": dkb_entries
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(dkb_entries)} decisions to {output_path}")
        return str(output_path)
    
    def print_stats(self):
        """Print scraping statistics"""
        print("\n" + "="*60)
        print("BVA SCRAPER STATISTICS")
        print("="*60)
        for key, value in self.stats.items():
            print(f"  {key.replace('_', ' ').title()}: {value}")
        print("="*60 + "\n")


def main():
    """Main entry point for BVA scraper"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape BVA decisions for Diamond Knowledge Base')
    parser.add_argument('--years', nargs='+', default=['25', '24'], help='Years to scrape (25=2025)')
    parser.add_argument('--max-per-year', type=int, default=200, help='Max decisions per year')
    parser.add_argument('--priority-only', action='store_true', default=True, help='Only priority conditions')
    parser.add_argument('--search', nargs='+', help='Search for specific terms')
    parser.add_argument('--output', help='Output filename')
    
    args = parser.parse_args()
    
    scraper = BVAScraper()
    
    if args.search:
        decisions = scraper.scrape_by_search(args.search, max_results=args.max_per_year)
    else:
        decisions = scraper.scrape_recent_decisions(
            years=args.years,
            max_per_year=args.max_per_year,
            priority_only=args.priority_only
        )
    
    if decisions:
        output_path = scraper.save_results(decisions, args.output)
        print(f"\n[SUCCESS] Saved {len(decisions)} BVA decisions to: {output_path}")
    else:
        print("\n[WARNING] No decisions were scraped")
    
    scraper.print_stats()


if __name__ == "__main__":
    main()
