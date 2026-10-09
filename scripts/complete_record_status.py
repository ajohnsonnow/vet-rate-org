#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DKB COMPLETE RECORD STATUS REPORT                                        ║
║══════════════════════════════════════════════════════════════════════════════║
║  Comprehensive analysis of knowledge base completeness vs. total available   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
import os
from pathlib import Path
from datetime import datetime
from collections import Counter

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

def count_all_entries(dir_path: Path) -> int:
    """Recursively count all JSON entries in directory"""
    total = 0
    if not dir_path.exists():
        return 0
    
    for item in dir_path.rglob("*.json"):
        try:
            with open(item, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                total += len(data)
            elif isinstance(data, dict):
                # Check for common entry containers
                for key in ['entries', 'decisions', 'cases', 'opinions', 'conditions']:
                    if key in data and isinstance(data[key], list):
                        total += len(data[key])
                        break
                else:
                    # If no container found, might be a single entry or metadata
                    if 'title' in data or 'content' in data or 'citation' in data:
                        total += 1
        except:
            pass
    
    return total

def main():
    print("\n" + "="*100)
    print("💎 DKB COMPLETE RECORD STATUS - January 2026")
    print("="*100)
    print(f"📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*100)
    
    # Define complete record targets (what exists in the real world)
    sources = [
        {
            "name": "BVA Decisions",
            "dir": "bva",
            "complete_record": 5000,
            "complete_desc": "~5,000 precedential decisions (1992-2025)",
            "all_available": 2000000,
            "all_desc": "~2M total decisions (most non-precedential)",
            "priority": "HIGH",
            "notes": "Precedential decisions establish binding precedent"
        },
        {
            "name": "CAVC Published",
            "dir": "cavc",
            "complete_record": 13600,
            "complete_desc": "~13,600 published decisions (2007-2023)",
            "all_available": 59500,
            "all_desc": "~59,500 total including unpublished",
            "priority": "CRITICAL",
            "notes": "Published CAVC decisions are primary precedent"
        },
        {
            "name": "M21-1 Manual",
            "dir": "m21-1",
            "complete_record": 1500,
            "complete_desc": "~1,500 manual sections (Parts I-V)",
            "all_available": 2000,
            "all_desc": "~2,000 with all subsections",
            "priority": "HIGH",
            "notes": "VA's procedural manual for adjudicators"
        },
        {
            "name": "OGC Opinions",
            "dir": "ogc",
            "complete_record": 1000,
            "complete_desc": "~1,000 precedent opinions (1990-2025)",
            "all_available": 4000,
            "all_desc": "~4,000 including advisory opinions",
            "priority": "HIGH",
            "notes": "General Counsel binding opinions"
        },
        {
            "name": "Federal Circuit",
            "dir": "federal-circuit",
            "complete_record": 300,
            "complete_desc": "~300 landmark/frequently cited cases",
            "all_available": 2625,
            "all_desc": "~2,625 all veteran cases (1989-2025)",
            "priority": "HIGH",
            "notes": "Highest veterans law precedent below SCOTUS"
        },
        {
            "name": "Rating Schedule",
            "dir": "ecfr-fresh",
            "complete_record": 800,
            "complete_desc": "~800 diagnostic codes (38 CFR Part 4)",
            "all_available": 3000,
            "all_desc": "~3,000 with all rating criteria",
            "priority": "MEDIUM",
            "notes": "All DC codes with rating percentages"
        },
        {
            "name": "Presumptive Conditions",
            "dir": "presumptive",
            "complete_record": 200,
            "complete_desc": "~200 presumptive conditions (all categories)",
            "all_available": 250,
            "all_desc": "~250 with subcategories",
            "priority": "HIGH",
            "notes": "PACT Act, Agent Orange, Gulf War, etc."
        },
        {
            "name": "Secondary Conditions",
            "dir": "secondary",
            "complete_record": 750,
            "complete_desc": "~750 documented primary→secondary pairs",
            "all_available": 2000,
            "all_desc": "~2,000+ in medical literature",
            "priority": "MEDIUM",
            "notes": "Medical nexus relationships"
        },
    ]
    
    results = []
    for src in sources:
        actual = count_all_entries(KB_DIR / src["dir"])
        coverage = min(actual / src["complete_record"] * 100, 100) if src["complete_record"] > 0 else 0
        gap = max(src["complete_record"] - actual, 0)
        
        if coverage >= 90:
            status = "✅ COMPLETE"
        elif coverage >= 50:
            status = "🟡 PARTIAL"
        else:
            status = "❌ GAP"
        
        results.append({
            **src,
            "actual": actual,
            "coverage": coverage,
            "gap": gap,
            "status": status
        })
    
    # Print detailed table
    print(f"\n📊 COMPLETENESS VS. COMPLETE RECORD TARGETS")
    print("─"*100)
    print(f"{'Source':<22} {'Have':>10} {'Target':>10} {'Coverage':>12} {'Gap':>10} {'Status':<12} {'Priority'}")
    print("─"*100)
    
    total_have = 0
    total_need = 0
    
    for r in results:
        total_have += r["actual"]
        total_need += r["complete_record"]
        print(f"{r['name']:<22} {r['actual']:>10,} {r['complete_record']:>10,} {r['coverage']:>10.1f}% {r['gap']:>10,} {r['status']:<12} [{r['priority']}]")
    
    print("─"*100)
    total_coverage = total_have / total_need * 100 if total_need > 0 else 0
    print(f"{'TOTAL':<22} {total_have:>10,} {total_need:>10,} {total_coverage:>10.1f}% {max(total_need-total_have,0):>10,}")
    
    # Categorize by status
    complete = [r for r in results if r["coverage"] >= 90]
    partial = [r for r in results if 50 <= r["coverage"] < 90]
    gaps = [r for r in results if r["coverage"] < 50]
    
    print(f"\n📈 STATUS BREAKDOWN")
    print("─"*60)
    print(f"✅ Complete (90%+):   {len(complete)}/8 sources")
    print(f"🟡 Partial (50-89%):  {len(partial)}/8 sources")  
    print(f"❌ Gap (<50%):        {len(gaps)}/8 sources")
    
    if complete:
        print(f"\n✅ COMPLETE SOURCES:")
        for r in complete:
            print(f"   • {r['name']}: {r['actual']:,} entries ({r['coverage']:.0f}%)")
    
    if partial:
        print(f"\n🟡 PARTIAL SOURCES (need more data):")
        for r in partial:
            print(f"   • {r['name']}: {r['actual']:,}/{r['complete_record']:,} ({r['coverage']:.0f}%) - need {r['gap']:,} more")
    
    if gaps:
        print(f"\n❌ GAP SOURCES (critical need):")
        for r in gaps:
            print(f"   • {r['name']}: {r['actual']:,}/{r['complete_record']:,} ({r['coverage']:.0f}%) - need {r['gap']:,} more")
    
    # Priority actions
    print(f"\n🎯 PRIORITY ACTIONS FOR COMPLETE RECORD")
    print("─"*80)
    
    actions = sorted([r for r in results if r["gap"] > 0], key=lambda x: (-["CRITICAL", "HIGH", "MEDIUM", "LOW"].index(x["priority"]) if x["priority"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else 0, -x["gap"]))
    
    for i, r in enumerate(actions[:5], 1):
        print(f"{i}. [{r['priority']}] {r['name']}: Need {r['gap']:,} more entries")
        print(f"   Current: {r['actual']:,} | Target: {r['complete_record']:,} ({r['complete_desc']})")
        print(f"   Notes: {r['notes']}")
        print()
    
    # Final assessment
    print("="*100)
    overall = total_have / total_need * 100 if total_need > 0 else 0
    
    if overall >= 90:
        tier = "💎 DIAMOND TIER - Complete Record Achieved"
    elif overall >= 70:
        tier = "🥇 GOLD TIER - Near Complete"
    elif overall >= 50:
        tier = "🥈 SILVER TIER - Substantial Progress"
    else:
        tier = "🥉 BRONZE TIER - In Development"
    
    print(f"""
    📊 COMPLETE RECORD SUMMARY
    ─────────────────────────
    Total Entries:     {total_have:,}
    Target Entries:    {total_need:,}
    Overall Coverage:  {overall:.1f}%
    
    {tier}
    
    Sources Complete:  {len(complete)}/8
    Sources Partial:   {len(partial)}/8
    Sources Gap:       {len(gaps)}/8
    """)
    print("="*100 + "\n")

if __name__ == "__main__":
    main()
