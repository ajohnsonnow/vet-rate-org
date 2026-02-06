# VA API Production Demo Guide

## Overview

VetRate demonstrates **world-class integration** with 7 VA.gov APIs through two interfaces:

1. **My Packet → VA Records Tab** - Veteran-facing data import with selective download
2. **VA API Interface (VaSandboxTest)** - Technical validation dashboard

---

## 7 VA APIs Demonstrated

### OAuth Protected APIs (Require VA.gov Sign-In)

| # | API | Endpoint | Use Case |
|---|-----|----------|----------|
| 1 | **Service History** | `/services/veteran_verification/v2/service_history` | Pre-fill claim forms with service dates, verify eligibility |
| 2 | **Benefits Claims** | `/services/claims/v2/veterans/me/claims` | Track claim status, identify rated conditions, plan supplementals |
| 3 | **Appeals Status** | `/services/appeals/v0/appeals` | Monitor appeal progress, track decisions |
| 4 | **Appealable Issues** | `/services/appeals/v1/appealable_issues` | Find issues eligible for appeal within deadline |

### API Key APIs (Open Data - No Sign-In Required)

| # | API | Endpoint | Use Case |
|---|-----|----------|----------|
| 5 | **VA Facilities** | `/services/va_facilities/v1/facilities` | Find C&P exam sites, nearest VA healthcare |
| 6 | **VA Forms** | `/services/va_forms/v0/forms` | Find claim forms, DBQs for medical evidence |
| 7 | **Benefits Reference Data** | `/services/benefits_reference_data/v1/disabilities` | Look up diagnostic codes, rating criteria |

---

## Demo Flow: My Packet → VA Records

### Step 1: Open VA Data Center
1. Open "My Packet" from the main menu
2. Click the "VA Records" tab (shows 🏛️ icon)

### Step 2: Authorization Flow
1. Click **"Sign in with VA.gov"** button
2. System redirects to VA.gov OAuth portal
3. Veteran authenticates with their credentials
4. Consent screen shows requested scopes
5. Upon approval, redirected back to VetRate

### Step 3: View Available Data
The VA Data Center shows 3 tabs:
- **Your VA Records** (4 OAuth APIs)
- **Reference Data** (3 API Key APIs)
- **Saved Data** (locally stored records)

### Step 4: Selective Download
1. Each data type has a **checkbox** for selection
2. Preview data before saving by clicking **expand arrow**
3. Toggle **"Show JSON"** to see raw API response
4. Click **"Save Selected to My Packet"**

### Step 5: Privacy & Disconnect
1. Data saved to localStorage (never sent to servers)
2. Click **"Disconnect"** to log out
3. Saved data persists locally for AI tools

---

## Demo Flow: VA API Interface

### Opening the Interface
1. Click **"VA API Interface"** from menu (or URL: `/va-sandbox`)

### Testing OAuth APIs
1. Click **"Sign In to VA.gov"**
2. After auth, click individual **"Fetch"** buttons
3. View formatted data AND raw JSON

### Testing API Key APIs
1. For Facilities: Enter ZIP code (e.g., "90210")
2. For Forms: Enter search term (e.g., "21-526EZ" or "PTSD")
3. For Benefits Reference: Click "Load Data"

### Validation Checklist
- ✅ Rate limiting indicator shows remaining calls
- ✅ Error handling displays user-friendly messages
- ✅ Raw JSON toggle available for all APIs
- ✅ Consent prompt appears after data fetch

---

## Environment Setup Verification

### Required Environment Variables (Render Dashboard)
```
VITE_VA_CLIENT_ID=<your_oauth_client_id>
VITE_VA_REDIRECT_URL=https://vet-rate.org/callback
VITE_VA_API_ENV=sandbox
VITE_VA_API_KEY=<facilities_api_key>
VITE_VA_FORMS_API_KEY=<forms_api_key>
VITE_VA_BENEFITS_REF_API_KEY=<benefits_ref_api_key>
```

### Configuration Status Check
The UI displays individual status for each API:
- 🟢 OAuth (VA.gov Sign-In) - Configured
- 🟢 Facilities API - Configured
- 🟢 Forms API - Configured
- 🟢 Benefits Reference API - Configured

---

## Data Privacy Guarantees

1. **Local Storage Only** - All veteran data stored in browser localStorage
2. **No Server Upload** - VetRate servers never receive PII
3. **AI Availability** - Data accessible to AI tools via VKB (Veteran Knowledge Base)
4. **Persistence** - Data survives logout and browser refresh
5. **Clear Control** - Veterans can delete saved data anytime

---

## Use Case Demonstrations

### Use Case 1: Pre-Fill Claim Form
1. Import Service History
2. Data auto-populates service dates in claim builder
3. Reduces data entry errors

### Use Case 2: Plan Supplemental Claim
1. View current Claims with status
2. Check Appealable Issues for decisions within 1 year
3. Use AI to analyze rating decisions

### Use Case 3: Find C&P Exam Location
1. Search Facilities by ZIP
2. Filter by "VA Health" type
3. Get contact info and hours

### Use Case 4: Get Correct DBQ
1. Search Forms for condition name
2. Find corresponding DBQ
3. Download PDF directly

---

## Technical Staff Involved

- **Frontend**: React + Vite + TailwindCSS
- **OAuth**: PKCE flow implementation (`useVaAuth.js`, `vaAuth.js`)
- **API Layer**: `src/api/va.js` with rate limiting
- **Storage**: `vaDataPersistence.js` for local storage
- **Components**: `VADataCenter.jsx`, `VaSandboxTest.jsx`

---

## Quick Demo Script (5 minutes)

1. **Open My Packet → VA Records** (30s)
2. **Sign in to VA.gov** (30s)
3. **Show all 4 OAuth data types loading** (60s)
4. **Toggle checkboxes to select data** (30s)
5. **Save selected to My Packet** (15s)
6. **Switch to Reference Data tab** (15s)
7. **Search Facilities by ZIP** (30s)
8. **Search Forms for "PTSD"** (30s)
9. **Load Benefits Reference Data** (15s)
10. **Disconnect and show data persists** (30s)

---

## Build Info

- **Version**: 1.19.1+
- **Last Updated**: February 5, 2026
- **Component**: VADataCenter.jsx
- **Build**: `npm run build` passes
