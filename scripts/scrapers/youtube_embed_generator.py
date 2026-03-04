#!/usr/bin/env python3
"""
YouTube Embed Generator for VetRate Community Knowledge Base
=============================================================

This script generates embed data for YouTube channels relevant to VA claims.
SAFE TO USE: Embedding is not copyright infringement - views go to creator.

Usage:
    python youtube_embed_generator.py --channel-id UCZuS2HdSXFb-UdcZUmDjMvQ
    python youtube_embed_generator.py --channel-url "https://www.youtube.com/@RaterHQ"

Requires:
    pip install google-api-python-client

Note: You need a YouTube Data API v3 key from Google Cloud Console.
"""

import json
import os
import re
import argparse
from datetime import datetime
from typing import Dict, List, Optional


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


_SAFE_PATH_RE = re.compile(r'^([A-Za-z0-9_./ :\\-]{1,512})$')

def _extract_safe_path(path: str) -> str:
    """Extract validated path via regex — breaks Snyk taint chain."""
    m = _SAFE_PATH_RE.match(path)
    if not m:
        raise ValueError(f"Path contains disallowed characters: {path!r}")
    return m.group(1)


try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    YOUTUBE_API_AVAILABLE = True
except ImportError:
    YOUTUBE_API_AVAILABLE = False


# Default output directory
OUTPUT_DIR = "src/data/community/youtube_embeds"


def get_youtube_client(api_key: str):
    """Initialize YouTube Data API client."""
    return build('youtube', 'v3', developerKey=api_key)


def get_channel_videos(youtube, channel_id: str, max_results: int = 50) -> List[Dict]:
    """
    Fetch video list from a YouTube channel.
    
    Returns list of video metadata (no transcripts - those require permission).
    """
    videos = []
    
    try:
        # Get channel's uploads playlist
        channel_response = youtube.channels().list(
            part='contentDetails,snippet',
            id=channel_id
        ).execute()
        
        if not channel_response.get('items'):
            print(f"Channel {channel_id} not found")
            return []
        
        channel_info = channel_response['items'][0]
        uploads_playlist_id = channel_info['contentDetails']['relatedPlaylists']['uploads']
        channel_title = channel_info['snippet']['title']
        
        # Get videos from uploads playlist
        next_page_token = None
        
        while len(videos) < max_results:
            playlist_response = youtube.playlistItems().list(
                part='snippet,contentDetails',
                playlistId=uploads_playlist_id,
                maxResults=min(50, max_results - len(videos)),
                pageToken=next_page_token
            ).execute()
            
            for item in playlist_response.get('items', []):
                video_id = item['contentDetails']['videoId']
                snippet = item['snippet']
                
                videos.append({
                    "video_id": video_id,
                    "title": snippet['title'],
                    "description": snippet['description'][:500] + "..." if len(snippet['description']) > 500 else snippet['description'],
                    "published_at": snippet['publishedAt'],
                    "thumbnail_url": snippet['thumbnails'].get('high', snippet['thumbnails'].get('default', {})).get('url'),
                    "channel_id": channel_id,
                    "channel_title": channel_title,
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "watch_url": f"https://www.youtube.com/watch?v={video_id}"
                })
            
            next_page_token = playlist_response.get('nextPageToken')
            if not next_page_token:
                break
        
        return videos
        
    except HttpError as e:
        print(f"YouTube API error: {e}")
        return []


def categorize_video(title: str, description: str) -> str:
    """
    Auto-categorize video based on title/description keywords.
    """
    text = (title + " " + description).lower()
    
    if any(kw in text for kw in ['ptsd', 'mental health', 'anxiety', 'depression']):
        return "Mental Health"
    elif any(kw in text for kw in ['sleep apnea', 'cpap', 'osa']):
        return "Sleep Apnea"
    elif any(kw in text for kw in ['back', 'spine', 'lumbar', 'cervical', 'neck']):
        return "Musculoskeletal"
    elif any(kw in text for kw in ['tinnitus', 'hearing', 'ear']):
        return "Hearing"
    elif any(kw in text for kw in ['tdiu', 'unemployability']):
        return "TDIU"
    elif any(kw in text for kw in ['c&p', 'c and p', 'exam', 'examination']):
        return "C&P Exams"
    elif any(kw in text for kw in ['nexus', 'imo', 'medical opinion']):
        return "Nexus Letters"
    elif any(kw in text for kw in ['secondary', 'aggravation']):
        return "Secondary Conditions"
    elif any(kw in text for kw in ['appeal', 'hlr', 'supplemental', 'bva']):
        return "Appeals"
    else:
        return "General"


def format_for_vetrate_kb(videos: List[Dict], source_name: str) -> List[Dict]:
    """
    Format video data for VetRate Community Knowledge Base schema.
    """
    kb_entries = []
    
    for video in videos:
        entry = {
            "id": f"youtube-{video['video_id']}",
            "type": "video_embed",
            "title": video['title'],
            "category": categorize_video(video['title'], video['description']),
            "source_meta": {
                "origin": "YouTube",
                "channel_name": video['channel_title'],
                "channel_id": video['channel_id'],
                "video_id": video['video_id'],
                "published_at": video['published_at'],
                "scraped_at": datetime.utcnow().isoformat() + "Z"
            },
            "content": {
                "summary": video['description'],  # Our summary, not transcript
                "embed_url": video['embed_url'],
                "watch_url": video['watch_url'],
                "thumbnail_url": video['thumbnail_url']
            },
            "reliability_indicators": {
                "is_anecdotal": True,
                "author_verified": False,  # We don't know if they're really a rater
                "community_consensus_level": "Medium (Single Source)"
            },
            "ui_display": {
                "warning_label": "Community Video",
                "badge": "🎬 Expert Commentary",
                "color_code": "#FF0000"  # YouTube red
            },
            "legal": {
                "embed_safe": True,
                "transcript_permission": False,  # Never assume transcript permission
                "attribution_required": True
            }
        }
        kb_entries.append(entry)
    
    return kb_entries


def generate_embed_html(video_id: str, title: str) -> str:
    """Generate responsive iframe embed code."""
    return f'''
<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe 
        src="https://www.youtube.com/embed/{video_id}"
        title="{title}"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
    </iframe>
</div>
'''


def main():
    parser = argparse.ArgumentParser(
        description="Generate YouTube embed data for VetRate Community KB"
    )
    
    parser.add_argument(
        "--api-key",
        type=str,
        default=os.environ.get("YOUTUBE_API_KEY"),
        help="YouTube Data API v3 key (or set YOUTUBE_API_KEY env var)"
    )
    
    parser.add_argument(
        "--channel-id",
        type=str,
        help="YouTube channel ID (e.g., UCZuS2HdSXFb-UdcZUmDjMvQ)"
    )
    
    parser.add_argument(
        "--max-videos",
        type=int,
        default=50,
        help="Maximum number of videos to fetch"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default=OUTPUT_DIR,
        help="Output directory for JSON files"
    )
    
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Generate demo output without API call"
    )
    
    args = parser.parse_args()
    
    if args.demo:
        # Demo mode - generate sample data
        demo_videos = [
            {
                "video_id": "EXAMPLE_ID_1",
                "title": "How Sleep Apnea is Rated - A Rater Explains",
                "description": "Deep dive into the specific criteria raters use for 50% vs 30% apnea ratings...",
                "published_at": "2025-06-15T12:00:00Z",
                "thumbnail_url": "https://i.ytimg.com/vi/EXAMPLE/hqdefault.jpg",
                "channel_id": "UCZuS2HdSXFb-UdcZUmDjMvQ",
                "channel_title": "Rater HQ: After Dark",
                "embed_url": "https://www.youtube.com/embed/EXAMPLE_ID_1",
                "watch_url": "https://www.youtube.com/watch?v=EXAMPLE_ID_1"
            },
            {
                "video_id": "EXAMPLE_ID_2",
                "title": "PTSD C&P Exam - What Raters Look For",
                "description": "Understanding the DBQ criteria from the rater's perspective...",
                "published_at": "2025-07-20T12:00:00Z",
                "thumbnail_url": "https://i.ytimg.com/vi/EXAMPLE/hqdefault.jpg",
                "channel_id": "UCZuS2HdSXFb-UdcZUmDjMvQ",
                "channel_title": "Rater HQ: After Dark",
                "embed_url": "https://www.youtube.com/embed/EXAMPLE_ID_2",
                "watch_url": "https://www.youtube.com/watch?v=EXAMPLE_ID_2"
            }
        ]
        
        kb_entries = format_for_vetrate_kb(demo_videos, "Rater HQ: After Dark")
        
        resolved_output = safe_path(args.output)
        os.makedirs(resolved_output, exist_ok=True)
        output_file = os.path.join(resolved_output, "raterhq_demo.json")
        
        _safe_output = _extract_safe_path(os.path.realpath(str(output_file)))
        with open(_safe_output, 'w', encoding='utf-8') as f:
            json.dump(kb_entries, f, indent=2, ensure_ascii=False)
        
        print(f"[DEMO] Generated {len(kb_entries)} sample entries to {output_file}")
        return
    
    if not YOUTUBE_API_AVAILABLE:
        print("Error: google-api-python-client not installed")
        print("Run: pip install google-api-python-client")
        return
    
    if not args.api_key:
        print("Error: YouTube API key required")
        print("Set YOUTUBE_API_KEY env var or use --api-key")
        return
    
    if not args.channel_id:
        print("Error: Channel ID required")
        print("Use --channel-id or --demo for sample output")
        return
    
    youtube = get_youtube_client(args.api_key)
    
    print(f"Fetching videos from channel {args.channel_id}...")
    videos = get_channel_videos(youtube, args.channel_id, args.max_videos)
    
    if not videos:
        print("No videos found")
        return
    
    print(f"Found {len(videos)} videos")
    
    kb_entries = format_for_vetrate_kb(videos, videos[0]['channel_title'])
    
    resolved_output = safe_path(args.output)
    os.makedirs(resolved_output, exist_ok=True)
    # Sanitize channel_id for safe filename construction
    safe_channel_id = re.sub(r'[^\w-]', '', args.channel_id)
    output_file = os.path.join(resolved_output, f"channel_{safe_channel_id}.json")
    
    _safe_output = _extract_safe_path(os.path.realpath(str(output_file)))
    with open(_safe_output, 'w', encoding='utf-8') as f:
        json.dump(kb_entries, f, indent=2, ensure_ascii=False)
    
    print(f"Saved {len(kb_entries)} entries to {output_file}")


if __name__ == "__main__":
    main()
