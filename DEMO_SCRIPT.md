# VA Production Access Demo Script

## For your 5-minute meeting with Nathan

---

## 🎯 Demo Overview

**Objective:** Prove the "Happy Path" works - show that your VA.gov API integration is functional and secure.

**Environment:** Sandbox (you'll be using VA test accounts)

**APIs to Demo:**

- ✅ 3 Open Data APIs (Facilities, Forms, Benefits Reference)
- ✅ 2 OAuth APIs (Service History, Claims)
- ⏳ 2 Future Scope (Appeals Status, Appealable Issues)

---

## 📋 Pre-Demo Checklist

Before the meeting:

- [ ] Clear browser cache/cookies (fresh start)
- [ ] Have dev server running (`npm run dev`)
- [ ] Open browser DevTools Network tab (keeps things professional)
- [ ] Have sandbox test credentials ready:
  - **Username:** `va.api.user+idme.001@gmail.com`
  - **Password:** Check VA Developer Portal for current test password
- [ ] Close unnecessary browser tabs
- [ ] Test the login flow once before the call

---

## 🎬 Demo Script (5 Minutes)

### MINUTE 1: Introduction & Dashboard Overview

**Say:**
> "Thanks for taking the time, Nathan. I've built a System Status Dashboard specifically for this demo. Let me show you our current integration status."

**Do:**

1. Open your app at `http://localhost:5173`
2. Navigate to the Demo Dashboard (find button in your tools menu or access directly)
3. Point out the **Status Summary bar** at the top:
   - "As you can see, we have 5 Active APIs, and 2 marked as Future Scope"

---

### MINUTE 2: Open Data APIs (No Login Required)

**Say:**
> "First, let me show you the three Open Data APIs that use API Key authentication. These don't require user login."

**Do:**

1. Click **"Run All Tests"** button
2. Watch the Facilities, Forms, and Benefits Reference cards turn green
3. Point to each one:
   - "VA Facilities API - returning nearby VA locations"
   - "VA Forms API - we searched for form 21-526EZ"
   - "Benefits Reference API - disability rating data"

**Say:**
> "These are all returning live data from the sandbox. Let me prove it..."

**Do:**

1. Click **"Show Raw JSON"** under any green card
2. Point to the JSON response:
   > "This is the actual response from `sandbox-api.va.gov`. You can see the data structure matches your API documentation."

---

### MINUTE 3: OAuth Login Flow

**Say:**
> "Now for the OAuth-protected APIs. Let me walk you through the full authentication flow."

**Do:**

1. Click **"Connect VA Account"** button
2. You'll be redirected to VA.gov sandbox login
3. **Say while redirecting:**
   > "We're using OAuth 2.0 with PKCE - no client secret stored client-side."
4. Enter sandbox credentials
5. Authorize the app
6. Watch the redirect back to your app
7. **Say when you land back:**
   > "The callback page exchanges the authorization code for tokens. Watch the status change..."

---

### MINUTE 4: OAuth-Protected Data

**Say:**
> "Now that we're authenticated, let me show you the user-specific data."

**Do:**

1. Watch Service History and Claims cards turn green automatically
2. Point to the **"VA.gov OAuth Connected"** status bar
3. Click **"Show Raw JSON"** on Service History:
   > "This is the test veteran's actual service history from your Veteran Verification API"
4. Click **"Show Raw JSON"** on Claims:
   > "And here are their claims from the Claims API"

---

### MINUTE 5: Security & Future Scope

**Say:**
> "Let me address security and our roadmap."

**Do:**

1. Scroll to the **Privacy & Security** notice:
   > "All data is processed client-side only. No veteran data is stored on our servers. OAuth tokens are in browser session storage and cleared on logout."

2. Point to the **"Future Scope"** section:
   > "We have Appeals Status and Appealable Issues marked for Phase 2. We intentionally skipped them for now as they weren't in our initial scope approval."

3. (If they ask "Where is data stored?"):
   - Open DevTools → Application → Session Storage
   - Show the `va_access_token` and `va_user_info` entries
   > "Everything is in session storage - it's automatically cleared when the browser tab closes or when the user logs out."

**Close with:**
> "That's our full integration. Would you like me to walk through any specific API response in more detail?"

---

## 🛡️ Anticipated Questions & Answers

### Q: "Where is veteran data stored?"

**A:** "Only in browser memory. We use sessionStorage for OAuth tokens which is automatically cleared when the tab closes. No database, no server-side storage."

### Q: "Do you store the client secret?"

**A:** "No. We use PKCE (Proof Key for Code Exchange) which is designed for public clients. No client secret is used or stored anywhere in our code."

### Q: "Why are Appeals APIs grayed out?"

**A:** "We intentionally scoped Phase 1 to Service History and Claims. Appeals are in our Phase 2 roadmap once we have Production Access for the initial APIs."

### Q: "Can you show me the code?"

**A:** "Absolutely. [Show `src/hooks/useVaAuth.js` and `src/api/va.js` if asked]"

### Q: "What happens if the token expires?"

**A:** "We request `offline_access` scope to get refresh tokens. The `useVaAuth` hook automatically detects expired tokens and refreshes them before making API calls."

---

## 🚀 Quick Access Commands

```bash
# Start dev server
npm run dev

# Open in browser
http://localhost:5173
```

### Quick Demo Dashboard Access

**Keyboard Shortcut:** Press `Ctrl + Shift + D` anywhere in the app to instantly open the Demo Dashboard.

This is a hidden dev shortcut - perfect for quickly pulling up the dashboard during your meeting!

---

## 📁 Key Files to Have Open (If Asked)

| File | Purpose |
|------|---------|
| `src/config/vaAuth.js` | OAuth configuration & scopes |
| `src/hooks/useVaAuth.js` | PKCE flow implementation |
| `src/api/va.js` | API endpoint definitions |
| `src/components/DemoDashboard.jsx` | This demo component |

---

## ✅ Success Criteria

Nathan needs to see:

1. ✅ **OAuth Login works** - User clicks sign in → VA.gov redirect → callback → authenticated state
2. ✅ **Data displays in UI** - Not just JSON dumps, but formatted user-friendly displays
3. ✅ **Raw JSON proof** - Toggle to show actual API responses
4. ✅ **Security story** - Can explain where data is stored (browser only)
5. ✅ **Professional presentation** - Dashboard looks polished, not like debug output

---

**Good luck! You've got this. 🎖️**
