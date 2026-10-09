#!/usr/bin/env python3
"""
Diamond Standard Progress Monitor
Real-time monitoring of autonomous compilation
"""

import json
import time
from pathlib import Path
from datetime import datetime

def format_duration(seconds):
    """Format seconds into human-readable duration"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours}h {minutes}m {secs}s"

def monitor_progress():
    """Monitor compilation progress"""
    log_dir = Path(__file__).parent / "logs"
    status_file = log_dir / "orchestration_status.json"
    
    print("=" * 80)
    print("DIAMOND STANDARD - AUTONOMOUS COMPILATION MONITOR")
    print("=" * 80)
    print()
    
    if not status_file.exists():
        print("Waiting for compilation to start...")
        time.sleep(5)
        return monitor_progress()
    
    with open(status_file) as f:
        status = json.load(f)
    
    start_time = datetime.fromisoformat(status["started"])
    elapsed = (datetime.now() - start_time).total_seconds()
    
    print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Elapsed: {format_duration(elapsed)}")
    print(f"Current Phase: {status['current_phase']}")
    print()
    
    # Phases
    phases = [
        ("knowledge_scraping", "Knowledge Base Scraping"),
        ("model_training", "Model Swarm Training"),
        ("webgpu_compilation", "WebGPU Compilation"),
        ("huggingface_upload", "HuggingFace Upload")
    ]
    
    print("PHASES:")
    for phase_id, phase_name in phases:
        if phase_id in status["phases_completed"]:
            print(f"  [OK] {phase_name}")
        elif status["current_phase"] == phase_id:
            print(f"  [>>] {phase_name} (IN PROGRESS)")
        else:
            print(f"  [ ] {phase_name}")
    print()
    
    # Errors
    if status["errors"]:
        print(f"ERRORS: {len(status['errors'])}")
        for error in status["errors"][-3:]:  # Show last 3
            print(f"  - {error['phase']}: {error['error'][:80]}")
        print()
    
    # Knowledge base stats
    kb_file = Path(__file__).parent / "knowledge-base" / "va_complete_knowledge_base.json"
    if kb_file.exists():
        try:
            with open(kb_file) as f:
                kb = json.load(f)
            print("KNOWLEDGE BASE:")
            print(f"  Total Citations: {kb['metadata']['total_citations']}")
            print(f"  Sources: {', '.join(kb['metadata']['sources'])}")
            print()
        except:
            pass
    
    # Logs
    log_files = sorted(log_dir.glob("orchestrator_*.log"))
    if log_files:
        latest_log = log_files[-1]
        print(f"Latest Log: {latest_log.name}")
        print()
        
        # Show last 5 lines
        with open(latest_log, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            print("RECENT ACTIVITY:")
            for line in lines[-5:]:
                print(f"  {line.strip()}")
    
    print()
    print("=" * 80)
    
    if status["current_phase"] == "complete":
        print("[SUCCESS] Compilation complete!")
        print(f"Total time: {format_duration(elapsed)}")
        return
    
    print(f"Refreshing in 30 seconds... (Ctrl+C to exit)")
    print("=" * 80)
    
    try:
        time.sleep(30)
        print("\n" * 2)
        monitor_progress()
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")

if __name__ == "__main__":
    try:
        monitor_progress()
    except Exception as e:
        print(f"Error: {e}")
