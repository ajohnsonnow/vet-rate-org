# Security & Privacy FAQ - For the Skeptics

**Because healthy skepticism keeps everyone honest**

---

## 🎯 Quick Navigation

- [Trust & Free Services](#trust--free-services)
- [Data Collection & Training](#data-collection--training)
- [Technical Architecture](#technical-architecture)
- [AI Features](#ai-features)
- [Comparisons](#comparisons)
- [Verification](#verification)

---

## Trust & Free Services

### Q: "If it's free, I'm the product. Right?"

**A: Not here.** That business model requires collecting your data to sell or monetize. We can't sell what we don't collect.

**Why this is free:**
- **No servers to pay for** - Static hosting costs ~$0/month (Render free tier)
- **No employees** - Built by one veteran (me, AJ Johnson) volunteering time
- **No infrastructure** - No databases, no APIs, no backend processing
- **Passion project** - This is about helping veterans, not making money

**The actual "product":** Putting predatory claim sharks (who charge 20-30% of backpay) out of business.

---

### Q: "How do you make money then?"

**A: I don't.** 

There's an optional donation link if people want to support hosting/development, but:
- ✅ Zero features are paywalled
- ✅ No subscriptions
- ✅ No premium tiers
- ✅ No upsells
- ✅ No ads

**My conviction:** Veterans shouldn't have to pay to understand their benefits. Full stop.

---

### Q: "What's the catch? There's always a catch."

**A: The catch is it's limited to what can run in a browser.**

**Trade-offs of this architecture:**
- ❌ No sync across devices (must manually backup/restore)
- ❌ No collaborative features (can't share packets with VSO)
- ❌ No cloud backups (must export yourself)
- ❌ Limited to browser capabilities

**Benefits:**
- ✅ Complete privacy
- ✅ No data breaches possible
- ✅ No account to manage
- ✅ Works offline (after initial load)
- ✅ You own your data

---

### Q: "Why should I trust you over other 'veteran-owned' tools?"

**A: Don't.**

Don't trust my service record, my promises, or my privacy policy.

**Verify instead:**
1. Use browser DevTools to watch network traffic
2. Read the source code on GitHub
3. Check localStorage to see where data lives
4. Compare to what we claim
5. Report any discrepancies

**See:** [Security Proof - How to Verify](./security-proof.md)

---

## Data Collection & Training

### Q: "The LLM needs data to train. You must be collecting something."

**A: We don't train any models.**

**Here's how AI features work:**
1. **You provide your own API key** (Google Gemini - free tier available)
2. **Only condition names/symptoms sent** (no names, SSN, dates, etc.)
3. **Sent directly from YOUR browser to Google** (we never see it)
4. **We don't log requests or responses**
5. **100% optional** - all features work without AI

**Google's responsibility:** Their privacy policy applies to API usage, not ours (because we never touch the data).

---

### Q: "Can't be entirely client-side - regulations change periodically."

**A: Good catch! Yes, regulations change. No, we don't need servers for that.**

**How updates work:**
1. Disability data compiled from public CFR sources (ecfr.gov)
2. Data stored as static JSON files bundled with the app
3. When regulations change, we update JSON files
4. You download new files when visiting (like any website update)
5. Think: "app update" not "sync"

**No continuous connection required** - the data IS the site itself.

---

### Q: "What data do you actually collect?"

**A: Zero personal data.**

| Data Type | Collected? | Stored Where? |
|-----------|------------|---------------|
| Name | ❌ No | Your browser only |
| Email | ❌ No | N/A |
| SSN | ❌ No | Your browser only |
| Service dates | ❌ No | Your browser only |
| Medical conditions | ❌ No | Your browser only |
| Search queries | ❌ No | Browser memory (cleared on refresh) |
| Usage analytics | ❌ No | N/A |
| IP addresses | ❌ No | N/A |
| Cookies | ✅ Yes | Session management only |

**What we see:**
- Number of site visits (hosting provider analytics - no personal info)
- That's it

---

### Q: "You say no tracking, but I see requests in DevTools."

**A: Let's break down what you should see:**

**Normal Requests:**
| Domain | Purpose | Your Data Sent? |
|--------|---------|-----------------|
| `vet-rate.org/assets/*` | App files (HTML/CSS/JS) | ❌ No |
| `fonts.googleapis.com` | Font files | ❌ No |
| `ecfr.gov` | External regulation links | ❌ No |

**Optional AI Requests:**
| Domain | Purpose | Your Data Sent? |
|--------|---------|-----------------|
| `generativelanguage.googleapis.com` | Google Gemini API | ⚠️ Symptoms only (no PII) |

**🚨 RED FLAG - Report these:**
| Domain | Reason |
|--------|--------|
| `analytics.google.com` | Tracking (we don't use this) |
| `facebook.com` | Tracking pixel |
| Any tracking domain | Compromise |
| `vet-rate.org/api/*` | We have no API |

---

## Technical Architecture

### Q: "How can a website work without a backend?"

**A: Single Page Application (SPA) architecture.**

**Traditional Web App:**
```
Browser → Internet → Server → Database → Processing → Response
```
Your data travels to servers.

**Vet-Rate.org:**
```
Browser → Static Files → Local Processing → Browser Storage
```
Everything stays on your device.

**What we serve:**
- HTML/CSS/JavaScript files (React app)
- JSON data files (disability ratings from public sources)
- That's it

**No server-side code processes your data.**

---

### Q: "Where is my data actually stored?"

**A: Browser localStorage on YOUR device.**

**Verify it yourself:**
1. Open DevTools (F12)
2. Go to Application → Local Storage
3. Click `vet-rate.org`
4. See your data

**Test:**
- Clear site data → data disappears
- Proves it was never on our servers

---

### Q: "Can you see my data if it's in my browser?"

**A: No. localStorage is device-specific.**

**Why we can't access it:**
- No backend to receive transmissions
- Browser security model prevents cross-origin access
- We'd need malicious JavaScript (which you can audit on GitHub)
- If we added tracking later, you'd see it in DevTools

**Analogy:** It's like asking if I can see a file on your computer. I can't, unless you send it to me (which the app never does).

---

## AI Features

### Q: "What exactly gets sent when I use AI features?"

**A: Only what's necessary for the AI to help, minus any PII.**

**Example: Nexus Builder**

**Sent to AI:**
```json
{
  "primary_condition": "PTSD",
  "secondary_condition": "Sleep Apnea",
  "request": "Generate nexus reasoning"
}
```

**NOT sent:**
```json
{
  "name": "John Doe",           // ❌ Never sent
  "ssn": "123-45-6789",         // ❌ Never sent
  "dob": "1980-01-01",          // ❌ Never sent
  "service_dates": "...",       // ❌ Never sent
  "address": "...",             // ❌ Never sent
  "medical_records": "..."      // ❌ Never sent
}
```

**Where it goes:**
- Directly from YOUR browser to Google's servers
- Using YOUR API key
- We never see the request or response

---

### Q: "Can I use the site without AI?"

**A: Yes. 100% of features work without AI.**

**AI is enhancement, not requirement:**
- **Nexus Builder:** Manual mode available
- **Forms Helper:** Template-based without AI
- **C-File Analyzer:** Local PDF parsing (no AI needed)
- **Statement Helper:** Example templates provided

**Toggle:** You can disable AI entirely in Settings.

---

### Q: "What's Google doing with my data?"

**A: See Google's privacy policy:**
- [Google AI API Privacy Policy](https://policies.google.com/privacy)
- [Gemini API Terms](https://ai.google.dev/terms)

**Our understanding:**
- Used to improve models (per Google's TOS)
- Not tied to your Google account (API key is anonymous)
- Ephemeral by default (not stored long-term per Google)

**Our recommendation:** Only send what you're comfortable with Google seeing.

---

## Comparisons

### Q: "How is this different from other VA tools?"

| Feature | Typical VA Tools | Vet-Rate.org |
|---------|------------------|---------------|
| **Account Required** | ✅ Yes | ❌ No |
| **Email Collection** | ✅ Yes | ❌ No |
| **Server Storage** | ✅ Yes | ❌ No |
| **Open Source** | ❌ No | ✅ Yes (GitHub) |
| **Verifiable** | ❌ No | ✅ Yes (DevTools) |
| **Analytics** | ✅ Yes | ❌ No |
| **Tracking Pixels** | ✅ Often | ❌ Never |
| **Premium Tiers** | ✅ Often | ❌ Never |

---

### Q: "Other tools claim privacy too. What's different?"

**A: Verification.**

**Most tools:**
- "We protect your data" (trust-based)
- Closed source (can't verify)
- Privacy policy says they collect data

**Vet-Rate.org:**
- "Verify we don't collect data" (proof-based)
- Open source (audit the code)
- Architecture makes collection impossible

**Difference:** You can PROVE our claims using DevTools and source code.

---

## Verification

### Q: "How do I verify you're not lying?"

**A: Multiple methods:**

#### Method 1: Network Monitor (Easy)
1. Open DevTools (F12) → Network tab
2. Use the site normally
3. Watch for suspicious requests
4. See zero POST requests with your data

**Expected:** Only asset loading (HTML/CSS/JS)

#### Method 2: Local Storage Inspection (Easy)
1. Open DevTools (F12) → Application tab
2. Check Local Storage → vet-rate.org
3. See your data stored locally
4. Clear it → proves it was never on our servers

#### Method 3: Source Code Audit (Advanced)
1. Visit: `github.com/ajohnsonnow/vet-rate-org`
2. Search for `fetch`, `axios`, API calls
3. Verify they only call Google Gemini (optional) or eCFR (external)
4. See NO analytics, tracking, or data collection code

**Full guide:** [Security Proof - No BS Transparency](./security-proof.md)

---

### Q: "What if you add tracking later?"

**A: You'd see it immediately.**

**How:**
- Network tab would show new requests
- Source code would show new tracking scripts
- GitHub commit history would show the addition
- Community can monitor for changes

**Our promise:** Any tracking addition would be:
1. Announced publicly
2. Opt-in only
3. Documented in privacy policy
4. Visible in source code

---

### Q: "Can I host this myself?"

**A: Yes. It's open source.**

**How:**
1. Fork the repo: `github.com/ajohnsonnow/vet-rate-org`
2. Build it: `npm run build`
3. Host the `dist/` folder anywhere
4. You control everything

**Use cases:**
- Total privacy (self-hosted)
- Verify the code matches the live site
- Customize for your needs
- Trust no one

---

## Skeptic Scenarios

### Q: "What if you're a long con - privacy now, data collection later?"

**A: Open source + DevTools make that impossible to hide.**

**If we tried:**
- GitHub commit would show code changes
- Network tab would show new requests
- Community would catch it instantly
- You'd see it before we could collect anything meaningful

**Protection:** Star the repo and watch for changes. If we go rogue, you'll know.

---

### Q: "What if there's a data breach?"

**A: Can't breach what doesn't exist.**

**Traditional breach:**
1. Hackers compromise server
2. Steal user database
3. Your data is leaked

**Vet-Rate.org breach scenario:**
1. Hackers compromise... nothing (no servers with data)
2. Steal... static HTML files (public anyway)
3. Your data... never left your device

**Only risk:** Your device getting compromised (true for ANY website).

---

### Q: "I still don't trust you. What now?"

**A: Good. You shouldn't blindly trust anyone.**

**Options:**
1. **Use with caution** - Don't enter real data, use fake info to test
2. **Verify first** - Follow the verification guide before entering real info
3. **Self-host** - Fork the repo and run it yourself
4. **Don't use** - That's valid too. Use whatever you trust

**Healthy skepticism keeps everyone honest.**

---

## Final Word

### The Real Answer to "Why Free?"

**Because I watched too many veterans get ripped off by claim sharks charging $3,000-$8,000 for "help" that should be free.**

**Because VSOs are great but overloaded.**

**Because the claims process shouldn't be a mystery that only "experts" can decode.**

**Because every dollar a veteran spends on claim help is a dollar NOT spent on rent, food, or their family.**

**This tool exists to level the playing field. Period.**

If you find this useful, recommend it to other veterans. If you don't trust it, verify it. If you catch me lying, blast me publicly.

**The mission matters more than trust.**

---

## Still Have Questions?

- 📖 Read: [Security Proof Guide](./security-proof.md)
- 🔍 Audit: [GitHub Repository](https://github.com/ajohnsonnow/vet-rate-org)
- 🐛 Report: Use Bug Squasher tool on site
- 📬 Contact: GitHub Issues for security concerns

---

**Updated:** January 19, 2026  
**Author:** AJ Johnson (U.S. Air Force Veteran)  
**License:** MIT (Open Source)
