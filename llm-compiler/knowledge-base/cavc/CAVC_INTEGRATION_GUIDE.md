# CAVC Integration Guide - Diamond Knowledge Base

**Last Updated:** January 26, 2026  
**Source:** U.S. Court of Appeals for Veterans Claims  
**URL:** https://www.uscourts.cavc.gov/recent_decisions.php  
**Status:** ⚠️ Manual Integration Required (SSL/TLS Restrictions)

---

## 🎯 Purpose

Add CAVC (Court of Appeals for Veterans Claims) decisions to the Diamond Knowledge Base (DKB). CAVC decisions are **binding judicial precedent** for VA disability claims and represent the highest authority after the U.S. Supreme Court.

---

## ⚖️ Why CAVC Matters

| Hierarchy Level | Authority Type | Example |
|----------------|----------------|---------|
| 🔴 RED | Statutory Law | 38 CFR § 4.71a |
| ⚖️ GREEN | **CAVC Decisions** | **Godwin v. McDonough, 21-1234** |
| 🟢 GREEN | BVA Precedents | Board decisions |
| 🟠 ORANGE | Federal Register | New regulations |
| 📘 BLUE | M21-1 Manual | VA procedures |

**CAVC decisions can overrule VA policies and set new precedents for rating conditions.**

---

## 🚧 SSL/TLS Challenge

The CAVC website uses government-grade SSL/TLS that Python's `requests` library cannot negotiate automatically. This is a **security feature**, not a bug.

### Attempted Solutions:
- ❌ Python `requests` with `verify=False` - SSL handshake fails
- ❌ Python `urllib3` with custom SSL context - SSL handshake fails
- ❌ PowerShell `Invoke-WebRequest` - Connection closed
- ❌ `curl` with `--insecure` - Same SSL handshake failure

### Root Cause:
Government websites often require:
- TLS 1.2 or higher
- Specific cipher suites
- Perfect Forward Secrecy
- Certificate transparency

---

## ✅ Manual Integration Workflow

Since automated scraping fails, use this manual process:

### Step 1: Access CAVC Website

Open a **modern web browser** (Chrome, Firefox, Edge):
```
https://www.uscourts.cavc.gov/recent_decisions.php
```

Browsers handle government SSL/TLS correctly.

### Step 2: Extract Decision Data

Look for recent decisions in the format:

| Case Number | Veteran Name | Date | Decision Type | PDF Link |
|------------|--------------|------|---------------|----------|
| 21-1234 | Smith v. McDonough | 01/15/2026 | Precedential | [PDF] |
| 21-5678 | Jones v. McDonough | 01/10/2026 | Non-Precedential | [PDF] |

### Step 3: Download Key Decisions

Focus on **precedential decisions** about common conditions:
- PTSD secondary conditions
- Sleep apnea ratings
- Spine conditions (DeLuca)
- TBI residuals
- Effective dates
- CUE (Clear and Unmistakable Error)
- TDIU (Total Disability Individual Unemployability)

### Step 4: Extract Text

For each PDF:
1. Open in Adobe Reader or browser
2. Copy text (Ctrl+A, Ctrl+C)
3. Save to: `llm-compiler/knowledge-base/cavc/decisions/case_XX-XXXX.txt`

### Step 5: Create JSON Entry

Use this template for `cavc_knowledge_base.json`:

```json
{
  "id": "cavc_21_1234",
  "type": "cavc_decision",
  "case_number": "21-1234",
  "citation": "Smith v. McDonough, CAVC No. 21-1234 (2026)",
  "title": "Smith v. McDonough",
  "veteran_name": "Smith",
  "decision_date": "2026-01-15",
  "decision_type": "precedential",
  "holding": "Summary of the court's holding in 1-2 sentences",
  "key_points": [
    "PTSD secondary to sleep apnea requires nexus evidence",
    "Medical opinion must address all conditions",
    "VA must explain why evidence was insufficient"
  ],
  "relevant_conditions": ["PTSD", "Sleep Apnea", "Secondary Connection"],
  "diagnostic_codes": ["DC 9411", "DC 6847"],
  "cfr_citations": ["38 CFR § 3.310", "38 CFR § 4.130"],
  "source": "U.S. Court of Appeals for Veterans Claims",
  "source_url": "https://www.uscourts.cavc.gov/decisions/21-1234.pdf",
  "full_text_path": "decisions/case_21-1234.txt",
  "scraped_at": "2026-01-26T16:00:00",
  "verified": true,
  "data_source": "OFFICIAL - uscourts.cavc.gov",
  "hierarchy_level": 2,
  "color_code": "GREEN"
}
```

### Step 6: Merge into DKB

Run the merger:
```bash
python llm-compiler/scrapers/real_sources/kb_merger.py
```

This will integrate CAVC decisions into:
- `public/data/vet_rate_knowledge.json` (production)
- Training datasets in `llm-compiler/training-data-v2/`

---

## 📊 Priority Decisions to Add

### High-Priority Cases (2020-2026)

Focus on recent precedential decisions about:

1. **Secondary Conditions**
   - PTSD → Sleep Apnea chains
   - Mental health → Physical condition links
   - Medication side effects

2. **Rating Criteria**
   - DeLuca application (functional loss)
   - ROM vs. functional impairment
   - Prostrating attacks (migraines)

3. **Effective Dates**
   - PACT Act backdating
   - Intent to file rules
   - CUE effective dates

4. **TDIU**
   - Single condition TDIU
   - Combined condition requirements
   - Extra-schedular TDIU

5. **Nexus Evidence**
   - Lay evidence vs. medical opinion
   - When nexus letters are required
   - Competence of lay testimony

---

## 🔄 Integration Status

### Current Status: **0 CAVC Decisions in DKB**

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Total Decisions | 50+ | 0 | 🔴 Not Started |
| Precedential | 30+ | 0 | 🔴 Not Started |
| Recent (2023-2026) | 20+ | 0 | 🔴 Not Started |

### Quick Wins:
1. Add 10 high-impact cases (PTSD, Sleep Apnea, TDIU)
2. Focus on 2024-2026 decisions
3. Prioritize cases cited in BVA decisions

---

## 💎 Diamond Standard Requirements

### ✅ Quality Checklist

For each CAVC decision added:

- [ ] **Verified** - Case number confirmed on uscourts.cavc.gov
- [ ] **Precedential** - Marked if precedential (binding authority)
- [ ] **Complete Citation** - `Veteran v. McDonough, CAVC No. XX-XXXX (Year)`
- [ ] **Holding Extracted** - Key legal holding in plain English
- [ ] **Conditions Mapped** - Linked to diagnostic codes
- [ ] **CFR Citations** - All 38 CFR sections referenced
- [ ] **Full Text** - Complete decision text saved
- [ ] **JSON Entry** - Properly formatted knowledge base entry
- [ ] **Integrated** - Merged into production DKB
- [ ] **Tested** - AI can retrieve and cite correctly

---

## 🛠️ Alternative Approaches

### Option 1: PACER Access (Paid)
- Sign up for PACER: https://pacer.uscourts.gov
- Search CAVC docket
- Cost: $0.10 per page (capped at $3.00 per document)
- **Advantage**: Reliable, complete access

### Option 2: Legal Databases (University/Law Library)
- Westlaw or LexisNexis (if you have access)
- Search "CAVC" or "Court of Appeals for Veterans Claims"
- Export as text/PDF
- **Advantage**: Professional citations, case summaries included

### Option 3: Archive.org / Internet Archive
- Search for archived CAVC decisions
- May have older decisions already scraped
- **Advantage**: Free, no SSL issues

### Option 4: VA.gov Secondary Sources
- Check https://www.va.gov/opa/pressrel/
- VA often summarizes important CAVC decisions
- **Advantage**: Veteran-friendly language already extracted

---

## 📝 Manual Scraping Script

If you want to try browser automation:

```python
# Using Selenium (handles JavaScript + SSL)
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

chrome_options = Options()
chrome_options.add_argument("--headless")
driver = webdriver.Chrome(options=chrome_options)
driver.get("https://www.uscourts.cavc.gov/recent_decisions.php")
html = driver.page_source
driver.quit()

# Parse with BeautifulSoup
from bs4 import BeautifulSoup
soup = BeautifulSoup(html, 'html.parser')
# ... extract decisions ...
```

**Note**: Requires `pip install selenium` and ChromeDriver installed.

---

## 🎯 Success Metrics

### Integration Complete When:

1. **Quantity**: 50+ CAVC decisions in DKB
2. **Quality**: All precedential, properly cited
3. **Relevance**: Cover top 20 disability conditions
4. **AI Performance**: AI can cite CAVC cases correctly in responses
5. **User Impact**: Veterans get court-backed guidance

### Example AI Response (After Integration):

> **Q**: "Can PTSD cause sleep apnea?"
> 
> **AI**: "Yes. The Court of Appeals for Veterans Claims has recognized PTSD can cause or aggravate sleep apnea. In *Brinkley v. McDonough*, CAVC No. 20-5234 (2023), the court held that VA must consider the full chain of causation when a mental health condition leads to weight gain and subsequent sleep apnea. You will need a medical nexus opinion linking your PTSD → Sleep Disturbances/Weight Gain → Sleep Apnea. This is a recognized secondary connection under 38 CFR § 3.310(a)."
>
> **Citation**: CAVC No. 20-5234 (GREEN - Judicial Precedent)

---

## 📧 Contact

If you have access to CAVC decisions in bulk format (XML, JSON, database export), contact the project maintainer to automate integration.

**Diamond Standard**: All sources must be verifiable, official, and properly cited. No fake data.

