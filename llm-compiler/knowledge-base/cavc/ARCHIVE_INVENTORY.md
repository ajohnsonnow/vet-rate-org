# 📊 CAVC Archive Inventory & Extraction Plan

**Date:** 2026-01-26
**Status:** Downloaded - Ready for Extraction

---

## ✅ Downloaded Archives

### Panel Decisions (Precedential Opinions - BINDING AUTHORITY)
| Year | File | Size (MB) | Estimated Cases |
|------|------|-----------|-----------------|
| 1989 | panel_1989.zip | 1.60 | ~20 |
| 1989-2006 | panel_1989-2006.zip | 18.55 | ~250 (master archive) |
| 1990 | panel_1990.zip | 0.62 | ~8 |
| 1991 | panel_1991.zip | 6.10 | ~75 |
| 1992 | panel_1992.zip | 8.46 | ~100 |
| 1993 | panel_1993.zip | 13.24 | ~160 |
| 1994 | panel_1994.zip | 7.83 | ~95 |
| 1995 | panel_1995.zip | 8.82 | ~105 |
| 1996 | panel_1996.zip | 8.28 | ~100 |
| 1997 | panel_1997.zip | 7.61 | ~90 |
| 1998 | panel_1998.zip | 9.65 | ~115 |
| 1999 | panel_1999.zip | 10.30 | ~125 |
| 2000 | panel_2000.zip | 5.47 | ~65 |
| 2001 | panel_2001.zip | 4.04 | ~50 |
| 2002 | panel_2002.zip | 5.23 | ~65 |
| 2003 | panel_2003.zip | 3.33 | ~40 |
| 2004 | panel_2004.zip | 4.56 | ~55 |
| 2005 | panel_2005.zip | 3.50 | ~43 |
| 2006 | panel_2006.zip | 5.30 | ~69 (confirmed) |

**Panel Total:** ~1,630 precedential opinions

### Single Judge Decisions (Non-Precedential)
| Year | File | Size (MB) | Estimated Cases |
|------|------|-----------|-----------------|
| 1989-2000 | single_1989-2000.zip | 25.82 | ~3,000+ |
| 1990 | single_1990.zip | 0.01 | ~1 |
| 1991 | single_1991.zip | 0.07 | ~8 |
| 1992 | single_1992.zip | 1.17 | ~150 |
| 1993 | single_1993.zip | 0.53 | ~65 |
| 1994 | single_1994.zip | 0.13 | ~15 |
| 1998 | single_1998.zip | 0.03 | ~3 |
| 1999 | single_1999.zip | 12.03 | ~1,500 |
| 2000 | single_2000.zip | 5.35 | ~650 |

**Single Judge Total:** ~5,400 decisions

---

## 🎯 Grand Total Estimate
- **Panel Decisions:** ~1,630 precedential opinions
- **Single Judge:** ~5,400 non-precedential decisions
- **Combined:** ~7,000+ CAVC court decisions from 1989-2006

---

## 📋 Extraction Plan

### Phase 1: Extract All Archives (Immediate)
```powershell
# Extract all archives to organized folders
$archives = "E:\VS_Studio\vet-rate-org-official\llm-compiler\knowledge-base\cavc\archives"
$extracted = "E:\VS_Studio\vet-rate-org-official\llm-compiler\knowledge-base\cavc\extracted"

foreach ($archive in Get-ChildItem $archives -Filter "*.zip") {
    $dest = Join-Path $extracted $archive.BaseName
    Expand-Archive -Path $archive.FullName -DestinationPath $dest -Force
}
```

### Phase 2: Parse PDF Metadata (High Priority)
For each PDF, extract:
- **Case Number** (from filename)
- **Veteran Name** (from filename)
- **Decision Date** (from PDF content)
- **Decision Type** (panel = precedential, single = non-precedential)
- **Key Text** (holdings, relevant conditions)

### Phase 3: Filter High-Value Cases
Priority conditions to search for in PDFs:
1. **PTSD** (Post-Traumatic Stress Disorder)
2. **TDIU** (Total Disability Individual Unemployability)
3. **Secondary Conditions** (nexus, causation)
4. **Mental Health** (depression, anxiety, bipolar)
5. **Nexus** (service connection)
6. **Rating Criteria** (10%, 30%, 50%, 70%, 100%)
7. **Effective Date** (earlier effective date claims)
8. **CUE** (Clear and Unmistakable Error)
9. **DIC** (Dependency and Indemnity Compensation)
10. **Sleep Apnea** (secondary to PTSD, obesity)

### Phase 4: Create DKB Entries
For high-value cases:
```json
{
  "id": "cavc_03_1930",
  "type": "cavc_decision",
  "case_number": "03-1930",
  "citation": "Bates v. Principi, CAVC No. 03-1930E (2006)",
  "veteran_name": "Bates",
  "decision_date": "2006-XX-XX",
  "decision_type": "precedential",
  "holding": "...",
  "relevant_conditions": ["PTSD", "Mental Health"],
  "diagnostic_codes": ["DC 9411"],
  "cfr_citations": ["38 CFR § 4.130"],
  "hierarchy_level": 2,
  "color_code": "GREEN"
}
```

---

## 🚀 Implementation Strategy

### Automated Approach
1. **PDF Text Extraction** (PyPDF2, pdfplumber)
2. **NLP Keyword Search** (search for high-value terms)
3. **Metadata Extraction** (regex for case numbers, dates, citations)
4. **JSON Generation** (automated DKB entry creation)
5. **Batch Integration** (merge into production KB)

### Manual Curation (For Precedential)
1. Extract ALL ~1,630 panel decisions
2. Use keyword search to filter top 200-300 high-value cases
3. Manually review precedential opinions about:
   - PTSD service connection
   - TDIU criteria
   - Secondary conditions (sleep apnea, hypertension)
   - Mental health ratings
   - Effective date claims
4. Create detailed DKB entries for top cases
5. Integrate into production knowledge base

---

## 📈 Expected Impact

### Before
- 14 CAVC decisions (last 3 days only)
- Limited precedential coverage
- Minimal historical context

### After
- **~7,000+ CAVC decisions** (1989-2006)
- **~1,630 precedential opinions** (binding authority)
- **Comprehensive historical precedent**
- Cover ALL major veteran claim types

### For Veterans
- AI can cite **decades of binding precedent**
- Find similar cases to their situation
- Understand how courts have ruled on specific conditions
- See patterns in successful appeals
- Get guidance on strong vs. weak arguments

---

## 🎯 Next Steps

1. ✅ Download all archives (COMPLETE - 177.63 MB)
2. ⏳ Extract all ZIP files (~7,000 PDFs)
3. ⏳ Parse PDF metadata (case numbers, veteran names)
4. ⏳ Keyword filter for high-value cases
5. ⏳ Create DKB JSON entries
6. ⏳ Integrate into production knowledge base
7. ⏳ Update KNOWLEDGE_BASE_INVENTORY.md
8. ⏳ Test AI retrieval with CAVC citations

---

## 💡 Quick Start Command

```powershell
# Extract all archives now
$archives = "E:\VS_Studio\vet-rate-org-official\llm-compiler\knowledge-base\cavc\archives"
$extracted = "E:\VS_Studio\vet-rate-org-official\llm-compiler\knowledge-base\cavc\extracted"
New-Item -ItemType Directory -Path $extracted -Force | Out-Null

Get-ChildItem $archives -Filter "*.zip" | ForEach-Object {
    $dest = Join-Path $extracted $_.BaseName
    Write-Host "Extracting: $($_.Name)"
    Expand-Archive -Path $_.FullName -DestinationPath $dest -Force
}

Write-Host "Extraction complete! Counting PDFs..."
$pdfCount = (Get-ChildItem $extracted -Recurse -Filter "*.pdf").Count
Write-Host "Total PDFs extracted: $pdfCount"
```

---

**Diamond Standard Enhanced with DECADES of Precedent!**
