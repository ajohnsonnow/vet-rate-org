#!/usr/bin/env python3
"""
38 CFR Part 4 Rating Schedule Gap Filler
Target: 245+ new entries to reach 1000 total
Strategy: Deep scrape diagnostic codes, rating formulas, special rules
"""
import requests
from bs4 import BeautifulSoup
import json
import time
import re
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent.parent / "knowledge-base" / "ecfr-fresh"
OUTPUT_FILE = OUTPUT_DIR / "ecfr_gap_filler.json"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Target specific 38 CFR Part 4 sections that are likely missing
TARGET_SECTIONS = [
    # Subpart A - General Policy in Rating
    "https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-A",
    "https://www.ecfr.gov/current/title-38/section-4.1",
    "https://www.ecfr.gov/current/title-38/section-4.2",
    "https://www.ecfr.gov/current/title-38/section-4.3",
    "https://www.ecfr.gov/current/title-38/section-4.7",
    "https://www.ecfr.gov/current/title-38/section-4.10",
    "https://www.ecfr.gov/current/title-38/section-4.14",
    "https://www.ecfr.gov/current/title-38/section-4.16",
    "https://www.ecfr.gov/current/title-38/section-4.19",
    "https://www.ecfr.gov/current/title-38/section-4.21",
    "https://www.ecfr.gov/current/title-38/section-4.25",  # Combined ratings table
    "https://www.ecfr.gov/current/title-38/section-4.26",
    "https://www.ecfr.gov/current/title-38/section-4.27",
    "https://www.ecfr.gov/current/title-38/section-4.30",
    "https://www.ecfr.gov/current/title-38/section-4.31",
    
    # Subpart B - Disability Ratings (all body systems)
    "https://www.ecfr.gov/current/title-38/chapter-I/part-4/subpart-B",
    
    # Individual diagnostic code sections (musculoskeletal - large)
    "https://www.ecfr.gov/current/title-38/section-4.71a",  # Musculoskeletal
    "https://www.ecfr.gov/current/title-38/section-4.71b",  # Shoulder & arm
    "https://www.ecfr.gov/current/title-38/section-4.71c",  # Foot & ankle
    
    # Cardiovascular system
    "https://www.ecfr.gov/current/title-38/section-4.104",  # Cardiovascular
    
    # Respiratory system  
    "https://www.ecfr.gov/current/title-38/section-4.96",   # Respiratory
    "https://www.ecfr.gov/current/title-38/section-4.97",   # Respiratory DBQ
    
    # Mental disorders
    "https://www.ecfr.gov/current/title-38/section-4.125",  # Mental Disorders
    "https://www.ecfr.gov/current/title-38/section-4.126",  # Mental GAF
    "https://www.ecfr.gov/current/title-38/section-4.129",  # Mental percentages
    "https://www.ecfr.gov/current/title-38/section-4.130",  # PTSD
    
    # Neurological
    "https://www.ecfr.gov/current/title-38/section-4.124a", # Neurological
    
    # Skin
    "https://www.ecfr.gov/current/title-38/section-4.118",  # Skin
    
    # Dental & Oral
    "https://www.ecfr.gov/current/title-38/section-4.150",  # Dental
    
    # Digestive
    "https://www.ecfr.gov/current/title-38/section-4.114",  # Digestive
    
    # Genitourinary
    "https://www.ecfr.gov/current/title-38/section-4.115a", # Genitourinary
    "https://www.ecfr.gov/current/title-38/section-4.115b", # Reproductive
    
    # Hemic and Lymphatic
    "https://www.ecfr.gov/current/title-38/section-4.117",  # Hemic
    
    # Endocrine
    "https://www.ecfr.gov/current/title-38/section-4.119",  # Endocrine
]

def extract_diagnostic_codes_from_section(soup, section_url):
    """Extract individual diagnostic codes from a section"""
    codes = []
    
    # Find all diagnostic code entries (usually formatted as "DC 5000 Description")
    content = soup.find('div', class_='content-wrap') or soup.find('main') or soup.find('body')
    
    if not content:
        return []
    
    text = content.get_text()
    
    # Pattern: "5000 " or "DC 5000" or "Code 5000"
    code_pattern = re.compile(r'(?:DC\s+)?(\d{4})\s+([A-Za-z][^\n]{10,200})')
    matches = code_pattern.findall(text)
    
    for code_num, description in matches:
        # Try to find the full entry for this code
        code_section = re.search(
            rf'{code_num}\s+{re.escape(description[:30])}.*?(?=\d{{4}}\s+[A-Z]|$)',
            text,
            re.DOTALL
        )
        
        if code_section:
            content_text = code_section.group(0)[:1500]  # Limit length
        else:
            content_text = f"{code_num} {description}"
        
        codes.append({
            "code": code_num,
            "description": description.strip(),
            "content": content_text.strip(),
            "url": section_url
        })
    
    return codes

def extract_section_content(soup, url):
    """Extract general section content"""
    # Get section title
    title = soup.find('h1')
    if title:
        title = title.get_text(strip=True)
    else:
        title_match = re.search(r'section-4\.(\d+[a-z]?)', url)
        if title_match:
            title = f"38 CFR §4.{title_match.group(1)}"
        else:
            title = "38 CFR Part 4 Section"
    
    # Get content
    content_div = soup.find('div', class_='content-wrap') or soup.find('main')
    
    if not content_div:
        return None, None
    
    # Extract paragraphs
    paragraphs = []
    for p in content_div.find_all(['p', 'div'], recursive=True):
        text = p.get_text(strip=True)
        if text and len(text) > 50:
            paragraphs.append(text)
    
    content = '\n\n'.join(paragraphs[:30])
    
    if len(content) < 100:
        return None, None
    
    return title, content

def scrape_section(url, session):
    """Scrape a section and return both the section and individual diagnostic codes"""
    entries = []
    
    try:
        print(f"   Fetching: {url}")
        response = session.get(url, timeout=20)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # First, try to extract the overall section
        title, content = extract_section_content(soup, url)
        if title and content:
            entries.append({
                "type": "section",
                "title": title,
                "content": content,
                "url": url
            })
            print(f"      ✅ Section: {title}")
        
        # Then extract individual diagnostic codes if present
        codes = extract_diagnostic_codes_from_section(soup, url)
        if codes:
            for code_data in codes:
                entries.append({
                    "type": "diagnostic_code",
                    "title": f"DC {code_data['code']} - {code_data['description'][:80]}",
                    "content": code_data['content'],
                    "url": code_data['url'],
                    "diagnostic_code": code_data['code'],
                    "description": code_data['description']
                })
            print(f"      ✅ Extracted {len(codes)} diagnostic codes")
        
        if not entries:
            print(f"      ⚠️ No content extracted")
        
        return entries
        
    except Exception as e:
        print(f"      ❌ Error: {e}")
        return []

def categorize_entry(title, content, url):
    """Categorize based on body system"""
    text = f"{title} {content} {url}".lower()
    
    categories = {
        "Musculoskeletal": ["joint", "bone", "arthritis", "muscle", "spine", "back", "knee", "shoulder"],
        "Mental Disorders": ["mental", "ptsd", "depression", "anxiety", "schizophrenia", "bipolar"],
        "Neurological": ["brain", "nerve", "peripheral", "migraine", "seizure", "paralysis"],
        "Cardiovascular": ["heart", "hypertension", "artery", "vascular", "cardiovascular"],
        "Respiratory": ["lung", "respiratory", "asthma", "copd", "tuberculosis"],
        "Digestive": ["digestive", "liver", "intestine", "stomach", "esophagus"],
        "Genitourinary": ["kidney", "urinary", "reproductive", "bladder"],
        "Skin": ["skin", "scars", "dermatitis", "eczema"],
        "Hemic/Lymphatic": ["blood", "anemia", "leukemia", "lymph"],
        "Endocrine": ["diabetes", "thyroid", "endocrine", "metabolic"],
        "Dental": ["dental", "teeth", "oral", "jaw"],
        "General Rating": ["rating", "bilateral", "combined", "pyramiding", "extraschedular"],
    }
    
    scores = {}
    for category, keywords in categories.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score
    
    if scores:
        return max(scores.items(), key=lambda x: x[1])[0]
    return "General Rating"

def create_dkb_entry(entry_data, entry_id):
    """Convert to DKB format"""
    category = categorize_entry(entry_data['title'], entry_data['content'], entry_data['url'])
    
    base_entry = {
        "id": f"ecfr-gap-{entry_id:04d}",
        "source": "38 CFR Part 4 - Schedule for Rating Disabilities",
        "title": entry_data['title'],
        "content": entry_data['content'],
        "category": category,
        "hierarchy_level": 1,  # Statutory Law
        "color_code": "#DC2626",  # Red for statutory
        "url": entry_data['url'],
        "metadata": {
            "gap_filler": True,
            "scraped_at": datetime.now().isoformat(),
            "entry_type": entry_data['type']
        }
    }
    
    # Add citation based on type
    if entry_data['type'] == "diagnostic_code":
        base_entry['citation'] = f"38 CFR §4.{entry_data.get('diagnostic_code', 'XXX')}"
        base_entry['metadata']['diagnostic_code'] = entry_data.get('diagnostic_code')
    else:
        # Extract section number from URL
        section_match = re.search(r'section-4\.(\d+[a-z]?)', entry_data['url'])
        if section_match:
            base_entry['citation'] = f"38 CFR §4.{section_match.group(1)}"
        else:
            base_entry['citation'] = "38 CFR Part 4"
    
    return base_entry

def main():
    print("\n" + "="*80)
    print("💎 38 CFR PART 4 GAP FILLER SCRAPER")
    print("="*80)
    print(f"Target: 245+ new entries (diagnostic codes + rating rules)")
    print(f"Output: {OUTPUT_FILE}")
    print("="*80 + "\n")
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    # Scrape all sections
    all_entries = []
    print(f"📥 Scraping {len(TARGET_SECTIONS)} eCFR sections...\n")
    
    for i, url in enumerate(TARGET_SECTIONS, 1):
        print(f"[{i}/{len(TARGET_SECTIONS)}]", end=" ")
        entries = scrape_section(url, session)
        all_entries.extend(entries)
        time.sleep(1)  # Be polite to eCFR servers
    
    print(f"\n✅ Extracted {len(all_entries)} total entries")
    
    # Convert to DKB format
    print("\n📝 Converting to DKB format...")
    dkb_entries = []
    for i, data in enumerate(all_entries, 1):
        dkb_entry = create_dkb_entry(data, i)
        dkb_entries.append(dkb_entry)
    
    # Category breakdown
    from collections import Counter
    categories = Counter(e['category'] for e in dkb_entries)
    
    print(f"\n📊 Category Breakdown:")
    for cat, count in categories.most_common():
        print(f"   {cat:30} {count:>3} entries")
    
    # Type breakdown
    types = Counter(e['metadata']['entry_type'] for e in dkb_entries)
    print(f"\n📊 Entry Type Breakdown:")
    for typ, count in types.most_common():
        print(f"   {typ:30} {count:>3} entries")
    
    # Save output
    output_data = {
        "source": "38 CFR Part 4 Gap Filler",
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(dkb_entries),
        "sections_scraped": len(TARGET_SECTIONS),
        "entries": dkb_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*80)
    print("💎 38 CFR PART 4 GAP FILLER COMPLETE")
    print("="*80)
    print(f"✅ Created {len(dkb_entries)} new rating schedule entries")
    print(f"📁 Output: {OUTPUT_FILE}")
    print(f"🎯 Next: Merge with existing 758 entries")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
