# Safety & Security Architecture

**Critical systems protecting veterans using Vet-Rate.org**

---

## 🚨 The Three Critical Blind Spots (Addressed)

This document details how Vet-Rate.org addresses the three most critical safety risks for veteran-facing AI applications.

---

## 1. ⛑️ Crisis Interceptor (Safety-Critical)

### The Problem
Veterans discussing trauma and service-connected conditions may experience emotional distress. If a user types language indicating self-harm or suicidal ideation, the application must:
- **NEVER** send that text to an AI (which cannot provide clinical support)
- **IMMEDIATELY** provide access to trained crisis counselors

### The Solution

#### Pre-Flight Screening
**Location**: `src/utils/crisisInterceptor.js`

Every text input is scanned for crisis language **BEFORE** being sent to any external API:

```javascript
// Triggered patterns (examples):
- "I can't take this anymore"
- "want to end it all"
- "thinking about suicide"
- "better off dead"
```

#### Automatic Intervention
**Location**: `src/components/CrisisModal.jsx`

When crisis language is detected:
1. **Block** the AI API call immediately
2. Display a full-screen, non-dismissible modal with:
   - **Veterans Crisis Line**: Dial 988, Press 1
   - Direct `tel:988` link (mobile-optimized)
   - Alternative contact methods (text 838255, chat)
   - Compassionate messaging emphasizing help is available

#### Integration Points
- **Core AI helper**: `src/utils/aiStatementHelper.js` - `callGeminiAPI()`
- **Nexus Builder**: Crisis events dispatched via `window.dispatchEvent('vetrate:crisis')`
- **App-level handler**: `src/App.jsx` - Listens for crisis events from any component

#### Logging (Privacy-Safe)
Crisis intercepts are logged **without user text** to:
- Track system effectiveness
- Improve keyword detection
- Provide developers with incident metrics

**Storage**: `localStorage` key `vetrate_crisis_logs` (metadata only)

---

## 2. 💰 API Key Security (The "Wallet Kill Switch")

### The Problem
If API keys are embedded in client-side code:
- Hackers scrape keys in seconds (even from "hidden" env files)
- Developer's account gets exploited for spam/abuse
- $5,000+ bills or account suspension

### The Solution: Bring Your Own Key (BYOK)

#### Architecture
**No backend server. No key storage. True client-side.**

1. **User provides their own free Gemini API key** via Settings
2. Key stored in `localStorage` (never transmitted to our servers - we have none!)
3. API calls made directly from browser to Google Gemini
4. User controls costs, rate limits, and key rotation

#### Implementation
**Location**: `src/utils/aiStatementHelper.js`

```javascript
const STORAGE_KEY = 'vetrate_gemini_key';

export const isAIAvailable = () => {
  const storedKey = localStorage.getItem(STORAGE_KEY);
  return Boolean(storedKey && storedKey.length > 0);
};
```

**Settings UI**: Accessible via gear icon in header → "AI Features (BYOK)"

#### Why This Works
- ✅ **Developer wallet protected** - We never hold keys
- ✅ **User gets free AI** - Gemini's free tier is generous
- ✅ **No backend costs** - Pure static site hosting
- ✅ **Instant revocation** - User can delete key anytime

#### Legacy Env Variable Support
For development/testing, `.env.local` keys still work but are:
- ⚠️ **Never used in production**
- ⚠️ **Never committed to version control** (`.gitignore` enforced)
- ⚠️ **Shown with security warnings** in README

**Production Rule**: If deploying publicly, **ALWAYS use BYOK model**.

---

## 3. 🔒 PII Scrubbing (The "Echo Chamber")

### The Problem
Veterans may inadvertently paste documents containing:
- Social Security Numbers (123-45-6789)
- Phone numbers (555-123-4567)
- Home addresses (123 Main Street)

If the AI echoes this information in the response, and the user shares a screenshot, they've leaked their identity.

### The Solution: Multi-Layer PII Protection

#### Layer 1: System Prompt Instruction
**Location**: `src/utils/aiStatementHelper.js`

```javascript
const PII_PROTECTION_PROMPT = `
CRITICAL PRIVACY PROTECTION RULES:
1. NEVER output Social Security Numbers in any format
2. NEVER output phone numbers with area codes
3. NEVER output specific street addresses
4. If the user's input contains these, replace with placeholders:
   - SSN → [SSN REDACTED]
   - Phone → [PHONE REDACTED]
   - Address → [ADDRESS]
`;
```

This protection is **prepended to every AI prompt** before submission.

#### Layer 2: User Education
**Consent Modals**: Before using AI features, users see explicit warnings:
- "Do NOT include your SSN, full name, or addresses"
- "This is for your protection"

**Location**: `src/components/AIConsentModal.jsx`

#### Layer 3: Input Validation (Future Enhancement)
**Planned**: Pre-submission regex scanning to detect and warn about PII patterns before API call.

---

## 🔐 Security Best Practices

### For Developers
1. **Never commit API keys** (`.env.local` is in `.gitignore`)
2. **Use BYOK model** for all public deployments
3. **Test crisis detection** regularly with keyword test cases
4. **Monitor crisis logs** for false positives/negatives

### For Users
1. **Get your own free Gemini key** (5 minutes, no credit card)
2. **Never share your API key** with others
3. **Revoke/rotate keys** if compromised
4. **Don't paste sensitive documents** - use descriptive text instead

---

## 🧪 Testing

### Crisis Detection Test
Run in browser console:
```javascript
import { testCrisisDetection } from './src/utils/crisisInterceptor.js';
testCrisisDetection();
```

### BYOK Workflow Test
1. Go to Settings
2. Enter test key: `test_key_123`
3. Check `localStorage.getItem('vetrate_gemini_key')`
4. Attempt AI feature → Should show "Invalid API key" (expected)
5. Clear key → AI features should be disabled

---

## 📊 Metrics & Monitoring

### Crisis Interception
- **Storage**: `localStorage['vetrate_crisis_logs']`
- **Data**: Timestamp, severity, source component (NO user text)
- **Purpose**: Improve keyword detection, track system health

### API Usage
- **User-controlled**: Each user monitors their own Gemini API dashboard
- **No centralized tracking**: We never see API usage (we don't have backend)

---

## 🆘 Crisis Resources (Always Available)

**Veterans Crisis Line**
- Phone: 988, then Press 1
- Text: 838255
- Chat: [VeteransCrisisLine.net](https://www.veteranscrisisline.net/get-help-now/chat/)
- International: +1-800-273-8255

**These resources are displayed:**
- When crisis language is detected (automated)
- In footer of every page (always accessible)
- In About Us and Contact pages

---

## 📝 Development Checklist

When adding new AI features:

- [ ] Import crisis interceptor: `import { interceptBeforeAICall } from './crisisInterceptor'`
- [ ] Add pre-flight check before API call
- [ ] Handle `CRISIS_DETECTED` error response
- [ ] Dispatch crisis event: `window.dispatchEvent(new CustomEvent('vetrate:crisis'))`
- [ ] Include PII protection in system prompt
- [ ] Show consent modal before first use
- [ ] Provide non-AI fallback (templates, manual entry)
- [ ] Test with crisis keyword scenarios

---

## 🤝 Community Responsibility

This is a veteran-serving tool. The crisis interceptor is not a "feature" - it's a **moral imperative**.

If you fork this project:
1. **Keep the crisis interceptor** - Don't remove it to "simplify"
2. **Test it regularly** - Veterans' lives may depend on it
3. **Improve the keyword list** - Submit PRs with better detection patterns
4. **Respect the BYOK model** - Don't centralize API keys for convenience

---

**Last Updated**: January 18, 2026  
**Maintained By**: Anthony Johnson (Founder, Vet-Rate.org)  
**Questions?** See [SECURITY.md](../SECURITY.md) for vulnerability reporting
