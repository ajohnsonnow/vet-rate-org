# VetRate Knowledge Base Architecture

## Overview

VetRate uses a **dual knowledge base** architecture to separate regulatory information from community-sourced content. This protects against copyright issues while maintaining comprehensive veteran support.

---

## Knowledge Base Types

### 1. 💎 Diamond Knowledge Base (DKB)
**Source:** Official VA regulations, public domain government content

| Attribute | Value |
|-----------|-------|
| **Legal Status** | Public Domain (38 CFR, VA.gov, eCFR) |
| **Copyright** | None - Federal government content |
| **Can Copy** | ✅ Yes, freely |
| **Liability** | Low - citing official sources |
| **Update Frequency** | When CFR/M21-1 changes |

**Contents:**
- 38 CFR Part 3 (Adjudication)
- 38 CFR Part 4 (Rating Schedule)
- M21-1 Adjudication Procedures Manual
- VA Forms and DBQ criteria
- Diagnostic codes and rating criteria

**File Locations:**
```
src/data/
├── diagnosticCodes.json       # Official DC definitions
├── ratingCriteria/            # Per-condition rating tables
├── cfr38/                     # CFR extracts
└── vaForms/                   # Form metadata
```

---

### 2. 🛡️ Community Knowledge Base (CKB)
**Source:** Veteran community, requires permission

| Attribute | Value |
|-----------|-------|
| **Legal Status** | Copyrighted by creators |
| **Copyright** | © respective owners |
| **Can Copy** | ⚠️ Only with permission |
| **Liability** | Medium - anecdotal, not official |
| **Update Frequency** | Community-driven |

**Potential Sources (Pending Permission):**
- VeteransBenefitsKB.com (© 2020-2026, all rights reserved)
- r/VeteransBenefits Reddit community
- Rater HQ: After Dark YouTube channel
- Individual veteran experiences

**File Locations:**
```
src/data/community/
├── README.md                  # Source attribution & permissions
├── veteransbenefitskb/        # If permission granted
├── reddit/                    # If API access obtained
├── youtube/                   # Video embeds only (safe)
└── pending_permission/        # Content awaiting approval
```

---

## Permission Status

### Current Status (January 2026)

| Source | Status | Contact | Notes |
|--------|--------|---------|-------|
| VA.gov/eCFR | ✅ Public Domain | N/A | Free to use |
| VeteransBenefitsKB | 🟡 Pending | l8tn8, SSG_Rock via Reddit | Email sent |
| Rater HQ YouTube | 🟡 Pending | YouTube channel contact | Email drafted |
| r/VeteransBenefits | 🟡 Pending | Reddit API application | Awaiting API key |

---

## Data Schema

### Diamond Knowledge Base Entry
```json
{
  "id": "dc-9411-ptsd",
  "type": "diagnostic_code",
  "source": "38_CFR_4.130",
  "source_url": "https://www.ecfr.gov/...",
  "title": "PTSD Rating Criteria",
  "content": "...",
  "last_verified": "2026-01-23",
  "is_official": true,
  "can_cite": true
}
```

### Community Knowledge Base Entry
```json
{
  "id": "ckb-ptsd-cp-tips-001",
  "type": "community_tip",
  "source": "veteransbenefitskb.com",
  "source_url": "https://veteransbenefitskb.com/pages/ptsd-exams",
  "author_type": "Wiki Consensus",
  "title": "PTSD C&P Exam Tips",
  "content": "...",
  "scraped_at": "2026-01-23T00:00:00Z",
  "permission_status": "pending",
  "reliability_indicators": {
    "is_anecdotal": true,
    "citations_present": false,
    "community_consensus_level": "High (Wiki Standard)"
  },
  "ui_display": {
    "warning_label": "Community Field Note",
    "badge": "🛡️ Community Wiki",
    "color_code": "#D4AF37"
  }
}
```

---

## UI Display Guidelines

### Diamond Knowledge Base (Official)
- **Border Color:** Blue/Grey (Institutional)
- **Badge:** ⚖️ Official VA Regulation
- **Disclaimer:** None required

### Community Knowledge Base (Anecdotal)
- **Border Color:** Gold/Green (Grassroots)
- **Badge:** 🛡️ Community Field Note
- **Disclaimer Required:**

> ### ⚠️ Community Intelligence
> This information comes from the veteran community, not official VA sources.
> While valuable for strategy, it is anecdotal and may not apply to your specific situation.
> Always verify with current VA regulations.

---

## Safe Integration Strategies

### For Copyrighted Content (No Permission Yet)

**Option 1: Link, Don't Copy**
- Store only: title, summary (self-written), source URL
- User clicks "Read Full Article" to visit source
- Drives traffic to original creator

**Option 2: Embed (YouTube)**
- Use YouTube embed API
- Views count for original creator
- They control ads/content
- Automatically updates if deleted

**Option 3: Index Only**
- Search index points to external source
- No content stored locally
- Pure aggregator model

---

## Scraping Scripts

### VeteransBenefitsKB Scraper (Use After Permission)
Location: `scripts/scrapers/veteransbenefitskb_scraper.py`

### Reddit Scraper (Requires API Key)
Location: `scripts/scrapers/reddit_veteransbenefits_scraper.py`

### YouTube Embed Generator (Safe to Use)
Location: `scripts/scrapers/youtube_embed_generator.py`

---

## Legal Disclaimers

### Required on All Community Content
```
This is community-sourced information, not official VA policy.
Vet-Rate.org does not verify anecdotal claims.
Always consult with an accredited VSO or attorney for legal advice.
```

### Required on YouTube Embeds
```
This video is property of [Channel Name] and embedded with implied permission.
Views and ad revenue go to the original creator.
```

---

## Contact Templates

### Email Template: Content Permission Request

**Subject:** Collaboration Request: [Source Name] with Vet-Rate.org (Free Open Source Project)

**Body:**
```
Hi [Name/Team],

My name is Anthony Johnson. I am a fellow veteran and the developer behind 
Vet-Rate.org, a free, open-source project designed to give veterans 
professional-grade claim tools completely for free.

I am writing to respectfully ask for permission to reference your material 
within the Vet-Rate.org "Community Knowledge Base."

About Vet-Rate.org:
- 100% Free & Open Source (AGPLv3 license)
- Privacy First: Runs entirely client-side, zero data collection
- Built by a veteran, for veterans

My Proposal:
1. Index your content in our search feature
2. Provide short summary/snippet in our app
3. Drive traffic to you via "Read Full Article" links
4. Full attribution to your work

You can verify at: https://vet-rate.org or https://github.com/ajohnsonnow/vet-rate-org

Respectfully,
Anthony Johnson
Creator, Vet-Rate.org
```

---

## Permission Status Tracker

| Source | Contact | Status | Sent Date | Response |
|--------|---------|--------|-----------|----------|
| VeteransBenefitsKB | l8tn8, SSG_Rock | 📧 **SENT** | 2026-01-23 | Awaiting |
| Rater HQ (YouTube) | Channel Owner | 📧 **SENT** | 2026-01-23 | Awaiting |
| r/VeteransBenefits | Mod Team | ⏳ Pending | - | - |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-23 | Initial KB architecture documented |
| 2026-01-23 | Permission emails drafted |
| 2026-01-23 | DKB/CKB separation implemented |
| 2026-01-23 | **Permission emails sent** to VeteransBenefitsKB & Rater HQ |

---

*Last Updated: January 23, 2026*
