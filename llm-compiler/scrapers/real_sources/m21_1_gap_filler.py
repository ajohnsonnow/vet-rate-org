#!/usr/bin/env python3
"""
M21-1 Gap Filler Scraper
Target: 67+ new entries to reach 200 total
Strategy: Focus on weak categories and unexplored VA.gov sections
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from datetime import datetime

# Output path
OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "m21-1"
OUTPUT_FILE = OUTPUT_DIR / "m21_1_gap_filler.json"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Target weak areas and new sections
TARGET_URLS = [
    # PTSD/Mental Health (currently 1 entry)
    "https://www.va.gov/disability/eligibility/ptsd/",
    "https://www.va.gov/health-care/health-needs-conditions/mental-health/",
    "https://www.va.gov/disability/eligibility/illnesses-within-one-year-of-discharge/",
    "https://www.va.gov/resources/ptsd-and-other-mental-health-problems/",
    "https://www.va.gov/disability/va-claim-exam/",
    
    # Service Connection (currently 1 entry)
    "https://www.va.gov/disability/eligibility/",
    "https://www.va.gov/disability/how-to-file-claim/",
    "https://www.va.gov/disability/eligibility/special-claims/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/",
    "https://www.va.gov/resources/direct-service-connection-and-va-disability-claims/",
    "https://www.va.gov/resources/what-is-secondary-service-connection-for-va-disability/",
    
    # Examinations (currently 2 entries)
    "https://www.va.gov/disability/va-claim-exam/",
    "https://www.va.gov/disability/how-va-assigns-disability-ratings/",
    "https://www.va.gov/resources/your-disability-claim-exam-what-to-expect/",
    "https://www.va.gov/resources/how-to-prepare-for-your-va-claim-exam/",
    
    # Appeals & Decision Reviews (expand from 26)
    "https://www.va.gov/decision-reviews/",
    "https://www.va.gov/decision-reviews/higher-level-review/",
    "https://www.va.gov/decision-reviews/supplemental-claim/",
    "https://www.va.gov/decision-reviews/board-appeal/",
    "https://www.va.gov/decision-reviews/after-you-request-review/",
    "https://www.va.gov/decision-reviews/contested-claims/",
    "https://www.va.gov/resources/board-appeals-frequently-asked-questions/",
    "https://www.va.gov/resources/decision-review-options-after-a-va-claim-decision/",
    
    # Benefits Delivery (new category)
    "https://www.va.gov/resources/how-we-assign-disability-severities/",
    "https://www.va.gov/resources/effective-date-for-va-disability-benefits/",
    "https://www.va.gov/disability/dependency-indemnity-compensation/",
    "https://www.va.gov/disability/survivor-dic-rates/",
    
    # Special Claims (expand from 6)
    "https://www.va.gov/disability/eligibility/former-pows/",
    "https://www.va.gov/disability/eligibility/illnesses-within-one-year-of-discharge/",
    "https://www.va.gov/resources/blue-water-navy-veterans-and-agent-orange-exposure/",
    "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
    "https://www.va.gov/disability/eligibility/special-claims/birth-defects/",
    
    # Evidence Development (expand from 6)
    "https://www.va.gov/disability/how-to-file-claim/evidence-needed/",
    "https://www.va.gov/disability/how-to-file-claim/evidence-needed/fully-developed-claims/",
    "https://www.va.gov/resources/what-evidence-do-i-need-to-support-my-va-claim/",
    "https://www.va.gov/resources/how-to-get-help-filing-a-va-disability-claim/",
    
    # Additional VA Forms with procedural guidance
    "https://www.va.gov/find-forms/about-form-21-526ez/",
    "https://www.va.gov/find-forms/about-form-21-0781/",
    "https://www.va.gov/find-forms/about-form-21-0781a/",
    "https://www.va.gov/find-forms/about-form-21-4138/",
    "https://www.va.gov/find-forms/about-form-21-8940/",
    "https://www.va.gov/find-forms/about-form-20-0995/",
    "https://www.va.gov/find-forms/about-form-20-0996/",
    "https://www.va.gov/find-forms/about-form-10182/",
    "https://www.va.gov/find-forms/about-form-21-4142/",
    "https://www.va.gov/find-forms/about-form-21-2680/",
]

# Categories for classification
CATEGORY_KEYWORDS = {
    "PTSD/Mental Health": ["ptsd", "mental health", "depression", "anxiety", "trauma"],
    "Service Connection": ["service connection", "direct service", "secondary service", "eligibility"],
    "Examinations": ["claim exam", "c&p exam", "compensation exam", "medical exam", "dbq"],
    "Decision Reviews": ["decision review", "appeal", "higher level", "supplemental claim", "board appeal"],
    "Benefits Delivery": ["effective date", "payment", "rate", "dependency", "dic"],
    "Special Claims": ["pow", "former prisoner", "pact act", "agent orange", "birth defect"],
    "Evidence Development": ["evidence", "fully developed", "medical record", "nexus letter"],
    "VA Forms": ["form 21-", "form 20-", "form 10-", "about-form"],
    "Filing Procedures": ["how to file", "filing", "application"],
    "Rating Procedures": ["rating", "assign disability", "percentage"],
}

def categorize_content(title, content, url):
    """Categorize based on keywords"""
    text = f"{title} {content} {url}".lower()
    scores = {}
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score
    
    if scores:
        return max(scores.items(), key=lambda x: x[1])[0]
    return "General Procedures"

def extract_content(soup, url):
    """Extract procedural content from VA.gov page"""
    # Remove scripts, styles, navs
    for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header']):
        tag.decompose()
    
    # Find main content area
    main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='main-content')
    
    if not main_content:
        main_content = soup.find('body')
    
    if not main_content:
        return None, None
    
    # Get title
    title = soup.find('h1')
    if title:
        title = title.get_text(strip=True)
    else:
        title = soup.find('title')
        title = title.get_text(strip=True) if title else urlparse(url).path.split('/')[-2].replace('-', ' ').title()
    
    # Extract text content
    paragraphs = []
    for tag in main_content.find_all(['p', 'li', 'h2', 'h3', 'div'], recursive=True):
        text = tag.get_text(strip=True)
        if text and len(text) > 50:  # Minimum content length
            paragraphs.append(text)
    
    content = '\n\n'.join(paragraphs[:20])  # Limit to first 20 substantial paragraphs
    
    # Must have substantial content
    if len(content) < 200:
        return None, None
    
    return title, content

def scrape_url(url, session):
    """Scrape a single URL"""
    try:
        print(f"   Fetching: {url}")
        response = session.get(url, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        title, content = extract_content(soup, url)
        
        if title and content:
            category = categorize_content(title, content, url)
            return {
                "title": title,
                "content": content,
                "url": url,
                "category": category,
                "scraped_at": datetime.now().isoformat()
            }
        else:
            print(f"      ⚠️ Insufficient content")
            return None
            
    except Exception as e:
        print(f"      ❌ Error: {e}")
        return None

def create_dkb_entry(entry_data, entry_id):
    """Convert scraped data to DKB format"""
    return {
        "id": f"m21-1-gap-{entry_id:04d}",
        "source": "M21-1 Manual / VA Procedural Guidance",
        "citation": f"VA.gov - {entry_data['category']}",
        "title": entry_data['title'],
        "content": entry_data['content'],
        "category": entry_data['category'],
        "hierarchy_level": 5,  # VA Procedures
        "color_code": "#10B981",  # Green for procedural
        "url": entry_data['url'],
        "metadata": {
            "gap_filler": True,
            "scraped_at": entry_data['scraped_at'],
            "weak_category_target": entry_data['category'] in [
                "PTSD/Mental Health", "Service Connection", "Examinations"
            ]
        }
    }

def main():
    print("\n" + "="*80)
    print("💎 M21-1 GAP FILLER SCRAPER")
    print("="*80)
    print(f"Target: 67+ new entries (weak categories + new sections)")
    print(f"Output: {OUTPUT_FILE}")
    print("="*80 + "\n")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    # Scrape all target URLs
    scraped_data = []
    print(f"📥 Scraping {len(TARGET_URLS)} target URLs...\n")
    
    for i, url in enumerate(TARGET_URLS, 1):
        print(f"[{i}/{len(TARGET_URLS)}]", end=" ")
        entry = scrape_url(url, session)
        if entry:
            scraped_data.append(entry)
            print(f"      ✅ Scraped: {entry['category']}")
        time.sleep(0.5)  # Be polite
    
    print(f"\n✅ Scraped {len(scraped_data)} entries with content")
    
    # Convert to DKB format
    print("\n📝 Converting to DKB format...")
    dkb_entries = []
    for i, data in enumerate(scraped_data, 1):
        dkb_entry = create_dkb_entry(data, i)
        dkb_entries.append(dkb_entry)
    
    # Category breakdown
    from collections import Counter
    categories = Counter(e['category'] for e in dkb_entries)
    
    print(f"\n📊 Category Breakdown:")
    for cat, count in categories.most_common():
        print(f"   {cat:30} {count:>3} entries")
    
    # Save output
    output_data = {
        "source": "M21-1 Manual Gap Filler",
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(dkb_entries),
        "target_categories": ["PTSD/Mental Health", "Service Connection", "Examinations", 
                             "Decision Reviews", "Special Claims", "Evidence Development"],
        "entries": dkb_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*80)
    print("💎 M21-1 GAP FILLER COMPLETE")
    print("="*80)
    print(f"✅ Created {len(dkb_entries)} new M21-1 entries")
    print(f"📁 Output: {OUTPUT_FILE}")
    print(f"🎯 Next: Merge with existing 133 entries")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
