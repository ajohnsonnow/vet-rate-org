#!/usr/bin/env python3
"""
💎 CAVC PDF PARSER & HIGH-VALUE CASE EXTRACTOR
================================================
Parses 1,889 CAVC precedential opinions to find high-value cases for veterans.

Features:
- Extracts metadata from 1,889 PDFs
- Searches for high-value keywords (PTSD, TDIU, secondary conditions, etc.)
- Scores cases by veteran relevance
- Creates searchable JSON database
- Generates DKB entries for top cases

Author: VetRate Team
Date: 2026-01-26
"""

import PyPDF2
import json
import re
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict
import traceback

# High-value keywords for veterans (weighted by importance)
HIGH_VALUE_KEYWORDS = {
    # Mental Health (HIGHEST PRIORITY)
    'ptsd': 100,
    'post-traumatic stress': 100,
    'post traumatic stress': 100,
    'depression': 80,
    'major depressive disorder': 90,
    'mdd': 90,
    'anxiety': 75,
    'bipolar': 85,
    'schizophrenia': 85,
    'mental health': 70,
    
    # TDIU (VERY HIGH PRIORITY)
    'tdiu': 95,
    'total disability': 95,
    'individual unemployability': 95,
    'unemployability': 90,
    
    # Secondary Conditions (HIGH PRIORITY)
    'secondary': 85,
    'nexus': 90,
    'causation': 80,
    'aggravation': 75,
    'sleep apnea': 85,
    
    # Service Connection (HIGH PRIORITY)
    'service connection': 80,
    'direct service connection': 85,
    'secondary service connection': 90,
    'in-service': 75,
    
    # Rating Issues (HIGH PRIORITY)
    'increased rating': 75,
    'rating criteria': 70,
    'extraschedular': 90,
    'residuals': 65,
    
    # Procedural (MEDIUM PRIORITY)
    'effective date': 80,
    'earlier effective date': 85,
    'cue': 75,
    'clear and unmistakable error': 80,
    'due process': 70,
    'adequate reasons': 75,
    
    # Common Conditions (MEDIUM PRIORITY)
    'tinnitus': 60,
    'hearing loss': 60,
    'knee': 50,
    'back': 50,
    'radiculopathy': 65,
    'diabetes': 70,
    'hypertension': 65,
    'heart': 60,
    'tbi': 85,
    'traumatic brain injury': 85,
    
    # Benefits (MEDIUM PRIORITY)
    'dic': 70,
    'dependency and indemnity': 75,
    'survivor benefits': 65,
    'special monthly compensation': 75,
    'smc': 75,
    
    # Evidence (LOWER PRIORITY)
    'medical opinion': 60,
    'competent evidence': 55,
    'buddy statement': 60,
    'lay evidence': 55,
}

# Diagnostic code patterns
DC_PATTERN = re.compile(r'\b(?:DC|diagnostic code)\s*(\d{4})\b', re.IGNORECASE)
CFR_PATTERN = re.compile(r'38\s*C\.?F\.?R\.?\s*§\s*(\d+\.\d+[a-z]?)', re.IGNORECASE)
CASE_NUM_PATTERN = re.compile(r'\b(\d{2,4}[-]\d{3,4}[A-Z]?)\b')

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ''
            # Extract first 10 pages (most important info is usually at start)
            for page in reader.pages[:10]:
                text += page.extract_text() + '\n'
            return text
    except Exception as e:
        print(f"   Error reading {pdf_path.name}: {str(e)}")
        return ''

def parse_case_metadata(filename, text):
    """Extract metadata from filename and PDF text."""
    # Parse filename: VeteranName_CaseNumber.pdf
    parts = filename.replace('.pdf', '').split('_')
    
    metadata = {
        'filename': filename,
        'veteran_name': parts[0] if parts else 'Unknown',
        'case_number': parts[1] if len(parts) > 1 else 'Unknown',
        'full_case_id': filename.replace('.pdf', ''),
    }
    
    # Extract case numbers from text (more reliable)
    case_nums = CASE_NUM_PATTERN.findall(text[:1000])
    if case_nums:
        metadata['case_number'] = case_nums[0]
    
    # Extract year from case number
    if metadata['case_number'] != 'Unknown':
        year_match = re.match(r'(\d{2})', metadata['case_number'])
        if year_match:
            year = int(year_match.group(1))
            # Convert 2-digit year to 4-digit
            metadata['year'] = 2000 + year if year < 50 else 1900 + year
    
    # Extract diagnostic codes
    diagnostic_codes = list(set(DC_PATTERN.findall(text)))
    metadata['diagnostic_codes'] = diagnostic_codes
    
    # Extract CFR citations
    cfr_citations = list(set(['38 CFR § ' + c for c in CFR_PATTERN.findall(text)]))
    metadata['cfr_citations'] = cfr_citations
    
    return metadata

def score_case_relevance(text):
    """Score case based on high-value keywords."""
    text_lower = text.lower()
    score = 0
    matched_keywords = []
    
    for keyword, weight in HIGH_VALUE_KEYWORDS.items():
        if keyword in text_lower:
            score += weight
            matched_keywords.append(keyword)
    
    return score, matched_keywords

def extract_holding(text):
    """Extract the court's holding from the opinion."""
    # Look for common holding phrases
    holding_markers = [
        r'(?:the court|we)\s+(?:affirm|reverse|remand|vacate|set aside)',
        r'(?:it is|accordingly)\s+(?:ordered|adjudged|held)',
        r'(?:for the foregoing reasons)',
        r'(?:judgment|decision)\s+(?:is|will be)',
    ]
    
    for marker in holding_markers:
        matches = re.finditer(marker, text, re.IGNORECASE)
        for match in matches:
            start = match.start()
            # Extract 200 characters after the marker
            holding_text = text[start:start+300].replace('\n', ' ').strip()
            if len(holding_text) > 50:
                return holding_text[:250] + '...'
    
    # Fallback: try to find "HELD:" section
    held_match = re.search(r'HELD:\s*(.{100,400})', text, re.IGNORECASE | re.DOTALL)
    if held_match:
        return held_match.group(1).replace('\n', ' ').strip()[:250] + '...'
    
    return 'Holding text extraction failed - manual review needed'

def categorize_case(matched_keywords):
    """Categorize case by primary issue type."""
    categories = []
    
    kw_set = set([k.lower() for k in matched_keywords])
    
    if any(k in kw_set for k in ['ptsd', 'post-traumatic stress', 'depression', 'anxiety', 'bipolar', 'mental health', 'mdd']):
        categories.append('Mental Health')
    
    if any(k in kw_set for k in ['tdiu', 'total disability', 'unemployability']):
        categories.append('TDIU')
    
    if any(k in kw_set for k in ['secondary', 'nexus', 'causation', 'aggravation']):
        categories.append('Secondary Conditions')
    
    if any(k in kw_set for k in ['service connection']):
        categories.append('Service Connection')
    
    if any(k in kw_set for k in ['effective date', 'earlier effective date']):
        categories.append('Effective Date')
    
    if any(k in kw_set for k in ['increased rating', 'rating criteria']):
        categories.append('Rating Increase')
    
    if any(k in kw_set for k in ['cue', 'clear and unmistakable error']):
        categories.append('CUE')
    
    if any(k in kw_set for k in ['dic', 'dependency and indemnity', 'survivor benefits']):
        categories.append('DIC/Survivor Benefits')
    
    if not categories:
        categories.append('General')
    
    return categories

def main():
    print("=" * 80)
    print("💎 CAVC PDF PARSER & HIGH-VALUE CASE EXTRACTOR")
    print("=" * 80)
    print()
    
    workspace = Path("E:/VS_Studio/vet-rate-org-official")
    extracted_dir = workspace / "llm-compiler" / "knowledge-base" / "cavc" / "extracted"
    output_dir = workspace / "llm-compiler" / "knowledge-base" / "cavc" / "parsed"
    output_dir.mkdir(exist_ok=True)
    
    print(f"📂 Scanning: {extracted_dir}")
    print(f"📤 Output: {output_dir}")
    print()
    
    # Find all panel decision PDFs (precedential opinions)
    panel_dirs = [d for d in extracted_dir.iterdir() if d.is_dir() and d.name.startswith('panel_')]
    
    all_cases = []
    total_pdfs = 0
    processed = 0
    errors = 0
    
    # Count total PDFs first
    for panel_dir in panel_dirs:
        total_pdfs += len(list(panel_dir.glob('*.pdf')))
    
    print(f"🔍 Found {total_pdfs} precedential opinions across {len(panel_dirs)} years")
    print()
    print("📊 Processing PDFs (this will take a few minutes)...")
    print()
    
    # Process each panel decision directory
    for panel_dir in sorted(panel_dirs):
        year = panel_dir.name.replace('panel_', '')
        pdfs = list(panel_dir.glob('*.pdf'))
        
        if not pdfs:
            continue
        
        print(f"📁 Processing {year}: {len(pdfs)} cases")
        
        for pdf_path in pdfs:
            processed += 1
            
            try:
                # Extract text
                text = extract_text_from_pdf(pdf_path)
                
                if not text or len(text) < 100:
                    errors += 1
                    continue
                
                # Parse metadata
                metadata = parse_case_metadata(pdf_path.name, text)
                
                # Score relevance
                score, matched_keywords = score_case_relevance(text)
                
                # Extract holding
                holding = extract_holding(text)
                
                # Categorize
                categories = categorize_case(matched_keywords)
                
                # Build case record
                case_record = {
                    'id': f"cavc_{metadata['case_number'].replace('-', '_')}",
                    'filename': metadata['filename'],
                    'case_number': metadata['case_number'],
                    'veteran_name': metadata['veteran_name'],
                    'year': metadata.get('year', year),
                    'full_case_id': metadata['full_case_id'],
                    'relevance_score': score,
                    'matched_keywords': matched_keywords,
                    'categories': categories,
                    'holding': holding,
                    'diagnostic_codes': metadata['diagnostic_codes'],
                    'cfr_citations': metadata['cfr_citations'],
                    'pdf_path': str(pdf_path.relative_to(workspace)),
                }
                
                all_cases.append(case_record)
                
                # Progress indicator
                if processed % 100 == 0:
                    print(f"   Progress: {processed}/{total_pdfs} ({(processed/total_pdfs)*100:.1f}%)")
                
            except Exception as e:
                errors += 1
                if processed % 100 == 0:  # Only print occasional errors
                    print(f"   ⚠️  Error processing {pdf_path.name}: {str(e)}")
    
    print()
    print(f"✅ Processed: {processed} PDFs")
    print(f"❌ Errors: {errors}")
    print()
    
    # Sort by relevance score
    all_cases.sort(key=lambda x: x['relevance_score'], reverse=True)
    
    # Save full database
    database_path = output_dir / 'cavc_full_database.json'
    with open(database_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_cases': len(all_cases),
            'cases': all_cases
        }, f, indent=2)
    
    print(f"💾 Saved full database: {database_path.name} ({len(all_cases)} cases)")
    print()
    
    # Save top 200 high-value cases
    top_200 = all_cases[:200]
    top_200_path = output_dir / 'cavc_top_200_high_value.json'
    with open(top_200_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'total_cases': len(top_200),
            'cases': top_200
        }, f, indent=2)
    
    print(f"⭐ Saved top 200 high-value cases: {top_200_path.name}")
    print()
    
    # Statistics
    print("=" * 80)
    print("📊 ANALYSIS RESULTS")
    print("=" * 80)
    print()
    
    # Top cases
    print("🏆 TOP 10 HIGHEST-VALUE CASES:")
    for i, case in enumerate(top_200[:10], 1):
        print(f"{i:2}. {case['veteran_name']:20} ({case['case_number']:10}) Score: {case['relevance_score']:4}")
        print(f"    Categories: {', '.join(case['categories'])}")
        print(f"    Keywords: {', '.join(case['matched_keywords'][:5])}")
        print()
    
    # Category breakdown
    print("📋 CASES BY CATEGORY:")
    category_counts = Counter()
    for case in all_cases:
        for cat in case['categories']:
            category_counts[cat] += 1
    
    for cat, count in category_counts.most_common(10):
        print(f"   {cat:30} {count:4} cases")
    
    print()
    
    # Score distribution
    print("📈 SCORE DISTRIBUTION:")
    score_ranges = {
        '500+': 0,
        '400-499': 0,
        '300-399': 0,
        '200-299': 0,
        '100-199': 0,
        '1-99': 0,
        '0': 0,
    }
    
    for case in all_cases:
        score = case['relevance_score']
        if score >= 500:
            score_ranges['500+'] += 1
        elif score >= 400:
            score_ranges['400-499'] += 1
        elif score >= 300:
            score_ranges['300-399'] += 1
        elif score >= 200:
            score_ranges['200-299'] += 1
        elif score >= 100:
            score_ranges['100-199'] += 1
        elif score > 0:
            score_ranges['1-99'] += 1
        else:
            score_ranges['0'] += 1
    
    for range_name, count in score_ranges.items():
        print(f"   {range_name:12} {count:4} cases")
    
    print()
    print("=" * 80)
    print("✅ ANALYSIS COMPLETE!")
    print("=" * 80)
    print()
    print("📁 Output Files:")
    print(f"   - {database_path.name} (Full database)")
    print(f"   - {top_200_path.name} (Top 200 cases)")
    print()
    print("🎯 NEXT STEPS:")
    print("   1. Review top 200 high-value cases")
    print("   2. Convert to DKB JSON format")
    print("   3. Integrate into production knowledge base")
    print("   4. Test AI retrieval with CAVC citations")

if __name__ == "__main__":
    main()
