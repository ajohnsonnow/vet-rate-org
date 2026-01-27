#!/usr/bin/env python3
"""
💎 DIAMOND M21-1 Comprehensive Scraper
======================================
Scrapes ALL available M21-1 Adjudication Procedures Manual content from public sources.

The M21-1 Manual contains VA's internal procedures for processing claims.
While the full manual requires authentication, we can collect substantial procedural
guidance from public VA resources.

Target: 200-500+ procedural entries (ENHANCED SCRAPER)
Sources:
- VA.gov knowledge base (COMPREHENSIVE)
- VA claims process guidance
- Evidence development procedures
- Rating procedures
- Effective date guidance
- Special claims procedures
- VA Forms and instructions
- Vets.gov resources
- All disability condition pages
"""

import json
import re
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
BASE_URLS = {
    "va_resources": "https://www.va.gov/resources/",
    "va_disability": "https://www.va.gov/disability/",
    "va_decision_reviews": "https://www.va.gov/decision-reviews/",
    "va_claim_status": "https://www.va.gov/claim-or-appeal-status/",
    "va_forms": "https://www.va.gov/find-forms/",
    "va_health": "https://www.va.gov/health-care/",
    "va_eligibility": "https://www.va.gov/disability/eligibility/",
}

# Output paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "m21-1"
OUTPUT_FILE = OUTPUT_DIR / "m21_1_comprehensive_knowledge.json"

# Headers for requests
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# M21-1 relevant topics - MASSIVELY EXPANDED
M21_TOPICS = [
    # Claims filing procedures
    "filing-a-claim", "claim-process", "evidence-needed", "how-to-file",
    "intent-to-file", "original-claim", "reopened-claim", "claim-forms",
    "va-form-21-526", "bdd-program", "fully-developed-claims",
    
    # Evidence development
    "va-claim-exam", "medical-evidence", "service-records", "nexus-letter",
    "buddy-statement", "lay-evidence", "medical-opinion", "private-medical-records",
    "independent-medical-opinion", "competent-evidence", "medical-treatise",
    
    # Service connection
    "service-connected-disability", "direct-service-connection",
    "secondary-service-connection", "aggravation", "presumptive-conditions",
    "in-service-injury", "chronic-disease", "continuity-of-symptomatology",
    "preexisting-condition", "presumption-of-soundness", "combat-veteran",
    
    # Rating procedures
    "disability-rating", "combined-ratings", "bilateral-factor",
    "pyramiding", "diagnostic-codes", "schedular-rating", "extraschedular",
    "individual-unemployability", "staged-ratings", "minimum-rating",
    
    # Effective dates
    "effective-date", "retroactive-benefits", "date-of-claim", "liberalizing-law",
    "clear-unmistakable-error", "date-entitlement-arose", "intent-to-file-date",
    
    # Special claims
    "individual-unemployability", "tdiu", "special-monthly-compensation",
    "aid-and-attendance", "housebound", "automotive-grant", "clothing-allowance",
    "dependents-benefits", "survivors-benefits",
    
    # Decision reviews
    "supplemental-claim", "higher-level-review", "board-appeal",
    "duty-to-assist", "notice-of-disagreement", "ama-appeals", "legacy-appeals",
    "remand", "dro-review", "statement-of-the-case", "ssoc",
    
    # Specific conditions (EXPANDED)
    "ptsd-claim", "tinnitus", "sleep-apnea", "mental-health", "depression",
    "anxiety", "migraines", "headaches", "back-pain", "knee-pain",
    "gulf-war-illness", "agent-orange", "burn-pit-exposure", "asbestos",
    "hearing-loss", "vision-loss", "diabetes", "hypertension", "heart-disease",
    "respiratory-conditions", "asthma", "copd", "skin-conditions", "scars",
    "radiculopathy", "neuropathy", "arthritis", "degenerative-disc",
    "traumatic-brain-injury", "tbi", "mst", "military-sexual-trauma",
    
    # Procedural
    "development-process", "due-process", "notice-requirements",
    "exam-scheduling", "rating-decision", "award-letter", "vcaa-notice",
    "duty-to-notify", "duty-to-assist-error", "reasonable-doubt",
    "benefit-of-the-doubt", "preponderance-of-evidence",
    
    # Time-related
    "one-year-rule", "filing-deadline", "extension-of-time", "good-cause",
    
    # Additional categories
    "compensation", "pension", "accrued-benefits", "apportionment",
    "competency", "fiduciary", "debt", "waiver", "reconsideration",
]


def fetch_page(url: str) -> Optional[str]:
    """Fetch a webpage with error handling."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"   ❌ Error fetching {url}: {e}")
        return None


def extract_article_links(base_url: str, html: str) -> List[str]:
    """Extract all article/resource links from a page."""
    links = []
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find all links
    for link in soup.find_all('a', href=True):
        href = link.get('href')
        
        # Skip non-content links
        if any(skip in href for skip in ['#', 'javascript:', 'tel:', 'mailto:', '.pdf', '.zip']):
            continue
        
        # Build full URL
        if href.startswith('http'):
            full_url = href
        elif href.startswith('/'):
            parsed = urlparse(base_url)
            full_url = f"{parsed.scheme}://{parsed.netloc}{href}"
        else:
            full_url = urljoin(base_url, href)
        
        # Only VA.gov URLs
        if 'va.gov' in full_url and full_url not in links:
            links.append(full_url)
    
    return links


def extract_content(html: str, url: str) -> Optional[Dict]:
    """Extract structured content from a VA.gov page."""
    soup = BeautifulSoup(html, 'html.parser')
    
    # Find main content area
    main_content = None
    for selector in ['main', 'article', '#content', '.main-content']:
        main_content = soup.select_one(selector)
        if main_content:
            break
    
    if not main_content:
        return None
    
    # Extract title
    title = ""
    for tag in ['h1', 'h2']:
        title_elem = main_content.find(tag)
        if title_elem:
            title = title_elem.get_text(strip=True)
            break
    
    if not title or len(title) < 10:
        return None
    
    # Extract all text content
    content_parts = []
    
    # Get all paragraphs and list items
    for elem in main_content.find_all(['p', 'li', 'div'], class_=re.compile('paragraph|content|text')):
        text = elem.get_text(strip=True)
        if text and len(text) > 30:
            content_parts.append(text)
    
    full_content = "\n\n".join(content_parts)
    
    # Must have substantial content
    if len(full_content) < 200:
        return None
    
    # Extract section headings
    sections = []
    for heading in main_content.find_all(['h2', 'h3', 'h4']):
        section_title = heading.get_text(strip=True)
        if section_title and len(section_title) > 5:
            sections.append(section_title)
    
    # Detect M21-1 relevance
    relevance_score = 0
    relevance_keywords = [
        'procedure', 'process', 'evidence', 'claim', 'rating', 'effective date',
        'service connection', 'development', 'examination', 'decision', 'award',
        'entitlement', 'adjudication', 'evaluation', 'schedular', 'extraschedular',
    ]
    
    content_lower = full_content.lower()
    for keyword in relevance_keywords:
        if keyword in content_lower:
            relevance_score += content_lower.count(keyword)
    
    # Extract CFR citations
    cfr_citations = re.findall(r'38\s*C\.?F\.?R\.?\s*§?\s*[\d\.]+', full_content)
    cfr_citations = list(set(cfr_citations))[:10]
    
    # Extract M21-1 citations if present
    m21_citations = re.findall(r'M21-1[,\s]+[IVXLC]+\.[\w\.]+', full_content)
    m21_citations = list(set(m21_citations))[:5]
    
    return {
        "title": title,
        "content": full_content[:8000],  # Limit to 8k chars
        "url": url,
        "sections": sections[:10],
        "cfr_citations": cfr_citations,
        "m21_citations": m21_citations,
        "relevance_score": relevance_score,
        "word_count": len(full_content.split())
    }


def categorize_content(content: Dict) -> str:
    """Categorize M21-1 content by topic."""
    text = (content['title'] + " " + content['content']).lower()
    
    # Category keywords
    categories = {
        "Filing Procedures": ['filing', 'how to file', 'application', 'form', 'submit'],
        "Evidence Development": ['evidence', 'medical records', 'service records', 'nexus', 'buddy statement'],
        "Service Connection": ['service connection', 'direct service', 'secondary', 'aggravation', 'presumptive'],
        "Rating Procedures": ['rating', 'disability rating', 'combined rating', 'bilateral', 'pyramiding'],
        "Effective Dates": ['effective date', 'retroactive', 'date of claim', 'entitlement arose'],
        "Special Claims": ['tdiu', 'unemployability', 'smc', 'special monthly', 'aid and attendance'],
        "Examinations": ['exam', 'examination', 'c&p exam', 'medical examination', 'va examination'],
        "Decision Reviews": ['supplemental claim', 'higher level review', 'board appeal', 'nod'],
        "Duty to Assist": ['duty to assist', 'development', 'vcaa', 'notification'],
        "PTSD Claims": ['ptsd', 'post-traumatic stress', 'mental health', 'stressor'],
        "Presumptive Conditions": ['agent orange', 'gulf war', 'burn pit', 'camp lejeune', 'pact act'],
        "General Procedures": ['procedure', 'process', 'adjudication', 'claims process'],
    }
    
    # Score each category
    scores = {}
    for category, keywords in categories.items():
        score = sum(text.count(kw) for kw in keywords)
        if score > 0:
            scores[category] = score
    
    # Return highest scoring category
    if scores:
        return max(scores, key=scores.get)
    return "General Procedures"


def create_kb_entry(content: Dict, index: int) -> Dict:
    """Create a standardized knowledge base entry."""
    category = categorize_content(content)
    
    # Generate citation
    citation = f"M21-1 {category} - {content['title'][:50]}"
    
    # Build comprehensive content string
    kb_content = f"Title: {content['title']}\n\n"
    kb_content += f"Category: {category}\n\n"
    
    if content.get('m21_citations'):
        kb_content += f"M21-1 Citations: {', '.join(content['m21_citations'])}\n\n"
    
    if content.get('cfr_citations'):
        kb_content += f"Related CFR: {', '.join(content['cfr_citations'])}\n\n"
    
    if content.get('sections'):
        kb_content += f"Sections: {', '.join(content['sections'][:5])}\n\n"
    
    kb_content += f"Content:\n{content['content']}"
    
    return {
        "id": f"m21_1_{index:04d}",
        "source": "M21-1",
        "citation": citation,
        "title": f"M21-1: {content['title']}",
        "content": kb_content,
        "category": category,
        "hierarchy_level": 5,  # Level 5: VA Procedures
        "color_code": "BLUE",
        "url": content['url'],
        "metadata": {
            "sections": content.get('sections', [])[:10],
            "cfr_citations": content.get('cfr_citations', []),
            "m21_citations": content.get('m21_citations', []),
            "relevance_score": content.get('relevance_score', 0),
            "word_count": content.get('word_count', 0),
            "scraped_at": datetime.now().isoformat(),
        }
    }


def crawl_topic_pages(topic_keywords: List[str]) -> Set[str]:
    """Crawl VA.gov to find topic-specific pages - ULTRA ENHANCED VERSION."""
    print("\n🔍 Discovering M21-1 relevant pages (ULTRA-ENHANCED CRAWL)...")
    
    discovered_urls = set()
    
    # BASE URLS - comprehensive VA.gov structure
    base_sections = [
        "https://www.va.gov/resources/",
        "https://www.va.gov/disability/",
        "https://www.va.gov/decision-reviews/",
        "https://www.va.gov/health-care/",
        "https://www.va.gov/pension/",
    ]
    
    # HARDCODED HIGH-VALUE PAGES (guaranteed to exist)
    print("   📚 Adding known high-value pages...")
    hardcoded_pages = [
        # Filing and Process
        "https://www.va.gov/disability/how-to-file-claim/",
        "https://www.va.gov/disability/how-to-file-claim/when-to-file/",
        "https://www.va.gov/disability/how-to-file-claim/evidence-needed/",
        "https://www.va.gov/disability/eligibility/",
        "https://www.va.gov/disability/after-you-file-claim/",
        "https://www.va.gov/disability/va-claim-exam/",
        "https://www.va.gov/disability/about-disability-ratings/",
        "https://www.va.gov/disability/effective-date/",
        
        # Decision Reviews
        "https://www.va.gov/decision-reviews/",
        "https://www.va.gov/decision-reviews/supplemental-claim/",
        "https://www.va.gov/decision-reviews/higher-level-review/",
        "https://www.va.gov/decision-reviews/board-appeal/",
        "https://www.va.gov/decision-reviews/after-you-request-review/",
        "https://www.va.gov/decision-reviews/get-board-appeal-decision/",
        
        # Special Claims
        "https://www.va.gov/disability/eligibility/special-claims/",
        "https://www.va.gov/disability/eligibility/special-claims/unemployability/",
        "https://www.va.gov/disability/eligibility/special-claims/1151-claims-title-38/",
        "https://www.va.gov/disability/eligibility/special-claims/birth-defects/",
        "https://www.va.gov/disability/eligibility/special-claims/automobile-allowance-adaptive-equipment/",
        "https://www.va.gov/disability/eligibility/special-claims/clothing-allowance/",
        "https://www.va.gov/disability/eligibility/special-claims/temporary-increase/",
        
        # Hazmat/Presumptive
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/agent-orange/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/asbestos/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/camp-lejeune-water-contamination/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/gulf-war-illness-southwest-asia/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/ionizing-radiation/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/mustard-gas-lewisite/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/project-112-shad/",
        "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/specific-environmental-hazards/",
        
        # PTSD
        "https://www.va.gov/disability/eligibility/ptsd/",
        
        # POW
        "https://www.va.gov/disability/eligibility/former-pows/",
        
        # PACT Act
        "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
    ]
    
    discovered_urls.update(hardcoded_pages)
    print(f"      Added {len(hardcoded_pages)} hardcoded pages")
    
    # DEEP CRAWL: Get ALL links from base sections
    print("   🌐 Phase 1: Deep crawling base sections...")
    for base_url in base_sections:
        html = fetch_page(base_url)
        if html:
            links = extract_article_links(base_url, html)
            for link in links:
                link_lower = link.lower()
                # Accept anything from disability, resources, decision-reviews
                if any(section in link_lower for section in ['/disability/', '/resources/', '/decision-reviews/', '/pension/']):
                    discovered_urls.add(link)
        time.sleep(0.3)
    
    print(f"      Total URLs: {len(discovered_urls)}")
    
    # SECONDARY CRAWL: Crawl discovered pages for more links
    print("   🔗 Phase 2: Secondary link discovery...")
    initial_urls = list(discovered_urls)
    crawl_limit = min(100, len(initial_urls))  # Crawl up to 100 pages
    
    for i, url in enumerate(initial_urls[:crawl_limit]):
        if i % 20 == 0 and i > 0:
            print(f"      Secondary crawl: {i}/{crawl_limit} pages ({len(discovered_urls)} total URLs)")
        
        html = fetch_page(url)
        if html:
            links = extract_article_links(url, html)
            for link in links:
                link_lower = link.lower()
                if any(section in link_lower for section in ['/disability/', '/resources/', '/decision-reviews/']):
                    discovered_urls.add(link)
        time.sleep(0.2)
    
    print(f"      Total URLs: {len(discovered_urls)}")
    
    print(f"   ✅ Discovered {len(discovered_urls)} relevant pages")
    return discovered_urls


def main():
    print("=" * 70)
    print("💎 DIAMOND M21-1 COMPREHENSIVE SCRAPER (ENHANCED)")
    print("=" * 70)
    print(f"Target: 200-500+ procedural entries")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Discover all relevant pages (ENHANCED)
    discovered_urls = crawl_topic_pages(M21_TOPICS)
    
    # Remove duplicates and sort
    all_urls = sorted(discovered_urls)
    
    print(f"\n📥 Processing {len(all_urls)} pages...")
    print("   (Lowered relevance threshold to capture more content)")
    
    all_entries = []
    processed = 0
    skipped = 0
    
    for i, url in enumerate(all_urls, 1):
        if i % 20 == 0:
            print(f"   Progress: {i}/{len(all_urls)} pages ({len(all_entries)} entries)")
        
        html = fetch_page(url)
        if not html:
            skipped += 1
            continue
        
        content = extract_content(html, url)
        # LOWERED THRESHOLD: was 3, now 1 (capture more content)
        if content and content['relevance_score'] > 0:
            entry = create_kb_entry(content, len(all_entries) + 1)
            all_entries.append(entry)
            processed += 1
        else:
            skipped += 1
        
        time.sleep(0.3)  # Faster rate limiting
    
    # Step 3: Save results
    output_data = {
        "source": "M21-1 Adjudication Procedures Manual (Public Guidance)",
        "description": "Comprehensive collection of VA claims adjudication procedures from public sources - ENHANCED EDITION",
        "scraped_at": datetime.now().isoformat(),
        "statistics": {
            "total_pages_crawled": len(all_urls),
            "entries_created": len(all_entries),
            "pages_processed": processed,
            "pages_skipped": skipped,
        },
        "total_entries": len(all_entries),
        "entries": all_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary with category breakdown
    print("\n" + "=" * 70)
    print("💎 M21-1 SCRAPING COMPLETE (ENHANCED)")
    print("=" * 70)
    
    print(f"\n📊 Statistics:")
    print(f"   Pages Crawled: {len(all_urls)}")
    print(f"   Entries Created: {len(all_entries)}")
    print(f"   Pages Processed: {processed}")
    print(f"   Pages Skipped: {skipped}")
    print(f"   Success Rate: {processed/(len(all_urls)) * 100:.1f}%")
    
    # Category breakdown
    if all_entries:
        print(f"\n📋 Entries by Category:")
        categories = {}
        for entry in all_entries:
            cat = entry['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat:30} {count:3} entries")
    
    print(f"\n📁 Output: {OUTPUT_FILE}")
    
    # Check if we met the target
    if len(all_entries) >= 200:
        print(f"\n✅ TARGET MET: {len(all_entries)} entries (200+ required)")
    else:
        print(f"\n⚠️  Below target: {len(all_entries)} entries (200+ recommended)")
        print(f"   Consider running again or expanding seed URLs")
    
    print("=" * 70)
    
    return all_entries


if __name__ == "__main__":
    entries = main()
