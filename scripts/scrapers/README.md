# VA Data Collection Pipeline

Automated tools for collecting and analyzing public VA data to power the Diamond Knowledge Base.

## Data Sources

| Source | URL | Data |
|--------|-----|------|
| BVA Decisions | https://www.index.va.gov/search/va/bva.jsp | Full text of appeals decisions |
| Workload Reports | https://www.benefits.va.gov/REPORTS/mmwr/index.asp | Processing times, backlog |
| VA Open Data | https://www.data.va.gov/ | Statistics, demographics |
| AMA Reports | https://www.va.gov/decision-reviews/ | Appeals lane data |

All sources are **public records** - no special access required.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run full pipeline update
python va_data_pipeline.py --full-update

# Scrape specific condition
python va_data_pipeline.py --condition "sleep apnea" --count 50

# Just get processing times
python va_workload_scraper.py --processing-times

# List all data sources
python va_data_pipeline.py --list-sources
```

## Scripts

### `bva_decision_scraper.py`
Scrapes and analyzes Board of Veterans' Appeals decisions.

```bash
# Search for sleep apnea decisions
python bva_decision_scraper.py --condition "sleep apnea" --count 50

# Fetch full text and analyze
python bva_decision_scraper.py --condition "PTSD" --count 100 --fetch-full
```

**Outputs:**
- `src/data/bva_decisions/` - Raw decision data (JSON)
- `src/data/bva_analysis/` - Analysis reports (JSON)

### `va_workload_scraper.py`
Fetches VA workload reports and processing times.

```bash
# Get current processing times
python va_workload_scraper.py --processing-times

# Download latest workload report
python va_workload_scraper.py --latest

# Download historical reports
python va_workload_scraper.py --historical --months 6
```

**Outputs:**
- `src/data/va_workload/raw/` - Downloaded Excel files
- `src/data/va_workload/` - Parsed JSON data

### `va_data_pipeline.py`
Master controller that orchestrates all scrapers.

```bash
# Full update (recommended - runs everything)
python va_data_pipeline.py --full-update

# Generate frontend JS from existing data
python va_data_pipeline.py --generate-frontend
```

**Outputs:**
- `src/data/bva_data_update.js` - Frontend-ready JavaScript

## Data Flow

```
VA Public Sources
       │
       ▼
┌─────────────────┐
│  Scrapers       │
│  (Python)       │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  Raw Data       │
│  (JSON/Excel)   │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  Analysis       │
│  (Python)       │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  Frontend JS    │
│  (Auto-gen)     │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  bvaSuccessData │
│  (Manual merge) │
└─────────────────┘
```

## Respectful Scraping

All scrapers follow best practices:
- **Rate limiting**: 2-5 second delays between requests
- **User-Agent**: Identifies as VetRateResearch
- **Public data only**: No authentication required
- **Caching**: Avoids re-downloading same content

## Condition Priority List

High-value conditions tracked by default:
1. Sleep Apnea (high secondary potential)
2. PTSD (common, complex)
3. Tinnitus (most claimed)
4. Migraine (TBI secondary)
5. Radiculopathy (common secondary)
6. GERD (PTSD secondary)
7. Depression/Anxiety (mental health)
8. Back conditions (common)
9. Knee conditions (common)
10. Sinusitis/Rhinitis (Gulf War)

## Integrating Updates

After running the pipeline:

```javascript
// In bvaSuccessData.js
import { BVA_CONDITION_STATS, mergeLatestData } from './bva_data_update';

// Use merged data
export const CONDITION_DATA = {
  ...existingData,
  ...BVA_CONDITION_STATS
};
```

## Scheduling (Optional)

For automatic updates, add a cron job or GitHub Action:

```bash
# Weekly update (Sunday at 2 AM)
0 2 * * 0 cd /path/to/project && python scripts/scrapers/va_data_pipeline.py --full-update
```

## Legal Note

All data comes from public VA sources:
- BVA decisions are public records under FOIA
- Workload reports are published by VA for transparency
- VA Open Data is explicitly public

This is **educational research** - we're analyzing patterns to help veterans understand the claims process better.
