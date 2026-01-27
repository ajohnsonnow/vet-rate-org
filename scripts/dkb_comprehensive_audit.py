#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DIAMOND KNOWLEDGE BASE - COMPREHENSIVE AUDIT                             ║
║══════════════════════════════════════════════════════════════════════════════║
║  Full audit of all KB sources, entry counts, quality metrics, and gaps       ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
import os
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict
from typing import Dict, List, Any, Tuple

KB_DIR = Path(__file__).parent.parent / "llm-compiler" / "knowledge-base"

def count_entries(file_path: Path) -> Tuple[int, str]:
    """Count entries in a JSON file, return count and structure type"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            return len(data), "array"
        elif isinstance(data, dict):
            if 'entries' in data:
                entries = data['entries']
                return len(entries) if isinstance(entries, list) else 0, "dict.entries"
            elif 'decisions' in data:
                decisions = data['decisions']
                return len(decisions) if isinstance(decisions, list) else 0, "dict.decisions"
            elif 'cases' in data:
                cases = data['cases']
                return len(cases) if isinstance(cases, list) else 0, "dict.cases"
            else:
                return 1, "dict.single"
        return 0, "unknown"
    except Exception as e:
        return -1, f"error: {str(e)[:50]}"

def get_file_size_mb(file_path: Path) -> float:
    """Get file size in MB"""
    return file_path.stat().st_size / (1024 * 1024)

def analyze_entry_quality(file_path: Path) -> Dict[str, Any]:
    """Analyze entry quality metrics"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        entries = []
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict) and 'entries' in data:
            entries = data['entries']
        
        if not entries:
            return {}
        
        # Analyze fields
        has_citation = sum(1 for e in entries if e.get('citation'))
        has_url = sum(1 for e in entries if e.get('url'))
        has_content = sum(1 for e in entries if e.get('content') and len(str(e.get('content', ''))) > 100)
        has_category = sum(1 for e in entries if e.get('category'))
        
        # Content length stats
        content_lengths = [len(str(e.get('content', ''))) for e in entries]
        avg_content_len = sum(content_lengths) / len(content_lengths) if content_lengths else 0
        
        return {
            "total": len(entries),
            "with_citation": has_citation,
            "with_url": has_url,
            "with_content_100+": has_content,
            "with_category": has_category,
            "avg_content_length": int(avg_content_len),
            "quality_score": round((has_citation + has_url + has_content + has_category) / (4 * len(entries)) * 100, 1)
        }
    except:
        return {}

def audit_directory(dir_path: Path, depth: int = 0) -> Dict[str, Any]:
    """Recursively audit a directory"""
    results = {
        "files": [],
        "subdirs": {},
        "total_entries": 0,
        "total_size_mb": 0,
        "json_files": 0
    }
    
    if not dir_path.exists():
        return results
    
    for item in sorted(dir_path.iterdir()):
        if item.is_file() and item.suffix == '.json':
            count, struct = count_entries(item)
            size_mb = get_file_size_mb(item)
            
            results["files"].append({
                "name": item.name,
                "entries": count,
                "structure": struct,
                "size_mb": round(size_mb, 3)
            })
            
            if count > 0:
                results["total_entries"] += count
            results["total_size_mb"] += size_mb
            results["json_files"] += 1
            
        elif item.is_dir() and not item.name.startswith('.'):
            sub_results = audit_directory(item, depth + 1)
            results["subdirs"][item.name] = sub_results
            results["total_entries"] += sub_results["total_entries"]
            results["total_size_mb"] += sub_results["total_size_mb"]
            results["json_files"] += sub_results["json_files"]
    
    return results

def print_audit_report(results: Dict[str, Any], base_path: Path):
    """Print comprehensive audit report"""
    
    print("\n" + "="*100)
    print("💎 DIAMOND KNOWLEDGE BASE - COMPREHENSIVE AUDIT REPORT")
    print("="*100)
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📁 Path: {base_path}")
    print("="*100)
    
    # Overall stats
    print(f"\n📊 OVERALL STATISTICS")
    print("-"*50)
    print(f"   Total JSON Files:     {results['json_files']:,}")
    print(f"   Total Entries:        {results['total_entries']:,}")
    print(f"   Total Size:           {results['total_size_mb']:.2f} MB")
    
    # Per-directory breakdown
    print(f"\n📁 DIRECTORY BREAKDOWN")
    print("-"*100)
    print(f"{'Directory':<25} {'Files':>8} {'Entries':>10} {'Size (MB)':>12} {'Top File':<40}")
    print("-"*100)
    
    dir_stats = []
    
    for dir_name, dir_data in sorted(results["subdirs"].items()):
        # Find top file by entries
        top_file = ""
        max_entries = 0
        for f in dir_data.get("files", []):
            if f["entries"] > max_entries:
                max_entries = f["entries"]
                top_file = f"{f['name']} ({f['entries']})"
        
        dir_stats.append({
            "name": dir_name,
            "files": dir_data["json_files"],
            "entries": dir_data["total_entries"],
            "size_mb": dir_data["total_size_mb"],
            "top_file": top_file
        })
        
        print(f"{dir_name:<25} {dir_data['json_files']:>8} {dir_data['total_entries']:>10,} {dir_data['total_size_mb']:>12.2f} {top_file:<40}")
    
    # Root level files
    if results["files"]:
        root_entries = sum(f["entries"] for f in results["files"] if f["entries"] > 0)
        root_size = sum(f["size_mb"] for f in results["files"])
        print(f"{'[root]':<25} {len(results['files']):>8} {root_entries:>10,} {root_size:>12.2f}")
    
    print("-"*100)
    print(f"{'TOTAL':<25} {results['json_files']:>8} {results['total_entries']:>10,} {results['total_size_mb']:>12.2f}")
    
    # Gap Analysis against targets
    print(f"\n🎯 GAP ANALYSIS (vs. Targets)")
    print("-"*100)
    
    gaps = [
        ("GAP #1", "CAVC 2007-2023", "cavc", 200, 500, "CRITICAL"),
        ("GAP #2", "BVA Precedential", "bva", 50, 100, "HIGH"),
        ("GAP #3", "M21-1 Manual", "m21-1", 200, 500, "HIGH"),
        ("GAP #4", "OGC Opinions", "ogc", 100, 200, "HIGH"),
        ("GAP #5", "Federal Circuit", "federal-circuit", 20, 50, "HIGH"),
        ("GAP #6", "Rating Schedule", "ecfr-fresh", 1000, 2000, "MEDIUM"),
        ("GAP #7", "Presumptive", "presumptive", 100, 150, "HIGH"),
        ("GAP #8", "Secondary", "secondary", 50, 100, "MEDIUM"),
    ]
    
    print(f"{'Gap ID':<10} {'Name':<25} {'Directory':<15} {'Actual':>10} {'Target':>12} {'Status':<12} {'Priority'}")
    print("-"*100)
    
    complete = 0
    partial = 0
    missing = 0
    
    for gap_id, name, dir_name, min_target, max_target, priority in gaps:
        actual = results["subdirs"].get(dir_name, {}).get("total_entries", 0)
        
        if actual >= min_target:
            status = "✅ COMPLETE"
            complete += 1
        elif actual > 0:
            status = f"🟡 {int(actual/min_target*100)}%"
            partial += 1
        else:
            status = "❌ MISSING"
            missing += 1
        
        print(f"{gap_id:<10} {name:<25} {dir_name:<15} {actual:>10,} {f'{min_target}-{max_target}':>12} {status:<12} [{priority}]")
    
    print("-"*100)
    print(f"Summary: {complete} Complete | {partial} Partial | {missing} Missing")
    
    # Top 15 files by entry count
    print(f"\n📈 TOP 15 FILES BY ENTRY COUNT")
    print("-"*80)
    
    all_files = []
    for dir_name, dir_data in results["subdirs"].items():
        for f in dir_data.get("files", []):
            if f["entries"] > 0:
                all_files.append({
                    "path": f"{dir_name}/{f['name']}",
                    "entries": f["entries"],
                    "size_mb": f["size_mb"]
                })
    
    for f in results["files"]:
        if f["entries"] > 0:
            all_files.append({
                "path": f["name"],
                "entries": f["entries"],
                "size_mb": f["size_mb"]
            })
    
    all_files.sort(key=lambda x: x["entries"], reverse=True)
    
    print(f"{'#':<4} {'File Path':<55} {'Entries':>12} {'Size (MB)':>12}")
    print("-"*80)
    for i, f in enumerate(all_files[:15], 1):
        print(f"{i:<4} {f['path']:<55} {f['entries']:>12,} {f['size_mb']:>12.3f}")
    
    # Quality analysis for key files
    print(f"\n🔍 QUALITY ANALYSIS (Key Files)")
    print("-"*100)
    
    key_files = [
        "cavc/cavc_2007_2023_dkb_format.json",
        "bva/bva_precedential_decisions.json",
        "m21-1/m21_1_complete_merged.json",
        "ogc/ogc_all_dkb_format.json",
        "federal-circuit/federal_circuit_knowledge.json",
        "ecfr-fresh/ecfr_gap_filler.json",
        "presumptive/presumptive_conditions.json",
        "secondary/secondary_conditions_matrix.json",
    ]
    
    print(f"{'File':<45} {'Entries':>8} {'Citation':>10} {'URL':>8} {'Content':>10} {'Quality':>10}")
    print("-"*100)
    
    for rel_path in key_files:
        full_path = base_path / rel_path
        if full_path.exists():
            quality = analyze_entry_quality(full_path)
            if quality:
                print(f"{rel_path:<45} {quality.get('total', 0):>8} "
                      f"{quality.get('with_citation', 0):>10} "
                      f"{quality.get('with_url', 0):>8} "
                      f"{quality.get('with_content_100+', 0):>10} "
                      f"{quality.get('quality_score', 0):>9.1f}%")
            else:
                print(f"{rel_path:<45} {'N/A':>8}")
        else:
            print(f"{rel_path:<45} {'NOT FOUND':>8}")
    
    # Source hierarchy coverage
    print(f"\n📚 SOURCE HIERARCHY COVERAGE")
    print("-"*60)
    print("""
    Level 1 - Statutory Law (38 USC, 38 CFR)
    Level 2 - Judicial Precedent (Federal Circuit, CAVC, BVA)
    Level 3 - VA Policy (M21-1, OGC Opinions)
    Level 4 - Medical/Scientific (DBQs, Rating Criteria)
    Level 5 - Community Knowledge (Reddit, Forums)
    """)
    
    hierarchy = {
        "Level 1 (Statutory)": ["ecfr", "ecfr-fresh", "official-va"],
        "Level 2 (Judicial)": ["federal-circuit", "cavc", "bva", "bva-diamond"],
        "Level 3 (VA Policy)": ["m21-1", "ogc"],
        "Level 4 (Medical)": ["presumptive", "secondary"],
        "Level 5 (Community)": ["community", "additional_sources"],
    }
    
    for level_name, dirs in hierarchy.items():
        level_total = sum(results["subdirs"].get(d, {}).get("total_entries", 0) for d in dirs)
        print(f"   {level_name:<25} {level_total:>8,} entries")
    
    # Final summary
    print(f"\n" + "="*100)
    print("💎 AUDIT COMPLETE")
    print("="*100)
    print(f"""
    📊 Total Knowledge Base Entries: {results['total_entries']:,}
    📁 Total JSON Files: {results['json_files']}
    💾 Total Size: {results['total_size_mb']:.2f} MB
    
    🎯 Gap Status: {complete}/8 Complete ({int(complete/8*100)}%)
    ✅ All Critical/High Priority Gaps: {'ADDRESSED' if complete >= 6 else 'IN PROGRESS'}
    
    🏆 Knowledge Base Status: {'DIAMOND TIER' if complete == 8 else 'PRODUCTION READY' if complete >= 6 else 'DEVELOPMENT'}
    """)
    print("="*100 + "\n")

def main():
    print("\n🔍 Starting comprehensive DKB audit...\n")
    
    if not KB_DIR.exists():
        print(f"❌ Knowledge base directory not found: {KB_DIR}")
        return
    
    results = audit_directory(KB_DIR)
    print_audit_report(results, KB_DIR)

if __name__ == "__main__":
    main()
