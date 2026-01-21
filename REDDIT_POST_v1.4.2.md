# 🚀 Vet-Rate.org v1.4.2 - Local AI, Multi-GPU Support & Cloud Backup

**TL;DR:** Run AI 100% locally on your GPU (zero data leaves your device), advanced GPU selection for multi-GPU systems, encrypted Google Drive backup, track multiple service periods (Guard/Reserve/Active), and enhanced DD214 analyzer. Still completely free, no accounts, zero data collection.

---

## 🎯 What is Vet-Rate.org?

A **free, open-source VA disability claims toolkit** with 40 professional-grade tools. Everything from rating calculators and secondary conditions lookup to AI-powered document analysis and evidence builders.

**100% client-side** = your data never leaves your browser. No accounts, no tracking, no server backend.

🌐 **Live:** https://vet-rate.org  
📂 **GitHub:** https://github.com/ajohnsonnow/vet-rate-org

---

## 🔥 What's New in v1.4.2

### 1. 🛡️ **The Faraday Cage - Run AI 100% Locally**

The biggest update: You can now run AI analysis entirely on your PC using WebGPU. Your data literally never leaves your device - even if you unplug the internet, it still works.

**How it works:**
- Uses WebLLM (open-source) to run models like Llama 3.2 and Phi 3.5 in your browser
- Requires WebGPU-compatible GPU (NVIDIA RTX 20/30/40, AMD RDNA2+, Intel Arc, M1/M2/M3 Macs)
- 2-8GB VRAM for most models
- First load takes 5-10 min (downloads model, then cached forever)

**What you can do:**
- Analyze C-Files without cloud uploads
- Generate nexus statements completely offline  
- Red Team adversarial review with zero data leakage
- Process sensitive medical records with full privacy

**Why this matters:** Veterans with PTSD, MST, or sensitive medical issues can use AI tools without sending data to ANY 3rd party service.

---

### 2. 🎮 **GPU Selection for Multi-GPU Systems**

If you have multiple GPUs (desktop with discrete + integrated, or multiple discrete GPUs), you can now choose which one runs the AI.

**Options:**
- **Auto Mode**: Browser picks best GPU (default)
- **High Performance**: Force discrete GPU (RTX 4080, RX 7900 XTX)
- **Power Saver**: Force integrated GPU

**GPU details shown:**
- Vendor (NVIDIA, AMD, Intel)
- Estimated VRAM
- Max texture size
- WebGPU features count
- Technical specs (for nerds)

Perfect for controlling performance vs power consumption.

---

### 3. ☁️ **Google Drive Cloud Backup**

Back up your claims data to YOUR Google Drive (not our servers - we don't have servers).

**How it works:**
- Data encrypted with AES-256 before upload
- Decryption key stored only in your browser
- Manual sync (you control when/what uploads)
- Restore on any device where you're signed into Google

**What gets backed up:**
- Veteran profile
- All saved conditions and ratings
- C&P exam answers
- Nexus statements and buddy letters
- My Packet evidence

**Privacy:** Google sees encrypted blob. We see nothing. You control the key.

---

### 4. 🎖️ **Multiple Service Periods**

Track all your service separately (re-enlistments, Guard, Reserve, breaks in service).

**Before:** Only one service period saved (overwrites on new upload)  
**Now:** Track unlimited periods as separate entries

**Example:**
- Period 1: Army Active Duty 2001-2005 (DD214)
- Period 2: Army Reserve 2006-2010 (DD256)  
- Period 3: Army National Guard 2011-2020 (NGB 22)

**Supported forms:**
- DD214 (Active Duty)
- NGB 22 (National Guard)
- DD256/DD257 (Reserve)
- DD2586 (AGR)

Auto-calculates total service time across all periods.

---

### 5. 📄 **Enhanced DD214 Analyzer**

Now processes Guard and Reserve discharge documents (not just DD214s).

**Supports:**
- DD214 (Active Duty)
- NGB 22 (National Guard)
- DD256/DD257 (Reserve)

**Improvements:**
- Handles multiple enlistments
- Extracts MOS/AFSC/Rate from all formats
- Identifies component (Active/Guard/Reserve)
- No more "upload failed" for Guard/Reserve vets

---

### 6. 🧹 **Quality-of-Life Updates**

**The Navigator (AI Assistant):**
- Draggable and resizable
- Minimizes to floating button
- Context-aware (knows what tool you're using)
- Remembers position

**Behind the Scenes:**
- 13 automated pre-deployment checks
- Legal pages auto-sync
- Dynamic stats (no hardcoded numbers)
- Version management automated

---

## 📊 By The Numbers

| Metric | Value |
|--------|-------|
| **Tools** | 40 professional-grade features |
| **VA Disabilities** | 751 conditions (38 CFR Part 4) |
| **Secondary Conditions** | 500+ medically-recognized links |
| **Lines of Code** | 128,477 LOC |
| **Dev Time** | 16,196 hours equivalent |
| **Traditional Cost** | $2.19M (at $135/hr industry rate) |
| **Actual Cost** | $7,425 (55 hrs AI-assisted) |
| **Savings** | $2.18M (99.7%) |
| **Your Cost** | $0 Forever |

---

## 💰 What Others Charge vs Vet-Rate.org

| Service | Market Price | Vet-Rate.org |
|---------|-------------|--------------|
| C-File analysis | $500-$1,500 | Free (local or cloud AI) |
| Nexus letter | $1,500-$2,000 | Free Nexus Builder |
| Claims help | 20-30% backpay | Free complete toolkit |
| Buddy statements | $100-$300 | Free Witness Bench |
| Subscriptions | $50/month | Free forever |

---

## 🔒 Privacy (Still 100% Client-Side)

**Nothing has changed:**

❌ No accounts  
❌ No backend servers  
❌ No tracking/analytics  
❌ No PII storage  
❌ No ads  

✅ 100% open-source  
✅ Static hosting (~$0/month)  
✅ All processing in YOUR browser  
✅ Optional cloud uses YOUR services  
✅ Local AI = data never leaves PC  

**Verify it:** Open DevTools → Network tab → See zero data transmission (except when YOU use cloud AI with YOUR key).

---

## 🚀 Try It Now

**Live:** https://vet-rate.org

**Quick start:**
1. Visit the site (no account needed)
2. Try Search - look up a condition (e.g., "tinnitus")
3. Run Tactical Calculator - see your combined rating
4. Test Faraday Cage - check if your GPU supports local AI
5. Optional: sync to your Google Drive

**Local AI setup:**
1. Click "Faraday Cage Protocol" in Support section
2. Check WebGPU availability (green = ready)
3. Select a model (Llama-3.2-3B needs 2GB VRAM)
4. Click "Load Model" (first time: ~5-10 min download)
5. Once loaded, AI runs 100% locally!

---

## 📱 Mobile Support

**Works on mobile:** All core tools (search, calculators, exam prep)

**Local AI:** Limited on mobile
- **Works:** M1/M2/M3 iPads and MacBooks
- **Experimental:** Android 12+ with Snapdragon 8 Gen 2+
- **Most phones:** Use cloud AI (Gemini with YOUR key)

---

## 🤝 Community

- **Reddit:** r/VeteransBenefits
- **GitHub:** Report bugs or request features
- **Support:** Optional tip jar if this saved you money

---

## 🎯 Roadmap

**Coming soon:**
- DBQ Library (offline access to all VA questionnaires)
- Claim Navigator (step-by-step wizard)
- More Local Models (Llama-3.3-70B for high-VRAM users)
- PDF Export (print-ready claims packets)
- Ribbon Rack (visualize awards from DD214)

**Under consideration:**
- Veteran mentorship (encrypted peer support)
- VSO integration (direct referrals)
- VA.gov API (live claims status)

---

## 💜 Why I Built This

I'm a veteran tired of watching my brothers and sisters get charged 20-30% of backpay or $500+ per "feature" that should be free.

The VA disability process is hard enough. The tools shouldn't cost a fortune or require handing over your data.

So I built what I wish existed when I filed: **A complete toolkit that respects privacy and costs nothing.**

If Vet-Rate.org helped you, share it with a veteran who needs it.

---

## 🙏 Thank You

To r/VeteransBenefits: Your feedback shaped this. Every bug report and feature request matters.

**Thanks to:**
- Veterans who beta-tested Faraday Cage
- Everyone who reported GPU issues
- Those who pushed for Guard/Reserve support
- The veterans who've used these tools

You made v1.4.2 possible. 🇺🇸

---

**Ready?** → https://vet-rate.org

**Questions?** Ask below.

**Bugs?** → https://github.com/ajohnsonnow/vet-rate-org/issues

**Contribute?** PRs welcome!

---

*Vet-Rate.org - Built by a veteran, for veterans.*

**Version 1.4.2** | January 21, 2026 | GNU AGPL v3 Open Source
