# VA.gov Sandbox API Integration Guide

## 🎯 Production Access Demo Preparation

This document provides everything you need to demonstrate VA.gov API integration to the VA review team.

---

## 📁 Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `src/api/va.js` | VA API service layer - all API calls |
| `src/components/VaIntegrationTest.jsx` | Demo dashboard component |
| `src/components/VaFacilitiesDemo.jsx` | VA Facilities search component |
| `src/hooks/useVaFacilities.js` | Facilities API hook |
| `.env.local.example` | Complete environment variable reference |

### Modified Files
| File | Changes |
|------|---------|
| `src/main.jsx` | Added VaAuthProvider wrapper and OAuth callback routing |
| `src/config/vaAuth.js` | Added `appealable_issues.read` scope and Facilities API key |
| `src/components/Header.jsx` | Added VA Integration Demo button |
| `src/App.jsx` | Imported VaIntegrationTest and added modal state |
| `src/data/toolkitData.js` | Added VA.gov Integration to tool list |
| `.env.example` | Updated with all required variables |

---

## 🔧 Environment Configuration

Create a `.env.local` file with these variables:

```env
# VA.gov OAuth 2.0 (PKCE)
VITE_VA_CLIENT_ID=your_sandbox_client_id_here
VITE_VA_REDIRECT_URL=http://localhost:5173/callback
VITE_VA_API_ENV=sandbox

# VA Facilities API (API Key auth)
VITE_VA_API_KEY=your_api_key_here

# Optional: AI Features
VITE_GEMINI_API_KEY=your_gemini_key_here
```

---

## 🔐 OAuth 2.0 Scopes Requested

| Scope | API Access |
|-------|------------|
| `openid` | OpenID Connect authentication |
| `profile` | Basic user profile information |
| `offline_access` | Refresh token support |
| `claim.read` | Claims Status API |
| `service_history.read` | Veteran Verification API |
| `appealable_issues.read` | Appeals API |

---

## 📡 API Endpoints Used

### OAuth-Authenticated Endpoints

1. **Service History** (Veteran Verification API)
   ```
   GET https://sandbox-api.va.gov/services/veteran_verification/v2/service_history
   ```
   - Returns: Military service records, branches, dates, discharge status

2. **Claims** (Benefits Claims API)
   ```
   GET https://sandbox-api.va.gov/services/claims/v2/veterans/me/claims
   ```
   - Returns: All claims with status, dates, phase information

3. **Appealable Issues** (Appeals API)
   ```
   GET https://sandbox-api.va.gov/services/appeals/appealable-issues/v0/appealable-issues
   ```
   - Returns: Decisions eligible for appeal

### API Key Endpoints

4. **VA Facilities** (Facilities API)
   ```
   GET https://sandbox-api.va.gov/services/va_facilities/v1/facilities
   ```
   - Uses API Key authentication (not OAuth)
   - Returns: Nearby VA medical centers, benefits offices, etc.

---

## 🖥️ Demo Component Features

### VA Integration Dashboard (`VaIntegrationTest.jsx`)

1. **Connect VA Account Button**
   - Initiates OAuth 2.0 PKCE flow
   - Redirects to VA.gov sandbox login

2. **Service History Card**
   - Shows branch of service
   - Start/end dates
   - Discharge status
   - Deployments (if any)

3. **Claims Tracker Card**
   - Lists all claims
   - Shows current phase (1-8)
   - Date filed, status
   - Visual progress bar

4. **Appealable Issues Card**
   - Lists denied decisions
   - Shows decision date
   - Rating percentage
   - Appeal eligibility

5. **Raw JSON Toggle**
   - Each card has "Show Raw JSON" button
   - Displays actual API response
   - Perfect for technical review

---

## 🧪 Testing Checklist

### Before Demo

- [ ] `.env.local` configured with Sandbox credentials
- [ ] Run `npm run dev` and verify no console errors
- [ ] Navigate to Tools → Support → VA.gov Integration
- [ ] Click "Connect VA Account" and complete OAuth flow
- [ ] Verify all three data cards populate
- [ ] Test "Show Raw JSON" toggles
- [ ] Test logout functionality
- [ ] Test re-login (session persistence)

### VA Test Users (Sandbox)

VA provides test users at: https://developer.va.gov/explore/api/veteran-verification/sandbox-access

Common test users include:
- `va.api.user+idme.001@gmail.com` (Standard veteran)
- `va.api.user+idme.002@gmail.com` (Veteran with claims)

---

## 🔄 Token Flow

```
1. User clicks "Connect VA Account"
   ↓
2. Generate PKCE code_verifier + code_challenge
   ↓
3. Redirect to VA.gov authorization URL
   ↓
4. User authenticates at VA.gov (ID.me, Login.gov, etc.)
   ↓
5. VA.gov redirects to /callback with auth code
   ↓
6. VaAuthCallbackNoRouter exchanges code for tokens
   ↓
7. Access token stored in sessionStorage
   ↓
8. API calls use Bearer token in Authorization header
   ↓
9. Token refresh when expired (using refresh_token)
```

---

## 🛡️ Security Implementation

### PKCE (Proof Key for Code Exchange)
- `code_verifier`: 32-byte random string
- `code_challenge`: SHA-256 hash of verifier (base64url encoded)
- Prevents authorization code interception attacks

### State Parameter
- Random 16-byte string for CSRF protection
- Validated on callback

### Token Storage
- Tokens stored in `sessionStorage` (not localStorage)
- Cleared on logout
- Cleared when tab/window closes

### Error Handling
- 401 responses trigger logout
- 403 responses show permission error
- Network errors handled gracefully

---

## 📊 Demo Script for VA Reviewers

1. **Introduction** (1 min)
   > "This is our VA.gov integration demo. We use OAuth 2.0 with PKCE for secure, client-side authentication without storing client secrets."

2. **Show Authentication** (2 min)
   - Click "Connect VA Account"
   - Complete VA.gov login
   - Point out: "The user authenticates directly with VA.gov. We never see their password."

3. **Show Service History** (1 min)
   - Point to service records
   - Toggle "Show Raw JSON"
   - Highlight: "This is the actual API response. No modifications."

4. **Show Claims** (2 min)
   - Expand a claim
   - Show progress bar
   - Explain: "We map VA's status codes to user-friendly phases."

5. **Show Appealable Issues** (1 min)
   - If present, explain appeal eligibility
   - If empty: "This veteran has no appealable issues - good news!"

6. **Security Discussion** (2 min)
   - Open browser DevTools → Application → Session Storage
   - Show tokens are stored securely
   - Demonstrate logout clears tokens

---

## 🚀 Access the Demo

In the running app:
1. Click the **🔧 Tools** dropdown in the header
2. Scroll to **🤝 Support & Resources**
3. Click **🔗 VA.gov Integration** (marked with DEMO badge)

Or add this button anywhere in your app:
```jsx
<button onClick={() => setShowVaIntegrationDemo(true)}>
  Open VA Integration Demo
</button>
```

---

## 📝 Notes for Production

When requesting production access:

1. Update `.env.local`:
   ```env
   VITE_VA_API_ENV=production
   VITE_VA_CLIENT_ID=your_production_client_id
   ```

2. Update redirect URI at developer.va.gov to your production domain

3. Endpoints automatically switch:
   - `sandbox-api.va.gov` → `api.va.gov`

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid redirect URI" | Ensure callback URL matches exactly what's registered |
| "Session expired" | Token lifetime varies; implement refresh token flow |
| No data returned | Check if test user has data in sandbox |
| CORS errors | VA APIs support CORS; check for typos in URL |
| 403 Forbidden | Check requested scopes match your app registration |

---

*Last Updated: January 20, 2026*
