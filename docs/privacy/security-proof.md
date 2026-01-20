# Security Proof - No BS Transparency

**For the skeptics (and you SHOULD be skeptical)**

---

## 🎯 TL;DR

We claim to be 100% private with no data collection. Here's how to prove we're telling the truth (or catch us lying).

---

## Why Trust No One

You're right to be suspicious. Every "free" VA tool says they're secure. Most are lying. Here's how to verify we're not.

---

## The Architecture Claims

We claim:
- ✅ 100% client-side (no backend servers)
- ✅ No data collection
- ✅ No tracking or analytics
- ✅ No user accounts or databases
- ✅ Everything runs in your browser

**Don't believe us. Verify.**

---

## Verification Method 1: Network Monitoring (Easy)

### What You Need
- Chrome, Firefox, Edge, or Safari
- 5 minutes
- Basic understanding of what a "network request" is

### Steps

#### 1. Open Developer Tools
```
Windows: F12 or Ctrl+Shift+I
Mac: Cmd+Option+I
Right-click → "Inspect"
```

#### 2. Go to Network Tab
Click the **Network** tab in DevTools

#### 3. Clear Existing Requests
Click the 🚫 (clear) icon to start fresh

#### 4. Reload the Page
Press F5 or Cmd+R to reload with network monitoring active

#### 5. Watch What Loads
You should see requests ONLY to:

| Domain | Purpose | Your Data? |
|--------|---------|------------|
| `vet-rate.org` | App files (HTML/CSS/JS) | ❌ No |
| `fonts.googleapis.com` | Font files | ❌ No |
| `ecfr.gov` | External regulation links | ❌ No |

#### 6. Interact with the Site
- Search for conditions
- Enter fake personal info
- Save a packet
- Generate forms

#### 7. Check Network Tab Again
Still monitoring? You should see **ZERO** new requests to any servers with your data.

#### 8. RED FLAGS 🚨

If you see requests to:
- `analytics.google.com`
- `facebook.com`
- `*.tracking-domain.com`
- Any API endpoints (like `/api/save-data`)
- Unknown domains

**→ Screenshot it and report via Bug Squasher immediately. That means we're compromised.**

---

## Verification Method 2: Check Local Storage (Easy)

### Steps

#### 1. Open Developer Tools
Same as above (F12)

#### 2. Go to Application/Storage Tab
- Chrome/Edge: **Application** tab
- Firefox: **Storage** tab

#### 3. Expand "Local Storage"
Look for `vet-rate.org` or your domain

#### 4. Click It
You'll see your data stored ONLY on your device:

| Key | Contains |
|-----|----------|
| `vetrate_packet` | Your saved conditions |
| `vetrate_gemini_key` | Your AI API key (if using AI) |
| `vetrate_forms_*` | Your form data |
| `vetrate_crisis_logs` | Crisis intercept logs (metadata only) |

#### 5. Verify It's Local
- Close the browser
- Open it again
- Your data is still there (NOT because we saved it to servers, but because localStorage persists)

#### 6. Test Deletion
- Clear site data (DevTools → Application → Clear storage)
- Reload page
- Your data is gone → proves it was never on our servers

---

## Verification Method 3: Source Code Audit (Advanced)

### For Developers

#### 1. Visit GitHub Repo
```
https://github.com/ajohnsonnow/vet-rate-org
```

#### 2. Search for Network Calls
```bash
# Clone the repo
git clone https://github.com/ajohnsonnow/vet-rate-org.git

# Search for API calls
grep -r "fetch\|axios\|XMLHttpRequest" src/

# Check what they call
```

#### 3. What You SHOULD Find
- `fetch()` calls ONLY to:
  - Google Gemini API (when using AI - YOUR key)
  - eCFR.gov (external regulation links)
- NO calls to our own backend
- NO analytics initialization
- NO tracking pixels

#### 4. What You Should NOT Find
- `fetch('https://vet-rate.org/api/...')` → We have no API
- `fetch('https://analytics.example.com/...')` → No tracking
- `new FormData()` being sent to servers → No form submission to us

#### 5. Check Build Configuration
```javascript
// vite.config.js - Should be simple static build
// No API proxies, no backend servers
```

#### 6. Check Package Dependencies
```json
// package.json - Should see:
- React (frontend only)
- Vite (build tool)
- NO Express, Fastify, or other server frameworks
- NO analytics SDKs (ga, facebook-pixel, etc.)
```

---

## Verification Method 4: Test Data Isolation

### The Incognito Test

#### 1. Open Regular Browser
- Create a fake packet with condition "Test Condition 1"
- Save it

#### 2. Open Incognito/Private Window
- Visit vet-rate.org
- Try to find your packet

**Result:** You won't see it → Proves data is local to that browser session, not synced to our servers.

#### 3. Different Computer Test
- Go to a different computer
- Visit vet-rate.org
- Try to access your data

**Result:** You can't → Proves no cloud storage or account sync.

---

## Verification Method 5: Request Inspection (Deep Dive)

### Check What's Being Sent

#### 1. In Network Tab, Click Any Request
Look at:
- **Request Headers** - Should NOT see personal data
- **Request Payload** - Should be empty or just asset requests
- **Response** - Should be just HTML/CSS/JS files

#### 2. AI Feature Requests (Optional)
If you use "Enhance with AI":

**What Gets Sent:**
```json
{
  "contents": [{
    "parts": [{
      "text": "Generate a nexus statement for: [condition name only]"
    }]
  }]
}
```

**What Does NOT Get Sent:**
- ❌ Your name
- ❌ Your SSN
- ❌ Your service dates
- ❌ Your address
- ❌ Any PII

**Where It Goes:**
- Directly to `generativelanguage.googleapis.com` (Google's servers, not ours)
- Using YOUR API key (we never see it)

---

## Common Questions from Skeptics

### "If it's free, you're the product"

**Our Model:**
- Hosting: Free tier static hosting (~$0/month on Render)
- Development: Volunteer time (me, AJ Johnson, veteran)
- Revenue: Optional donations (not required for any features)
- Monetization: Zero

**Why it works:**
- No servers = no infrastructure costs
- No databases = no maintenance costs
- No data collection = no data to monetize
- Open source = community can verify

### "LLMs need data to train"

**We don't train any models.** When you use AI:
- You provide YOUR OWN API key (Google Gemini)
- Requests go directly from your browser to Google
- We never see the requests or responses
- Google's privacy policy applies (not ours, because we never touch the data)

### "Regulations change - must need backend"

**Yes, regulations change. No, we don't need backend.** Here's how:
- All disability data compiled from public CFR sources
- Data stored as static JSON files in the app
- When regs change, we update the JSON files
- You download new files when visiting (like any website update)
- No continuous sync or server processing required

### "Can't trust Reddit strangers"

**GOOD.** Don't trust - verify:
- Use DevTools (methods above)
- Read the source code (GitHub)
- Ask security researchers to audit
- Fork the repo and host it yourself
- Compare network traffic to claims

---

## Red Flags That Would Prove We're Lying

Watch for these (and report if you see them):

### Network Tab Red Flags
- ❌ POST requests with form data to our domain
- ❌ Requests to analytics domains
- ❌ Tracking pixels loading
- ❌ WebSocket connections to our servers
- ❌ API endpoints under vet-rate.org/api/...

### Code Inspection Red Flags
- ❌ Hidden backend server code
- ❌ Analytics SDK imports (Google Analytics, Facebook Pixel, etc.)
- ❌ User authentication code
- ❌ Database connection strings
- ❌ Data collection functions

### Behavior Red Flags
- ❌ Requires account creation
- ❌ Asks for email verification
- ❌ Data persists across devices (without manual export)
- ❌ Paywalls or feature locks
- ❌ Terms of Service changes about data collection

---

## What GOOD Privacy Looks Like

### ✅ Positive Signs
- No account required
- No email collection
- Works in incognito mode
- Data in localStorage (visible in DevTools)
- Open source code
- No analytics scripts
- Minimal network requests
- Static site hosting

### ❌ Bad Privacy (Typical SaaS)
- Account required
- Email verification
- Data syncs across devices (cloud storage)
- Tracking cookies
- Analytics scripts
- Closed source
- Server-side processing
- Privacy policy full of data sharing clauses

---

## How to Report Security Issues

### If You Find Something Suspicious

#### 1. Document It
- Screenshot the Network tab
- Copy the request URL
- Note what you were doing

#### 2. Report It
- Use Bug Squasher tool on the site
- GitHub Issues: https://github.com/ajohnsonnow/vet-rate-org/issues
- Label it: `security` or `privacy`

#### 3. What We'll Do
- Investigate immediately
- Fix if it's real
- Explain if it's a false positive
- Thank you publicly (if you want credit)

---

## The Bottom Line

**We built this to be untrustworthy-proof.**

You don't have to trust:
- Our promises
- Our privacy policy
- Random Reddit posts
- Anything we say

You CAN verify:
- Network traffic (DevTools)
- Source code (GitHub)
- Local storage (DevTools)
- No backend (architectural choice)

**If you catch us lying about privacy, you'll be the first to know - because you'll see it in your browser's DevTools.**

---

## Further Reading

- [Technical Security Architecture](../SAFETY_ARCHITECTURE.md)
- [Privacy Policy](../docs/privacy/)
- [Open Source Verification Guide](./open-source-verification.md)
- [Security Configuration](../SECURITY.md)

---

## For Security Researchers

If you're a security professional interested in auditing:
- Full source access on GitHub
- No obfuscation or minification (in repo)
- Happy to answer architecture questions
- Will credit responsible disclosures

**Contact:** Via Bug Squasher or GitHub Issues

---

**Last Updated:** January 19, 2026  
**Next Review:** When we make ANY architecture changes affecting privacy
