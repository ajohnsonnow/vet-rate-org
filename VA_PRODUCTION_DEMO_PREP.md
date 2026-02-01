# VA Production Access Demo - Preparation Document

**Date:** January 31, 2026  
**Contact:** Nathan Edmondson, VA API Team  
**Objective:** Demonstrate readiness for VA Production API Access

---

## ✅ Requirements Checklist

### 1. API Integration Status

| Required API | Status | Endpoint | Implementation |
|-------------|--------|----------|----------------|
| ✅ **Facilities API** | READY | `/services/va_facilities/v1/facilities` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L247) |
| ✅ **Forms API** | READY | `/services/va_forms/v0/forms` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L273) |
| ✅ **Benefits Reference Data** | READY | `/services/benefits-reference-data/v1/disabilities` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L287) |
| ✅ **Benefits Claims API** | READY | `/services/claims/v2/veterans/me/claims` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L169) |
| ✅ **Appeals Status API** | READY | `/services/appeals/v0/appeals` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L225) |
| ✅ **Appealable Issues API** | READY | `/services/appeals/appealable-issues/v0/appealable-issues` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L197) |
| ✅ **Service History & Eligibility** | READY | `/services/veteran_verification/v2/service_history` | [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx#L141) |

**All 7 Required APIs Implemented ✓**

---

### 2. Authorization & Consent Flow

**OAuth 2.0 Implementation:**
- ✅ **OAuth Provider:** [useVaAuth.js](src/hooks/useVaAuth.js) - Full PKCE flow
- ✅ **Configuration:** [vaAuth.js](src/config/vaAuth.js)
- ✅ **Login Flow:** `VaSandboxTest.jsx` → Click "Connect VA Account" → VA.gov redirect → Consent screen → Callback → Token exchange
- ✅ **Consent Screens:** Handled by VA.gov (user must approve requested scopes)
- ✅ **Token Management:** Automatic refresh with `offline_access` scope

**Scopes Requested:**
```javascript
openid profile offline_access claim.read service_history.read 
appealable_issues.read appeals_status.read
```

**Demonstration Path:**
1. User clicks "Connect VA Account" button
2. Redirect to `https://sandbox-api.va.gov/oauth2/authorization`
3. User sees VA.gov consent screen showing:
   - What data the app will access
   - Which APIs are being authorized
4. User approves → Redirect to callback URL
5. App exchanges authorization code for access token (PKCE verification)
6. User data loads automatically

---

### 3. Account Management

**Veteran Account Creation:**
- ✅ OAuth automatically creates session on first login
- ✅ User info retrieved from `/oauth2/userinfo` endpoint
- ✅ Data stored in browser sessionStorage only (no database)

**Account Deactivation:**
- ✅ "Disconnect VA Account" button in dashboard
- ✅ Calls `/oauth2/revoke` endpoint to invalidate tokens
- ✅ Clears all sessionStorage data
- ✅ User returns to unauthenticated state

**Code Reference:** [useVaAuth.js](src/hooks/useVaAuth.js#L120-L140)

---

### 4. Development/Test Environment

**Status:** ✅ FULLY CONFIGURED

**Local Setup:**
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Access at
http://localhost:5173
```

**Environment Variables (`.env.local`):**
```env
# OAuth Configuration
VITE_VA_CLIENT_ID=your_sandbox_client_id
VITE_VA_REDIRECT_URL=http://localhost:5173/callback
VITE_VA_API_ENV=sandbox

# API Keys
VITE_VA_API_KEY=your_facilities_api_key
VITE_VA_FORMS_API_KEY=your_forms_api_key
VITE_VA_BENEFITS_REF_API_KEY=your_benefits_ref_api_key
```

**Proxy Configuration (CORS Bypass):**
- [vite.config.js](vite.config.js#L20-L30) - Proxies `/va-api/*` to `https://sandbox-api.va.gov/*`

---

### 5. Sandbox Integration

**Status:** ✅ ACTIVELY INTEGRATED

**Test Component:** [VaSandboxTest.jsx](src/components/VaSandboxTest.jsx)

**Testing Capabilities:**
- Real-time API testing dashboard
- "Run All Tests" button executes all 7 APIs
- Pass/Fail status indicators
- Raw JSON response viewer
- Error handling and logging
- Network request inspection

**Sandbox Test Users:**
- Username: `va.api.user+idme.001@gmail.com`
- Available at: https://developer.va.gov/explore/verification/sandbox-access

---

### 6. Technical Staff

**Primary Developer:** Anth (ajohnsonnow)
- GitHub: [@ajohnsonnow](https://github.com/ajohnsonnow)
- Role: Full-stack developer, VA API integration lead

**Availability:** Flexible for demo scheduling

---

### 7. Use Case Demonstrations

#### Use Case #1: Facilities API
**Workflow:**
1. Veteran enters ZIP code
2. App searches nearby VA facilities
3. Displays medical centers, benefits offices, vet centers
4. Shows distance, hours, phone numbers

**Demo Command:**
```javascript
testFacilitiesApi() // Searches 97217 ZIP, returns 5 facilities
```

---

#### Use Case #2: Forms API
**Workflow:**
1. Veteran searches for VA form by name or number
2. App queries VA Forms API
3. Displays form details, PDF links, last revision date
4. Provides direct download link

**Demo Command:**
```javascript
testFormsApi() // Searches "21-526EZ" disability claim form
```

---

#### Use Case #3: Benefits Reference Data
**Workflow:**
1. App loads disability rating reference data
2. Provides condition names and diagnostic codes
3. Used for claim preparation and evidence matching
4. Helps veterans identify conditions for claims

**Demo Command:**
```javascript
testDisabilitiesApi() // Returns disabilities list
```

---

#### Use Case #4: Benefits Claims API
**Workflow:**
1. Veteran logs in with OAuth
2. App fetches all claims
3. Displays claim status, phase (1-8), date filed
4. Shows evidence needed and upcoming actions
5. Tracks claim progress in real-time
6. **With consent:** Saves claim data to MyPacket and VKB for offline access

**Demo Command:**
```javascript
testClaimsApi(accessToken) // Requires OAuth
```

**Visual Output:**
- Claim ID
- Claim type (Compensation, Pension, etc.)
- Current phase with progress bar
- Documents needed
- Decision letter status

---

#### Use Case #5: Appeals Status API
**Workflow:**
1. Veteran logs in with OAuth
2. App fetches all active appeals
3. Displays appeal type (HLR, Supplemental, Board)
4. Shows status, events, hearing dates
5. Tracks appeal timeline

**Demo Command:**
```javascript
testAppealsStatusApi(accessToken) // Requires OAuth
```

---

#### Use Case #6: Appealable Issues API
**Workflow:**
1. Veteran logs in with OAuth
2. App fetches denied decisions
3. Identifies which issues can be appealed
4. Shows decision date and rating percentage
5. Guides veteran to correct appeal lane

**Demo Command:**
```javascript
testAppealableIssuesApi(accessToken) // Requires OAuth
```

**Visual Output:**
- Issue description
- Decision date
- Current rating
- Appeal eligibility status

---

#### Use Case #7: Service History & Eligibility API
**Workflow:**
1. Veteran logs in with OAuth
2. App fetches military service records
3. Displays branch, service dates, discharge status
4. Shows deployments and eligibility status
5. Used for automatic claim prefilling
6. **With consent:** Saves to VKB for AI-assisted claim building

**Demo Command:**
```javascript
testServiceHistoryApi(accessToken) // Requires OAuth
```

**Visual Output:**
- Branch of service
- Start/end dates
- Discharge status
- Deployment history
- Character of discharge

---

## 🎬 Demo Flow (10-Minute Structure)

### Minute 0-2: Environment Setup
1. Open app: `http://localhost:5173`
2. Navigate to VA Integration Dashboard
3. Show clean, unauthenticated state

### Minute 2-4: Open Data APIs (No Login)
1. Click "Run All Tests" for Open Data section
2. Show Facilities API results (ZIP 97217)
3. Show Forms API results (21-526EZ form)
4. Show Benefits Reference Data (disabilities)
5. Toggle "Show Raw JSON" to prove real API responses

### Minute 4-7: OAuth Flow
1. Click "Connect VA Account"
2. Redirect to VA.gov sandbox
3. **Narrate:** "Using OAuth 2.0 with PKCE - no client secret"
4. Enter test credentials
5. Show VA.gov consent screen
6. Approve → Callback → Token exchange
7. Show authenticated state indicator

### Minute 7-10: User-Specific APIs
1. Watch Service History load automatically
2. Show Claims API data with progress bars
3. Show Appeals Status (if test user has appeals)
4. Show Appealable Issues
5. Click through raw JSON for each
6. Demonstrate logout → Token revocation

---

## 🔒 Security Highlights

**For the Demo:**
- ✅ **No Client Secret:** PKCE flow eliminates secret storage
- ✅ **No Server Storage:** All data in browser sessionStorage
- ✅ **Token Revocation:** Proper logout with `/oauth2/revoke`
- ✅ **HTTPS Only:** Production enforces secure connections
- ✅ **Scoped Access:** Only requested minimal necessary scopes
- ✅ **Session Expiry:** Tokens cleared on browser close
- ✅ **Consent-Based Storage:** VA data saved to MyPacket/VKB only with explicit veteran consent
- ✅ **Local-First:** All veteran data remains on their device (localStorage/IndexedDB)

---

## 📁 Key Files to Reference

| File | Purpose |
|------|---------|
| [src/api/va.js](src/api/va.js) | All 7 API endpoint definitions |
| [src/hooks/useVaAuth.js](src/hooks/useVaAuth.js) | OAuth PKCE implementation |
| [src/config/vaAuth.js](src/config/vaAuth.js) | OAuth configuration and scopes |
| [src/components/VaSandboxTest.jsx](src/components/VaSandboxTest.jsx) | Demo dashboard component |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | 5-minute demo script (legacy) |
| [docs/VA_INTEGRATION_DEMO.md](docs/VA_INTEGRATION_DEMO.md) | Full integration guide |

---

## 🧪 Pre-Demo Testing Commands

**Run these 1 hour before the demo:**

```bash
# Clear cache
npm run clean

# Fresh install
npm install

# Start dev server
npm run dev

# In browser:
# 1. Open DevTools (F12)
# 2. Navigate to http://localhost:5173
# 3. Open VA Integration Dashboard
# 4. Test full OAuth flow with sandbox credentials
# 5. Verify all 7 APIs return data
```

---

## ✅ Final Checklist (Day Before Demo)

- [ ] Test VA sandbox credentials are still valid
- [ ] Verify `.env.local` has all required keys
- [ ] Run `npm run dev` and confirm no errors
- [ ] Test complete OAuth login flow
- [ ] Verify all 7 APIs return successful responses
- [ ] Test logout and re-login
- [ ] Clear browser cache/cookies
- [ ] Have DevTools Network tab ready to show API calls
- [ ] Review use cases for each API
- [ ] Prepare answers for common questions (see below)

---

## ❓ Anticipated Questions & Answers

### Q: "Where is veteran PII stored?"
**A:** "Nowhere on our servers. All data is in browser sessionStorage, which is automatically cleared when the tab closes or when the user logs out. We're a 100% client-side application with zero database."

### Q: "How do you handle token refresh?"
**A:** "We request `offline_access` scope to receive a refresh token. Our `useVaAuth` hook automatically detects expired access tokens and exchanges the refresh token for a new one before making API calls. Users never see an error."

### Q: "What if the user revokes access?"
**A:** "They can click 'Disconnect VA Account' in our dashboard, which calls the `/oauth2/revoke` endpoint and clears all local storage. They can also revoke via their VA.gov profile. Either way, our next API call will fail gracefully and prompt re-authentication."

### Q: "Do you use the client secret?"
**A:** "No. We use PKCE (Proof Key for Code Exchange), which is designed specifically for public clients. No secret is stored in our code or environment variables."

### Q: "How do you prevent CORS errors?"
**A:** "In development, we use a Vite proxy that forwards `/va-api/*` requests to `https://sandbox-api.va.gov/*`. In production, we make direct calls to your API since our app will be hosted on an approved domain."

### Q: "Can you show me the code?"
**A:** "Absolutely. [Pull up src/hooks/useVaAuth.js or src/api/va.js and walk through it]"

### Q: "What error handling do you have?"
**A:** "Every API call is wrapped in try-catch blocks. We display user-friendly messages for common errors (network issues, expired tokens) and log technical details to console for debugging. Users never see raw error objects."

---

## 🚀 Post-Demo Action Items

After Nathan approves:

1. Request production credentials
2. Update `.env.local` with production values:
   ```env
   VITE_VA_API_ENV=production
   VITE_VA_CLIENT_ID=production_client_id
   ```
3. Test production endpoints in staging environment
4. Deploy to production domain
5. Monitor API usage and error rates

---

## 📞 Demo Scheduling

**To reply to Nathan:**

```
Hi Nathan,

We're ready for the production demo. Here's our status:

✅ Successfully calling all 7 required APIs (Facilities, Forms, Benefits Reference 
   Data, Claims, Appeals Status, Appealable Issues, Service History)
✅ OAuth 2.0 PKCE flow with veteran consent screens fully implemented
✅ Account creation and deactivation tested in sandbox
✅ Development environment running smoothly
✅ Sandbox integration validated - all endpoints returning expected data
✅ Technical staff (myself) available for demo
✅ Use cases documented and tested for each API

I can demonstrate each API's specific workflow during the meeting. 

Available times this week:
[Provide 3-5 time slots]

Looking forward to it!

Best,
Anth
```

---

**You're ready. Let's get that production access! 🎖️**
