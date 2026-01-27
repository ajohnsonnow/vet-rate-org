#!/usr/bin/env python3
"""
M21-1 Final Push - Get remaining 15+ entries to cross 200
Focus on specific forms and disability-specific pages
"""
import requests
from bs4 import BeautifulSoup
import json
import time
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "m21-1"
OUTPUT_FILE = OUTPUT_DIR / "m21_1_final_push.json"

# Very specific URLs that should work
FINAL_URLS = [
    # More VA forms
    "https://www.va.gov/find-forms/about-form-21-674/",
    "https://www.va.gov/find-forms/about-form-21-686c/",
    "https://www.va.gov/find-forms/about-form-21-4142a/",
    "https://www.va.gov/find-forms/about-form-21-0960c-1/",
    "https://www.va.gov/find-forms/about-form-21-0960c-2/",
    "https://www.va.gov/find-forms/about-form-21-0960c-3/",
    "https://www.va.gov/find-forms/about-form-21-0960c-4/",
    "https://www.va.gov/find-forms/about-form-21-0960c-5/",
    "https://www.va.gov/find-forms/about-form-21-0960c-6/",
    "https://www.va.gov/find-forms/about-form-21-0960c-7/",
    "https://www.va.gov/find-forms/about-form-21-0960c-8/",
    "https://www.va.gov/find-forms/about-form-21-0960m-1/",
    "https://www.va.gov/find-forms/about-form-21-0960m-2/",
    "https://www.va.gov/find-forms/about-form-21-0960m-3/",
    "https://www.va.gov/find-forms/about-form-26-4555/",
    
    # Specific disability pages
    "https://www.va.gov/disability/eligibility/illnesses-within-one-year-of-discharge/",
    "https://www.va.gov/disability/eligibility/former-pows/",
    "https://www.va.gov/disability/eligibility/special-claims/congenital-birth-defects/",
    "https://www.va.gov/disability/eligibility/special-claims/title-38-USC-1151/",
    
    # Exposure-related
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/agent-orange/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/gulf-war-illness-southwest-asia/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/radiogenic-risk-activities/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/specific-environmental-hazards/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/camp-lejeune-water-contamination/",
    "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/asbestos/",
]

CATEGORY_KEYWORDS = {
    "VA Forms": ["form 21-", "form 20-", "form 10-", "form 26-"],
    "Special Claims": ["exposure", "agent orange", "gulf war", "camp lejeune", "birth defect", "former pow"],
    "Benefits Delivery": ["payment", "rate", "compensation"],
    "Evidence Development": ["evidence", "medical", "exam", "dbq"],
    "Filing Procedures": ["how to", "filing", "application"],
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
        if text and len(text) > 40:
            paragraphs.append(text)
    
    content = '\n\n'.join(paragraphs[:30])
    
    if len(content) < 150:
        return None, None
    
    return title, content

def scrape_url(url, session):
    try:
        print(f"   {url.split('/')[-2]}")
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
            print(f"      ⚠️ Skip")
            return None
    except Exception as e:
        print(f"      ❌ {e}")
        return None

def create_dkb_entry(entry_data, entry_id):
    return {
        "id": f"m21-1-final-{entry_id:04d}",
        "source": "M21-1 Manual / VA Procedural Guidance",
        "citation": f"VA.gov - {entry_data['category']}",
        "title": entry_data['title'],
        "content": entry_data['content'],
        "category": entry_data['category'],
        "hierarchy_level": 5,
        "color_code": "#10B981",
        "url": entry_data['url'],
        "metadata": {
            "final_push": True,
            "scraped_at": entry_data['scraped_at']
        }
    }

def main():
    print("\n" + "="*80)
    print("💎 M21-1 FINAL PUSH - Cross 200 Target")
    print("="*80)
    print(f"Current: 185 | Target: 200 | Need: 15+")
    print(f"Output: {OUTPUT_FILE}")
    print("="*80 + "\n")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    scraped = []
    print(f"📥 Scraping {len(FINAL_URLS)} URLs...\n")
    
    for i, url in enumerate(FINAL_URLS, 1):
        print(f"[{i}/{len(FINAL_URLS)}]", end=" ")
        entry = scrape_url(url, session)
        if entry:
            scraped.append(entry)
        time.sleep(0.4)
    
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
        "source": "M21-1 Final Push",
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(dkb_entries),
        "entries": dkb_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*80)
    print("🎯 M21-1 FINAL PUSH COMPLETE")
    print("="*80)
    print(f"✅ Added {len(dkb_entries)} entries")
    print(f"📊 New Total M21-1: 185 + {len(dkb_entries)} = {185 + len(dkb_entries)}")
    print(f"🎉 Target Status: {'✅ COMPLETE' if (185 + len(dkb_entries)) >= 200 else '🟡 PARTIAL'}")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
