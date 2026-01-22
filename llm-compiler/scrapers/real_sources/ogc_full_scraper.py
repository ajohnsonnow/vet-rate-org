#!/usr/bin/env python3
"""
💎 DIAMOND OGC Precedent Opinions Scraper
==========================================
Scrapes ALL VA Office of General Counsel Precedent Opinions (1987-2019)

These are BINDING legal interpretations that VA must follow.
Critical for understanding how regulations are applied.

Source: https://www.va.gov/ogc/precedentopinions.asp
"""

import json
import re
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

# Configuration
BASE_URL = "https://www.va.gov/ogc"
MAIN_PAGE = f"{BASE_URL}/precedentopinions.asp"

# Years with opinions (from the VA website)
OPINION_YEARS = [
    2019, 2018, 2017, 2015, 2014, 2012, 2011, 2010, 2009,
    2008, 2007, 2006, 2005, 2004, 2003, 2002, 2001, 2000, 1999,
    1998, 1997, 1996, 1995, 1994, 1993, 1992, 1991, 1990, 1989, 1987
]

# Output paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "ogc"
OUTPUT_FILE = OUTPUT_DIR / "ogc_all_opinions.json"

# Headers for requests
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_page(url: str) -> Optional[str]:
    """Fetch a webpage with error handling."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"   ❌ Error fetching {url}: {e}")
        return None


def parse_year_page(html: str, year: int) -> List[Dict]:
    """Parse a year's opinion list page."""
    opinions = []
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find all opinion links - typically in format VAOPGCPREC X-YY
    # Look for links containing opinion numbers
    links = soup.find_all('a', href=True)
    
    for link in links:
        href = link.get('href', '')
        text = link.get_text(strip=True)
        
        # Match opinion patterns like "1-97", "12-2003", etc.
        if re.search(r'\d+-\d{2,4}', text) or 'VAOPGCPREC' in text.upper():
            # Extract opinion number
            opinion_match = re.search(r'(\d+)-(\d{2,4})', text)
            if opinion_match:
                opinion_num = opinion_match.group(1)
                opinion_year = opinion_match.group(2)
                
                # Normalize year to 4 digits
                if len(opinion_year) == 2:
                    opinion_year = f"19{opinion_year}" if int(opinion_year) > 50 else f"20{opinion_year}"
                
                citation = f"VAOPGCPREC {opinion_num}-{opinion_year}"
                
                # Build full URL
                if href.startswith('http'):
                    full_url = href
                elif href.startswith('/'):
                    full_url = f"https://www.va.gov{href}"
                else:
                    full_url = f"{BASE_URL}/{href}"
                
                opinions.append({
                    "citation": citation,
                    "url": full_url,
                    "year": int(opinion_year),
                    "number": int(opinion_num),
                    "link_text": text
                })
    
    return opinions


def fetch_opinion_content(url: str) -> Optional[Dict]:
    """Fetch the full content of an opinion."""
    html = fetch_page(url)
    if not html:
        return None
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Try to find the main content area
    content_area = None
    
    # Try various content selectors
    for selector in ['#maincontent', '.content', 'main', 'article', '#content']:
        content_area = soup.select_one(selector)
        if content_area:
            break
    
    if not content_area:
        # Fallback: get body content
        content_area = soup.find('body')
    
    if not content_area:
        return None
    
    # Extract text, preserving structure
    full_text = content_area.get_text(separator='\n', strip=True)
    
    # Try to extract title/subject
    title = ""
    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
    
    # Try to find the "held" or conclusion section
    held_match = re.search(r'HELD[:\s]*(.+?)(?=\n\n|\Z)', full_text, re.IGNORECASE | re.DOTALL)
    held = held_match.group(1).strip() if held_match else ""
    
    # Extract question presented
    question_match = re.search(r'QUESTION[S]?\s*PRESENTED[:\s]*(.+?)(?=HELD|DISCUSSION|\n\n)', full_text, re.IGNORECASE | re.DOTALL)
    question = question_match.group(1).strip() if question_match else ""
    
    # Extract related statutes/regulations
    statutes = re.findall(r'38\s*(?:U\.?S\.?C\.?|C\.?F\.?R\.?)\s*[§\s]*[\d\.]+(?:\([a-z]\))?', full_text)
    statutes = list(set(statutes))  # Remove duplicates
    
    return {
        "title": title,
        "full_text": full_text[:15000],  # Limit to 15k chars
        "held": held[:2000] if held else "",
        "question_presented": question[:2000] if question else "",
        "related_statutes": statutes,
        "text_length": len(full_text)
    }


def create_knowledge_entry(opinion: Dict, content: Optional[Dict]) -> Dict:
    """Create a standardized knowledge base entry."""
    citation = opinion['citation']
    
    # Build content string
    if content:
        content_text = f"Citation: {citation}\n\n"
        if content.get('question_presented'):
            content_text += f"QUESTION PRESENTED:\n{content['question_presented']}\n\n"
        if content.get('held'):
            content_text += f"HELD:\n{content['held']}\n\n"
        if content.get('related_statutes'):
            content_text += f"RELATED STATUTES: {', '.join(content['related_statutes'])}\n\n"
        if content.get('full_text'):
            # Add summary of full text
            content_text += f"FULL OPINION (excerpt):\n{content['full_text'][:5000]}"
    else:
        content_text = f"Citation: {citation}\nOpinion content could not be retrieved. See URL for full text."
    
    return {
        "id": f"ogc_{citation.replace(' ', '_').replace('-', '_').lower()}",
        "title": content.get('title', citation) if content else citation,
        "content": content_text,
        "metadata": {
            "source": "OGC_PRECEDENT_OPINION",
            "type": "legal_opinion",
            "citation": citation,
            "year": opinion['year'],
            "opinion_number": opinion['number'],
            "url": opinion['url'],
            "hierarchy_level": 4,  # High authority - binding on VA
            "color_code": "PURPLE",
            "legal_weight": "BINDING - VA must follow these interpretations",
            "source_disclaimer": "VA Office of General Counsel Precedent Opinion - Binding interpretation of VA regulations",
            "related_statutes": content.get('related_statutes', []) if content else [],
            "held_summary": content.get('held', '')[:500] if content else "",
            "scraped_at": datetime.now().isoformat(),
            "content_retrieved": content is not None
        }
    }


def main():
    print("=" * 70)
    print("💎 DIAMOND OGC Precedent Opinions Scraper")
    print("=" * 70)
    print(f"Target: {len(OPINION_YEARS)} years of opinions (1987-2019)")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    all_opinions = []
    all_entries = []
    stats = {
        "years_processed": 0,
        "opinions_found": 0,
        "content_retrieved": 0,
        "errors": 0
    }
    
    # Process each year
    for year in OPINION_YEARS:
        print(f"\n📅 Processing year {year}...")
        
        # Construct year URL (pattern varies)
        year_url = f"{BASE_URL}/precedentopinions{year}.asp"
        
        html = fetch_page(year_url)
        if not html:
            print(f"   ⚠️ Could not fetch year {year}")
            stats["errors"] += 1
            continue
        
        # Parse opinions from year page
        year_opinions = parse_year_page(html, year)
        print(f"   Found {len(year_opinions)} opinions")
        
        if not year_opinions:
            # Try alternate URL patterns
            alt_urls = [
                f"{BASE_URL}/PrecedentOpinions{year}.asp",
                f"{BASE_URL}/opinions{year}.asp",
            ]
            for alt_url in alt_urls:
                html = fetch_page(alt_url)
                if html:
                    year_opinions = parse_year_page(html, year)
                    if year_opinions:
                        print(f"   Found {len(year_opinions)} opinions (alt URL)")
                        break
        
        stats["years_processed"] += 1
        
        # Fetch content for each opinion
        for opinion in year_opinions:
            print(f"   📄 {opinion['citation']}...")
            all_opinions.append(opinion)
            stats["opinions_found"] += 1
            
            # Fetch full content
            content = fetch_opinion_content(opinion['url'])
            if content:
                stats["content_retrieved"] += 1
            
            # Create knowledge entry
            entry = create_knowledge_entry(opinion, content)
            all_entries.append(entry)
            
            # Be respectful - small delay between requests
            time.sleep(0.5)
    
    # Save all opinions
    output_data = {
        "source": "VA Office of General Counsel",
        "description": "Precedent Opinions - Binding legal interpretations (1987-2019)",
        "scraped_at": datetime.now().isoformat(),
        "statistics": stats,
        "total_entries": len(all_entries),
        "entries": all_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 70)
    print("💎 OGC SCRAPING COMPLETE")
    print("=" * 70)
    print(f"\n📊 Statistics:")
    print(f"   Years Processed: {stats['years_processed']}")
    print(f"   Opinions Found: {stats['opinions_found']}")
    print(f"   Content Retrieved: {stats['content_retrieved']}")
    print(f"   Errors: {stats['errors']}")
    print(f"\n📁 Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    return all_entries


if __name__ == "__main__":
    entries = main()
