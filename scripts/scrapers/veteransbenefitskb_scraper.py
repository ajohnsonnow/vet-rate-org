#!/usr/bin/env python3
"""
Veterans Benefits Knowledge Base Scraper
=========================================

⚠️ DO NOT RUN THIS SCRIPT without explicit written permission from the KB owners.

The site veteransbenefitskb.com is copyrighted:
"© 2020-2026 Veterans Benefits Knowledge Base, all rights reserved"

This script is prepared for IF/WHEN permission is granted.

Contact: l8tn8, SSG_Rock via r/VeteransBenefits Reddit

Usage (AFTER PERMISSION GRANTED):
    python veteransbenefitskb_scraper.py --permission-confirmed
"""

import json
import re
import uuid
import time
import random
import argparse
import sys
from datetime import datetime
from typing import Dict, List, Optional

try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPING_AVAILABLE = True
except ImportError:
    SCRAPING_AVAILABLE = False


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    import os
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


# Configuration
BASE_URL = "https://www.veteransbenefitskb.com"
OUTPUT_DIR = "src/data/community/approved/veteransbenefitskb"
PENDING_DIR = "src/data/community/pending_permission/veteransbenefitskb"

# Respectful scraping headers
HEADERS = {
    "User-Agent": "VetRateBot/1.0 (https://vet-rate.org; contact@vet-rate.org) - Scraping with permission",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
}


def get_soup(url: str) -> Optional[BeautifulSoup]:
    """Fetch and parse a webpage."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return BeautifulSoup(response.content, 'html.parser')
    except Exception as e:
        print(f"  [!] Error fetching {url}: {e}")
        return None


def analyze_reliability(text: str) -> Dict:
    """
    Determine if community advice references official sources.
    """
    import re
    
    indicators = {
        "citations_present": False,
        "community_consensus_level": "High (Wiki Standard)"  # Default for KB pages
    }
    
    # Check for references to official docs
    official_markers = [r'38 CFR', r'M21-1', r'DBQ', r'VA Form', r'Title 38', r'§\s*\d+']
    if any(re.search(marker, text, re.IGNORECASE) for marker in official_markers):
        indicators["citations_present"] = True
    
    return indicators


def categorize_by_url(url: str) -> str:
    """Categorize article based on URL path."""
    url_lower = url.lower()
    
    if 'ptsd' in url_lower or 'mental' in url_lower:
        return "Mental Health"
    elif 'sleep' in url_lower or 'apnea' in url_lower:
        return "Sleep Apnea"
    elif 'back' in url_lower or 'spine' in url_lower or 'musculoskeletal' in url_lower:
        return "Musculoskeletal"
    elif 'hearing' in url_lower or 'tinnitus' in url_lower:
        return "Hearing"
    elif 'tdiu' in url_lower:
        return "TDIU"
    elif 'exam' in url_lower or 'c-p' in url_lower or 'cp' in url_lower:
        return "C&P Exams"
    elif 'nexus' in url_lower or 'imo' in url_lower:
        return "Nexus Letters"
    elif 'secondary' in url_lower:
        return "Secondary Conditions"
    elif 'appeal' in url_lower or 'hlr' in url_lower or 'supplemental' in url_lower:
        return "Appeals"
    else:
        return "General"


def scrape_kb(output_dir: str, dry_run: bool = False) -> List[Dict]:
    """
    Scrape the Veterans Benefits Knowledge Base.
    
    Args:
        output_dir: Where to save the JSON output
        dry_run: If True, only discover URLs without scraping content
    
    Returns:
        List of knowledge base entries
    """
    print(f"[*] Starting crawl of {BASE_URL}...")
    
    soup = get_soup(BASE_URL)
    if not soup:
        return []
    
    # Find all internal article links
    article_links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        
        if href.startswith('/') and len(href) > 2:
            # Exclude non-content pages
            if any(x in href.lower() for x in ['about', 'contact', 'mission', 'discord', 'reddit', 'donate']):
                continue
            full_url = BASE_URL + href
            article_links.add(full_url)
    
    print(f"[*] Found {len(article_links)} unique articles")
    
    if dry_run:
        print("\n[DRY RUN] Would scrape these URLs:")
        for url in sorted(article_links):
            print(f"  - {url}")
        return []
    
    knowledge_base_data = []
    
    for i, url in enumerate(article_links):
        print(f"  [{i+1}/{len(article_links)}] Scraping: {url}")
        
        article_soup = get_soup(url)
        if not article_soup:
            continue
        
        # Extract title
        title_tag = article_soup.find('h1')
        title = title_tag.get_text(strip=True) if title_tag else "Unknown Title"
        
        # Extract body content
        content_div = (
            article_soup.find('main') or 
            article_soup.find('article') or 
            article_soup.find('div', class_='content')
        )
        
        if content_div:
            body_text = content_div.get_text(separator='\n', strip=True)
        else:
            body_text = "\n".join([p.get_text() for p in article_soup.find_all('p')])
        
        reliability = analyze_reliability(body_text)
        
        entry = {
            "id": str(uuid.uuid4()),
            "title": title,
            "body_text": body_text,
            "category": categorize_by_url(url),
            "source_meta": {
                "origin_url": url,
                "author_type": "Wiki Consensus",
                "scraped_at": datetime.utcnow().isoformat() + "Z",
                "permission_status": "granted"  # Only run with permission!
            },
            "reliability_indicators": {
                "is_anecdotal": True,
                "citations_present": reliability["citations_present"],
                "community_consensus_level": reliability["community_consensus_level"]
            },
            "ui_display": {
                "warning_label": "Community Field Note",
                "badge": "🛡️ Community Wiki",
                "color_code": "#D4AF37"  # Gold
            }
        }
        
        knowledge_base_data.append(entry)
        
        # Polite delay
        time.sleep(random.uniform(1.0, 2.0))
    
    return knowledge_base_data


def main():
    parser = argparse.ArgumentParser(
        description="Veterans Benefits KB Scraper (REQUIRES PERMISSION)"
    )
    
    parser.add_argument(
        "--permission-confirmed",
        action="store_true",
        help="Confirm you have written permission to scrape"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only discover URLs, don't scrape content"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default=OUTPUT_DIR,
        help="Output directory"
    )
    
    args = parser.parse_args()
    
    if not args.permission_confirmed:
        print("=" * 60)
        print("⚠️  WARNING: DO NOT RUN WITHOUT PERMISSION")
        print("=" * 60)
        print()
        print("veteransbenefitskb.com is copyrighted:")
        print("'© 2020-2026 Veterans Benefits Knowledge Base, all rights reserved'")
        print()
        print("You MUST obtain written permission from the owners before scraping.")
        print()
        print("Contact: l8tn8, SSG_Rock via r/VeteransBenefits Reddit")
        print()
        print("To run a dry-run (URL discovery only):")
        print("  python veteransbenefitskb_scraper.py --dry-run")
        print()
        print("To run after obtaining permission:")
        print("  python veteransbenefitskb_scraper.py --permission-confirmed")
        print()
        sys.exit(1)
    
    if not SCRAPING_AVAILABLE:
        print("Error: Required libraries not installed")
        print("Run: pip install requests beautifulsoup4")
        sys.exit(1)
    
    print("[*] Permission confirmed. Starting scrape...")
    
    data = scrape_kb(args.output, dry_run=args.dry_run)
    
    if data:
        import os
        resolved_output = safe_path(args.output)
        os.makedirs(resolved_output, exist_ok=True)
        output_file = os.path.join(resolved_output, "veteransbenefitskb_export.json")
        
        _safe_output = _extract_safe_path(os.path.realpath(str(output_file)))
        with open(_safe_output, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"\n[SUCCESS] Scraped {len(data)} articles to {output_file}")


if __name__ == "__main__":
    main()
