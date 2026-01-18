# AI Assistant Privacy

Understanding how the AI Statement Assistant works and what data is shared.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## Overview

Vet-Rate.org offers an **optional** AI-powered statement assistant that helps veterans write more professional and effective statements for their VA claims. This feature is powered by **Google Gemini**, Google's AI service.

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
