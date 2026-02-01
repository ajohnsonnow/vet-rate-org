# VA API Demo - Quick Reference Card
*Print this and keep it next to your screen during the demo*

---

## 🎯 The 7 Required APIs

| # | API Name | Auth Type | Status |
|---|----------|-----------|--------|
| 1 | **VA Facilities** | API Key | ✅ Ready |
| 2 | **VA Forms** | API Key | ✅ Ready |
| 3 | **Benefits Reference Data** | API Key | ✅ Ready |
| 4 | **Benefits Claims** | OAuth | ✅ Ready |
| 5 | **Appeals Status** | OAuth | ✅ Ready |
| 6 | **Appealable Issues** | OAuth | ✅ Ready |
| 7 | **Service History & Eligibility** | OAuth | ✅ Ready |

---

## 🔐 Sandbox Test Credentials

**Username:** `va.api.user+idme.001@gmail.com`  
**Password:** *(Check VA Developer Portal or your notes)*

**If login fails:** Use backup test user `va.api.user+idme.002@gmail.com`

---

## 🚀 Demo Commands

```bash
# Start app
npm run dev

# Open browser
http://localhost:5173

# Navigate to
Tools → VA Integration Dashboard
```

---

## 📝 10-Minute Demo Script

| Time | Action | Key Point |
|------|--------|-----------|
| **0-1 min** | Open dashboard | "Testing all 7 APIs" |
| **1-3 min** | Click "Run All Tests" | Show 3 API Key APIs pass |
| **3-5 min** | Click "Connect VA Account" | Full OAuth flow |
| **5-8 min** | Show 4 OAuth APIs load | Toggle Raw JSON |
| **8-9 min** | Click "Disconnect" | Token revocation |
| **9-10 min** | Q&A | Security, storage, errors |

---

## 💬 Key Talking Points

### On Open Data APIs (Min 1-3)
> "These 3 APIs use API key authentication - no user login required. Perfect for public data like facility locations and forms."

### On OAuth Flow (Min 3-5)
> "Using OAuth 2.0 with PKCE - no client secret stored client-side. The veteran sees exactly what we're requesting."

### On User Data (Min 5-8)
> "Now we can access veteran-specific data. These 4 APIs require the OAuth token we just received."

### On Security (Min 8-10)
> "All data is in browser sessionStorage. No database. No server-side storage. It's cleared when the tab closes or when the user logs out."

---

## ❓ Anticipated Questions

### "Where is veteran data stored?"
**A:** VA data is fetched into sessionStorage temporarily. With veteran consent, we can save to localStorage/IndexedDB on their device for offline access (My Packet & Knowledge Base). No database. They can delete anytime.

### "Do you use a client secret?"
**A:** No. OAuth 2.0 PKCE eliminates the need for a secret in public clients.

### "What if the token expires?"
**A:** We request `offline_access` for a refresh token. Our hook auto-refreshes before making calls.

### "How do you handle errors?"
**A:** Try-catch blocks on every API call. User-friendly messages displayed. Technical details logged to console.

### "Can I see the code?"
**A:** Absolutely. `src/hooks/useVaAuth.js` and `src/api/va.js` have all the OAuth and API logic.

### "How do you prevent CORS?"
**A:** Development uses Vite proxy. Production will make direct calls from approved domain.

---

## 🛠️ Troubleshooting (If Things Go Wrong)

### OAuth redirect fails
- Check `.env.local` has correct `VITE_VA_CLIENT_ID` and `VITE_VA_REDIRECT_URL`
- Ensure redirect URL matches VA Developer Portal registration

### API returns 403 Forbidden
- Verify API key is registered for that specific service
- Check key hasn't been rotated

### Network error / CORS
- Confirm Vite proxy is running (`/va-api` → `sandbox-api.va.gov`)
- Check browser console for specific error

### Token expired
- Click "Disconnect" and log in again
- Refresh tokens are valid for 7 days in sandbox

---

## 📁 Files to Reference (If Asked)

| File | Purpose |
|------|---------|
| `src/api/va.js` | All 7 API endpoint definitions |
| `src/hooks/useVaAuth.js` | OAuth PKCE implementation |
| `src/config/vaAuth.js` | OAuth config & scopes |
| `src/components/VaSandboxTest.jsx` | Demo dashboard component |

---

## ✅ Success = Nathan Sees:

- [x] All 7 APIs return data (green checkmarks)
- [x] OAuth login flow with consent screen
- [x] Raw JSON responses (proof of real API calls)
- [x] Logout with token revocation
- [x] Specific use case for each API
- [x] Security story (no server storage)

---

## 📧 Post-Demo Email (Pre-written)

```
Hi Nathan,

Thank you for the demo session. As demonstrated:

✅ All 7 APIs integrated and functional  
✅ OAuth 2.0 PKCE with veteran consent  
✅ Account creation/deactivation tested  
✅ Sandbox environment validated  
✅ Use cases documented for each API  

We're ready for production access. Please advise on next steps.

Best regards,
Anth
```

---

## 🎖️ Confidence Boosters

✅ **You've already built everything** - just showing it off  
✅ **The code works** - tested and validated  
✅ **Focus on the happy path** - login → data loads → logout  
✅ **Stay calm** - this is a formality, not a test  

**You've got this! 🚀**

---

*Keep this card visible during the demo. Good luck!*
