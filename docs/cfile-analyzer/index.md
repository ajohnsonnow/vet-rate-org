# C-File AI Analyzer

## Overview

The **C-File AI Analyzer** is Vet-Rate.org's most powerful feature-analyzing thousands of pages of VA claims records in seconds using artificial intelligence. What competitors charge $500+ for, you can do for free.

!!! warning "Beta Feature"
    The C-File Analyzer is currently in beta. Results should be verified against your actual records.

## What is a C-File?

A **C-File** (Claims File) is the comprehensive collection of all documents the VA has about your military service and claims history, including:

- Service Treatment Records (STRs)
- Personnel records
- Medical records
- Previous VA decisions
- C&P exam results
- Correspondence

## How It Works

### 1. Client-Side Processing (Privacy First)

Your C-File PDF is processed **entirely in your browser**:

1. **PDF uploaded locally** - File never leaves your device
2. **Text extraction** - pdf.js extracts text from each page
3. **Page markers added** - Each page gets a `--- PAGE X ---` marker for citations
4. **Text sent to AI** - Only the text (not images) goes to Google Gemini

### 2. AI Analysis

The extracted text is analyzed by **Google Gemini 1.5 Flash**, which has a 1 million token context window-enough to process ~2,000 pages in a single analysis.

The AI looks for **"The Big Three"**:

| Element | What It Means |
|---------|---------------|
| **In-Service Event** | Injuries, illnesses, or exposures documented during service |
| **Current Diagnosis** | Chronic conditions mentioned in recent medical records |
| **Nexus** | Medical opinions or continuity of symptoms linking service to current conditions |

### 3. Results Dashboard

Your analysis appears in an interactive dashboard:

- **Executive Summary** - Quick overview of major findings
- **Timeline** - Chronological events with page references
- **Potential Claims** - Conditions rated by likelihood (High/Medium/Low)
- **Exposures** - Toxic exposures and presumptive conditions
- **Mental Health** - Indicators and documented stressors
- **Action Items** - Prioritized next steps

## Getting Started

### Step 1: Get Your C-File

Request your C-File from the VA:

1. **Online**: Use [VA.gov](https://www.va.gov/records/get-military-service-records/)
2. **FOIA Request**: Submit a Freedom of Information Act request
3. **eBenefits**: Download through your eBenefits account

### Step 2: Get a Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key for use in the analyzer

!!! tip "Free Tier"
    Gemini 1.5 Flash has a generous free tier-enough for multiple C-File analyses per month.

### Step 3: Upload and Analyze

1. Open the **C-File AI Analyzer** from the main menu
2. Drag and drop your PDF (or click to browse)
3. Paste your Gemini API key
4. Review the privacy notice
5. Click "Analyze My C-File"

## Understanding Results

### Claim Likelihood Ratings

| Rating | Meaning |
|--------|---------|
| 🟢 **High** | Strong evidence for all three pillars |
| 🟡 **Medium** | Has 1-2 pillars, needs additional evidence |
| 🔴 **Low** | Significant gaps in evidence |

### Nexus Strength

| Strength | What It Means |
|----------|---------------|
| **Strong** | Clear medical opinion linking service to condition |
| **Moderate** | Some connection documented, but not definitive |
| **Weak** | Limited evidence of connection |
| **Missing** | No nexus documentation found |

### Timeline Categories

- 🤕 **Injury** - Physical injuries documented
- 🏥 **Medical Visit** - Healthcare encounters
- 🎖️ **Combat Award** - Decorations indicating combat
- 📋 **Diagnosis** - Medical diagnoses assigned
- ☢️ **Exposure** - Toxic or hazardous exposures
- 🔪 **Surgery** - Surgical procedures
- 🧠 **Mental Health** - Psychological events
- 💊 **Medication** - Prescription medications

## Privacy & Security

### What Happens to Your Data

| Step | Data Location | Who Can Access |
|------|---------------|----------------|
| PDF Upload | Your browser only | Only you |
| Text Extraction | Your browser only | Only you |
| AI Analysis | Google's servers | Google (per their policy) |
| Results Display | Your browser only | Only you |

### What We Never Do

- ❌ Upload your PDF to our servers
- ❌ Store your C-File contents
- ❌ Save your API key
- ❌ Track your analysis results
- ❌ Share any data with third parties

### Google's Data Handling

When you use your Gemini API key, the extracted text is processed according to [Google's AI Terms of Service](https://policies.google.com/terms/generative-ai). Google may use data to improve their services unless you opt out.

## Troubleshooting

### "PDF appears to be a scanned image"

**Problem**: Your C-File is scanned paper records without a text layer.

**Solution**: 
1. Open in Adobe Acrobat
2. Choose Tools > Enhance Scans > Recognize Text
3. Save and re-upload

Free alternatives:
- [OCRmyPDF](https://ocrmypdf.readthedocs.io/) (command line)
- [Online OCR](https://www.onlineocr.net/) (web-based)

### "Rate limit exceeded"

**Problem**: You've hit Google's free tier limits.

**Solution**: Wait a few minutes and try again, or upgrade your Google Cloud account for higher limits.

### "Invalid API key"

**Problem**: Your Gemini API key isn't working.

**Solution**:
1. Verify the key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Make sure you copied the entire key
3. Generate a new key if needed

### Analysis takes too long

Large C-Files (2000+ pages) may take several minutes:

- Extraction: ~1-2 minutes for 2000 pages
- AI Analysis: ~1-3 minutes depending on complexity

Keep the browser tab open during processing.

## Limitations

1. **Image-only PDFs**: Scanned documents without OCR won't work
2. **Handwritten notes**: AI may struggle with handwritten medical notes
3. **AI accuracy**: Results should be verified against original documents
4. **Not legal advice**: Analysis is informational only

## Best Practices

1. **Verify findings** - Always cross-reference AI findings with your actual records
2. **Use page numbers** - The AI provides page citations-use them to locate evidence
3. **Take action** - Follow up on the "Action Items" with your VSO or attorney
4. **Save results** - Screenshot or note important findings before closing

## Related Features

- [Secondary Scout](../secondary-scout/index.md) - Find linked conditions
- [Nexus Builder](../nexus-builder/index.md) - Build nexus statements
- [Forms Helper](../forms-helper/index.md) - Complete VA forms
- [C&P Simulator](../cap-simulator/index.md) - Prepare for exams
