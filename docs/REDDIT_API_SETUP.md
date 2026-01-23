# Reddit API Setup for VetRate CKB

## Quick Setup (5 minutes)

### Step 1: Create Reddit App
1. Go to: https://www.reddit.com/prefs/apps
2. Scroll down and click **"create another app..."**
3. Fill in:
   - **Name:** `VetRate CKB Scraper`
   - **Type:** Select `script`
   - **Description:** `Community knowledge base for veteran disability claims`
   - **About URL:** `https://vet-rate.org`
   - **Redirect URI:** `http://localhost:8080`
4. Click **"create app"**

### Step 2: Copy Credentials
After creation, you'll see:
```
VetRate CKB Scraper
personal use script
[CLIENT_ID]        <-- Copy this (under the app name)
secret: [CLIENT_SECRET]  <-- Copy this
```

### Step 3: Save Credentials
Create file `~/.config/vetrate/reddit_credentials.json`:
```json
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "user_agent": "VetRate:CKB:v1.0 (by /u/YOUR_USERNAME)"
}
```

### Step 4: Test Connection
```bash
# In WSL
cd ~/vet-rate-swarm
python -c "
import praw
import json

with open('~/.config/vetrate/reddit_credentials.json') as f:
    creds = json.load(f)

reddit = praw.Reddit(
    client_id=creds['client_id'],
    client_secret=creds['client_secret'],
    user_agent=creds['user_agent']
)
print(f'Connected as: {reddit.user.me()}')
print('Reddit API working!')
"
```

---

## Rate Limits

| Tier | Requests/min | Notes |
|------|-------------|-------|
| Free | 60 | Sufficient for initial scrape |
| OAuth | 600 | After authentication |

## Target Subreddits

| Subreddit | Type | Permission |
|-----------|------|------------|
| r/VeteransBenefits | Main | Request from mods |
| r/Veterans | General | Public posts only |
| r/VeteransBenefitsKB | Wiki | Via VeteransBenefitsKB permission |

## Ethical Scraping Rules

1. **Respect robots.txt** - Reddit allows API access
2. **Rate limit** - Stay under 60 req/min
3. **No PII** - Strip usernames from training data
4. **Attribution** - Link back to original posts
5. **Permission** - For wiki/curated content, get explicit permission

---

*See `scripts/scrapers/reddit_scraper.py` once credentials are configured*
