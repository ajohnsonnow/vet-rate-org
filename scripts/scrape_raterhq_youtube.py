#!/usr/bin/env python3
"""
Scrape RaterHQ YouTube Channel for CKB
======================================
Extracts video titles, descriptions, and metadata from the RaterHQ YouTube channel
and adds them to the Community Knowledge Base (CKB).

REQUIRES: 
- pip install google-api-python-client
- YouTube Data API v3 key (free from Google Cloud Console)

OR run with yt-dlp (no API key needed):
- pip install yt-dlp
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from collections import Counter

# Paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
CKB_PATH = WORKSPACE_ROOT / "public" / "data" / "community_knowledge.json"
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "community"

# RaterHQ Channel Info
CHANNEL_URL = "https://www.youtube.com/@RaterHQ"
CHANNEL_ID = "UCVnXCRVcUUHCfUNPXQYaKCg"  # May need to verify this

def scrape_with_ytdlp():
    """Scrape using yt-dlp (no API key required)"""
    try:
        import yt_dlp
    except ImportError:
        print("Installing yt-dlp...")
        os.system("pip install yt-dlp")
        import yt_dlp
    
    print("="*60)
    print("📺 Scraping RaterHQ YouTube Channel with yt-dlp")
    print("="*60)
    
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,
        'force_generic_extractor': False,
    }
    
    videos = []
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Get channel videos
            result = ydl.extract_info(f"{CHANNEL_URL}/videos", download=False)
            
            if result and 'entries' in result:
                print(f"Found {len(result['entries'])} videos")
                
                for entry in result['entries']:
                    if entry:
                        video = {
                            'id': entry.get('id', ''),
                            'title': entry.get('title', ''),
                            'description': entry.get('description', ''),
                            'url': entry.get('url', f"https://www.youtube.com/watch?v={entry.get('id', '')}"),
                            'duration': entry.get('duration', 0),
                            'view_count': entry.get('view_count', 0),
                            'upload_date': entry.get('upload_date', ''),
                        }
                        videos.append(video)
                        print(f"  ✓ {video['title'][:60]}...")
    except Exception as e:
        print(f"Error scraping channel: {e}")
        print("\nTrying alternative method...")
        return scrape_with_api()
    
    return videos

def scrape_with_api():
    """Scrape using YouTube Data API v3"""
    try:
        from googleapiclient.discovery import build
    except ImportError:
        print("Installing google-api-python-client...")
        os.system("pip install google-api-python-client")
        from googleapiclient.discovery import build
    
    # Check for API key
    api_key = os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        print("\n⚠️  No YOUTUBE_API_KEY environment variable found.")
        print("To use the YouTube API method:")
        print("1. Go to https://console.cloud.google.com/")
        print("2. Create a project and enable YouTube Data API v3")
        print("3. Create an API key")
        print("4. Set: $env:YOUTUBE_API_KEY='your-api-key'")
        print("\nAlternatively, manually add RaterHQ content to CKB.")
        return []
    
    print("="*60)
    print("📺 Scraping RaterHQ YouTube Channel with API")
    print("="*60)
    
    youtube = build('youtube', 'v3', developerKey=api_key)
    
    videos = []
    next_page_token = None
    
    while True:
        # Get channel uploads
        request = youtube.search().list(
            part='snippet',
            channelId=CHANNEL_ID,
            maxResults=50,
            order='date',
            type='video',
            pageToken=next_page_token
        )
        response = request.execute()
        
        for item in response.get('items', []):
            snippet = item.get('snippet', {})
            video = {
                'id': item.get('id', {}).get('videoId', ''),
                'title': snippet.get('title', ''),
                'description': snippet.get('description', ''),
                'url': f"https://www.youtube.com/watch?v={item.get('id', {}).get('videoId', '')}",
                'upload_date': snippet.get('publishedAt', ''),
                'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
            }
            videos.append(video)
            print(f"  ✓ {video['title'][:60]}...")
        
        next_page_token = response.get('nextPageToken')
        if not next_page_token:
            break
    
    return videos

def convert_to_ckb_entries(videos):
    """Convert scraped videos to CKB entry format"""
    entries = []
    
    for video in videos:
        # Extract topics from title
        title = video.get('title', '')
        description = video.get('description', '')
        
        # Create instruction-output pair for each video
        entry = {
            "instruction": f"What does RaterHQ say about: {title}?",
            "output": f"According to RaterHQ ({video.get('url', '')}): {description[:1500] if description else 'See video for details.'}",
            "metadata": {
                "source": "COMMUNITY_PROVIDED",
                "source_detail": "RaterHQ YouTube Channel",
                "type": "community_video",
                "citation": f"RaterHQ. \"{title}\". YouTube. {video.get('upload_date', 'n.d.')}",
                "url": video.get('url', ''),
                "video_id": video.get('id', ''),
                "scraped_date": datetime.now().isoformat(),
                "training_approved": False,  # CKB is NOT for training
                "disclaimer": "Community-provided content from YouTube. Not official VA guidance."
            }
        }
        entries.append(entry)
    
    return entries

def update_ckb(new_entries):
    """Add new entries to Community Knowledge Base"""
    print(f"\n📥 Loading existing CKB from {CKB_PATH}")
    
    # Load existing CKB
    if CKB_PATH.exists():
        with open(CKB_PATH, 'r', encoding='utf-8') as f:
            ckb_data = json.load(f)
    else:
        ckb_data = {
            "metadata": {
                "name": "Community Knowledge Base (CKB)",
                "description": "Community-provided veteran experiences and insights",
                "version": "1.0.0",
                "training_approved": False,
                "warning": "Community content - not verified by official sources"
            },
            "entries": []
        }
    
    existing_entries = ckb_data.get('entries', [])
    existing_urls = {e.get('metadata', {}).get('url', '') for e in existing_entries}
    
    # Add only new entries
    added = 0
    for entry in new_entries:
        url = entry.get('metadata', {}).get('url', '')
        if url and url not in existing_urls:
            existing_entries.append(entry)
            added += 1
    
    # Update CKB
    ckb_data['entries'] = existing_entries
    ckb_data['metadata']['generated'] = datetime.now().isoformat()
    ckb_data['metadata']['total_entries'] = len(existing_entries)
    
    # Count sources
    source_counts = Counter(e.get('metadata', {}).get('source_detail', 'Unknown') for e in existing_entries)
    ckb_data['metadata']['sources'] = dict(source_counts)
    
    # Save
    with open(CKB_PATH, 'w', encoding='utf-8') as f:
        json.dump(ckb_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Added {added} new RaterHQ entries to CKB")
    print(f"📊 Total CKB entries: {len(existing_entries)}")
    
    return added

def manual_entry_mode():
    """Allow manual entry of RaterHQ video content"""
    print("\n" + "="*60)
    print("📝 MANUAL ENTRY MODE")
    print("="*60)
    print("YouTube requires authentication. Enter video info manually.")
    print("Type 'done' when finished.\n")
    
    entries = []
    
    while True:
        print("-"*40)
        video_url = input("Video URL (or 'done'): ").strip()
        if video_url.lower() == 'done':
            break
        
        title = input("Video Title: ").strip()
        description = input("Key Points (brief summary): ").strip()
        
        if video_url and title:
            entry = {
                "instruction": f"What does RaterHQ say about: {title}?",
                "output": f"According to RaterHQ ({video_url}): {description}",
                "metadata": {
                    "source": "COMMUNITY_PROVIDED",
                    "source_detail": "RaterHQ YouTube Channel",
                    "type": "community_video",
                    "citation": f"RaterHQ. \"{title}\". YouTube.",
                    "url": video_url,
                    "scraped_date": datetime.now().isoformat(),
                    "training_approved": False,
                    "disclaimer": "Community-provided content from YouTube. Not official VA guidance."
                }
            }
            entries.append(entry)
            print(f"✓ Added: {title}")
    
    return entries

def main():
    print("="*70)
    print("📺 RaterHQ YouTube Scraper for CKB")
    print("="*70)
    print(f"Channel: {CHANNEL_URL}")
    print(f"Output: {CKB_PATH}")
    print("="*70)
    
    # Try automated scraping first
    videos = scrape_with_ytdlp()
    
    if not videos:
        print("\n⚠️  Automated scraping failed.")
        choice = input("\nEnter videos manually? (y/n): ").strip().lower()
        if choice == 'y':
            entries = manual_entry_mode()
        else:
            print("\nTo add RaterHQ content manually later, run:")
            print("  python scripts/scrape_raterhq_youtube.py --manual")
            return
    else:
        entries = convert_to_ckb_entries(videos)
    
    if entries:
        added = update_ckb(entries)
        print("\n" + "="*70)
        print("✅ SCRAPING COMPLETE")
        print("="*70)
        print(f"New entries added: {added}")
        print(f"CKB file: {CKB_PATH}")
        print("\n⚠️  REMINDER: CKB is NOT used for AI training!")
    else:
        print("\nNo entries to add.")

if __name__ == "__main__":
    if "--manual" in sys.argv:
        entries = manual_entry_mode()
        if entries:
            update_ckb(entries)
    else:
        main()
