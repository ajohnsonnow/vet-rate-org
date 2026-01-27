#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DKB COMPLETENESS AUDIT - "Complete Record" Analysis                      ║
║══════════════════════════════════════════════════════════════════════════════║
║  What does 100% coverage actually look like for each source?                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
import os
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

def count_entries_in_dir(dir_path: Path) -> int:
    """Count all entries in a directory"""
    total = 0
    if not dir_path.exists():
        return 0
    
    for f in dir_path.glob("*.json"):
        try:
            with open(f, 'r', encoding='utf-8') as file:
                data = json.load(file)
            if isinstance(data, list):
                total += len(data)
            elif isinstance(data, dict):
                if 'entries' in data:
                    total += len(data['entries'])
                elif 'decisions' in data:
                    total += len(data['decisions'])
                elif 'cases' in data:
                    total += len(data['cases'])
        except:
            pass
    return total

def analyze_bva_coverage():
    """BVA: How many total precedential decisions exist?"""
    bva_dir = KB_DIR / "bva"
    count = count_entries_in_dir(bva_dir)
    
    # BVA issues ~80,000 decisions per year, but only ~50-200 are "precedential"
    # From 2000-2025, that's roughly 1,250-5,000 truly precedential decisions
    # Plus landmark cases from before 2000
    
    return {
        "source": "BVA Decisions",
        "current": count,
        "estimated_total": "~80,000/year total, ~100-200 precedential/year",
        "precedential_estimate": "1,500-5,000 precedential (2000-2025)",
        "all_decisions_estimate": "~2,000,000 total (2000-2025)",
        "notes": "We have 77,618 - likely pulled all available from search, but most are non-precedential"
    }

def analyze_cavc_coverage():
    """CAVC: How many total decisions 2007-2023?"""
    cavc_dir = KB_DIR / "cavc"
    count = count_entries_in_dir(cavc_dir)
    
    # CAVC issues ~3,000-5,000 decisions per year
    # 2007-2023 = 17 years = ~51,000-85,000 total decisions
    # But only ~500-1,000/year are published/precedential
    
    return {
        "source": "CAVC Decisions (2007-2023)",
        "current": count,
        "estimated_total": "~3,500 decisions/year × 17 years = ~59,500",
        "published_estimate": "~800/year published = ~13,600",
        "coverage_pct": f"{count / 13600 * 100:.1f}% of published" if count > 0 else "0%",
        "notes": "9,057 entries - about 67% of estimated published decisions"
    }

def analyze_m21_coverage():
    """M21-1: How many total manual sections?"""
    m21_dir = KB_DIR / "m21-1"
    count = count_entries_in_dir(m21_dir)
    
    # M21-1 Adjudication Procedures Manual has:
    # - 5 Parts (I-V)
    # - Each part has multiple Chapters
    # - Each chapter has multiple Sections
    # - Total: ~1,500-2,000 distinct sections/subsections
    
    return {
        "source": "M21-1 Manual",
        "current": count,
        "structure": "5 Parts × ~10-15 Chapters × ~10-20 Sections",
        "estimated_total": "~1,500-2,000 sections",
        "coverage_pct": f"{count / 1500 * 100:.1f}%" if count > 0 else "0%",
        "notes": f"419 entries = ~28% coverage. Need Part III (rating), Part IV (evidence) most"
    }

def analyze_ogc_coverage():
    """OGC: How many total opinions?"""
    ogc_dir = KB_DIR / "ogc"
    count = count_entries_in_dir(ogc_dir)
    
    # OGC Precedent Opinions: ~25/year × 30+ years = 750+
    # OGC Advisory Opinions: thousands more
    
    return {
        "source": "OGC Opinions",
        "current": count,
        "precedent_estimate": "~750-1,000 precedent opinions (1990-2025)",
        "advisory_estimate": "~3,000+ advisory opinions",
        "coverage_pct": f"{count / 1000 * 100:.1f}% of precedent" if count > 0 else "0%",
        "notes": f"937 entries - good coverage of precedent, missing most advisory"
    }

def analyze_federal_circuit_coverage():
    """Federal Circuit: How many veteran-related cases?"""
    fc_dir = KB_DIR / "federal-circuit"
    count = count_entries_in_dir(fc_dir)
    
    # Federal Circuit hears ~50-100 veteran cases per year
    # Since 1989 (VJRA) = ~35 years = 1,750-3,500 cases
    
    return {
        "source": "Federal Circuit (Veteran Cases)",
        "current": count,
        "estimated_total": "~75/year × 35 years = ~2,625 cases",
        "landmark_estimate": "~200-300 landmark/frequently cited",
        "coverage_pct": f"{count / 2625 * 100:.1f}%" if count > 0 else "0%",
        "notes": f"22 entries = <1% coverage. Major gap - need comprehensive scrape"
    }

def analyze_rating_schedule_coverage():
    """38 CFR Part 4: How many diagnostic codes?"""
    ecfr_dir = KB_DIR / "ecfr-fresh"
    count = count_entries_in_dir(ecfr_dir)
    
    # 38 CFR Part 4 has ~800 diagnostic codes
    # Plus criteria text, notes, and cross-references
    
    return {
        "source": "Rating Schedule (38 CFR Part 4)",
        "current": count,
        "diagnostic_codes": "~800 distinct DC codes (4.40-4.150)",
        "with_criteria": "~2,500-3,000 entries with rating criteria",
        "coverage_pct": f"{count / 800 * 100:.1f}% of DCs" if count > 0 else "0%",
        "notes": f"3,139 entries - EXCELLENT. Likely complete DC coverage + criteria"
    }

def analyze_presumptive_coverage():
    """Presumptive conditions: How many total?"""
    pres_dir = KB_DIR / "presumptive"
    count = count_entries_in_dir(pres_dir)
    
    # Presumptive conditions by category:
    # - Gulf War: ~20+
    # - Agent Orange: ~20+
    # - Camp Lejeune: ~15+
    # - Radiation: ~20+
    # - POW: ~10+
    # - Chronic diseases (1-year): ~40+
    # - Tropical diseases: ~10+
    # Total: ~150-200
    
    return {
        "source": "Presumptive Conditions",
        "current": count,
        "by_category": {
            "Gulf War": "~25 conditions",
            "Agent Orange": "~20 conditions", 
            "Camp Lejeune": "~15 conditions",
            "Radiation": "~21 conditions",
            "POW": "~12 conditions",
            "Chronic (1-year)": "~40 conditions",
            "Tropical": "~12 conditions"
        },
        "estimated_total": "~150-200 distinct conditions",
        "coverage_pct": f"{count / 175 * 100:.1f}%" if count > 0 else "0%",
        "notes": f"140 entries = ~80% coverage. Missing some newer PACT Act additions"
    }

def analyze_secondary_coverage():
    """Secondary conditions: How many known pairings?"""
    sec_dir = KB_DIR / "secondary"
    count = count_entries_in_dir(sec_dir)
    
    # Known secondary condition relationships:
    # - Each major condition has 5-20 common secondaries
    # - ~100 major service-connected conditions
    # - Total matrix: ~500-1,000 documented relationships
    
    return {
        "source": "Secondary Conditions",
        "current": count,
        "relationship_estimate": "~500-1,000 documented primary→secondary pairs",
        "medical_literature": "~2,000+ if including all medical literature",
        "coverage_pct": f"{count / 750 * 100:.1f}%" if count > 0 else "0%",
        "notes": f"234 entries = ~31% of documented pairs. Need medical nexus expansion"
    }

def main():
    print("\n" + "="*100)
    print("💎 DKB COMPLETENESS AUDIT - What Does 'Complete Record' Mean?")
    print("="*100)
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*100)
    
    # Get actual directory counts
    results = {"subdirs": {}}
    for dir_name in ["bva", "cavc", "m21-1", "ogc", "federal-circuit", "ecfr-fresh", "presumptive", "secondary"]:
        dir_path = KB_DIR / dir_name
        results["subdirs"][dir_name] = {"total_entries": count_entries_in_dir(dir_path)}
    
    analyses = [
        analyze_bva_coverage(),
        analyze_cavc_coverage(),
        analyze_m21_coverage(),
        analyze_ogc_coverage(),
        analyze_federal_circuit_coverage(),
        analyze_rating_schedule_coverage(),
        analyze_presumptive_coverage(),
        analyze_secondary_coverage(),
    ]
    
    print("\n" + "="*100)
    print("📊 COMPLETENESS ANALYSIS BY SOURCE")
    print("="*100)
    
    for a in analyses:
        print(f"\n{'─'*100}")
        print(f"📁 {a['source']}")
        print(f"{'─'*100}")
        print(f"   Current Entries: {a['current']:,}")
        
        for key, val in a.items():
            if key not in ['source', 'current']:
                if isinstance(val, dict):
                    print(f"   {key}:")
                    for k, v in val.items():
                        print(f"      • {k}: {v}")
                else:
                    print(f"   {key}: {val}")
    
    # Summary table
    print("\n" + "="*100)
    print("📋 COMPLETENESS SUMMARY - WHAT WE NEED FOR 100%")
    print("="*100)
    
    # Dynamically get actual counts
    actual_bva = results["subdirs"].get("bva", {}).get("total_entries", 0)
    actual_cavc = results["subdirs"].get("cavc", {}).get("total_entries", 0)
    actual_m21 = results["subdirs"].get("m21-1", {}).get("total_entries", 0)
    actual_ogc = results["subdirs"].get("ogc", {}).get("total_entries", 0)
    actual_fc = results["subdirs"].get("federal-circuit", {}).get("total_entries", 0)
    actual_ecfr = results["subdirs"].get("ecfr-fresh", {}).get("total_entries", 0)
    actual_pres = results["subdirs"].get("presumptive", {}).get("total_entries", 0)
    actual_sec = results["subdirs"].get("secondary", {}).get("total_entries", 0)
    
    targets = [
        ("BVA Precedential", actual_bva, 5000, "~5,000 true precedential"),
        ("CAVC Published", actual_cavc, 13600, "~13,600 published decisions"),
        ("M21-1 Sections", actual_m21, 1500, "~1,500 manual sections"),
        ("OGC Precedent", actual_ogc, 1000, "~1,000 precedent opinions"),
        ("Federal Circuit", actual_fc, 2625, "~2,625 veteran cases"),
        ("Rating Schedule", actual_ecfr, 800, "~800 diagnostic codes"),
        ("Presumptive", actual_pres, 200, "~200 conditions"),
        ("Secondary", actual_sec, 750, "~750 documented pairs"),
    ]
    
    print(f"\n{'Source':<25} {'Have':>10} {'Need':>10} {'Coverage':>12} {'Gap':>10} {'Target Description'}")
    print("─"*100)
    
    for name, have, need, desc in targets:
        coverage = min(have / need * 100, 100) if need > 0 else 0
        gap = max(need - have, 0)
        status = "✅" if coverage >= 90 else "🟡" if coverage >= 50 else "❌"
        print(f"{name:<25} {have:>10,} {need:>10,} {status} {coverage:>9.1f}% {gap:>10,} {desc}")
    
    print("─"*100)
    
    total_have = sum(t[1] for t in targets)
    total_need = sum(t[2] for t in targets)
    print(f"{'TOTAL':<25} {total_have:>10,} {total_need:>10,} {'':>12} {max(total_need-total_have,0):>10,}")
    
    print("\n" + "="*100)
    print("🎯 PRIORITY GAPS TO ACHIEVE COMPLETE RECORD")
    print("="*100)
    print("""
    🔴 CRITICAL GAPS (Low Coverage):
       1. Federal Circuit: 22/2,625 (0.8%) - Need comprehensive case scraper
       2. M21-1 Manual: 419/1,500 (28%) - Need complete manual section extraction
       3. Secondary Conditions: 234/750 (31%) - Need medical nexus research
    
    🟡 MODERATE GAPS (Partial Coverage):
       4. CAVC Published: 9,057/13,600 (67%) - Need remaining years/unpublished
       5. Presumptive: 140/175 (80%) - Need PACT Act updates
    
    ✅ COMPLETE OR OVER-COMPLETE:
       6. BVA: 77,618 (way over target - includes non-precedential)
       7. Rating Schedule: 3,139/800 (392%) - Complete with extras
       8. OGC: 937/1,000 (94%) - Near complete
    
    📌 RECOMMENDED ACTIONS:
       1. Create federal_circuit_comprehensive_scraper.py
       2. Create m21_1_complete_manual_scraper.py (all Parts I-V)
       3. Research and add secondary condition medical literature
       4. Scrape remaining CAVC years
       5. Add PACT Act presumptives
    """)
    print("="*100 + "\n")

if __name__ == "__main__":
    main()
