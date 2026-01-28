# 🔍 Knowledge Base Source Verification Guide

**Purpose:** Verify Vet-Rate knowledge base against official VA sources  
**Last Updated:** January 22, 2026  
**Knowledge Base:** `public/data/vet_rate_knowledge.json`  
**Status:** ✅ FRESHLY REBUILT FROM eCFR

---

## ✅ CURRENT STATUS: VERIFIED FRESH BUILD

### Knowledge Base Statistics

| Metric | Count |
|--------|-------|
| **Total Entries** | **1,071** |
| **Unique Diagnostic Codes** | **748** |
| Active DC Codes | 731 |
| Removed DC Codes | 18 |
| Rating Criteria Entries | 322 |

---

## 🔄 FRESH BUILD (January 22, 2026)

### Data Source

- **Primary Source:** eCFR.gov Official XML API
- **URL:** `https://www.ecfr.gov/api/versioner/v1/full/{date}/title-38.xml?part=4`
- **Title:** 38 CFR Part 4 - Schedule for Rating Disabilities
- **Build Method:** Direct XML scraping → Text extraction → Structured JSON

### What Was Rebuilt

This knowledge base was **completely rebuilt from scratch** using:

1. **eCFR XML API** - Downloaded full 38 CFR Part 4 (1,058,468 bytes)
2. **Multi-pass parsing** - XML scraper + Text parser + Merger
3. **Manual additions** - Special cases like DC 6100 (hearing loss audiometric tables)

### Entry Breakdown by Body System

| Body System | Entries |
|-------------|---------|
| Musculoskeletal System | 236 |
| Neurological Conditions | 122 |
| Digestive System | 94 |
| Respiratory System | 85 |
| Eye | 74 |
| Cardiovascular System | 56 |
| Genitourinary System | 50 |
| Skin | 45 |
| Infectious Diseases | 43 |
| Mental Disorders | 40 |
| Hemic and Lymphatic System | 39 |
| Endocrine System | 31 |
| Muscle Injuries | 29 |
| Gynecological Conditions | 29 |
| Peripheral Nerves | 27 |
| Ear | 17 |
| Dental and Oral Conditions | 11 |
| Nutritional Deficiencies | 4 |

---

## 📊 Entry Types

| Type | Count | Description |
|------|-------|-------------|
| `diagnostic_code` | 731 | Active VA diagnostic codes |
| `rating_criteria` | 322 | Rating percentages and criteria |
| `diagnostic_code_removed` | 18 | Codes removed from schedule |

---

## 🔗 OFFICIAL SOURCE LINKS

### Primary Source: eCFR

```
https://www.ecfr.gov/current/title-38/chapter-I/part-4
```

### Body System Sections

| Section | Body System | eCFR Link |
|---------|-------------|-----------|
| § 4.71a | Musculoskeletal | <https://www.ecfr.gov/current/title-38/part-4/section-4.71a> |
| § 4.73 | Muscle Injuries | <https://www.ecfr.gov/current/title-38/part-4/section-4.73> |
| § 4.79 | Eye | <https://www.ecfr.gov/current/title-38/part-4/section-4.79> |
| § 4.85-4.87 | Ear | <https://www.ecfr.gov/current/title-38/part-4/section-4.85> |
| § 4.88a-c | Infectious/Immune | <https://www.ecfr.gov/current/title-38/part-4/section-4.88a> |
| § 4.97 | Respiratory | <https://www.ecfr.gov/current/title-38/part-4/section-4.97> |
| § 4.104 | Cardiovascular | <https://www.ecfr.gov/current/title-38/part-4/section-4.104> |
| § 4.114 | Digestive | <https://www.ecfr.gov/current/title-38/part-4/section-4.114> |
| § 4.115-4.116 | Genitourinary | <https://www.ecfr.gov/current/title-38/part-4/section-4.115a> |
| § 4.117 | Hemic/Lymphatic | <https://www.ecfr.gov/current/title-38/part-4/section-4.117> |
| § 4.118 | Skin | <https://www.ecfr.gov/current/title-38/part-4/section-4.118> |
| § 4.119 | Endocrine | <https://www.ecfr.gov/current/title-38/part-4/section-4.119> |
| § 4.124a | Neurological | <https://www.ecfr.gov/current/title-38/part-4/section-4.124a> |
| § 4.130 | Mental Disorders | <https://www.ecfr.gov/current/title-38/part-4/section-4.130> |
| § 4.150 | Dental/Oral | <https://www.ecfr.gov/current/title-38/part-4/section-4.150> |

---

## 🎯 Key Diagnostic Codes Verified

| DC Code | Condition | Status |
|---------|-----------|--------|
| 5003 | Degenerative Arthritis | ✅ ACTIVE |
| 5010 | Post-traumatic Arthritis | ✅ ACTIVE |
| 5260 | Leg, limitation of flexion | ✅ ACTIVE |
| 5301-5323 | Muscle Groups I-XXIII | ✅ ACTIVE |
| 6100 | Hearing Loss | ✅ ACTIVE |
| 6260 | Tinnitus | ✅ ACTIVE |
| 7101 | Hypertension | ✅ ACTIVE |
| 7305 | Duodenal Ulcer | ❌ REMOVED (May 2024) |
| 7913 | Diabetes Mellitus | ✅ ACTIVE |
| 8100 | Migraine | ✅ ACTIVE |
| 9411 | PTSD | ✅ ACTIVE |

---

## 📁 Build Artifacts

| File | Location | Description |
|------|----------|-------------|
| Knowledge Base | `public/data/vet_rate_knowledge.json` | Main KB file |
| Raw XML | `llm-compiler/knowledge-base/ecfr-fresh/` | Downloaded eCFR XML |
| Extracted Text | `llm-compiler/knowledge-base/ecfr-fresh/ecfr_extracted_text.txt` | Parsed text |
| Build Scripts | `llm-compiler/scrapers/real_sources/` | Python scrapers |

### Build Scripts

1. `ecfr_fresh_scraper.py` - Downloads XML from eCFR API
2. `ecfr_complete_parser.py` - Parses extracted text
3. `ecfr_merger.py` - Combines all sources

---

## ⚠️ Important Notes

### Special Rating Methods

**DC 6100 - Hearing Loss:**

- Rated using audiometric tables (Tables VI, VIA, VII)
- Not a fixed percentage - depends on measured hearing levels
- Requires audiological examination by licensed audiologist

**Muscle Injuries (DC 5301-5323):**

- Rated by muscle group function
- Separate ratings for dominant vs non-dominant side
- Severity levels: Slight, Moderate, Moderately Severe, Severe

### Removed Codes

18 diagnostic codes have been removed from the rating schedule. These are tagged with `diagnostic_code_removed` type. Veterans with existing ratings may be re-evaluated under current codes.

---

## 🔄 Re-Building the Knowledge Base

To rebuild from scratch:

```bash
cd llm-compiler/scrapers/real_sources
python ecfr_fresh_scraper.py   # Download XML
python ecfr_complete_parser.py # Parse text
python ecfr_merger.py          # Merge all sources
```

---

## 📞 Official VA Resources

| Resource | URL |
|----------|-----|
| eCFR (Rating Schedule) | <https://www.ecfr.gov/current/title-38> |
| VA Schedule for Rating | <https://www.benefits.va.gov/warms/bookc.asp> |
| M21-1 Manual | <https://www.knowva.ebenefits.va.gov> |

---

*This knowledge base contains ONLY data verified against official eCFR sources.*  
*Last rebuild: January 22, 2026*
