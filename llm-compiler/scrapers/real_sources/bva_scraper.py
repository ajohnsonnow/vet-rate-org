#!/usr/bin/env python3
"""
🔍 REAL BVA Decision Scraper
============================
Scrapes ACTUAL BVA decisions from the official VA BVA search database.
NO FAKE DATA - Only real citations and real decision text.

Sources:
- https://www.index.va.gov/search/va/bva.jsp (BVA Search)
- https://www.bva.va.gov/ (Board of Veterans Appeals)
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
from urllib.parse import urlencode, quote_plus
import time

# Configure logging
log_dir = Path(__file__).parent.parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"bva_scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class RealBVAScraper:
    """Scrape REAL BVA decisions from official VA sources"""
    
    def __init__(self):
        self.output_dir = Path(__file__).parent.parent.parent / "knowledge-base" / "bva"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.decisions = []
        self.stats = {
            "searched": 0,
            "found": 0,
            "scraped": 0,
            "errors": 0
        }
        
        # Key search terms for VA disability claims
        self.search_topics = [
            # High-value conditions
            "PTSD service connection",
            "PTSD combat veteran",
            "PTSD military sexual trauma",
            "sleep apnea secondary",
            "sleep apnea CPAP",
            "sleep apnea PTSD",
            "tinnitus service connection",
            "hearing loss service connection",
            "lumbar spine service connection",
            "cervical spine service connection",
            "knee service connection",
            "knee secondary bilateral",
            "TBI traumatic brain injury",
            "migraine headaches",
            "GERD secondary",
            "hypertension secondary PTSD",
            "diabetes type 2 agent orange",
            "peripheral neuropathy secondary diabetes",
            "ischemic heart disease agent orange",
            "TDIU unemployability",
            "TDIU extraschedular",
            "effective date service connection",
            "CUE clear unmistakable error",
            "Gulf War undiagnosed illness",
            "burn pit respiratory",
            "PACT Act presumptive",
            "aid attendance SMC",
            "housebound SMC",
            "depression secondary",
            "anxiety service connection",
            "radiculopathy secondary spine",
            "erectile dysfunction secondary",
            "fibromyalgia Gulf War",
            "chronic fatigue syndrome",
            "irritable bowel syndrome",
            "sinusitis service connection",
            "asthma service connection",
            "skin condition eczema",
            "scars painful",
            "rating increase",
            "DeLuca functional loss"
        ]
    
    async def search_bva_decisions(self, session: aiohttp.ClientSession, query: str, max_results: int = 10) -> List[Dict]:
        """Search BVA decisions using the VA search API"""
        
        results = []
        
        # VA BVA Search endpoint
        # The search uses a specific format
        search_url = "https://www.index.va.gov/search/va/bva_search.jsp"
        
        params = {
            'QT': query,
            'sort': 'date:D:S:d1',
            'num': str(max_results),
            'start': '0'
        }
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Referer': 'https://www.index.va.gov/search/va/bva.jsp'
            }
            
            async with session.get(search_url, params=params, headers=headers, timeout=30) as response:
                if response.status == 200:
                    html = await response.text()
                    results = self._parse_bva_search_results(html, query)
                    self.stats["searched"] += 1
                    self.stats["found"] += len(results)
                    logger.info(f"Found {len(results)} results for: {query}")
                else:
                    logger.warning(f"BVA search returned status {response.status} for: {query}")
                    self.stats["errors"] += 1
                    
        except asyncio.TimeoutError:
            logger.warning(f"Timeout searching BVA for: {query}")
            self.stats["errors"] += 1
        except Exception as e:
            logger.error(f"Error searching BVA for '{query}': {e}")
            self.stats["errors"] += 1
        
        return results
    
    def _parse_bva_search_results(self, html: str, query: str) -> List[Dict]:
        """Parse BVA search results HTML"""
        results = []
        
        # Look for decision links and citation patterns
        # BVA decisions typically have citation format like "Citation Nr: XXXXXXX"
        citation_pattern = r'Citation\s*Nr[:\s]+(\d{7,})'
        citations = re.findall(citation_pattern, html, re.IGNORECASE)
        
        # Also look for decision dates
        date_pattern = r'Decision\s*Date[:\s]+(\d{2}/\d{2}/\d{4})'
        dates = re.findall(date_pattern, html, re.IGNORECASE)
        
        # Look for links to actual decisions
        link_pattern = r'href=["\']([^"\']*bva[^"\']*\.txt)["\']'
        links = re.findall(link_pattern, html, re.IGNORECASE)
        
        # Also try to find decision summaries/snippets
        snippet_pattern = r'<div[^>]*class=["\'][^"\']*result[^"\']*["\'][^>]*>(.*?)</div>'
        snippets = re.findall(snippet_pattern, html, re.IGNORECASE | re.DOTALL)
        
        for i, citation in enumerate(citations[:10]):  # Limit to 10 per search
            result = {
                "citation": f"Citation Nr: {citation}",
                "query": query,
                "date": dates[i] if i < len(dates) else "Unknown",
                "link": links[i] if i < len(links) else None,
                "snippet": self._clean_html(snippets[i]) if i < len(snippets) else ""
            }
            results.append(result)
        
        return results
    
    def _clean_html(self, html: str) -> str:
        """Remove HTML tags and clean text"""
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()[:500]  # Limit snippet length
    
    async def fetch_full_decision(self, session: aiohttp.ClientSession, decision: Dict) -> Optional[Dict]:
        """Fetch the full text of a BVA decision"""
        
        if not decision.get("link"):
            return None
        
        try:
            link = decision["link"]
            if not link.startswith("http"):
                link = f"https://www.index.va.gov{link}"
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            async with session.get(link, headers=headers, timeout=30) as response:
                if response.status == 200:
                    text = await response.text()
                    
                    # Parse the decision text
                    parsed = self._parse_decision_text(text, decision)
                    if parsed:
                        self.stats["scraped"] += 1
                        return parsed
                        
        except Exception as e:
            logger.error(f"Error fetching decision {decision.get('citation')}: {e}")
            self.stats["errors"] += 1
        
        return None
    
    def _parse_decision_text(self, text: str, decision: Dict) -> Optional[Dict]:
        """Parse a full BVA decision text"""
        
        # Extract key components from BVA decision
        
        # Docket number
        docket_match = re.search(r'Docket\s*No[.:\s]+(\d{2}-\d{2}\s*\d{3}[A-Z]?)', text, re.IGNORECASE)
        docket = docket_match.group(1) if docket_match else "Unknown"
        
        # Decision date
        date_match = re.search(r'Date[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})', text)
        date = date_match.group(1) if date_match else decision.get("date", "Unknown")
        
        # Issues on appeal
        issues_match = re.search(r'ISSUES?\s*\n(.*?)(?=REPRESENTATION|ATTORNEY|WITNESS|INTRODUCTION)', text, re.DOTALL | re.IGNORECASE)
        issues = issues_match.group(1).strip() if issues_match else ""
        
        # Findings of fact
        findings_match = re.search(r'FINDINGS?\s*OF\s*FACT\s*\n(.*?)(?=CONCLUSION|REASONS)', text, re.DOTALL | re.IGNORECASE)
        findings = findings_match.group(1).strip()[:2000] if findings_match else ""
        
        # Conclusions of law
        conclusions_match = re.search(r'CONCLUSIONS?\s*OF\s*LAW\s*\n(.*?)(?=REASONS|ORDER)', text, re.DOTALL | re.IGNORECASE)
        conclusions = conclusions_match.group(1).strip()[:2000] if conclusions_match else ""
        
        # Order/Decision
        order_match = re.search(r'ORDER\s*\n(.*?)(?=$|\n\n\n)', text, re.DOTALL | re.IGNORECASE)
        order = order_match.group(1).strip()[:1000] if order_match else ""
        
        # Determine outcome
        outcome = "Unknown"
        if re.search(r'is\s+granted|are\s+granted|service\s+connection.*granted|appeal.*granted', text, re.IGNORECASE):
            outcome = "Granted"
        elif re.search(r'is\s+denied|are\s+denied|appeal.*denied', text, re.IGNORECASE):
            outcome = "Denied"
        elif re.search(r'is\s+remanded|are\s+remanded|appeal.*remanded', text, re.IGNORECASE):
            outcome = "Remanded"
        
        if not issues and not findings and not conclusions:
            return None
        
        return {
            "citation": decision.get("citation", "Unknown"),
            "docket": docket,
            "date": date,
            "query_topic": decision.get("query", ""),
            "issues": self._clean_text(issues),
            "findings": self._clean_text(findings),
            "conclusions": self._clean_text(conclusions),
            "order": self._clean_text(order),
            "outcome": outcome,
            "source_url": decision.get("link", "")
        }
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r' {2,}', ' ', text)
        text = re.sub(r'\t+', ' ', text)
        return text.strip()
    
    async def scrape_all(self):
        """Scrape BVA decisions for all topics"""
        
        logger.info("="*70)
        logger.info("🔍 REAL BVA DECISION SCRAPER")
        logger.info("="*70)
        logger.info(f"Topics to search: {len(self.search_topics)}")
        logger.info("")
        
        # Create SSL context that handles certificate issues
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        connector = aiohttp.TCPConnector(ssl=ssl_context, limit=5)
        timeout = aiohttp.ClientTimeout(total=60)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            
            # Search for each topic
            for i, topic in enumerate(self.search_topics):
                logger.info(f"[{i+1}/{len(self.search_topics)}] Searching: {topic}")
                
                results = await self.search_bva_decisions(session, topic, max_results=5)
                
                # Fetch full decisions for results
                for result in results:
                    full_decision = await self.fetch_full_decision(session, result)
                    if full_decision:
                        self.decisions.append(full_decision)
                        logger.info(f"  ✅ Scraped: {full_decision['citation']}")
                
                # Rate limiting
                await asyncio.sleep(1)
        
        # Save results
        self._save_results()
        
        return self.stats
    
    def _save_results(self):
        """Save scraped decisions"""
        
        # Save raw decisions
        decisions_file = self.output_dir / "bva_decisions_raw.json"
        with open(decisions_file, 'w', encoding='utf-8') as f:
            json.dump({
                "metadata": {
                    "scraped": datetime.now().isoformat(),
                    "total_decisions": len(self.decisions),
                    "stats": self.stats
                },
                "decisions": self.decisions
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved {len(self.decisions)} decisions to {decisions_file}")
        
        # Convert to training format
        training_examples = []
        for decision in self.decisions:
            # Create training example
            example = {
                "instruction": f"What did the BVA decide in {decision['citation']} regarding {decision['query_topic']}?",
                "input": "",
                "output": self._format_decision_output(decision),
                "metadata": {
                    "source": "BVA",
                    "type": "precedent_decision",
                    "citation": decision["citation"],
                    "docket": decision["docket"],
                    "date": decision["date"],
                    "topic": decision["query_topic"],
                    "outcome": decision["outcome"],
                    "source_url": decision["source_url"]
                }
            }
            training_examples.append(example)
        
        # Save training examples
        training_file = self.output_dir / "bva_training_examples.json"
        with open(training_file, 'w', encoding='utf-8') as f:
            json.dump(training_examples, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Saved {len(training_examples)} training examples to {training_file}")
    
    def _format_decision_output(self, decision: Dict) -> str:
        """Format a decision as training output"""
        
        parts = [
            f"**BVA Decision: {decision['citation']}** [REAL BVA DECISION]",
            f"",
            f"**Docket:** {decision['docket']}",
            f"**Date:** {decision['date']}",
            f"**Outcome:** {decision['outcome']}",
            f"",
        ]
        
        if decision['issues']:
            parts.append("**Issues on Appeal:**")
            parts.append(decision['issues'][:500])
            parts.append("")
        
        if decision['findings']:
            parts.append("**Key Findings:**")
            parts.append(decision['findings'][:800])
            parts.append("")
        
        if decision['conclusions']:
            parts.append("**Conclusions of Law:**")
            parts.append(decision['conclusions'][:800])
            parts.append("")
        
        if decision['order']:
            parts.append("**Order:**")
            parts.append(decision['order'][:300])
        
        parts.append("")
        parts.append(f"Source: {decision['source_url']}")
        
        return "\n".join(parts)


async def main():
    scraper = RealBVAScraper()
    stats = await scraper.scrape_all()
    
    print("\n" + "="*50)
    print("🔍 BVA SCRAPING COMPLETE")
    print("="*50)
    print(f"Topics searched: {stats['searched']}")
    print(f"Results found: {stats['found']}")
    print(f"Decisions scraped: {stats['scraped']}")
    print(f"Errors: {stats['errors']}")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
