#!/usr/bin/env python3
"""
💎 CAVC Archive Mass Downloader
================================
Downloads ALL CAVC case archives from 1989-2006.
These contain THOUSANDS of precedential opinions to help veterans.

Author: VetRate Team
Date: 2026-01-26
"""

import requests
import os
from pathlib import Path
from datetime import datetime
import time

# Disable SSL warnings (government sites)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Base directory for downloads
WORKSPACE = Path("E:/VS_Studio/vet-rate-org-official")
DOWNLOAD_DIR = WORKSPACE / "llm-compiler" / "knowledge-base" / "cavc" / "archives"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# All panel decisions (PRECEDENTIAL - highest value)
PANEL_ARCHIVES = {
    "1989-2006": "https://www.uscourts.cavc.gov/documents/panel_decisions_1989-2006.zip",  # 18 MB - MASSIVE
    "2006": "https://www.uscourts.cavc.gov/documents/OpinionPanel2006.zip",
    "2005": "https://www.uscourts.cavc.gov/documents/OpinionsPanel2005.zip",
    "2004": "https://www.uscourts.cavc.gov/documents/OpinionsPanel2004.zip",
    "2003": "https://www.uscourts.cavc.gov/documents/OpinionsPanel2003.zip",
    "2002": "https://www.uscourts.cavc.gov/documents/OpinionsPanel2002.zip",
    "2001": "https://www.uscourts.cavc.gov/documents/OpinionsPanel2001.zip",
    "2000": "https://www.uscourts.cavc.gov/documents/OpinionPanel20001.zip",
    "1999": "https://www.uscourts.cavc.gov/documents/OpinionsPanel19992.zip",
    "1998": "https://www.uscourts.cavc.gov/documents/OpinionsPanel19982.zip",
    "1997": "https://www.uscourts.cavc.gov/documents/OpninionPanel1997.zip",
    "1996": "https://www.uscourts.cavc.gov/documents/Panl1996.zip",
    "1995": "https://www.uscourts.cavc.gov/documents/OpinionPanel1995.zip",
    "1994": "https://www.uscourts.cavc.gov/documents/OpinionPanel1994.zip",
    "1993": "https://www.uscourts.cavc.gov/documents/93.zip",
    "1992": "https://www.uscourts.cavc.gov/documents/OpinionPanel1992.zip",
    "1991": "https://www.uscourts.cavc.gov/documents/OpinionPanel1991.zip",
    "1990": "https://www.uscourts.cavc.gov/documents/OpinionPanel1990.zip",
    "1989": "https://www.uscourts.cavc.gov/documents/89.zip",
}

# Single judge decisions (lower priority but still valuable)
SINGLE_JUDGE_ARCHIVES = {
    "1989-2000": "https://www.uscourts.cavc.gov/documents/single_all2.zip",  # 26 MB
    "2000": "https://www.uscourts.cavc.gov/documents/sngl20002.zip",
    "1999": "https://www.uscourts.cavc.gov/documents/sngl19991.zip",
    "1998": "https://www.uscourts.cavc.gov/documents/Sngl19981.zip",
    "1994": "https://www.uscourts.cavc.gov/documents/Sngl1994.zip",
    "1993": "https://www.uscourts.cavc.gov/documents/Sngl1993.zip",
    "1992": "https://www.uscourts.cavc.gov/documents/Sngl1992.zip",
    "1991": "https://www.uscourts.cavc.gov/documents/Sngl1991.zip",
    "1990": "https://www.uscourts.cavc.gov/documents/Sngl1990.zip",
}

def download_file(url, filename, desc):
    """Download a single archive file."""
    filepath = DOWNLOAD_DIR / filename
    
    # Skip if already downloaded
    if filepath.exists():
        size_mb = filepath.stat().st_size / (1024 * 1024)
        print(f"   ⏭️  SKIP: {filename} already exists ({size_mb:.1f} MB)")
        return True
    
    print(f"\n📥 Downloading: {desc}")
    print(f"   URL: {url}")
    print(f"   File: {filename}")
    
    try:
        # Try with SSL verify first
        response = requests.get(url, stream=True, timeout=300)
        
        if response.status_code != 200:
            # Retry with certifi CA bundle for SSL issues
            print(f"   ⚠️  Retrying with certifi CA bundle...")
            import certifi
            response = requests.get(url, stream=True, timeout=300, verify=certifi.where())
        
        if response.status_code == 200:
            total_size = int(response.headers.get('content-length', 0))
            total_mb = total_size / (1024 * 1024)
            
            with open(filepath, 'wb') as f:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = (downloaded / total_size) * 100
                            mb_downloaded = downloaded / (1024 * 1024)
                            print(f"   Progress: {percent:.1f}% ({mb_downloaded:.1f}/{total_mb:.1f} MB)", end='\r')
            
            print(f"\n   ✅ Downloaded: {total_mb:.1f} MB")
            return True
        else:
            print(f"   ❌ Failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def main():
    print("=" * 80)
    print("💎 CAVC ARCHIVE MASS DOWNLOADER")
    print("=" * 80)
    print(f"\n📁 Download Directory: {DOWNLOAD_DIR}")
    print(f"📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track statistics
    stats = {
        "total_files": 0,
        "downloaded": 0,
        "skipped": 0,
        "failed": 0,
        "total_mb": 0
    }
    
    # Download Panel Decisions (HIGHEST PRIORITY)
    print("\n" + "=" * 80)
    print("⚖️  PANEL DECISIONS (PRECEDENTIAL OPINIONS)")
    print("=" * 80)
    print("These are binding precedent - HIGHEST VALUE for veterans!")
    
    for year, url in PANEL_ARCHIVES.items():
        stats["total_files"] += 1
        filename = f"panel_{year}.zip"
        result = download_file(url, filename, f"Panel Decisions {year}")
        
        if result:
            if (DOWNLOAD_DIR / filename).exists():
                if (DOWNLOAD_DIR / filename).stat().st_size > 1024:
                    stats["downloaded"] += 1
                    stats["total_mb"] += (DOWNLOAD_DIR / filename).stat().st_size / (1024 * 1024)
                else:
                    stats["skipped"] += 1
        else:
            stats["failed"] += 1
        
        time.sleep(1)  # Be nice to the server
    
    # Download Single Judge Decisions
    print("\n" + "=" * 80)
    print("👨‍⚖️ SINGLE JUDGE DECISIONS")
    print("=" * 80)
    print("Non-precedential but still valuable examples!")
    
    for year, url in SINGLE_JUDGE_ARCHIVES.items():
        stats["total_files"] += 1
        filename = f"single_{year}.zip"
        result = download_file(url, filename, f"Single Judge Decisions {year}")
        
        if result:
            if (DOWNLOAD_DIR / filename).exists():
                if (DOWNLOAD_DIR / filename).stat().st_size > 1024:
                    stats["downloaded"] += 1
                    stats["total_mb"] += (DOWNLOAD_DIR / filename).stat().st_size / (1024 * 1024)
                else:
                    stats["skipped"] += 1
        else:
            stats["failed"] += 1
        
        time.sleep(1)
    
    # Print summary
    print("\n" + "=" * 80)
    print("📊 DOWNLOAD SUMMARY")
    print("=" * 80)
    print(f"Total Files: {stats['total_files']}")
    print(f"✅ Downloaded: {stats['downloaded']}")
    print(f"⏭️  Skipped: {stats['skipped']}")
    print(f"❌ Failed: {stats['failed']}")
    print(f"💾 Total Size: {stats['total_mb']:.1f} MB")
    print(f"\n📁 All files in: {DOWNLOAD_DIR}")
    print(f"📅 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    print("\n🎯 NEXT STEPS:")
    print("1. Extract all ZIP files")
    print("2. Parse PDFs for case metadata")
    print("3. Filter for high-value cases (PTSD, TDIU, mental health, secondaries)")
    print("4. Create JSON entries for DKB")
    print("5. Integrate into production knowledge base")
    print("\n💡 This will give veterans access to DECADES of binding precedent!")

if __name__ == "__main__":
    main()
