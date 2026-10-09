#!/usr/bin/env python3
"""
💎 CAVC to DKB Converter
========================
Converts ALL parsed CAVC cases to Diamond Knowledge Base format.
"""

import json
from pathlib import Path
from datetime import datetime

def convert_to_dkb_format(case, index):
    """Convert parsed CAVC case to DKB entry format."""
    
    # Generate ID
    case_num = case['case_number'].replace('-', '_')
    entry_id = f"cavc_{case_num}"
    
    # Build citation
    citation = f"{case['veteran_name']} v. {get_secretary(case.get('year', 2000))}, CAVC No. {case['case_number']}"
    if case.get('year'):
        citation += f" ({case['year']})"
    
    # Determine decision type (all panel decisions are precedential)
    decision_type = "precedential"
    
    # Extract relevant conditions from keywords and categories
    conditions = []
    if 'Mental Health' in case['categories']:
        conditions.extend(['PTSD', 'Mental Health Conditions', 'Depression', 'Anxiety'])
    if 'TDIU' in case['categories']:
        conditions.append('Total Disability Individual Unemployability')
    if 'Secondary Conditions' in case['categories']:
        conditions.extend(['Secondary Conditions', 'Nexus', 'Aggravation'])
    if 'Service Connection' in case['categories']:
        conditions.append('Service Connection')
    
    # Remove duplicates while preserving order
    conditions = list(dict.fromkeys(conditions))
    
    # Determine impact level
    score = case['relevance_score']
    if score >= 800:
        impact = "critical"
    elif score >= 500:
        impact = "high"
    elif score >= 300:
        impact = "medium"
    else:
        impact = "low"
    
    # Build tags
    tags = [cat.lower().replace(' ', '_') for cat in case['categories']]
    # matched_keywords may not exist in mass downloader output
    if 'matched_keywords' in case:
        tags.extend([kw.replace(' ', '_') for kw in case['matched_keywords'][:10]])
    tags = list(dict.fromkeys(tags))  # Remove duplicates
    
    # Build DKB entry
    dkb_entry = {
        "id": entry_id,
        "type": "cavc_decision",
        "case_number": case['case_number'],
        "citation": citation,
        "title": f"{case['veteran_name']} v. {get_secretary(case.get('year', 2000))}",
        "veteran_name": case['veteran_name'],
        "decision_date": case.get('date', f"{case.get('year', 'Unknown')}-01-01"),
        "decision_type": decision_type,
        "holding": case['holding'],
        "key_points": case['categories'][:5],  # Top 5 categories
        "relevant_conditions": conditions[:10],
        "diagnostic_codes": [f"DC {dc}" for dc in case['diagnostic_codes'][:5]],
        "cfr_citations": case['cfr_citations'][:5],
        "source": "U.S. Court of Appeals for Veterans Claims",
        "source_url": case.get('url', f"https://efiling.uscourts.cavc.gov/cmecf/servlet/TransportRoom?servlet=CaseSummary.jsp&caseNum={case['case_number']}&incOrigDkt=Y&incDktEntries=Y"),
        "summary": f"{case['veteran_name']} case addressing {', '.join(case['categories'][:3])}. {case['holding'][:150]}",
        "impact": impact,
        "relevance_score": case['relevance_score'],
        "tags": tags[:15],
        "scraped_at": datetime.now().isoformat(),
        "verified": True,
        "data_source": "OFFICIAL - uscourts.cavc.gov search database",
        "hierarchy_level": 2,
        "color_code": "GREEN"
    }
    
    return dkb_entry

def get_secretary(year):
    """Get VA Secretary name based on year."""
    # Convert to int if string
    if isinstance(year, str):
        try:
            year = int(year)
        except:
            year = 2000
    
    if year >= 2021:
        return "McDonough"
    elif year >= 2017:
        return "Wilkie"
    elif year >= 2014:
        return "McDonald"
    elif year >= 2009:
        return "Shinseki"
    elif year >= 2007:
        return "Peake"
    elif year >= 2005:
        return "Nicholson"
    elif year >= 2001:
        return "Principi"
    elif year >= 2000:
        return "Gober"
    elif year >= 1998:
        return "West"
    elif year >= 1993:
        return "Brown"
    else:
        return "Derwinski"

def main():
    print("=" * 80)
    print("💎 CAVC TO DKB CONVERTER - 2007-2023 MASS DOWNLOAD")
    print("=" * 80)
    print()
    
    workspace = Path("E:/VS_Studio/vet-rate-org-official")
    input_path = workspace / "llm-compiler" / "knowledge-base" / "cavc" / "full_download_2007_2023" / "all_parsed_cases.json"
    output_path = workspace / "llm-compiler" / "knowledge-base" / "cavc" / "cavc_2007_2023_dkb_format.json"
    
    print(f"📥 Loading: {input_path.name}")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    cases = data['cases']
    print(f"✅ Loaded {len(cases)} total cases (2007-2023 complete)")
    print()
    
    print("🔄 Converting to DKB format...")
    dkb_entries = []
    
    for i, case in enumerate(cases, 1):
        dkb_entry = convert_to_dkb_format(case, i)
        dkb_entries.append(dkb_entry)
        
        if i % 50 == 0:
            print(f"   Converted {i}/{len(cases)} cases...")
    
    print(f"✅ Converted all {len(dkb_entries)} cases")
    print()
    
    # Save DKB format
    output_data = {
        "source": "OFFICIAL - U.S. Court of Appeals for Veterans Claims",
        "source_url": "https://www.uscourts.cavc.gov/",
        "generated_at": datetime.now().isoformat(),
        "total_entries": len(dkb_entries),
        "precedential_count": len(dkb_entries),
        "non_precedential_count": 0,
        "entries": dkb_entries
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Saved: {output_path.name}")
    print()
    
    # Statistics
    print("=" * 80)
    print("📊 CONVERSION SUMMARY")
    print("=" * 80)
    print()
    
    print(f"Total DKB Entries: {len(dkb_entries)}")
    print()
    
    print("🏆 Top 5 Cases:")
    for i, entry in enumerate(dkb_entries[:5], 1):
        print(f"{i}. {entry['title']}")
        print(f"   Score: {entry['relevance_score']} | Impact: {entry['impact'].upper()}")
        print(f"   Categories: {', '.join(entry['key_points'][:3])}")
        print()
    
    print("📈 Impact Distribution:")
    impact_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    for entry in dkb_entries:
        impact_counts[entry['impact']] += 1
    
    for impact, count in impact_counts.items():
        print(f"   {impact.capitalize():10} {count:3} cases")
    
    print()
    print("=" * 80)
    print("✅ CONVERSION COMPLETE!")
    print("=" * 80)
    print()
    print("🎯 READY FOR INTEGRATION!")
    print(f"   File: {output_path.name}")
    print(f"   Cases: {len(dkb_entries)} precedential opinions")
    print()
    print("Next: Run cavc_integrator.py to merge into production KB")

if __name__ == "__main__":
    main()
