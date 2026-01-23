# Community Knowledge Base

## ⚠️ Important Notice

This directory contains community-sourced content that is **NOT** official VA policy.

**All content here requires permission from original creators before inclusion.**

---

## Permission Status

| Source | Status | Contact Method | Date Contacted |
|--------|--------|----------------|----------------|
| VeteransBenefitsKB.com | 🟡 Pending | Reddit DM to l8tn8/SSG_Rock | TBD |
| Rater HQ: After Dark | 🟡 Pending | YouTube comment/email | TBD |
| r/VeteransBenefits | 🟡 Pending | Reddit API application | TBD |

---

## Directory Structure

```
community/
├── README.md                    # This file
├── approved/                    # Content with confirmed permission
│   └── .gitkeep
├── pending_permission/          # Scraped but awaiting approval
│   └── .gitkeep
├── youtube_embeds/              # Safe - embeds only, no content copying
│   └── .gitkeep
└── attribution.json             # Source credits and permissions
```

---

## Legal Requirements

### Before Adding Content:
1. ✅ Obtain explicit written permission from content creator
2. ✅ Document permission in `attribution.json`
3. ✅ Add appropriate disclaimer to UI display
4. ✅ Preserve original source URLs

### Disclaimer Required on All Community Content:
> 🛡️ **Community Field Note**
> This information is sourced from the veteran community, not official VA policy.
> What worked for one veteran may not apply to your specific situation.
> Always verify with current VA regulations.

---

## Attribution Template

Add to `attribution.json`:
```json
{
  "source_id": "unique-id",
  "source_name": "VeteransBenefitsKB",
  "source_url": "https://veteransbenefitskb.com",
  "permission_granted": false,
  "permission_date": null,
  "contact_person": "l8tn8",
  "contact_method": "Reddit DM",
  "license_terms": "Link-back required, no full-text copying",
  "notes": "Awaiting response"
}
```

---

## Safe Usage (No Permission Required)

### YouTube Embeds
- Embedding YouTube videos is generally safe
- Views/ad revenue go to original creator
- Store only: video_id, title, our summary
- Do NOT store transcripts without permission

### Link Aggregation
- Creating a search index that links to external sources is safe
- User clicks link → goes to original source
- We write our own summaries, don't copy theirs

---

*Last Updated: January 23, 2026*
