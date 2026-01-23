# 💎 DIAMOND Knowledge Base Architecture

> **Version:** 2.0.0 | **Last Updated:** January 2026 | **DKB Entries:** 1,601 | **CKB Entries:** 560

## Overview

The VetRate Knowledge Base system now consists of two **separate** knowledge bases:

1. **💎 Diamond Knowledge Base (DKB)** - Official VA sources only (training approved)
2. **👥 Community Knowledge Base (CKB)** - Veteran community insights (NOT for training)

This separation ensures that AI training uses only verified official sources while community knowledge remains available for reference.

## 📊 Knowledge Base Statistics

### 💎 DKB (Diamond Knowledge Base) - Training Approved

| Metric | Value |
|--------|-------|
| **Total Entries** | 1,601 |
| **eCFR Official** | 1,070 (38 CFR Part 4) |
| **Secondary Matrix** | 234 |
| **VA Official** | 159 |
| **OGC Opinions** | 49 |
| **BVA Reports** | 38 |
| **PACT Act** | 28 |
| **Fed Register** | 15 |
| **M21-1** | 4 |
| **BVA Decisions** | 3 |
| **EAJA Stats** | 1 |

### 👥 CKB (Community Knowledge Base) - Display Only

| Metric | Value |
|--------|-------|
| **Total Entries** | 560 |
| **Source** | VeteransBenefitsKB |
| **Training Approved** | ❌ NO |
| **Status** | Reference Only |

⚠️ **IMPORTANT:** CKB is NOT used for AI training. Community content is displayed separately from official sources.

## 🔐 Privacy Architecture

### 100% Client-Side Processing

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER ENVIRONMENT                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │   IndexedDB     │  │  Transformers.js │  │   Voy        │  │
│  │   (Dexie)       │  │  (Embeddings)    │  │ (Vector DB)  │  │
│  │                 │  │                  │  │              │  │
│  │ ✓ Legal DB      │  │ ✓ all-MiniLM-L6 │  │ ✓ Semantic   │  │
│  │ ✓ User Data     │  │ ✓ 384-dim       │  │   Search     │  │
│  │ ✓ Search Index  │  │ ✓ No API calls  │  │ ✓ ~10ms      │  │
│  └─────────────────┘  └─────────────────┘  └──────────────┘  │
│                                                               │
│                    ❌ NO DATA LEAVES BROWSER                  │
└──────────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

- ✅ **No Server Communication** - All processing happens locally
- ✅ **No User Tracking** - Zero analytics or telemetry
- ✅ **No Data Storage** - Nothing persisted externally
- ✅ **No API Keys Required** - Pre-loaded knowledge base
- ✅ **Works Offline** - Full functionality without internet

## 📁 Data Sources

### 1. eCFR Official Source (GOLD Standard)

**Source:** [Electronic Code of Federal Regulations](https://www.ecfr.gov/)

```json
{
  "source": "eCFR_OFFICIAL",
  "authority": "38 CFR Part 4 - Schedule for Rating Disabilities",
  "legal_weight": "BINDING - Federal Regulation",
  "coverage": [
    "All diagnostic codes (DC 5000-9999)",
    "Rating percentages (0-100%)",
    "Medical criteria definitions",
    "Effective dates and amendments"
  ]
}
```

**Entry Types:**
- `diagnostic_code` (731 entries) - Official VA diagnostic codes
- `rating_criteria` (322 entries) - Detailed rating percentage criteria
- `diagnostic_code_removed` (18 entries) - Historical/removed codes

### 2. Community Knowledge Source (WISDOM Layer)

**Source:** [VeteransBenefitsKB](https://www.veteransbenefitskb.com/)

```json
{
  "source": "COMMUNITY_PROVIDED",
  "source_disclaimer": "Community-provided information - not from official VA regulations",
  "content_warning": "For educational purposes only. Verify with official sources.",
  "coverage": [
    "Claims filing strategies",
    "Secondary condition correlations",
    "Medical evidence guidance",
    "Real-world case experiences"
  ]
}
```

**Entry Types:**
- `community_knowledge` (599 entries) - Detailed condition guides
- `community_knowledge_summary` (36 entries) - Category overviews

### 3. BVA Decisions (DIAMOND Layer - PENDING)

**Source:** [VA Board of Veterans Appeals](https://data.va.gov/)

> ⚠️ **Status:** Awaiting API token from data.va.gov

```json
{
  "source": "BVA_DECISIONS",
  "authority": "Board of Veterans Appeals",
  "legal_weight": "PERSUASIVE - Administrative Decisions",
  "planned_features": [
    "Ruling extraction (Grant/Deny/Remand)",
    "Judge analytics and patterns",
    "38 CFR citation mapping",
    "Win rate trends by condition"
  ]
}
```

## 🏗️ Data Structure

### Entry Schema

```typescript
interface KnowledgeEntry {
  // Identification
  id: string;              // Unique identifier
  type: EntryType;         // Entry classification
  
  // Content
  title: string;           // Human-readable title
  content: string;         // Main content/description
  
  // Source Attribution
  source: "eCFR_OFFICIAL" | "COMMUNITY_PROVIDED" | "BVA_DECISIONS";
  source_url?: string;     // Original source URL
  source_disclaimer?: string; // For community content
  content_warning?: string;   // Educational use notice
  
  // Classification
  category?: string;       // Body system category
  diagnostic_codes?: string[]; // Related DC codes
  
  // Metadata
  last_updated: string;    // ISO date string
  scraped_at: string;      // When data was collected
}
```

### Body System Categories

| Category | Diagnostic Codes | Description |
|----------|-----------------|-------------|
| Musculoskeletal | 5000-5299 | Bones, joints, muscles |
| Organs of Special Sense | 6000-6099 | Eyes and ears |
| Respiratory | 6600-6899 | Lungs, breathing |
| Cardiovascular | 7000-7199 | Heart, blood vessels |
| Digestive | 7200-7399 | GI system |
| Genitourinary | 7500-7599 | Kidneys, bladder |
| Gynecological | 7600-7699 | Female conditions |
| Hemic/Lymphatic | 7700-7799 | Blood, lymph |
| Skin | 7800-7899 | Dermatological |
| Endocrine | 7900-7999 | Hormones, glands |
| Neurological | 8000-8599 | Brain, nerves |
| Mental Disorders | 9200-9499 | Psychiatric |
| Dental/Oral | 9900-9999 | Teeth, mouth |

## 🔍 Search Architecture

### Semantic Search Pipeline

```
User Query → Tokenization → Embedding → Vector Search → Ranked Results
     │            │             │            │              │
     │            │             │            │              │
"PTSD rating"   BERT      384-dim vector   Voy cosine    Top-k matches
"criteria"     tokens      all-MiniLM     similarity     with scores
```

### Search Features

1. **Semantic Understanding** - Finds conceptually related content
2. **Keyword Matching** - Traditional text search fallback
3. **Source Filtering** - Search within specific sources
4. **Category Scoping** - Limit to body system
5. **Confidence Scoring** - Relevance percentages

## 📋 Diamond Checklist

### ✅ Completed Features

- [x] **Official Regulations** - 38 CFR Part 4 coverage
- [x] **Community Knowledge** - Real-world veteran wisdom
- [x] **Source Attribution** - Clear tagging of all content
- [x] **Privacy Protection** - 100% client-side processing
- [x] **Merged Database** - Unified knowledge access
- [x] **Backup System** - Automatic backups on merge

### 🔄 In Progress

- [ ] **BVA Decisions** - Awaiting VA API token
- [ ] **Judge Analytics** - Requires BVA data
- [ ] **Win Rate Trends** - Requires BVA data

### 📅 Future Roadmap

- [ ] **CAVC Decisions** - Court of Appeals cases
- [ ] **Shepardizing** - Track overruled precedents
- [ ] **M21-1 Adjudication Manual** - Internal VA guidance
- [ ] **Regional Pattern Analysis** - Success rates by region

## 🛠️ Maintenance

### Updating Knowledge Base

```bash
# 1. Scrape official sources
python llm-compiler/scrapers/real_sources/ecfr_official_scraper.py

# 2. Scrape community sources
python llm-compiler/scrapers/real_sources/vbkb_community_scraper.py

# 3. Merge all sources
python llm-compiler/scrapers/real_sources/kb_merger.py

# 4. Verify output
cat public/data/vet_rate_knowledge.json | jq '.metadata'
```

### Adding New Sources

1. Create scraper in `llm-compiler/scrapers/real_sources/`
2. Follow entry schema with proper `source` tagging
3. Add to `kb_merger.py` source list
4. Run merge and verify

## 📜 Legal Disclaimer

> **IMPORTANT:** This knowledge base is for **educational and informational purposes only**. It is not legal advice and should not be used as a substitute for consultation with a qualified VA-accredited attorney, claims agent, or Veterans Service Organization representative.
>
> - **Official content** (eCFR) reflects federal regulations as published
> - **Community content** represents veteran experiences and opinions
> - **BVA decisions** are persuasive but not binding precedent
>
> Always verify information with official VA sources before making claims decisions.

---

*Built with 💎 for veterans, by veterans*
