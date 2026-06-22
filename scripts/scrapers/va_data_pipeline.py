#!/usr/bin/env python3
"""
Comprehensive VA Data Pipeline
==============================

Master controller for all VA data collection. Orchestrates:
- BVA Decision scraping and analysis
- VA Workload Report collection
- VA Open Data Portal fetching
- Data synthesis and JavaScript generation

This creates/updates the frontend data files automatically.

Usage:
    python va_data_pipeline.py --full-update
    python va_data_pipeline.py --condition "sleep apnea" --bva-only
    python va_data_pipeline.py --generate-frontend
"""

import json
import os
import re
import sys
import argparse
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def safe_path(user_path, allowed_dir=None):
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "src" / "data"
SCRAPERS_DIR = Path(__file__).parent

# Conditions to track (high-value for veterans)
PRIORITY_CONDITIONS = [
    "sleep apnea",
    "PTSD",
    "tinnitus", 
    "migraine",
    "radiculopathy",
    "GERD",
    "depression",
    "anxiety",
    "back condition",
    "knee condition",
    "sinusitis",
    "rhinitis",
    "hypertension",
]

# Secondary connection pathways (very common)
SECONDARY_PATHWAYS = [
    ("sleep apnea", "PTSD"),
    ("sleep apnea", "hypertension"),
    ("depression", "chronic pain"),
    ("GERD", "PTSD"),
    ("migraine", "TBI"),
    ("radiculopathy", "back condition"),
    ("erectile dysfunction", "PTSD"),
    ("erectile dysfunction", "diabetes"),
]


class VADataPipeline:
    """Master pipeline for VA data collection."""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.results = {
            'started': datetime.now().isoformat(),
            'bva_analyses': [],
            'workload_data': None,
            'errors': []
        }
    
    def log(self, message: str):
        if self.verbose:
            print(message)
    
    def run_bva_scraper(self, condition: str, count: int = 50, fetch_full: bool = True) -> Optional[Dict]:
        """Run BVA decision scraper for a condition."""
        self.log(f"\n🔍 Scraping BVA decisions for: {condition}")
        
        try:
            # Import here to avoid circular imports
            from bva_decision_scraper import BVADecisionScraper, BVAAnalyzer, save_decisions, save_analysis, OUTPUT_DIR, ANALYSIS_DIR
            
            scraper = BVADecisionScraper()
            
            # Search for decisions
            decisions = scraper.search_decisions(condition=condition, max_results=count)
            
            if not decisions:
                self.log(f"  ⚠️ No decisions found for {condition}")
                return None
            
            self.log(f"  ✅ Found {len(decisions)} decisions")
            
            # Fetch full text if requested
            if fetch_full:
                self.log("  📄 Fetching full decision texts...")
                for i, decision in enumerate(decisions[:20]):  # Limit full fetches
                    if decision.get('url'):
                        full = scraper.fetch_full_decision(decision['url'])
                        if full:
                            decision.update(full)
            
            # Save raw decisions
            save_decisions(decisions, condition, OUTPUT_DIR)
            
            # Analyze
            analyzer = BVAAnalyzer(decisions)
            report = analyzer.generate_condition_report(condition)
            save_analysis(report, ANALYSIS_DIR)
            
            self.results['bva_analyses'].append(report)
            return report
            
        except Exception as e:
            error = f"BVA scraper error for {condition}: {e}"
            self.log(f"  ❌ {error}")
            self.results['errors'].append(error)
            return None
    
    def run_workload_scraper(self) -> Optional[Dict]:
        """Run VA workload report scraper."""
        self.log("\n📊 Fetching VA workload reports...")
        
        try:
            from va_workload_scraper import VAWorkloadScraper, OUTPUT_DIR
            
            scraper = VAWorkloadScraper()
            
            # Get processing times
            times = scraper.get_claims_processing_times()
            
            # Get available reports
            reports = scraper.get_available_reports()
            
            # Download latest
            if reports:
                latest = reports[0]
                filepath = scraper.download_report(latest['url'], OUTPUT_DIR / "raw")
                
                if filepath:
                    data = scraper.parse_excel_report(filepath)
                    if data:
                        self.results['workload_data'] = {
                            'processing_times': times,
                            'report_summary': data.get('summary', {}),
                            'report_date': latest.get('date')
                        }
                        return self.results['workload_data']
            
            return times
            
        except Exception as e:
            error = f"Workload scraper error: {e}"
            self.log(f"  ❌ {error}")
            self.results['errors'].append(error)
            return None
    
    def generate_frontend_data(self) -> Path:
        """
        Generate/update bvaSuccessData.js with latest scraped data.
        
        This merges all collected data into the frontend JavaScript file.
        """
        self.log("\n📝 Generating frontend data update...")
        
        output_file = DATA_DIR / "bva_data_update.js"
        
        # Build aggregated stats
        condition_stats = {}
        for analysis in self.results['bva_analyses']:
            condition = analysis.get('condition', 'unknown')
            condition_stats[condition] = {
                'sample_size': analysis.get('sample_size', 0),
                'grant_rate': analysis.get('outcomes', {}).get('grant_rate', 0),
                'denial_rate': analysis.get('outcomes', {}).get('denial_rate', 0),
                'remand_rate': analysis.get('outcomes', {}).get('remand_rate', 0),
                'favorable_rate': analysis.get('outcomes', {}).get('favorable_rate', 0),
                'evidence_analysis': analysis.get('evidence_analysis', {}),
                'winning_patterns': analysis.get('winning_patterns', []),
                'denial_patterns': analysis.get('denial_patterns', []),
            }
        
        # Get processing times
        processing = {}
        if self.results['workload_data']:
            processing = self.results['workload_data'].get('processing_times', {})
        
        # Generate JavaScript
        js_content = f'''// BVA Data Update - Auto-generated
// Generated: {datetime.now().isoformat()}
// Source: VA Public Records
// DO NOT EDIT MANUALLY - Run va_data_pipeline.py to update

/**
 * Latest BVA analysis data by condition
 * Based on scraped public BVA decisions
 */
export const BVA_CONDITION_STATS = {json.dumps(condition_stats, indent=2)};

/**
 * Current VA processing times
 * From VA Benefits Reports
 */
export const VA_PROCESSING_CURRENT = {json.dumps(processing, indent=2)};

/**
 * Data freshness info
 */
export const DATA_METADATA = {{
  lastUpdated: "{datetime.now().strftime('%Y-%m-%d')}",
  bvaDecisionsAnalyzed: {sum(s.get('sample_size', 0) for s in condition_stats.values())},
  conditionsCovered: {len(condition_stats)},
  source: "VA Public Records (BVA decisions, VA.gov reports)"
}};

/**
 * Merge function - call this to update main bvaSuccessData
 * Usage: import {{ mergeLatestData }} from './bva_data_update';
 */
export function mergeLatestData(existingData) {{
  return {{
    ...existingData,
    conditionSpecific: {{
      ...(existingData.conditionSpecific || {{}}),
      ...BVA_CONDITION_STATS
    }},
    processingTimes: {{
      ...(existingData.processingTimes || {{}}),
      ...VA_PROCESSING_CURRENT
    }},
    _lastAutoUpdate: DATA_METADATA.lastUpdated
  }};
}}
'''
        
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        self.log(f"  ✅ Generated: {output_file}")
        return output_file
    
    def run_full_update(self, conditions: List[str] = None, count_per_condition: int = 30):
        """
        Run full data pipeline update.
        
        Args:
            conditions: List of conditions to scrape (defaults to PRIORITY_CONDITIONS)
            count_per_condition: Number of BVA decisions to fetch per condition
        """
        self.log("="*60)
        self.log("🚀 VA DATA PIPELINE - FULL UPDATE")
        self.log("="*60)
        
        conditions = conditions or PRIORITY_CONDITIONS[:5]  # Start with top 5
        
        # 1. Scrape BVA decisions for each condition
        self.log(f"\n📋 Phase 1: BVA Decision Analysis ({len(conditions)} conditions)")
        
        for condition in conditions:
            self.run_bva_scraper(condition, count=count_per_condition, fetch_full=True)
        
        # 2. Get workload data
        self.log("\n📋 Phase 2: VA Workload Data")
        self.run_workload_scraper()
        
        # 3. Generate frontend update
        self.log("\n📋 Phase 3: Frontend Data Generation")
        output = self.generate_frontend_data()
        
        # 4. Summary
        self.results['completed'] = datetime.now().isoformat()
        
        self.log("\n" + "="*60)
        self.log("📊 PIPELINE COMPLETE")
        self.log("="*60)
        self.log(f"  • Conditions analyzed: {len(self.results['bva_analyses'])}")
        self.log(f"  • Total decisions: {sum(a.get('sample_size', 0) for a in self.results['bva_analyses'])}")
        self.log(f"  • Errors: {len(self.results['errors'])}")
        self.log(f"  • Output: {output}")
        
        # Save full results
        results_file = DATA_DIR / "pipeline_results.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        self.log(f"  • Full results: {results_file}")
        
        if self.results['errors']:
            self.log("\n⚠️ ERRORS:")
            for error in self.results['errors']:
                self.log(f"  • {error}")
        
        return self.results


def print_data_sources():
    """Print information about VA data sources."""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║                    VA DATA SOURCES REFERENCE                         ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  📜 BVA DECISION DATABASE                                            ║
║     URL: https://www.index.va.gov/search/va/bva.jsp                  ║
║     Data: Full text of all Board of Veterans' Appeals decisions      ║
║     Notes: Public records under FOIA, searchable by keyword          ║
║                                                                      ║
║  📊 VA MONDAY MORNING WORKLOAD REPORTS                               ║
║     URL: https://www.benefits.va.gov/REPORTS/mmwr/index.asp          ║
║     Data: Claims inventory, processing times, RO statistics          ║
║     Format: Weekly Excel files                                       ║
║                                                                      ║
║  📈 VA DETAILED CLAIMS DATA                                          ║
║     URL: https://www.benefits.va.gov/REPORTS/detailed_claims_data.asp║
║     Data: Historical claims processing statistics                    ║
║     Format: Monthly Excel files                                      ║
║                                                                      ║
║  🔢 VA OPEN DATA PORTAL                                              ║
║     URL: https://www.data.va.gov/                                    ║
║     Data: Compensation stats, demographics, facility data            ║
║     Format: JSON API (Socrata-based)                                 ║
║                                                                      ║
║  📋 VA AMA APPEALS REPORTS                                           ║
║     URL: https://www.va.gov/decision-reviews/                        ║
║     Data: Appeals Modernization Act statistics                       ║
║     Notes: Processing times by lane, success rates                   ║
║                                                                      ║
║  🏛️ ANNUAL BENEFITS REPORT                                          ║
║     URL: https://www.benefits.va.gov/REPORTS/abr/                    ║
║     Data: Yearly compensation statistics, trends                     ║
║     Format: PDF report with detailed tables                          ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    """)


def main():
    parser = argparse.ArgumentParser(
        description='VA Data Collection Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python va_data_pipeline.py --full-update
    python va_data_pipeline.py --condition "sleep apnea" --bva-only
    python va_data_pipeline.py --list-sources
    python va_data_pipeline.py --generate-frontend
        """
    )
    
    parser.add_argument('--full-update', action='store_true', 
                        help='Run complete data update pipeline')
    parser.add_argument('--condition', type=str, 
                        help='Specific condition to analyze')
    parser.add_argument('--count', type=int, default=30,
                        help='Number of BVA decisions per condition')
    parser.add_argument('--bva-only', action='store_true',
                        help='Only run BVA scraper')
    parser.add_argument('--workload-only', action='store_true',
                        help='Only run workload scraper')
    parser.add_argument('--generate-frontend', action='store_true',
                        help='Generate frontend JS from existing data')
    parser.add_argument('--list-sources', action='store_true',
                        help='List all VA data sources')
    parser.add_argument('--quiet', action='store_true',
                        help='Suppress output')
    
    args = parser.parse_args()
    
    if args.list_sources:
        print_data_sources()
        return
    
    pipeline = VADataPipeline(verbose=not args.quiet)
    
    # Sanitize condition arg to prevent path traversal in derived filenames
    if args.condition:
        args.condition = re.sub(r'[^\w\s-]', '', args.condition).strip()
    
    if args.full_update:
        conditions = [args.condition] if args.condition else None
        pipeline.run_full_update(conditions=conditions, count_per_condition=args.count)
        
    elif args.condition:
        if args.bva_only:
            pipeline.run_bva_scraper(args.condition, count=args.count)
        else:
            pipeline.run_bva_scraper(args.condition, count=args.count)
            pipeline.run_workload_scraper()
        pipeline.generate_frontend_data()
        
    elif args.workload_only:
        pipeline.run_workload_scraper()
        pipeline.generate_frontend_data()
        
    elif args.generate_frontend:
        # Load existing analysis files
        analysis_dir = DATA_DIR / "bva_analysis"
        if analysis_dir.exists():
            failed = 0
            for f in analysis_dir.glob("analysis_*.json"):
                try:
                    with open(f) as fp:
                        pipeline.results['bva_analyses'].append(json.load(fp))
                except (OSError, json.JSONDecodeError) as e:
                    failed += 1
                    print(f"⚠️  Skipped unreadable analysis file {f.name}: {e}")
            if failed:
                print(f"⚠️  {failed} analysis file(s) failed to load and were skipped")
        pipeline.generate_frontend_data()
        
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
