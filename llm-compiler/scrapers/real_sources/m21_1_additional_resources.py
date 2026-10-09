#!/usr/bin/env python3
"""
M21-1 Additional Resources Scraper
Target: 40+ more entries to push total over 200
Strategy: Deep dive into /resources/ pages and veteran guides
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "m21-1"
OUTPUT_FILE = OUTPUT_DIR / "m21_1_additional_resources.json"

# Target /resources/ pages that aren't already covered
RESOURCE_URLS = [
    # Direct from VA.gov /resources/ browsing
    "https://www.va.gov/resources/va-claim-types/",
    "https://www.va.gov/resources/choosing-between-decision-review-options/",
    "https://www.va.gov/resources/board-of-veterans-appeals-hearing-options/",
    "https://www.va.gov/resources/va-accredited-representative-faqs/",
    "https://www.va.gov/resources/submitting-buddy-statements-to-support-va-claim/",
    "https://www.va.gov/resources/va-claim-exam/",
    "https://www.va.gov/resources/compensation-and-pension-exam-fact-sheet/",
    "https://www.va.gov/resources/fully-developed-claims-program/",
    "https://www.va.gov/resources/intent-to-file-disability-compensation-claim/",
    "https://www.va.gov/resources/reopening-va-disability-claim/",
    "https://www.va.gov/resources/va-combined-disability-rating/",
    "https://www.va.gov/resources/disability-housing-grants-for-veterans/",
    "https://www.va.gov/resources/va-dependency-and-indemnity-compensation-dic/",
    "https://www.va.gov/resources/va-aided-in-line-review/",
    "https://www.va.gov/resources/retroactive-va-benefits/",
    "https://www.va.gov/resources/individual-unemployability/",
    "https://www.va.gov/resources/temporary-100-percent-disability-rating/",
    "https://www.va.gov/resources/how-to-file-supplemental-claim/",
    "https://www.va.gov/resources/higher-level-review-options/",
    "https://www.va.gov/resources/va-notice-of-disagreement/",
    
    # Additional filing guidance
    "https://www.va.gov/disability/file-disability-claim-form-21-526ez/introduction/",
    "https://www.va.gov/disability/file-an-appeal/",
    "https://www.va.gov/disability/get-help-filing-claim/",
    "https://www.va.gov/disability/view-disability-rating/",
    "https://www.va.gov/disability/after-you-file-claim/",
    "https://www.va.gov/disability/compensation-rates/",
    "https://www.va.gov/disability/add-remove-dependent/",
    "https://www.va.gov/disability/about-disability-ratings/",
    "https://www.va.gov/disability/effective-date/",
    
    # Special programs
    "https://www.va.gov/careers-employment/vocational-rehabilitation/",
    "https://www.va.gov/careers-employment/vocational-rehabilitation/programs/",
    "https://www.va.gov/education/survivor-dependent-benefits/",
    
    # Pension (often references M21-1)
    "https://www.va.gov/pension/veterans-pension-rates/",
    "https://www.va.gov/pension/aid-attendance-housebound/",
    "https://www.va.gov/pension/eligibility/",
    "https://www.va.gov/pension/how-to-apply/",
    
    # Survivor benefits
    "https://www.va.gov/burials-memorials/dependency-indemnity-compensation/",
    "https://www.va.gov/life-insurance/options-eligibility/sgli/",
]

CATEGORY_KEYWORDS = {
    "Decision Reviews": ["decision review", "appeal", "higher level", "supplemental", "board"],
    "Filing Procedures": ["how to file", "filing", "application", "claim form"],
    "Rating Procedures": ["rating", "combined rating", "effective date", "percentage"],
    "Evidence Development": ["evidence", "buddy statement", "medical", "nexus", "exam"],
    "VA Forms": ["form 21-", "form 20-", "form 10-", "about-form"],
    "Benefits Delivery": ["payment", "rate", "compensation", "pension", "dic"],
    "Special Claims": ["vocational", "education", "survivor", "dependent", "unemployability"],
    "Service Connection": ["eligibility", "service connection", "qualifying"],
    "Examinations": ["exam", "c&p", "dbq", "medical exam"],
    "PTSD/Mental Health": ["ptsd", "mental health", "depression"],
}

def categorize(title, content, url):
    text = f"{title} {content} {url}".lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score
    return max(scores.items(), key=lambda x: x[1])[0] if scores else "General Procedures"

def extract_content(soup, url):
    for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header']):
        tag.decompose()
    
    main = soup.find('main') or soup.find('article') or soup.find('div', class_='main-content')
    if not main:
        main = soup.find('body')
    if not main:
        return None, None
    
    title = soup.find('h1')
    title = title.get_text(strip=True) if title else url.split('/')[-2].replace('-', ' ').title()
    
    paragraphs = []
    for tag in main.find_all(['p', 'li', 'h2', 'h3'], recursive=True):
        text = tag.get_text(strip=True)
        if text and len(text) > 50:
            paragraphs.append(text)
    
    content = '\n\n'.join(paragraphs[:25])
    
    if len(content) < 200:
        return None, None
    
    return title, content

def scrape_url(url, session):
    try:
        print(f"   {url}")
        response = session.get(url, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        title, content = extract_content(soup, url)
        
        if title and content:
            category = categorize(title, content, url)
            print(f"      ✅ {category}")
            return {
                "title": title,
                "content": content,
                "url": url,
                "category": category,
                "scraped_at": datetime.now().isoformat()
            }
        else:
            print(f"      ⚠️ Skip - insufficient content")
            return None
    except Exception as e:
        print(f"      ❌ {e}")
        return None

def create_dkb_entry(entry_data, entry_id):
    return {
        "id": f"m21-1-resources-{entry_id:04d}",
        "source": "M21-1 Manual / VA Resources & Guidance",
        "citation": f"VA.gov - {entry_data['category']}",
        "title": entry_data['title'],
        "content": entry_data['content'],
        "category": entry_data['category'],
        "hierarchy_level": 5,
        "color_code": "#10B981",
        "url": entry_data['url'],
        "metadata": {
            "additional_resources": True,
            "scraped_at": entry_data['scraped_at']
        }
    }

def main():
    print("\n" + "="*80)
    print("💎 M21-1 ADDITIONAL RESOURCES SCRAPER")
    print("="*80)
    print(f"Target: 40+ more entries from /resources/ and guides")
    print(f"Output: {OUTPUT_FILE}")
    print("="*80 + "\n")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    scraped = []
    print(f"📥 Scraping {len(RESOURCE_URLS)} resource URLs...\n")
    
    for i, url in enumerate(RESOURCE_URLS, 1):
        print(f"[{i}/{len(RESOURCE_URLS)}]", end=" ")
        entry = scrape_url(url, session)
        if entry:
            scraped.append(entry)
        time.sleep(0.5)
    
    print(f"\n✅ Scraped {len(scraped)} entries")
    
    # Convert to DKB
    dkb_entries = [create_dkb_entry(data, i) for i, data in enumerate(scraped, 1)]
    
    # Stats
    from collections import Counter
    categories = Counter(e['category'] for e in dkb_entries)
    print(f"\n📊 Category Breakdown:")
    for cat, count in categories.most_common():
        print(f"   {cat:30} {count:>3} entries")
    
    # Save
    output = {
        "source": "M21-1 Additional Resources",
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(dkb_entries),
        "entries": dkb_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*80)
    print("💎 M21-1 ADDITIONAL RESOURCES COMPLETE")
    print("="*80)
    print(f"✅ Created {len(dkb_entries)} entries")
    print(f"📁 Output: {OUTPUT_FILE}")
    print(f"🎯 Total M21-1: 133 + 33 + {len(dkb_entries)} = {133 + 33 + len(dkb_entries)}")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
