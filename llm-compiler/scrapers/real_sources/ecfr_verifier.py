#!/usr/bin/env python3
"""
🔍 REAL 38 CFR Scraper & Verifier
=================================
Scrapes the ACTUAL 38 CFR from eCFR.gov and verifies against local data.
NO FAKE DATA - Only real regulatory text.

Source: https://www.ecfr.gov/current/title-38/chapter-I/part-4
"""

import json
import asyncio
import aiohttp
import logging
import re
import ssl
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import xml.etree.ElementTree as ET

# Configure logging
log_dir = Path(__file__).parent.parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"ecfr_scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class RealECFRScraper:
    """Scrape and verify 38 CFR from eCFR.gov"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent.parent
        self.output_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.scraped_dcs = {}
        self.local_dcs = {}
        self.verification_results = {
            "matched": [],
            "mismatched": [],
            "missing_local": [],
            "missing_ecfr": [],
            "errors": []
        }
        
        # eCFR API endpoints
        self.ecfr_base = "https://www.ecfr.gov"
        self.ecfr_api = "https://www.ecfr.gov/api/versioner/v1"
        
        # 38 CFR Part 4 - Rating Schedule sections
        self.rating_schedule_sections = {
            # Part 4 - Rating Schedule for Disabilities
            "4.71a": "Musculoskeletal System",
            "4.73": "Muscle Injuries",
            "4.76": "Visual Impairment",
            "4.85": "Hearing Impairment",
            "4.87": "Diseases of the Ear",
            "4.88": "Infectious Diseases",
            "4.97": "Respiratory System",
            "4.104": "Cardiovascular System",
            "4.110": "Digestive System",
            "4.115a": "Genitourinary System",
            "4.117": "Hemic and Lymphatic Systems",
            "4.118": "Skin",
            "4.119": "Endocrine System",
            "4.120": "Neurological Conditions and Convulsive Disorders",
            "4.124a": "Neurological Conditions (Schedule)",
            "4.126": "Mental Disorders",
            "4.130": "Mental Disorders (Schedule)",
            "4.132": "Dental and Oral Conditions"
        }
        
        # DC ranges by body system
        self.dc_ranges = [
            (5000, 5299, "Musculoskeletal"),
            (5300, 5399, "Muscle Injuries"),
            (6000, 6099, "Eyes"),
            (6100, 6299, "Ears"),
            (6300, 6399, "Infectious Diseases"),
            (6500, 6899, "Respiratory"),
            (7000, 7199, "Cardiovascular"),
            (7200, 7399, "Digestive"),
            (7500, 7599, "Genitourinary"),
            (7700, 7799, "Hemic/Lymphatic"),
            (7800, 7899, "Skin"),
            (7900, 7999, "Endocrine"),
            (8000, 8599, "Neurological"),
            (9200, 9499, "Mental Disorders"),
            (9900, 9999, "Dental/Oral")
        ]
    
    def load_local_disability_data(self):
        """Load the local disabilityData.json"""
        
        local_file = self.project_root / "src" / "data" / "disabilityData.json"
        
        if not local_file.exists():
            logger.error(f"Local file not found: {local_file}")
            return False
        
        try:
            with open(local_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            disabilities = data.get('disabilities', [])
            
            for item in disabilities:
                dc = str(item.get('diagnosticCode', ''))
                if dc:
                    self.local_dcs[dc] = {
                        "code": dc,
                        "name": item.get('conditionName', ''),
                        "aliases": item.get('aliases', ''),
                        "ratingSchedule": item.get('ratingSchedule', ''),
                        "ratingCriteria": item.get('ratingCriteria', {}),
                        "documentationRequirements": item.get('documentationRequirements', ''),
                        "ecfrUrl": item.get('ecfrUrl', ''),
                        "relatedSecondaryConditions": item.get('relatedSecondaryConditions', [])
                    }
            
            logger.info(f"✅ Loaded {len(self.local_dcs)} diagnostic codes from local file")
            return True
            
        except Exception as e:
            logger.error(f"Error loading local file: {e}")
            return False
    
    async def scrape_ecfr_part4(self, session: aiohttp.ClientSession):
        """Scrape 38 CFR Part 4 from eCFR"""
        
        logger.info("="*60)
        logger.info("📜 Scraping 38 CFR Part 4 from eCFR.gov")
        logger.info("="*60)
        
        # eCFR API for Title 38, Part 4
        # Format: /api/versioner/v1/full/{date}/title-{title}.xml
        # Or use the structure endpoint
        
        # Try the new eCFR API structure
        structure_url = f"{self.ecfr_api}/structure/current/title-38.json"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/html, */*'
        }
        
        try:
            # First get the structure
            logger.info("Fetching eCFR structure...")
            async with session.get(structure_url, headers=headers, timeout=30) as response:
                if response.status == 200:
                    structure = await response.json()
                    logger.info("✅ Got eCFR structure")
                    
                    # Find Part 4 in the structure
                    await self._process_structure(session, structure, headers)
                else:
                    logger.warning(f"Structure endpoint returned {response.status}")
                    # Try alternative approach - scrape HTML pages
                    await self._scrape_ecfr_html(session, headers)
                    
        except Exception as e:
            logger.error(f"Error with eCFR API: {e}")
            # Fallback to HTML scraping
            await self._scrape_ecfr_html(session, headers)
    
    async def _process_structure(self, session: aiohttp.ClientSession, structure: Dict, headers: Dict):
        """Process the eCFR structure to find Part 4 sections"""
        
        # Navigate to Part 4
        try:
            chapters = structure.get('children', [])
            for chapter in chapters:
                if chapter.get('identifier') == 'I':  # Chapter I - VA
                    parts = chapter.get('children', [])
                    for part in parts:
                        if part.get('identifier') == '4':  # Part 4
                            logger.info("Found Part 4 - Rating Schedule")
                            await self._scrape_part4_sections(session, part, headers)
                            return
            
            logger.warning("Part 4 not found in structure")
            
        except Exception as e:
            logger.error(f"Error processing structure: {e}")
    
    async def _scrape_part4_sections(self, session: aiohttp.ClientSession, part4: Dict, headers: Dict):
        """Scrape all sections of Part 4"""
        
        subparts = part4.get('children', [])
        
        for subpart in subparts:
            subpart_id = subpart.get('identifier', '')
            subpart_title = subpart.get('label', '')
            logger.info(f"Processing Subpart {subpart_id}: {subpart_title}")
            
            sections = subpart.get('children', [])
            for section in sections:
                section_id = section.get('identifier', '')
                
                # Get full section content
                await self._fetch_section_content(session, section_id, headers)
                await asyncio.sleep(0.5)  # Rate limiting
    
    async def _fetch_section_content(self, session: aiohttp.ClientSession, section_id: str, headers: Dict):
        """Fetch the content of a specific section"""
        
        # eCFR section content URL
        content_url = f"{self.ecfr_base}/current/title-38/chapter-I/part-4/section-4.{section_id}"
        
        try:
            async with session.get(content_url, headers=headers, timeout=30) as response:
                if response.status == 200:
                    html = await response.text()
                    self._parse_section_html(html, section_id)
                    
        except Exception as e:
            logger.error(f"Error fetching section 4.{section_id}: {e}")
    
    async def _scrape_ecfr_html(self, session: aiohttp.ClientSession, headers: Dict):
        """Fallback: Scrape eCFR HTML pages directly"""
        
        logger.info("Using HTML scraping method...")
        
        # Key rating schedule URLs
        rating_urls = [
            # Musculoskeletal
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR046421dd770130b", "Musculoskeletal"),
            # Respiratory
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFRf5cc0e59f5abfef", "Respiratory"),
            # Cardiovascular
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR408f3e25a2e3092", "Cardiovascular"),
            # Digestive
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFRa18ad7b278cab74", "Digestive"),
            # Mental Disorders
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFRd3e50cb5d3e3d86", "Mental Disorders"),
            # Neurological
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR28caef2be90f56e", "Neurological"),
            # Ears
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR9f39e4dd38f2b58", "Ears"),
            # Skin
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR9e987d174e6f493", "Skin"),
            # Endocrine
            ("https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B/subject-group-ECFR9f41e1c6c8ea52a", "Endocrine"),
        ]
        
        for url, system in rating_urls:
            logger.info(f"Scraping {system}...")
            
            try:
                async with session.get(url, headers=headers, timeout=60) as response:
                    if response.status == 200:
                        html = await response.text()
                        self._parse_rating_schedule_html(html, system)
                    else:
                        logger.warning(f"Failed to fetch {system}: status {response.status}")
                        
            except Exception as e:
                logger.error(f"Error scraping {system}: {e}")
            
            await asyncio.sleep(1)  # Rate limiting
    
    def _parse_rating_schedule_html(self, html: str, system: str):
        """Parse rating schedule HTML to extract DC information"""
        
        # Look for diagnostic code patterns
        # Pattern: 5XXX, 6XXX, 7XXX, 8XXX, 9XXX followed by condition name
        dc_pattern = r'([5-9]\d{3})\s*[-–—]\s*([^<\n]+?)(?:\.|<|$)'
        
        matches = re.findall(dc_pattern, html)
        
        for dc_code, name in matches:
            name = self._clean_text(name)
            if name and len(name) > 3:
                self.scraped_dcs[dc_code] = {
                    "code": dc_code,
                    "name": name,
                    "system": system,
                    "source": "eCFR"
                }
        
        # Also look for rating criteria tables
        # Pattern: XX percent or XX%
        rating_pattern = r'(\d{1,3})\s*(?:percent|%)[:\s]+([^<\n]+?)(?:\.|<|$)'
        
        logger.info(f"  Found {len(matches)} DCs in {system}")
    
    def _parse_section_html(self, html: str, section_id: str):
        """Parse a section HTML page"""
        
        # Extract DC definitions and ratings
        dc_pattern = r'(\d{4})\s+([^<]+)'
        matches = re.findall(dc_pattern, html)
        
        for dc_code, content in matches:
            if dc_code.startswith(('5', '6', '7', '8', '9')):
                self.scraped_dcs[dc_code] = {
                    "code": dc_code,
                    "content": self._clean_text(content)[:500],
                    "section": section_id,
                    "source": "eCFR"
                }
    
    def _clean_text(self, text: str) -> str:
        """Clean HTML and normalize text"""
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def verify_local_data(self):
        """Verify local data against scraped eCFR data"""
        
        logger.info("="*60)
        logger.info("🔍 VERIFYING LOCAL DATA AGAINST eCFR")
        logger.info("="*60)
        
        # Compare each local DC against scraped data
        for dc_code, local_data in self.local_dcs.items():
            if dc_code in self.scraped_dcs:
                scraped = self.scraped_dcs[dc_code]
                
                # Check if names match (fuzzy)
                local_name = local_data.get('name', '').lower()
                scraped_name = scraped.get('name', '').lower()
                
                if self._names_match(local_name, scraped_name):
                    self.verification_results["matched"].append({
                        "dc": dc_code,
                        "local_name": local_data.get('name'),
                        "ecfr_name": scraped.get('name'),
                        "status": "VERIFIED"
                    })
                else:
                    self.verification_results["mismatched"].append({
                        "dc": dc_code,
                        "local_name": local_data.get('name'),
                        "ecfr_name": scraped.get('name'),
                        "status": "NAME_MISMATCH"
                    })
            else:
                self.verification_results["missing_ecfr"].append({
                    "dc": dc_code,
                    "local_name": local_data.get('name'),
                    "status": "NOT_IN_ECFR_SCRAPE"
                })
        
        # Check for DCs in eCFR but not in local
        for dc_code in self.scraped_dcs:
            if dc_code not in self.local_dcs:
                self.verification_results["missing_local"].append({
                    "dc": dc_code,
                    "ecfr_name": self.scraped_dcs[dc_code].get('name'),
                    "status": "NOT_IN_LOCAL"
                })
        
        # Log results
        logger.info(f"✅ Matched: {len(self.verification_results['matched'])}")
        logger.info(f"⚠️ Name mismatches: {len(self.verification_results['mismatched'])}")
        logger.info(f"❌ Missing from eCFR scrape: {len(self.verification_results['missing_ecfr'])}")
        logger.info(f"❌ Missing from local: {len(self.verification_results['missing_local'])}")
    
    def _names_match(self, name1: str, name2: str) -> bool:
        """Check if two condition names match (fuzzy)"""
        if not name1 or not name2:
            return False
        
        # Normalize
        name1 = re.sub(r'[^a-z0-9]', '', name1.lower())
        name2 = re.sub(r'[^a-z0-9]', '', name2.lower())
        
        # Check for substring match or high similarity
        if name1 in name2 or name2 in name1:
            return True
        
        # Check first few words match
        words1 = name1[:20]
        words2 = name2[:20]
        
        return words1 == words2
    
    def save_results(self):
        """Save all results"""
        
        # Save scraped eCFR data
        ecfr_file = self.output_dir / "ecfr_scraped.json"
        with open(ecfr_file, 'w', encoding='utf-8') as f:
            json.dump({
                "metadata": {
                    "scraped": datetime.now().isoformat(),
                    "source": "eCFR.gov",
                    "total_dcs": len(self.scraped_dcs)
                },
                "diagnostic_codes": self.scraped_dcs
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved scraped eCFR data to {ecfr_file}")
        
        # Save verification results
        verify_file = self.output_dir / "verification_results.json"
        with open(verify_file, 'w', encoding='utf-8') as f:
            json.dump({
                "metadata": {
                    "verified": datetime.now().isoformat(),
                    "local_file": "src/data/disabilityData.json",
                    "ecfr_source": "eCFR.gov"
                },
                "summary": {
                    "total_local": len(self.local_dcs),
                    "total_scraped": len(self.scraped_dcs),
                    "matched": len(self.verification_results['matched']),
                    "mismatched": len(self.verification_results['mismatched']),
                    "missing_ecfr": len(self.verification_results['missing_ecfr']),
                    "missing_local": len(self.verification_results['missing_local'])
                },
                "results": self.verification_results
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved verification results to {verify_file}")
    
    async def run(self):
        """Run the full scrape and verify process"""
        
        logger.info("="*70)
        logger.info("🔍 38 CFR SCRAPER & VERIFIER")
        logger.info("="*70)
        
        # Load local data first
        if not self.load_local_disability_data():
            return None
        
        # Create SSL context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        connector = aiohttp.TCPConnector(ssl=ssl_context, limit=5)
        timeout = aiohttp.ClientTimeout(total=120)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            # Scrape eCFR
            await self.scrape_ecfr_part4(session)
        
        # Verify
        self.verify_local_data()
        
        # Save
        self.save_results()
        
        return {
            "local_dcs": len(self.local_dcs),
            "scraped_dcs": len(self.scraped_dcs),
            "verification": self.verification_results
        }


async def main():
    scraper = RealECFRScraper()
    results = await scraper.run()
    
    if results:
        print("\n" + "="*50)
        print("📜 eCFR SCRAPE & VERIFY COMPLETE")
        print("="*50)
        print(f"Local DCs: {results['local_dcs']}")
        print(f"Scraped DCs: {results['scraped_dcs']}")
        print(f"Matched: {len(results['verification']['matched'])}")
        print(f"Mismatched: {len(results['verification']['mismatched'])}")
        print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
