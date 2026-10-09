#!/usr/bin/env python3
"""
💎 Veterans Benefits Knowledge Base Community Scraper
=====================================================
Scrapes community-provided information from veteransbenefitskb.com

Source: https://www.veteransbenefitskb.com/
License: Community resource, NO ADS, NO PAY WALLS

CRITICAL: All data must be tagged as:
"COMMUNITY_PROVIDED - Not from Regulations"

This is wisdom from veterans helping veterans - incredibly valuable
but should be clearly distinguished from official CFR regulations.
"""

import json
import requests
from bs4 import BeautifulSoup
import time
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Configure logging
log_dir = Path(__file__).parent.parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"vbkb_scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class VeteransBenefitsKBScraper:
    """
    Scrapes community knowledge from veteransbenefitskb.com
    All data is tagged as COMMUNITY_PROVIDED - NOT official regulations
    """
    
    BASE_URL = "https://www.veteransbenefitskb.com"
    
    # Key pages to scrape - high-value community knowledge
    PAGES_TO_SCRAPE = {
        # Claims & Appeals
        "claim_types": "/claimtype",
        "filing_claim": "/vaclaim",
        "appeals": "/appeals",
        "effective_dates": "/edate",
        "intent_to_file": "/itf",
        
        # Rating Info
        "rating_schedule_index": "/ratingsindex",
        "va_math": "/vamath",
        "combined_benefits": "/combinedbenefits",
        "increase_claim": "/increase",
        
        # Medical Exams
        "cp_exams": "/cnp",
        "examiner_insight": "/examiner",
        "bad_examiner": "/badexaminer",
        "dbqs": "/dbq",
        
        # Evidence
        "buddy_letters": "/buddy",
        "nexus_imo": "/imo",
        "personal_statement": "/statement",
        
        # Special Programs
        "tdiu": "/tdiu",
        "smc": "/smc",
        "pt_status": "/pt",
        "aid_attendance": "/aa",
        
        # Secondary Conditions
        "secondary_conditions": "/claimtype#secondary",
        "tertiary_conditions": "/tertiary",
        "service_connection": "/serviceconnection",
        "aggravated_sc": "/agg",
        
        # Special Topics
        "presumptive_conditions": "/presumptive",
        "pact_act": "/pact",
        "agent_orange": "/agentorange",
        "burn_pits": "/burnpit",
        "gulf_war": "/gulfwar",
        
        # Protections
        "rating_protections": "/protection",
        "rating_reduction": "/reduction",
        
        # Administrative
        "cfile_request": "/cfile",
        "congressional_inquiry": "/congressional",
        "vso_info": "/vso",
        
        # Body Systems - These link to specific condition rating info
        "mental_disorders": "/mental",
        "musculoskeletal": "/musculoskeletal",
        "respiratory": "/airsystem",
        "cardiovascular": "/heart",
        "digestive": "/digsystem",
        "nervous_system": "/nervesystem",
        "skin_conditions": "/skin",
        "genitourinary": "/gensystem",
        "endocrine": "/endsystem",
        "hearing_ears": "/ears",
        "eyes_vision": "/eyes",
    }
    
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "community"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.scraped_data = []
        self.stats = {
            "pages_scraped": 0,
            "entries_created": 0,
            "errors": 0
        }
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'VetRate.org Knowledge Scraper (contact@vet-rate.org) - For veteran assistance',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        })
    
    def scrape_page(self, page_name: str, page_path: str) -> List[Dict]:
        """Scrape a single page and extract knowledge entries."""
        url = f"{self.BASE_URL}{page_path}"
        entries = []
        
        try:
            logger.info(f"Scraping: {page_name} -> {url}")
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract page title
            title_elem = soup.find('h1')
            page_title = title_elem.get_text(strip=True) if title_elem else page_name.replace('_', ' ').title()
            
            # Extract main content sections
            content_sections = self._extract_sections(soup)
            
            for section_title, section_content in content_sections:
                if section_content and len(section_content) > 50:  # Skip very short content
                    entry = self._create_kb_entry(
                        page_name=page_name,
                        page_title=page_title,
                        section_title=section_title,
                        content=section_content,
                        url=url
                    )
                    entries.append(entry)
                    self.stats["entries_created"] += 1
            
            # Also create a summary entry for the whole page
            full_text = soup.get_text(separator=' ', strip=True)
            summary = self._create_summary_entry(page_name, page_title, full_text[:2000], url)
            if summary:
                entries.append(summary)
                self.stats["entries_created"] += 1
            
            self.stats["pages_scraped"] += 1
            logger.info(f"  -> Extracted {len(entries)} knowledge entries")
            
            # Be respectful - 1 second between requests
            time.sleep(1)
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error scraping {url}: {e}")
            self.stats["errors"] += 1
        except Exception as e:
            logger.error(f"Unexpected error scraping {url}: {e}")
            self.stats["errors"] += 1
        
        return entries
    
    def _extract_sections(self, soup: BeautifulSoup) -> List[tuple]:
        """Extract content sections with their headers."""
        sections = []
        
        # Find all h2 and h3 headers
        for header in soup.find_all(['h2', 'h3']):
            section_title = header.get_text(strip=True)
            
            # Get content following this header until next header
            content_parts = []
            sibling = header.find_next_sibling()
            
            while sibling and sibling.name not in ['h2', 'h3', 'h1']:
                if sibling.name in ['p', 'ul', 'ol', 'div', 'table']:
                    text = sibling.get_text(separator=' ', strip=True)
                    if text:
                        content_parts.append(text)
                sibling = sibling.find_next_sibling()
            
            full_content = ' '.join(content_parts)
            if full_content:
                sections.append((section_title, full_content))
        
        return sections
    
    def _create_kb_entry(self, page_name: str, page_title: str, section_title: str, 
                         content: str, url: str) -> Dict:
        """Create a knowledge base entry in the standard format."""
        
        # Clean up content
        content = re.sub(r'\s+', ' ', content).strip()
        
        # Create instruction based on context
        if 'how' in section_title.lower() or 'filing' in page_name:
            instruction = f"How do I {section_title.lower()}?"
        elif 'what' in section_title.lower():
            instruction = f"What is {section_title}?"
        else:
            instruction = f"Explain {section_title} for VA disability claims"
        
        return {
            "instruction": instruction,
            "input": "",
            "output": f"⚠️ COMMUNITY GUIDANCE (Not Official VA Regulations):\n\n{content}\n\n" +
                     f"Source: Veterans Benefits Knowledge Base - {page_title}",
            "metadata": {
                "source": "COMMUNITY_PROVIDED",
                "source_name": "Veterans Benefits Knowledge Base",
                "source_url": url,
                "source_disclaimer": "NOT from official VA regulations. Community-provided guidance from veterans helping veterans.",
                "type": "community_knowledge",
                "page_name": page_name,
                "page_title": page_title,
                "section_title": section_title,
                "scraped_at": datetime.now().isoformat(),
                "content_warning": "This is community-provided information, not official VA policy. Always verify with official sources."
            }
        }
    
    def _create_summary_entry(self, page_name: str, page_title: str, 
                              content: str, url: str) -> Optional[Dict]:
        """Create a summary entry for the page."""
        if len(content) < 100:
            return None
        
        # Clean and truncate
        content = re.sub(r'\s+', ' ', content).strip()[:1500]
        
        return {
            "instruction": f"What should I know about {page_title.lower()} for VA disability claims?",
            "input": "",
            "output": f"⚠️ COMMUNITY GUIDANCE (Not Official VA Regulations):\n\n{page_title}:\n\n{content}...\n\n" +
                     f"For full details, visit: {url}",
            "metadata": {
                "source": "COMMUNITY_PROVIDED",
                "source_name": "Veterans Benefits Knowledge Base",
                "source_url": url,
                "source_disclaimer": "NOT from official VA regulations. Community-provided guidance from veterans helping veterans.",
                "type": "community_knowledge_summary",
                "page_name": page_name,
                "page_title": page_title,
                "scraped_at": datetime.now().isoformat(),
                "content_warning": "This is community-provided information, not official VA policy. Always verify with official sources."
            }
        }
    
    def scrape_all(self) -> List[Dict]:
        """Scrape all configured pages."""
        logger.info("=" * 60)
        logger.info("💎 Veterans Benefits KB Community Scraper")
        logger.info("=" * 60)
        logger.info(f"Target: {len(self.PAGES_TO_SCRAPE)} pages")
        logger.info("Tagging: COMMUNITY_PROVIDED - Not from Regulations")
        logger.info("=" * 60)
        
        all_entries = []
        
        for page_name, page_path in self.PAGES_TO_SCRAPE.items():
            entries = self.scrape_page(page_name, page_path)
            all_entries.extend(entries)
        
        self.scraped_data = all_entries
        return all_entries
    
    def export_knowledge_base(self, filename: str = "community_knowledge.json") -> Path:
        """Export scraped data to JSON file."""
        output_path = self.output_dir / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Exported {len(self.scraped_data)} entries to {output_path}")
        return output_path
    
    def print_summary(self):
        """Print scraping summary."""
        logger.info("\n" + "=" * 60)
        logger.info("💎 SCRAPING COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Pages Scraped: {self.stats['pages_scraped']}")
        logger.info(f"Entries Created: {self.stats['entries_created']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Output Directory: {self.output_dir}")
        logger.info("=" * 60)
        logger.info("⚠️ ALL DATA TAGGED AS: COMMUNITY_PROVIDED")
        logger.info("⚠️ NOT OFFICIAL VA REGULATIONS")
        logger.info("=" * 60)


def main():
    """Main entry point."""
    scraper = VeteransBenefitsKBScraper()
    
    # Scrape all pages
    entries = scraper.scrape_all()
    
    # Export results
    if entries:
        scraper.export_knowledge_base()
        scraper.print_summary()
        print(f"\n✅ Success! Scraped {len(entries)} community knowledge entries")
    else:
        print("\n❌ No entries scraped. Check logs for details.")


if __name__ == "__main__":
    main()
