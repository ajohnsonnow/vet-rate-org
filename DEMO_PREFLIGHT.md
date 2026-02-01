# VA API Demo - Pre-Flight Configuration Guide

## ⚠️ CRITICAL: Enable OAuth Scopes Before Demo

Your OAuth scopes are currently commented out in the code. You MUST enable them before the demo.

---

## Step 1: Enable OAuth Scopes

**File:** `src/config/vaAuth.js`

**Current state (BROKEN):**
```javascript
export const VA_SCOPES = [
  'openid',
  'profile',
  // 'offline_access',          // Uncomment if approved for refresh tokens
  // 'claim.read',              // Uncomment if approved
  // 'service_history.read',    // Uncomment if approved
  // 'appealable_issues.read',  // Uncomment if approved
  // 'appeals_status.read',     // Uncomment if approved
].join(' ');
```

**Required state (WORKING):**
```javascript
export const VA_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'claim.read',
  'service_history.read',
  'appealable_issues.read',
  'appeals_status.read',
].join(' ');
```

**Action:** Uncomment ALL the scopes that are approved in your VA Developer Portal account.

---

## Step 2: Verify Environment Variables

**File:** `.env.local` (create if missing)

**Required variables:**
```env
# OAuth Configuration
VITE_VA_CLIENT_ID=your_sandbox_client_id_here
VITE_VA_REDIRECT_URL=http://localhost:5173/callback
VITE_VA_API_ENV=sandbox

# API Keys (may all be the same key, or different per API)
VITE_VA_API_KEY=your_api_key_here
VITE_VA_FORMS_API_KEY=your_api_key_here
VITE_VA_BENEFITS_REF_API_KEY=your_api_key_here
```

**Where to get these:**
1. **Client ID:** https://developer.va.gov → Your Applications → Client ID
2. **API Keys:** https://developer.va.gov → API Keys (may need separate keys for each API)

---

## Step 3: Verify API Key Registrations

Each API key must be registered for the specific API service.

**Check at:** https://developer.va.gov → API Keys → Key Details

**Required registrations per key:**
- **VITE_VA_API_KEY:** VA Facilities API
- **VITE_VA_FORMS_API_KEY:** VA Forms API
- **VITE_VA_BENEFITS_REF_API_KEY:** Benefits Reference Data API

**If you get 403 errors:** Your key is not registered for that service. Go to the VA Developer Portal and enable it.

---

## Step 4: Verify OAuth Scopes Are Approved

**Check at:** https://developer.va.gov → Your Application → Scopes

**Required scopes for demo:**
- [x] `openid`
- [x] `profile`
- [x] `offline_access`
- [x] `claim.read`
- [x] `service_history.read`
- [x] `appealable_issues.read`
- [x] `appeals_status.read`

**If a scope is NOT approved:**
1. Remove it from `vaAuth.js`
2. Note which API won't work in the demo
3. Be prepared to explain: "We're requesting approval for that scope as part of this review"

---

## Step 5: Test Configuration

### Test 1: Verify scopes are enabled
```bash
# Search for the scopes in your config
grep -A 10 "VA_SCOPES" src/config/vaAuth.js

# Should NOT see "//" comments in front of scopes
```

### Test 2: Run API key test
```bash
node scripts/test-va-apis.js

# Expected output:
# ✅ VA Facilities API: OK (200)
# ✅ VA Forms API: OK (200)  
# ✅ Benefits Reference Data API: OK (200)
```

### Test 3: Test OAuth flow manually
```bash
npm run dev
# Open http://localhost:5173
# Navigate to VA Integration Dashboard
# Click "Connect VA Account"
# Should redirect to VA.gov
# Enter credentials: va.api.user+idme.001@gmail.com
# Should see consent screen with all 7 scopes listed
# Approve → Should redirect back with data loaded
```

---

## Step 6: Enable Scopes Now

**DO THIS RIGHT NOW:**

1. Open `src/config/vaAuth.js`
2. Find line ~45 where scopes are defined
3. Uncomment all approved scopes
4. Save file
5. Restart dev server

**Quick fix command:**
```javascript
// Replace lines 45-53 with:
export const VA_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'claim.read',
  'service_history.read',
  'appealable_issues.read',
  'appeals_status.read',
].join(' ');
```

---

## ⚠️ Common Mistakes

### Mistake 1: Forgot to uncomment scopes
**Symptom:** OAuth login works but no user data loads  
**Fix:** Uncomment scopes in `vaAuth.js`

### Mistake 2: Wrong redirect URL
**Symptom:** OAuth returns "redirect_uri_mismatch" error  
**Fix:** Ensure `.env.local` redirect URL matches VA Developer Portal EXACTLY (including port 5173)

### Mistake 3: API key not registered
**Symptom:** 403 Forbidden on Facilities/Forms/Benefits APIs  
**Fix:** Register key for those services at developer.va.gov

### Mistake 4: Using production endpoints in sandbox
**Symptom:** All APIs return 401  
**Fix:** Ensure `VITE_VA_API_ENV=sandbox` in `.env.local`

---

## 🧪 Pre-Demo Validation Checklist

Run through this 30 minutes before the demo:

- [ ] Scopes uncommented in `vaAuth.js`
- [ ] `.env.local` has all required variables
- [ ] `node scripts/test-va-apis.js` passes all 3 tests
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] Can successfully log in with test credentials
- [ ] All 7 API cards show green checkmarks
- [ ] Raw JSON toggles work for each API
- [ ] Logout clears data and returns to login state

---

## 🚨 If You Get Errors During Testing

### Error: "invalid_scope"
**Cause:** Requested a scope that wasn't approved  
**Fix:** Comment out unapproved scopes in `vaAuth.js`

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URL doesn't match registration  
**Fix:** Update `.env.local` or update VA Developer Portal registration

### Error: "Cannot read property 'data' of undefined"
**Cause:** API returned error but code expected success  
**Fix:** Check browser console for actual API error, likely 403 (key not registered)

### Error: CORS / Network Error
**Cause:** Vite proxy not configured  
**Fix:** Check `vite.config.js` has proxy config for `/va-api`

---

## ✅ When You're Ready

After completing all steps above, you should:

1. See 3 green checkmarks on Open Data APIs (no login)
2. Be able to log in with OAuth
3. See 4 green checkmarks on OAuth APIs (after login)
4. Be able to toggle Raw JSON on each
5. Be able to log out and see data clear

**If all of the above work, you're 100% ready for the demo! 🎖️**

---

**Next Steps:**
1. Enable scopes in `vaAuth.js` NOW
2. Run `node scripts/test-va-apis.js`
3. Test full OAuth flow manually
4. Review [DEMO_CHECKLIST.md](DEMO_CHECKLIST.md) for demo script

**You're almost there! Just enable those scopes! 🚀**
