# Platinum Standard Testing Guide

## Overview
This guide covers testing all "Platinum Standard" security and functionality improvements.

---

## 1. Feature Flag System Testing

### Test 1.1: AI Disable Flag
**Objective:** Verify remote kill switch works

**Steps:**
1. Open `public/status.json`
2. Set `"ai_enabled": false`
3. Try to use any AI feature (C-File Analyzer, Nexus Builder, etc.)
4. Should see error: "AI features are temporarily disabled. Please try again later."

**Expected:** AI is completely blocked

---

### Test 1.2: Local AI Disable Flag
**Objective:** Verify mode-specific disable

**Steps:**
1. Set `"features": { "local_ai": false }`
2. Set AI mode to Local
3. Try to generate text
4. Should see error: "Local AI is temporarily disabled. Please use Cloud AI or try again later."

**Expected:** Local AI blocked, Cloud AI still works

---

### Test 1.3: Fail-Open Behavior
**Objective:** Verify AI works if status.json is unreachable

**Steps:**
1. Rename `public/status.json` to `public/status.json.backup`
2. Try to use AI features
3. Should work normally (fail-open design)

**Expected:** Features continue working despite missing status file

**Cleanup:** Restore `status.json`

---

## 2. PII Scrubber Testing

### Test 2.1: SSN Detection
**Input:**
```
My SSN is 123-45-6789 and I served from 2010-2015.
```

**Expected:**
- Console shows: `⚠️ PII Detected before AI call: ["SSN"]`
- Console shows: `🛡️ PII Scrubbed: { ssn: 1, ... }`
- SSN replaced with `[SSN REDACTED]`

---

### Test 2.2: Phone Number Detection
**Input:**
```
Call me at (555) 123-4567 or 555-987-6543 for more info.
```

**Expected:**
- Console shows: `⚠️ PII Detected before AI call: ["Phone"]`
- Both phone numbers replaced with `[PHONE REDACTED]`

---

### Test 2.3: Email Detection
**Input:**
```
Send documents to john.doe@example.com please.
```

**Expected:**
- Email replaced with `[EMAIL REDACTED]`

---

### Test 2.4: Multiple PII Types
**Input:**
```
John Doe, SSN 123-45-6789, born 01/15/1980.
Contact: john@email.com or 555-1234.
Lives at 123 Main St, Anytown, CA 90210.
```

**Expected:**
- All PII types detected and scrubbed
- Console shows detailed breakdown: `{ ssn: 1, email: 1, phone: 1, dob: 1, address: 1 }`

---

## 3. Hallucination Trap Testing

### Test 3.1: Valid Diagnostic Code
**Test Code:**
```javascript
import { validateDiagnosticCode } from './utils/hallucinationTrap';

console.log(validateDiagnosticCode('9411')); 
// Should return: { valid: true, officialName: "Post Traumatic Stress Disorder (PTSD)" }
```

**Expected:** Valid code accepted

---

### Test 3.2: Invalid Diagnostic Code (Hallucination)
**Test Code:**
```javascript
console.log(validateDiagnosticCode('9999')); 
// Should return: { valid: false, reason: "Code '9999' not found in 38 CFR Part 4" }
```

**Expected:** Fake code rejected

---

### Test 3.3: AI Response Filtering
**Scenario:** AI returns response with mix of valid/invalid codes

**Test with C-File Analyzer:**
1. Use AI to analyze a C-File
2. Manually inject invalid code in response (for testing, modify generateAI temporarily)
3. Check console for: `🚫 Hallucination Trap triggered: [...]`

**Expected:**
- Invalid codes logged to console
- Response includes `hallucinationReport` object
- If `expectJSON: true`, response reconstructed with valid codes only

---

## 4. AI Preset Testing

### Test 4.1: LEGAL Preset
**Steps:**
1. Open AI Settings (header badge)
2. Select "Legal/Regulatory (Jag Advocate)" preset
3. Use C-File Analyzer with regulatory question
4. Check console for: Temperature 0.1, topK 1, topP 0.1

**Expected:** 
- Precise, regulation-focused response
- Low creativity (may feel robotic)

---

### Test 4.2: CREATIVE Preset
**Steps:**
1. Select "Creative/Writing (Empathetic Nexus)" preset
2. Use Nexus Builder to generate a nexus letter
3. Check console for: Temperature 0.7, topK 40, topP 0.9

**Expected:** 
- Natural, flowing language
- Human-like writing style
- Persuasive tone

---

### Test 4.3: ADVERSARIAL Preset
**Steps:**
1. Select "Adversarial (Red Team)" preset
2. Use any claim analysis tool
3. Warning should appear: "🛡️ Red Team Mode Active: AI will challenge your claim..."

**Expected:** 
- Skeptical, critical analysis
- Challenges weak points
- Temperature 0.4 (balanced between precise and creative)

---

### Test 4.4: Preset Persistence
**Steps:**
1. Select LEGAL preset
2. Close AI Settings modal
3. Reload page
4. Reopen AI Settings

**Expected:** LEGAL preset still selected (saved to localStorage)

---

## 5. Token Limit Configuration Testing

### Test 5.1: MIN Preset (512 tokens)
**Steps:**
1. Select MIN (512 tokens)
2. Generate response
3. Response should be shorter/cut off earlier

**Expected:** Max 512 tokens generated

---

### Test 5.2: MAX Preset (4096 tokens)
**Steps:**
1. Select MAX (4096 tokens)
2. Warning appears about VRAM impact
3. Generate long response (e.g., detailed nexus letter)

**Expected:** 
- Longer response allowed
- Warning about memory usage shown

---

### Test 5.3: Custom Token Entry
**Steps:**
1. Click "Custom"
2. Enter 1500
3. Generate response

**Expected:** Respects custom 1500 token limit

---

## 6. Crisis Overlay Testing

### Test 6.1: Crisis Language Detection
**Input in any AI tool:**
```
I can't take this anymore. I want to end it all.
```

**Expected:**
- CrisisOverlay appears immediately
- Veterans Crisis Line 988 resources shown
- AI processing blocked
- Error thrown: `CRISIS_DETECTED`

---

### Test 6.2: Crisis Overlay UI
**Check:**
- ✅ Call button (tel:988 link)
- ✅ Text button (sms:838255 link)
- ✅ Chat button (opens VeteransCrisisLine.net)
- ✅ "I'm OK" close button works

---

## 7. Secure Storage Testing

### Test 7.1: Check if Secure Storage Exists
**Browser Console:**
```javascript
// Open DevTools Console
const { isCryptoAvailable } = await import('./src/utils/secureStorage.js');
console.log('Crypto Available:', isCryptoAvailable());
```

**Expected:** Returns `true` (Web Crypto API supported in modern browsers)

---

### Test 7.2: API Key in sessionStorage (Future Enhancement)
**Note:** Currently still using localStorage for backward compatibility.

**Future Test:**
1. Set Gemini API key in settings
2. Check sessionStorage (not localStorage)
3. Reload page - should prompt for key again (session-only)

**Status:** ⏳ Recommended but not yet enforced (migration path needed)

---

## 8. CSP Headers Testing

### Test 8.1: Verify CSP Active
**Browser Console:**
```javascript
// Check if CSP is active
console.log(document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content);
```

**Expected:** Should show CSP policy restricting script-src, connect-src, etc.

---

### Test 8.2: CSP Violation Test (Intentional)
**Attempt to run inline script:**
1. Open browser DevTools Console
2. Try: `eval("console.log('test')")`

**Expected:** Should be blocked by CSP (unless 'unsafe-eval' is needed for AI models)

---

## 9. Integration Testing

### Test 9.1: Full AI Pipeline with All Protections
**Scenario:** Analyze C-File with SSN, get valid + invalid codes

**Input:**
```
Analyze this veteran's C-File:
Service: 2010-2015 (Army)
SSN: 123-45-6789
Conditions claimed: PTSD (9411), TBI, hearing loss
```

**Expected Flow:**
1. ✅ Feature flag checked (AI enabled)
2. ✅ Crisis check passed (no crisis language)
3. ✅ PII scrubbed (SSN redacted)
4. ✅ AI generates response
5. ✅ Hallucination trap validates codes
6. ✅ Invalid codes filtered/logged
7. ✅ Valid response returned

**Check Console for:**
- `⚠️ PII Detected before AI call: ["SSN"]`
- `🛡️ PII Scrubbed: { ssn: 1 }`
- (If AI hallucinates) `🚫 Hallucination Trap triggered: [...]`

---

### Test 9.2: Local AI + LEGAL Preset + PII Scrubbing
**Steps:**
1. Enable Local AI
2. Select LEGAL preset (temp 0.1)
3. Input text with SSN
4. Generate

**Expected:**
- Local AI used (check console)
- Temperature 0.1 applied
- SSN scrubbed before Local AI
- Ultra-precise response

---

### Test 9.3: Preset Override in Code
**For Developers:**
```javascript
import { generateAI } from './utils/unifiedAIService';

const result = await generateAI('Analyze this claim', {
  preset: 'LEGAL', // Force LEGAL mode
  temperature: 0.2, // Override temperature
  maxTokens: 1000
});

console.log(result);
```

**Expected:** 
- Preset applied first
- Explicit options override preset

---

## 10. Error Handling Testing

### Test 10.1: Feature Flag Error
**Scenario:** status.json returns invalid JSON

**Steps:**
1. Edit `status.json` to be invalid JSON
2. Try AI feature

**Expected:** Fail-open (feature works with warning logged)

---

### Test 10.2: PII Scrubber Error
**Scenario:** PII scrubber throws exception

**Expected:** AI continues (scrubbing is non-blocking enhancement)

---

### Test 10.3: Hallucination Check Error
**Scenario:** hallucinationTrap.js fails

**Expected:** 
- Warning logged: `Hallucination check failed: [error]`
- AI response still returned (non-blocking)

---

## 11. Performance Testing

### Test 11.1: PII Scrubbing Performance
**Test:**
```javascript
import { scrubPII } from './utils/piiScrubber';

const largeText = "John Doe SSN 123-45-6789 ".repeat(100); // 100 SSNs
console.time('scrubPII');
const result = scrubPII(largeText);
console.timeEnd('scrubPII');
```

**Expected:** < 10ms for 100 SSNs (regex is fast)

---

### Test 11.2: Hallucination Trap Performance
**Test:**
```javascript
import { validateConditions } from './utils/hallucinationTrap';

const codes = ['9411', '5238', '8045', '7101', '6260']; // 5 valid codes
console.time('validateCodes');
const result = validateConditions(codes);
console.timeEnd('validateCodes');
```

**Expected:** < 1ms (O(1) Set lookup)

---

## 12. User Experience Testing

### Test 12.1: Preset Descriptions
**Check:**
- ✅ Each preset has clear label
- ✅ Description explains use case
- ✅ "Best for" tools listed
- ✅ Warnings for LEGAL/ADVERSARIAL modes

---

### Test 12.2: Warning Visibility
**Check:**
- ✅ Yellow warning for LEGAL mode (technical language)
- ✅ Red warning for ADVERSARIAL mode (stressful)
- ✅ VRAM warnings for high token limits

---

## 13. Regression Testing

### Test 13.1: Existing Features Still Work
**Test all major tools:**
- ✅ Disability Search
- ✅ Rating Calculator
- ✅ Secondary Scout
- ✅ C-File Analyzer
- ✅ Nexus Builder
- ✅ Local AI Panel

**Expected:** All work as before (backward compatible)

---

### Test 13.2: API Compatibility
**Check that existing code still works:**
```javascript
// Old-style call (no preset)
const result = await generateAI('test prompt', {
  temperature: 0.5,
  maxTokens: 2000
});
// Should still work!
```

---

## 14. Documentation Testing

### Test 14.1: README Updated
**Check:**
- ✅ Platinum Standard mentioned
- ✅ Security features listed
- ✅ PII scrubbing documented

---

### Test 14.2: In-App Help
**Check:**
- ✅ Token limit has help tooltips
- ✅ Preset selector has "What do these presets do?" details
- ✅ Model capability warnings clear

---

## Automated Test Suite (Future)

```javascript
// Example Jest tests for CI/CD

describe('Platinum Standard Security', () => {
  test('PII scrubber detects SSN', () => {
    const result = analyzePII('SSN: 123-45-6789');
    expect(result.hasPII).toBe(true);
    expect(result.types).toContain('SSN');
  });

  test('Hallucination trap rejects invalid code', () => {
    const result = validateDiagnosticCode('9999');
    expect(result.valid).toBe(false);
  });

  test('Feature flags fail-open', async () => {
    // Mock failed fetch
    global.fetch = jest.fn(() => Promise.reject());
    const enabled = await isFeatureEnabled('ai_enabled');
    expect(enabled).toBe(true); // Fail-open
  });

  test('Preset applies temperature', () => {
    const preset = getAIPreset('LEGAL');
    expect(preset.temperature).toBe(0.1);
  });
});
```

---

## Test Results Template

| Test ID | Feature | Status | Notes |
|---------|---------|--------|-------|
| 1.1 | Feature Flag - AI Disable | ⏳ | |
| 1.2 | Feature Flag - Local AI Disable | ⏳ | |
| 1.3 | Feature Flag - Fail-Open | ⏳ | |
| 2.1 | PII - SSN Detection | ⏳ | |
| 2.2 | PII - Phone Detection | ⏳ | |
| 2.3 | PII - Email Detection | ⏳ | |
| 2.4 | PII - Multiple Types | ⏳ | |
| 3.1 | Hallucination - Valid Code | ⏳ | |
| 3.2 | Hallucination - Invalid Code | ⏳ | |
| 3.3 | Hallucination - AI Filtering | ⏳ | |
| 4.1 | Preset - LEGAL | ⏳ | |
| 4.2 | Preset - CREATIVE | ⏳ | |
| 4.3 | Preset - ADVERSARIAL | ⏳ | |
| 4.4 | Preset - Persistence | ⏳ | |
| 5.1 | Token - MIN (512) | ⏳ | |
| 5.2 | Token - MAX (4096) | ⏳ | |
| 5.3 | Token - Custom | ⏳ | |
| 6.1 | Crisis - Detection | ⏳ | |
| 6.2 | Crisis - Overlay UI | ⏳ | |
| 9.1 | Integration - Full Pipeline | ⏳ | |
| 9.2 | Integration - Local + LEGAL + PII | ⏳ | |
| 13.1 | Regression - Existing Features | ⏳ | |

**Legend:**
- ⏳ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed

---

## Quick Smoke Test (5 Minutes)

**Minimum tests to verify core functionality:**

1. ✅ Open AI Settings → Select LEGAL preset → Save
2. ✅ Use C-File Analyzer with text containing SSN
3. ✅ Check console for PII scrubbing message
4. ✅ Verify AI generates response
5. ✅ Edit `status.json` → Set `ai_enabled: false`
6. ✅ Try AI → Should block with error
7. ✅ Restore `status.json`
8. ✅ Type crisis text → CrisisOverlay appears
9. ✅ All major tools still work

If all 9 pass → Platinum Standard is functional! ✨
