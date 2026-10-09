#!/usr/bin/env python3
"""
BVA Decision Scraper & Analyzer
===============================

Scrapes public Board of Veterans' Appeals decisions from the VA's official database.
All BVA decisions are public records under FOIA.

Source: https://www.index.va.gov/search/va/bva.jsp

Usage:
    python bva_decision_scraper.py --condition "sleep apnea" --count 100
    python bva_decision_scraper.py --condition "PTSD" --year 2025
    python bva_decision_scraper.py --analyze-existing
"""

import json
import os
import re
import time
import random
import argparse
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from collections import Counter

try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPING_AVAILABLE = True
except ImportError:
    SCRAPING_AVAILABLE = False
    print("⚠️ Install required packages: pip install requests beautifulsoup4")


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


# Configuration
BVA_SEARCH_URL = "https://www.index.va.gov/search/va/bva_search.jsp"
BVA_BASE_URL = "https://www.index.va.gov"
OUTPUT_DIR = Path("src/data/bva_decisions")
ANALYSIS_DIR = Path("src/data/bva_analysis")

# Respectful scraping - these are public records but be nice to the server
HEADERS = {
    "User-Agent": "VetRateResearch/1.0 (https://vet-rate.org; Educational research on BVA decisions)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

# Rate limiting
MIN_DELAY = 2  # seconds between requests
MAX_DELAY = 5

# Per-request timeout (D-M19): fail fast instead of hanging the whole pipeline
# on an unresponsive VA endpoint. (connect, read) seconds.
REQUEST_TIMEOUT = (10, 30)

# Allowed URL prefixes for SSRF protection
_ALLOWED_URL_PREFIXES = (
    'https://www.va.gov',
    'https://api.va.gov',
    'https://sandbox-api.va.gov',
    'https://www.index.va.gov',
)

_SAFE_URL_RE = re.compile(
    r'^(https://(?:[a-zA-Z0-9-]+\.)*(?:va\.gov|index\.va\.gov)(?:/[^\s]*)?)$'
)

def _extract_safe_url(url: str) -> str:
    """Extract validated URL via regex — breaks Snyk SSRF taint chain."""
    m = _SAFE_URL_RE.match(url)
    if not m:
        raise ValueError(f"URL not in allowed domains: {url!r}")
    return m.group(1)


class BVADecisionScraper:
    """Scrapes and analyzes BVA decisions."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.decisions = []
        
    def _delay(self):
        """Respectful delay between requests."""
        time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
    
    def search_decisions(self, condition: str, year: int = None, max_results: int = 100) -> List[Dict]:
        """
        Search for BVA decisions by condition.
        
        Args:
            condition: Medical condition to search for (e.g., "sleep apnea")
            year: Optional year filter (e.g., 2025)
            max_results: Maximum number of decisions to retrieve
            
        Returns:
            List of decision metadata
        """
        if not SCRAPING_AVAILABLE:
            print("❌ Scraping libraries not available")
            return []
        
        print(f"🔍 Searching BVA decisions for: {condition}")
        
        # Build search query
        search_params = {
            "q": condition,
            "op": "Search",
            "db": "bva",
            "num": min(max_results, 50),  # VA limits per page
        }
        
        if year:
            search_params["date"] = f"{year}"
        
        decisions = []
        page = 0
        
        while len(decisions) < max_results:
            search_params["start"] = page * 50
            
            try:
                response = self.session.get(BVA_SEARCH_URL, params=search_params, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                results = self._parse_search_results(soup)
                
                if not results:
                    break
                    
                decisions.extend(results)
                print(f"  📄 Found {len(decisions)} decisions so far...")
                
                page += 1
                self._delay()
                
            except Exception as e:
                print(f"❌ Search error: {e}")
                break
        
        return decisions[:max_results]
    
    def _parse_search_results(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse search results page."""
        results = []
        
        # Find result entries (adjust selectors based on actual page structure)
        for result in soup.select('.result-item, .search-result, tr.result'):
            try:
                decision = {
                    'id': self._extract_id(result),
                    'date': self._extract_date(result),
                    'docket': self._extract_docket(result),
                    'url': self._extract_url(result),
                    'snippet': self._extract_snippet(result),
                }
                if decision['id']:
                    results.append(decision)
            except Exception as e:
                continue
                
        return results
    
    def _extract_id(self, element) -> Optional[str]:
        """Extract decision ID."""
        link = element.select_one('a[href*="bva"]')
        if link and 'href' in link.attrs:
            match = re.search(r'(\d{7,})', link['href'])
            if match:
                return match.group(1)
        return None
    
    def _extract_date(self, element) -> Optional[str]:
        """Extract decision date."""
        date_text = element.get_text()
        date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{4}|\w+ \d{1,2}, \d{4})', date_text)
        if date_match:
            return date_match.group(1)
        return None
    
    def _extract_docket(self, element) -> Optional[str]:
        """Extract docket number."""
        text = element.get_text()
        docket_match = re.search(r'(\d{2}-\d{2}\s*\d{3,})', text)
        if docket_match:
            return docket_match.group(1)
        return None
    
    def _extract_url(self, element) -> Optional[str]:
        """Extract full decision URL."""
        link = element.select_one('a[href*="bva"]')
        if link and 'href' in link.attrs:
            href = link['href']
            if not href.startswith('http'):
                href = BVA_BASE_URL + href
            return href
        return None
    
    def _extract_snippet(self, element) -> str:
        """Extract text snippet."""
        return element.get_text(strip=True)[:500]
    
    def fetch_full_decision(self, decision_url: str) -> Optional[Dict]:
        """
        Fetch and parse full decision text.
        
        Args:
            decision_url: URL to the full BVA decision
            
        Returns:
            Parsed decision with outcome, evidence, etc.
        """
        if not any(decision_url.startswith(prefix) for prefix in _ALLOWED_URL_PREFIXES):
            raise ValueError(f"URL not in allowed VA.gov domains: {decision_url}")
        try:
            self._delay()
            _safe_decision_url = _extract_safe_url(decision_url)
            response = self.session.get(_safe_decision_url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract full text
            content = soup.select_one('.decision-content, #content, main, body')
            if not content:
                return None
                
            full_text = content.get_text(separator='\n', strip=True)
            
            # Parse key elements
            parsed = self._parse_decision_text(full_text)
            parsed['url'] = decision_url
            parsed['raw_length'] = len(full_text)
            
            return parsed
            
        except Exception as e:
            print(f"❌ Error fetching decision: {e}")
            return None
    
    def _parse_decision_text(self, text: str) -> Dict:
        """
        Parse decision text to extract key information.
        
        Extracts:
        - Outcome (granted/denied/remanded)
        - Evidence types mentioned
        - Nexus discussion
        - Judge quotes
        - Timeline information
        """
        text_lower = text.lower()
        
        # Determine outcome
        outcome = self._determine_outcome(text_lower)
        
        # Extract dates
        dates = self._extract_timeline_dates(text)
        
        # Identify evidence types
        evidence_types = self._identify_evidence_types(text_lower)
        
        # Find nexus discussion
        nexus_info = self._extract_nexus_info(text)
        
        # Extract judge quotes (useful language)
        quotes = self._extract_useful_quotes(text)
        
        # Identify connection type
        connection_type = self._identify_connection_type(text_lower)
        
        # Check for examiner issues
        examiner_issues = self._check_examiner_issues(text_lower)
        
        return {
            'outcome': outcome,
            'connection_type': connection_type,
            'evidence_types': evidence_types,
            'nexus_info': nexus_info,
            'examiner_issues': examiner_issues,
            'dates': dates,
            'quotes': quotes,
            'word_count': len(text.split()),
        }
    
    def _determine_outcome(self, text: str) -> str:
        """Determine the decision outcome."""
        # Priority order matters - check granted first
        if any(phrase in text for phrase in [
            'is granted', 'are granted', 'service connection is established',
            'benefit sought on appeal is granted', 'claim is granted'
        ]):
            return 'granted'
        
        if any(phrase in text for phrase in [
            'is remanded', 'are remanded', 'claim is remanded',
            'remanded to the agency of original jurisdiction',
            'remanded for additional development'
        ]):
            return 'remanded'
        
        if any(phrase in text for phrase in [
            'is denied', 'are denied', 'benefit sought on appeal is denied',
            'claim is denied', 'appeal is denied'
        ]):
            return 'denied'
        
        return 'unknown'
    
    def _identify_evidence_types(self, text: str) -> Dict[str, bool]:
        """Identify what evidence types are mentioned."""
        return {
            'private_medical_records': any(p in text for p in [
                'private medical', 'private treatment', 'private physician',
                'treating physician', 'private doctor'
            ]),
            'private_nexus': any(p in text for p in [
                'private medical opinion', 'private nexus', 'independent medical',
                'imo', 'ime', 'private examiner'
            ]),
            'va_examination': any(p in text for p in [
                'va examination', 'va examiner', 'c&p exam', 'compensation and pension',
                'va medical opinion'
            ]),
            'service_records': any(p in text for p in [
                'service treatment records', 'str', 'service medical records',
                'military medical', 'in-service treatment'
            ]),
            'lay_statements': any(p in text for p in [
                'lay statement', 'buddy statement', 'lay evidence',
                'veteran\'s statement', 'personal statement', 'lay testimony'
            ]),
            'va_treatment_records': any(p in text for p in [
                'va treatment records', 'va medical records', 'vamc records'
            ]),
        }
    
    def _identify_connection_type(self, text: str) -> str:
        """Identify the type of service connection claimed."""
        if 'secondary service connection' in text or 'secondary to' in text:
            return 'secondary'
        if 'presumptive' in text or 'presumed' in text:
            return 'presumptive'
        if 'aggravat' in text and ('service' in text or 'military' in text):
            return 'aggravation'
        return 'direct'
    
    def _extract_nexus_info(self, text: str) -> Dict:
        """Extract nexus-related information."""
        text_lower = text.lower()
        
        return {
            'nexus_discussed': 'nexus' in text_lower or 'medical opinion' in text_lower,
            'likely_as_not': 'at least as likely as not' in text_lower or '50 percent' in text_lower,
            'private_more_probative': any(p in text_lower for p in [
                'private opinion is more probative',
                'private physician\'s opinion',
                'greater probative weight to the private'
            ]),
            'va_more_probative': any(p in text_lower for p in [
                'va opinion is more probative',
                'va examiner\'s opinion',
                'greater probative weight to the va'
            ]),
            'inadequate_nexus': any(p in text_lower for p in [
                'inadequate nexus', 'no nexus', 'without a nexus',
                'fails to establish a nexus', 'nexus is lacking'
            ]),
        }
    
    def _check_examiner_issues(self, text: str) -> List[str]:
        """Check for common examiner/exam issues."""
        issues = []
        
        issue_patterns = [
            ('no_rationale', ['no rationale', 'without rationale', 'failed to provide rationale']),
            ('conclusory', ['conclusory', 'bare conclusion', 'without explanation']),
            ('incomplete_exam', ['incomplete examination', 'inadequate examination', 'exam was inadequate']),
            ('wrong_standard', ['incorrect standard', 'wrong standard', 'did not apply the correct']),
            ('ignored_evidence', ['failed to consider', 'did not address', 'ignored the veteran\'s']),
            ('wrong_specialist', ['not a specialist', 'wrong specialty', 'inadequate expertise']),
        ]
        
        for issue_name, patterns in issue_patterns:
            if any(p in text for p in patterns):
                issues.append(issue_name)
        
        return issues
    
    def _extract_timeline_dates(self, text: str) -> Dict:
        """Extract key dates from the decision."""
        dates = {}
        
        # Look for filing date
        filing_match = re.search(r'(?:filed|submitted|received).{0,30}?(\d{1,2}/\d{1,2}/\d{4}|\w+ \d{1,2}, \d{4})', text, re.I)
        if filing_match:
            dates['filing_date'] = filing_match.group(1)
        
        # Look for decision date
        decision_match = re.search(r'(?:this decision|decided|date of decision).{0,30}?(\d{1,2}/\d{1,2}/\d{4}|\w+ \d{1,2}, \d{4})', text, re.I)
        if decision_match:
            dates['decision_date'] = decision_match.group(1)
        
        # Look for denial date
        denial_match = re.search(r'(?:denied|denial).{0,30}?(\d{1,2}/\d{1,2}/\d{4}|\w+ \d{1,2}, \d{4})', text, re.I)
        if denial_match:
            dates['prior_denial_date'] = denial_match.group(1)
        
        return dates
    
    def _extract_useful_quotes(self, text: str) -> List[str]:
        """Extract potentially useful judge language."""
        quotes = []
        
        # Patterns for useful language
        patterns = [
            r'"[^"]{50,300}"',  # Quoted text
            r'The Board finds that[^.]{20,200}\.',
            r'The evidence (?:establishes|shows|demonstrates)[^.]{20,200}\.',
            r'(?:is|are) at least as likely as not[^.]{10,150}\.',
            r'(?:private|VA) (?:opinion|examiner|physician)[^.]{20,200}(?:probative|weight)[^.]{10,100}\.',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.I)
            quotes.extend(matches[:3])  # Limit per pattern
        
        return quotes[:10]  # Total limit


class BVAAnalyzer:
    """Analyzes collected BVA decisions."""
    
    def __init__(self, decisions: List[Dict]):
        self.decisions = decisions
    
    def generate_condition_report(self, condition: str) -> Dict:
        """Generate comprehensive report for a condition."""
        total = len(self.decisions)
        if total == 0:
            return {'error': 'No decisions to analyze'}
        
        # Calculate outcomes
        outcomes = Counter(d.get('outcome', 'unknown') for d in self.decisions)
        
        # Calculate evidence correlations
        evidence_outcomes = self._analyze_evidence_outcomes()
        
        # Calculate connection type outcomes
        connection_outcomes = self._analyze_connection_outcomes()
        
        # Analyze examiner issues
        examiner_analysis = self._analyze_examiner_issues()
        
        # Extract winning patterns
        winning_patterns = self._extract_winning_patterns()
        
        # Extract denial reasons
        denial_patterns = self._extract_denial_patterns()
        
        return {
            'condition': condition,
            'sample_size': total,
            'analysis_date': datetime.now().isoformat(),
            'outcomes': {
                'granted': outcomes.get('granted', 0),
                'denied': outcomes.get('denied', 0),
                'remanded': outcomes.get('remanded', 0),
                'grant_rate': round(outcomes.get('granted', 0) / total * 100, 1),
                'denial_rate': round(outcomes.get('denied', 0) / total * 100, 1),
                'remand_rate': round(outcomes.get('remanded', 0) / total * 100, 1),
                'favorable_rate': round((outcomes.get('granted', 0) + outcomes.get('remanded', 0)) / total * 100, 1),
            },
            'evidence_analysis': evidence_outcomes,
            'connection_types': connection_outcomes,
            'examiner_issues': examiner_analysis,
            'winning_patterns': winning_patterns,
            'denial_patterns': denial_patterns,
        }
    
    def _analyze_evidence_outcomes(self) -> Dict:
        """Analyze grant rates by evidence type."""
        evidence_stats = {}
        
        evidence_types = [
            'private_medical_records', 'private_nexus', 'va_examination',
            'service_records', 'lay_statements', 'va_treatment_records'
        ]
        
        for ev_type in evidence_types:
            with_evidence = [d for d in self.decisions 
                           if d.get('evidence_types', {}).get(ev_type)]
            
            if len(with_evidence) >= 5:  # Minimum sample
                granted = sum(1 for d in with_evidence if d.get('outcome') == 'granted')
                evidence_stats[ev_type] = {
                    'count': len(with_evidence),
                    'grant_rate': round(granted / len(with_evidence) * 100, 1)
                }
        
        return evidence_stats
    
    def _analyze_connection_outcomes(self) -> Dict:
        """Analyze outcomes by connection type."""
        connection_stats = {}
        
        for conn_type in ['direct', 'secondary', 'presumptive', 'aggravation']:
            matching = [d for d in self.decisions 
                       if d.get('connection_type') == conn_type]
            
            if len(matching) >= 3:
                granted = sum(1 for d in matching if d.get('outcome') == 'granted')
                remanded = sum(1 for d in matching if d.get('outcome') == 'remanded')
                connection_stats[conn_type] = {
                    'count': len(matching),
                    'grant_rate': round(granted / len(matching) * 100, 1),
                    'favorable_rate': round((granted + remanded) / len(matching) * 100, 1)
                }
        
        return connection_stats
    
    def _analyze_examiner_issues(self) -> Dict:
        """Analyze frequency of examiner issues."""
        all_issues = []
        for d in self.decisions:
            all_issues.extend(d.get('examiner_issues', []))
        
        issue_counts = Counter(all_issues)
        total_with_issues = sum(1 for d in self.decisions if d.get('examiner_issues'))
        
        return {
            'decisions_with_issues': total_with_issues,
            'issue_frequency': dict(issue_counts.most_common(10)),
        }
    
    def _extract_winning_patterns(self) -> List[Dict]:
        """Extract patterns from granted decisions."""
        granted = [d for d in self.decisions if d.get('outcome') == 'granted']
        
        patterns = []
        
        # Check for private nexus correlation
        with_private = sum(1 for d in granted 
                         if d.get('nexus_info', {}).get('private_more_probative'))
        if with_private > 0:
            patterns.append({
                'pattern': 'Private nexus opinion cited as more probative',
                'count': with_private,
                'percentage': round(with_private / len(granted) * 100, 1) if granted else 0
            })
        
        # Check for lay evidence correlation
        with_lay = sum(1 for d in granted 
                      if d.get('evidence_types', {}).get('lay_statements'))
        if with_lay > 0:
            patterns.append({
                'pattern': 'Lay statements submitted',
                'count': with_lay,
                'percentage': round(with_lay / len(granted) * 100, 1) if granted else 0
            })
        
        # Check for secondary connection
        secondary = sum(1 for d in granted 
                       if d.get('connection_type') == 'secondary')
        if secondary > 0:
            patterns.append({
                'pattern': 'Secondary service connection',
                'count': secondary,
                'percentage': round(secondary / len(granted) * 100, 1) if granted else 0
            })
        
        return patterns
    
    def _extract_denial_patterns(self) -> List[Dict]:
        """Extract patterns from denied decisions."""
        denied = [d for d in self.decisions if d.get('outcome') == 'denied']
        
        patterns = []
        
        # Check for inadequate nexus
        no_nexus = sum(1 for d in denied 
                      if d.get('nexus_info', {}).get('inadequate_nexus'))
        if no_nexus > 0:
            patterns.append({
                'pattern': 'Inadequate or missing nexus',
                'count': no_nexus,
                'percentage': round(no_nexus / len(denied) * 100, 1) if denied else 0
            })
        
        # Check for examiner issues
        with_issues = sum(1 for d in denied if d.get('examiner_issues'))
        if with_issues > 0:
            patterns.append({
                'pattern': 'Had examiner issues but still denied',
                'count': with_issues,
                'percentage': round(with_issues / len(denied) * 100, 1) if denied else 0
            })
        
        return patterns


def save_decisions(decisions: List[Dict], condition: str, output_dir: Path):
    """Save decisions to JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Sanitize condition for safe filename construction
    safe_condition = re.sub(r'[^\w\s-]', '', condition).strip()
    filename = f"bva_{safe_condition.replace(' ', '_').lower()}_{datetime.now().strftime('%Y%m%d')}.json"
    filepath = Path(safe_path(str(output_dir / filename), str(output_dir)))
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump({
            'condition': condition,
            'scraped_date': datetime.now().isoformat(),
            'count': len(decisions),
            'decisions': decisions
        }, f, indent=2)
    
    print(f"✅ Saved {len(decisions)} decisions to {filepath}")
    return filepath


def save_analysis(analysis: Dict, output_dir: Path):
    """Save analysis report to JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    condition = analysis.get('condition', 'unknown')
    # Sanitize condition for safe filename construction
    safe_condition = re.sub(r'[^\w\s-]', '', condition).strip()
    filename = f"analysis_{safe_condition.replace(' ', '_').lower()}_{datetime.now().strftime('%Y%m%d')}.json"
    filepath = Path(safe_path(str(output_dir / filename), str(output_dir)))
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2)
    
    print(f"📊 Saved analysis to {filepath}")
    return filepath


def main():
    parser = argparse.ArgumentParser(description='Scrape and analyze BVA decisions')
    parser.add_argument('--condition', type=str, help='Medical condition to search')
    parser.add_argument('--count', type=int, default=50, help='Number of decisions to fetch')
    parser.add_argument('--year', type=int, help='Filter by year')
    parser.add_argument('--analyze-existing', action='store_true', help='Analyze existing data')
    parser.add_argument('--fetch-full', action='store_true', help='Fetch full decision text')
    
    args = parser.parse_args()
    
    if args.analyze_existing:
        # Analyze existing data
        print("📊 Analyzing existing BVA data...")
        # Load from OUTPUT_DIR and analyze
        return
    
    if not args.condition:
        print("❌ Please specify --condition (e.g., --condition 'sleep apnea')")
        return
    
    # Initialize scraper
    scraper = BVADecisionScraper()
    
    # Search for decisions
    decisions = scraper.search_decisions(
        condition=args.condition,
        year=args.year,
        max_results=args.count
    )
    
    if not decisions:
        print("❌ No decisions found")
        return
    
    print(f"\n✅ Found {len(decisions)} decisions")
    
    # Optionally fetch full text
    if args.fetch_full:
        print("\n📄 Fetching full decision texts...")
        full_decisions = []
        
        for i, decision in enumerate(decisions):
            if decision.get('url'):
                print(f"  [{i+1}/{len(decisions)}] Fetching {decision['id']}...")
                _safe_url = _extract_safe_url(decision['url'])
                full = scraper.fetch_full_decision(_safe_url)
                if full:
                    decision.update(full)
                full_decisions.append(decision)
        
        decisions = full_decisions
    
    # Save raw decisions
    save_decisions(decisions, args.condition, OUTPUT_DIR)
    
    # Run analysis
    if args.fetch_full:
        analyzer = BVAAnalyzer(decisions)
        report = analyzer.generate_condition_report(args.condition)
        save_analysis(report, ANALYSIS_DIR)
        
        # Print summary
        print("\n" + "="*60)
        print(f"📊 ANALYSIS: {args.condition.upper()}")
        print("="*60)
        print(f"Sample size: {report['sample_size']}")
        print(f"Grant rate: {report['outcomes']['grant_rate']}%")
        print(f"Denial rate: {report['outcomes']['denial_rate']}%")
        print(f"Remand rate: {report['outcomes']['remand_rate']}%")
        print(f"Favorable rate (grant+remand): {report['outcomes']['favorable_rate']}%")
        
        if report['winning_patterns']:
            print("\n🏆 WINNING PATTERNS:")
            for p in report['winning_patterns']:
                print(f"  • {p['pattern']}: {p['count']} cases ({p['percentage']}%)")
        
        if report['denial_patterns']:
            print("\n❌ DENIAL PATTERNS:")
            for p in report['denial_patterns']:
                print(f"  • {p['pattern']}: {p['count']} cases ({p['percentage']}%)")


if __name__ == "__main__":
    main()
