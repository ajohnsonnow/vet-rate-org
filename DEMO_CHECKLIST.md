# VA API Demo - Quick Start Checklist

## 🎯 Goal
Prove to Nathan that all 7 required APIs work and you understand the flows.

---

## ⏱️ 1 Hour Before Demo

### Environment Check
```bash
# 1. Verify dev server starts
npm run dev

# 2. Check console for errors
# Should see: "VITE ready in XXX ms"
# Should NOT see: Missing environment variable errors

# 3. Open browser
# Navigate to: http://localhost:5173
```

### API Keys Validation
```bash
# Run pre-demo test script
node scripts/test-va-apis.js

# Expected output:
# ✅ VA Facilities API: OK (200)
# ✅ VA Forms API: OK (200)
# ✅ Benefits Reference Data API: OK (200)
```

### OAuth Flow Test
1. Open app → Navigate to VA Integration Dashboard
2. Click "Connect VA Account"
3. Redirects to `sandbox-api.va.gov`
4. Enter credentials: `va.api.user+idme.001@gmail.com`
5. Approve consent screen
6. Callback → Should see authenticated state
7. Verify Service History, Claims, Appeals load

---

## 📋 During Demo (10 Minutes)

### Minute 0-1: Introduction
**Say:** "Thanks Nathan. I have a comprehensive demo dashboard that tests all 7 APIs you requested."

**Do:**
- Share screen
- Open `http://localhost:5173`
- Navigate to VA Integration Dashboard

---

### Minute 1-3: Open Data APIs (No Login)
**Say:** "First, the 3 Open Data APIs that use API key authentication."

**Do:**
1. Point to the 3 cards: Facilities, Forms, Benefits Reference
2. Click "Run All Tests"
3. Watch all 3 turn green with checkmarks
4. Click "Show Raw JSON" on Facilities
5. **Say:** "This is the actual response from `sandbox-api.va.gov` - here's the facility data."

**APIs Demonstrated:**
- ✅ VA Facilities API
- ✅ VA Forms API  
- ✅ Benefits Reference Data API

---

### Minute 3-5: OAuth Authorization Flow
**Say:** "Now the OAuth-protected APIs. Let me show you the full authorization flow."

**Do:**
1. Click "Connect VA Account" button
2. **While redirecting, say:** "Using OAuth 2.0 with PKCE - no client secret stored client-side."
3. Enter sandbox credentials at VA.gov
4. **Point to consent screen:** "Here's where the veteran sees exactly what data we're requesting."
5. Click "Approve"
6. **During callback:** "Now exchanging authorization code for access token with PKCE verification."

**Key Points:**
- ✅ Veteran sees clear consent screen
- ✅ PKCE eliminates need for client secret
- ✅ Scopes clearly displayed

---

### Minute 5-8: User-Specific APIs
**Say:** "Once authenticated, we can access the veteran's personal data."

**Do:**
1. Watch 4 cards auto-load: Service History, Claims, Appeals Status, Appealable Issues
2. Point to "Service History" card:
   - **Say:** "This is from the Veteran Service History API - shows branch, dates, discharge status."
   - Click "Show Raw JSON"
3. Point to "Claims" card:
   - **Say:** "Benefits Claims API - real-time claim status and phase tracking."
   - Click "Show Raw JSON"
4. Point to "Appeals Status":
   - **Say:** "Appeals Status API - all active appeals with events timeline."
5. Point to "Appealable Issues":
   - **Say:** "Appealable Issues API - denied decisions eligible for appeal."

**APIs Demonstrated:**
- ✅ Service History & Eligibility API
- ✅ Benefits Claims API
- ✅ Appeals Status API
- ✅ Appealable Issues API

---

### Minute 8-9: Data Persistence with Consent
**Say:** "Now let me show you how we handle data persistence with veteran consent."

**Do:**
1. After OAuth data loads, mention consent requirement:
   - **Say:** "In production, veterans would see a consent prompt asking permission to save this data to their local device."
2. Navigate to My Packet (if time permits)
3. **Say:** "VA data can be saved to My Packet and our Knowledge Base - but only with explicit consent."
4. Click "Disconnect VA Account" button
5. **Say:** "This calls `/oauth2/revoke` to invalidate the token. All session data is cleared."

**Demonstrates:**
- ✅ Consent-based data storage
- ✅ Account deactivation/logout
- ✅ Token revocation
- ✅ Data privacy (no server storage without consent)

---

### Minute 9-10: Use Case Examples
**Say:** "Each API serves a specific veteran need."

**Run through quickly:**
1. **Facilities:** "Veteran finds nearest VA medical center"
2. **Forms:** "Veteran downloads disability claim form 21-526EZ"
3. **Benefits Reference:** "Veteran looks up condition rating criteria"
4. **Claims:** "Veteran tracks claim progress and sees what evidence is needed"
5. **Appeals:** "Veteran checks appeal status and next hearing date"
6. **Appealable Issues:** "Veteran identifies which denials can be appealed"
7. **Service History:** "Veteran verifies service dates for claim auto-fill"

---

## 🔒 Security Talking Points

### If asked: "Where is data stored?"
**Answer:** "VA API data is fetched into sessionStorage temporarily. If the veteran wants to save it for offline access - like their claims or service history - we show a consent prompt. Only with explicit consent do we save to localStorage/IndexedDB on their device. They can delete it anytime from My Packet. Zero server storage."

### If asked: "Do you use a client secret?"
**Answer:** "No. We use OAuth 2.0 PKCE, which is designed for public clients. There's no secret to store or protect."

### If asked: "What if a token expires?"
**Answer:** "We request `offline_access` scope to get a refresh token. Our auth hook automatically detects expired tokens and exchanges the refresh token for a new one. Users never see an error."

### If asked: "How do you prevent CORS?"
**Answer:** "In development, we use a Vite proxy. In production, we'll make direct calls to your API from our approved domain."

---

## ✅ Success Criteria

Nathan needs to see:

- [x] All 7 APIs returning data
- [x] OAuth login flow with consent screen
- [x] Logout/token revocation
- [x] Raw JSON responses (proof of real API calls)
- [x] Specific use case for each API
- [x] Security explanation (no server storage)

---

## 🚨 If Something Goes Wrong

### Scenario 1: OAuth redirect fails
**Fix:** Check `.env.local` has correct `VITE_VA_REDIRECT_URL` and `VITE_VA_CLIENT_ID`

### Scenario 2: API returns 403
**Fix:** 
- Check API key is registered for that specific service
- Verify sandbox credentials are still valid

### Scenario 3: Network request fails
**Fix:**
- Check DevTools Console for CORS errors
- Verify Vite proxy is configured (`/va-api` → `sandbox-api.va.gov`)

### Scenario 4: "Token expired" error
**Fix:** 
- Logout and login again
- Refresh tokens are valid for 7 days in sandbox

---

## 📧 Post-Demo Email Template

```
Hi Nathan,

Thank you for the demo opportunity. As shown, we have:

✅ All 7 APIs fully integrated and functional
✅ OAuth 2.0 PKCE flow with veteran consent screens
✅ Account creation and deactivation
✅ Sandbox environment validated
✅ Specific use cases for each API

We're ready for production access. Please let us know the next steps.

Best regards,
Anth
ajohnsonnow@github
```

---

## 🎖️ You've Got This!

**Remember:**
- Stay calm - you've already built everything
- If Nathan asks to see code, show `src/api/va.js` or `src/hooks/useVaAuth.js`
- Focus on the "happy path" - veteran logs in, data loads, veteran logs out
- Emphasize privacy: "No server storage, all client-side"

**The work is done. Now just show it off! 🚀**
