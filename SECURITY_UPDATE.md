# 🛡️ Security & Integrity Update: Patch 1.1

**Date:** January 27, 2026  
**Status:** Live  
**Context:** Addressing community feedback regarding AI hallucinations and procedural safety.

---

Following a critical technical audit by the r/VAClaims community, we have implemented three hard-coded engineering controls to prevent the specific failures identified (specifically: the invention of fake forms and the generation of strategy without evidence).

**We do not ask you to "trust us." We ask you to verify the code updates below.**

---

## 1. The "Hallucination Firewall" (Form Validator)

**The Vulnerability:** Generative models can hallucinate procedural forms that do not exist or cite forms incorrectly. If a veteran trusts incorrect form guidance, they could file the wrong paperwork and lose their effective date.

**The Fix:** We have moved from "prompt engineering" to **deterministic code validation**.

### Mechanism

A new strict allowlist ([src/data/validVAForms.json](src/data/validVAForms.json)) now governs all AI outputs.

### Logic

1. The system scans every AI response using Regex patterns for VA form syntax (e.g., `\d{2}-\d{3,5}`)
2. It cross-references matches against our validated database of 90+ official VA forms (sourced from [VA.gov/find-forms](https://www.va.gov/find-forms/))
3. **Outcome:** If the AI attempts to cite a form NOT in the allowlist, the response is programmatically blocked before it reaches the UI

### Result

It is now **technically impossible** for the tool to recommend a non-existent form. The validation code is at:

- **Validator Logic:** [src/utils/formValidator.js](src/utils/formValidator.js)
- **Allowlist Data:** [src/data/validVAForms.json](src/data/validVAForms.json)

### Verified Form Categories

| Category | Example Forms | Count |
|----------|---------------|-------|
| Claims & Appeals | 21-526EZ, 20-0995, 20-0996, 10182 | 10 |
| Evidence & Statements | 21-4138, 21-10210, 21-0781, 21-0781a | 7 |
| TDIU/Employment | 21-8940, 21-4192 | 3 |
| Dependents | 21-686c, 21-674 | 4 |
| Medical/A&A | 21-2680, 10-10EZ | 5 |
| DBQ Series | 21-0960* (wildcard prefix) | All |

---

## 2. The "No Document, No Strategy" Gatekeeper

**The Vulnerability:** Providing specific claim strategy (e.g., "submit a nexus letter") without reading the actual "Reasons for Decision" in the denial letter constitutes "guessing," which is harmful. Generic advice presented as specific guidance can send veterans down the wrong path.

**The Fix:** We implemented a **"Refusal Mode"** in the system prompt.

### Mechanism

The AI Context Window now scans user input for the specific text of a VA Denial Letter (keywords: "Reasons for Decision," "Favorable Findings," "Service connection is denied," etc.).

### Logic

```
IF the user asks for strategy ("How do I win?", "Why was I denied?")
AND the specific denial text is MISSING...
THEN the AI is hard-coded to REFUSE the request.
```

### New Output When Text is Missing
>
> ⚠️ **MISSING DECISION DATA**
>
> To give you safe advice, I need to see the specific "Reasons for Decision" from your denial letter. Without this, I cannot identify the missing element (Nexus vs. Diagnosis vs. In-Service Event). Please paste that text.

### Result

The AI can no longer provide "confident guesses" about why you were denied. It must see the actual denial rationale first. The gatekeeper code is at:

- **Gatekeeper Prompt:** [src/utils/aiSystemPrompts.js](src/utils/aiSystemPrompts.js) (search: `STRATEGY_GATEKEEPER_PROMPT`)
- **Detection Logic:** `detectDecisionText()` function in the same file

---

## 3. Transparency: Data & Entity Structure

Addressing valid concerns regarding operational transparency:

### Legal Entity

The application is currently deployed under **Firearm Safety Team LLC**, an existing entity used solely for billing and API provisioning. This was done to avoid 6+ month incorporation delays for API access.

### Data Isolation

This legal entity **cannot see your data**. The application architecture is **"Local-First"**:

- Your claims data exists in your browser's `localStorage`
- It is **never transmitted** to our billing backend
- All AI inference happens either locally (Wllama/WebGPU) or via direct user API keys (Gemini)

### Verification

You can verify this by:

1. Opening Browser DevTools (F12) → Network tab
2. Using the app and watching for outbound requests
3. You will see requests to Google (if using Gemini) but **no data payloads** sent to firearmsafetyteam.*or vetrate.* servers

### BVA Data Status

We previously stated the tool "scrapes BVA." To be precise:

- The tool was trained on a **static snapshot** of public BVA decisions (2018-2025)
- Live BVA API integration is currently **offline/pending** due to VA API availability
- This has been updated in our documentation

---

## 4. Diagnostic Code Validation (Existing)

In addition to form validation, we have always validated diagnostic codes:

### Mechanism

Every AI-generated diagnostic code is checked against our validated database of 748+ conditions from 38 CFR Part 4.

### Location

- **Validator:** [src/utils/hallucinationTrap.js](src/utils/hallucinationTrap.js)
- **Database:** [src/data/disabilityData.json](src/data/disabilityData.json)

### Result

If the AI invents a diagnostic code (e.g., "DC 9999" that doesn't exist), the response is flagged and the code is rejected with suggestions for similar valid codes.

---

## Verification & Audit

### You Can Verify These Changes

| Control | File Location | How to Verify |
|---------|---------------|---------------|
| Form Validator | `src/utils/formValidator.js` | Search for `validateVAForms` function |
| Form Allowlist | `src/data/validVAForms.json` | Open file, see all valid forms |
| Strategy Gatekeeper | `src/utils/aiSystemPrompts.js` | Search for `STRATEGY_GATEKEEPER_PROMPT` |
| Decision Detection | `src/utils/aiSystemPrompts.js` | Search for `detectDecisionText` function |
| DC Validator | `src/utils/hallucinationTrap.js` | Search for `validateDiagnosticCode` |

### Open Source Commitment

This entire codebase is open source. You can:

1. Clone the repo and audit any file
2. Submit issues if you find problems
3. Propose PRs if you have improvements

---

## Responding to Specific Criticisms

| Criticism | Our Response |
|-----------|--------------|
| "Tool hallucinated VA Form 27-0820" | Form 27-0820/27-0820a ARE real forms (Report of First Notice of Death), but we've added the allowlist to validate ALL form references regardless |
| "Guessing without reading the decision" | Implemented the "No Document, No Strategy" gatekeeper that refuses to give advice without decision text |
| "Trust me" isn't proof | Agreed. The code is open source. Audit it. |
| "Buzzwords like three-layer validation" | We've removed marketing language and now point to specific files and functions |
| "LLC confusion" | Explained the billing entity vs. data isolation architecture |

---

## What We Commit To

1. **No Fake Forms:** Deterministic validation, not prompt-based
2. **No Blind Strategy:** Refusal when decision text is missing
3. **Open Audit:** All code is public and verifiable
4. **Continuous Improvement:** Community feedback → code fixes

---

## Contact & Reporting

If you find the AI generating incorrect information:

1. Screenshot the error
2. Open an issue on GitHub with the reproduction steps
3. We will patch and credit you

**Thank you to the r/VAClaims community for the critical feedback. The tool is safer today because of it.**

---

*Last Updated: January 27, 2026*
