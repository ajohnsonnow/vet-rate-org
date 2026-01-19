# AI Assistant Privacy

Understanding how the AI Statement Assistant works and what data is shared.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## Overview

Vet-Rate.org offers an **optional** AI-powered statement assistant that helps veterans write more professional and effective statements for their VA claims. This feature is powered by **Google Gemini**, Google's AI service.

The AI assistant is available in:

- ✨ **Nexus Builder** - For secondary claim statements
- ✨ **Forms Helper** - For buddy statements, PTSD stressor statements, and personal statements
- ✨ **My Packet** - When resuming saved claims
- ✨ **Secondary Scout** - When building statements for discovered conditions
- ✨ **Disability Details** - When building statements for primary conditions
- 🔬 **C-File AI Analyzer** - For analyzing your entire Claims File (see dedicated section below)

!!! warning "AI is Optional"
    The AI assistant is completely optional. You can always use the standard template that processes everything locally on your device with no external data sharing.

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                   YOUR DEVICE                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │              VET-RATE.ORG APP                    │    │
│  │                                                  │    │
│  │  1. You fill out the statement wizard           │    │
│  │  2. Click "✨ Enhance with AI"                  │    │
│  │  3. Review privacy disclosure                   │    │
│  │  4. Consent to send data                        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (Only if you consent)
┌─────────────────────────────────────────────────────────┐
│                 GOOGLE GEMINI API                        │
│                                                          │
│  • Receives your statement details (no PII)             │
│  • Generates professional statement                     │
│  • Returns enhanced text to your browser                │
│  • Does NOT store your data for training                │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   YOUR DEVICE                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  5. Review AI-generated statement               │    │
│  │  6. Edit as needed                              │    │
│  │  7. Download (stays on your device)             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## What Data Is Shared

When you use the AI assistant, the following information is sent to Google Gemini:

### Personal Statement (Nexus Builder)

| Data Shared | Example |
|-------------|---------|
| Condition name | "Sleep Apnea" |
| Primary condition (if secondary) | "PTSD" |
| Symptom onset timeframe | "2019" |
| Treatment status | "VA treatment" |
| Connection mechanism | "Stress and anxiety from primary condition" |
| Work impact description | "Difficulty concentrating at work" |
| Social impact description | "Avoiding social gatherings" |
| Daily life examples | "Need to take breaks during tasks" |

### Buddy/Lay Statement

| Data Shared | Example |
|-------------|---------|
| Condition name | "Back Pain" |
| Relationship type | "Spouse" |
| Duration known | "15 years" |
| Observations | "Has difficulty standing" |
| Changes noticed | "Mobility has decreased" |
| Daily impact observed | "Can no longer do yard work" |

### PTSD Stressor Statement

| Data Shared | Example |
|-------------|---------|
| Stressor type | "Combat" |
| General event description | "Exposed to hostile fire" |
| Emotional impact | "Felt terrified and helpless" |
| Current symptoms | "Nightmares, hypervigilance" |
| Daily impact | "Difficulty sleeping" |

---

## What Is NOT Shared

The AI assistant **never** sends:

| Protected Data | Status |
|----------------|--------|
| Your name | ❌ Never sent |
| Social Security Number | ❌ Never sent |
| VA file number | ❌ Never sent |
| Address or contact info | ❌ Never sent |
| Specific dates | ❌ Never sent |
| Specific locations | ❌ Never sent |
| Unit names or service details | ❌ Never sent |
| Names of others | ❌ Never sent |
| Medical record numbers | ❌ Never sent |

---

## Google's Data Handling

### Free API Tier Policy

Vet-Rate.org uses Google Gemini's **free API tier**, which has specific privacy protections:

- ✅ **No training on your data** - Google does not use free tier API prompts to train their models
- ✅ **No human review** - Your prompts are not reviewed by Google employees
- ✅ **Temporary processing** - Data is processed and discarded
- ✅ **Encrypted transmission** - All data sent over HTTPS

### Google's AI Principles

Google's Gemini API is governed by their [AI Principles](https://ai.google/principles/) and [Privacy Policy](https://policies.google.com/privacy).

---

## Your Consent

Before any data is sent to the AI:

1. **Explicit consent required** - You must click "I Understand, Enhance with AI"
2. **Full disclosure shown** - You see exactly what will be sent
3. **Easy opt-out** - Click "No Thanks" to use standard template
4. **Per-session consent** - You consent each time you use AI

---

## Security Measures

### In Transit
- All API calls use **HTTPS encryption**
- API key is not exposed to users
- No credentials are stored in your browser

### On Your Device
- AI-generated statements stay in your browser
- Downloads save only to your device
- No server-side storage of your statements

---

## Frequently Asked Questions

### Can I use Vet-Rate without AI?

**Yes, absolutely!** The AI assistant is 100% optional. Every feature works without it using locally-processed templates.

### Who can see my AI-enhanced statement?

Only you. The statement is returned to your browser and never stored on any server.

### Is my medical information safe?

We designed the AI prompts to exclude all personally identifying information. Only general descriptions of conditions and symptoms are shared.

### Can Google identify me from the data?

No. The data sent contains no names, addresses, dates, or other identifying information. It's not possible to identify you from "condition: Sleep Apnea, impact: difficulty at work."

### What if I change my mind?

You can switch back to the standard template anytime by clicking the "Standard" toggle on the review screen.

### Does AI cost extra?

No. The AI feature is free for all users, powered by Google Gemini's free tier.

---

## C-File AI Analyzer Privacy

The C-File Analyzer is a special case that deserves its own privacy explanation because it processes much larger amounts of data.

### How C-File Analysis Differs

| Aspect | Statement Assistant | C-File Analyzer |
|--------|--------------------|--------------------|
| Data volume | Small (few paragraphs) | Large (thousands of pages) |
| Data source | You type it | Your PDF file |
| Processing location | Your browser | Your browser (extraction) + Google (analysis) |
| API model | Gemini 1.5 Flash | Gemini 1.5 Flash (1M token context) |
| Contains PII? | Deliberately excluded | May contain full records |

### What Happens to Your C-File

```
┌─────────────────────────────────────────────────────────┐
│                   YOUR DEVICE                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  1. You drop your C-File PDF                    │    │
│  │  2. pdf.js extracts TEXT (images ignored)       │    │
│  │  3. Page markers added: "--- PAGE X ---"        │    │
│  │  ❌ PDF NEVER UPLOADED TO ANY SERVER           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ (Only extracted text, after consent)
┌─────────────────────────────────────────────────────────┐
│            GOOGLE GEMINI API (YOUR KEY)                  │
│                                                          │
│  • Receives extracted text (may contain PII)            │
│  • Analyzes for claims evidence                         │
│  • Returns structured JSON results                      │
│  • Processed per Google's API policies                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### C-File Privacy Considerations

!!! warning "Your C-File Contains Sensitive Data"
    Unlike the statement assistant where we deliberately exclude PII, your C-File likely contains:
    
    - Your name and SSN
    - Medical diagnoses and treatments
    - Service history details
    - Personal addresses
    - Family information

### Protections in Place

1. **Your PDF stays local** - The actual file is NEVER uploaded
2. **You provide your own API key** - We never see your key or your data
3. **Explicit consent required** - You must acknowledge the privacy notice
4. **No Vet-Rate storage** - We don't save any part of your C-File or analysis

### Google's Handling of C-File Data

When you use your personal Gemini API key, the extracted text is subject to [Google's AI Terms](https://policies.google.com/terms/generative-ai). Key points:

- Google may process data to provide the service
- Data retention varies by account type
- You can review Google's data practices in their privacy policy

### Recommendations

1. **Use a dedicated Google account** - Create a separate Google account for the API key if desired
2. **Only analyze on secure devices** - Don't use public computers
3. **Review results carefully** - Verify AI findings against original documents
4. **Clear browser data after** - If you want extra privacy, clear your browser cache

---

## Opting Out

To avoid AI data sharing entirely:

1. Simply don't click "✨ Enhance with AI"
2. Use the standard template instead
3. Your data stays 100% on your device

---

## Contact

Questions about AI privacy?

- Use the Bug Squasher tool in the app
- Review our main [Privacy Policy](../data-privacy/)
- See [Security Practices](../security-practices/)

---

<div class="info-box">
<strong>🔒 Remember:</strong> AI enhancement is optional. Your standard template experience remains completely private and local to your device.
</div>
