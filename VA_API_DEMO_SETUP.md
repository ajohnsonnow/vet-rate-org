# VA API Production Demo Setup Guide

**Date:** February 5, 2026  
**Purpose:** Configure Vet-Rate.org for VA Production Access Demo

---

## 🚨 Current Issue

The production build shows this error because the VA environment variables are not configured:

```
[VA Auth] Missing VITE_VA_CLIENT_ID environment variable
[VA Auth] Login error: Error: Invalid VA.gov OAuth configuration
```

## ✅ Quick Fix: Configure Render Environment Variables

### Step 1: Open Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your **vet-rate-org** service
3. Navigate to **Environment** → **Environment Variables**

### Step 2: Add Required Variables

**OAuth Configuration:**

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_VA_CLIENT_ID` | `0oaXXXXXXXXXX` | Your VA.gov OAuth Client ID from [developer.va.gov](https://developer.va.gov) |
| `VITE_VA_REDIRECT_URL` | `https://vet-rate.org/callback` | Must match registered redirect URI |
| `VITE_VA_API_ENV` | `sandbox` | Use `sandbox` until production approved |

**API Keys (Open Data - can use same key for all 3):**

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_VA_API_KEY` | `your-va-api-key` | **VA Facilities API** - Find nearby VA locations |
| `VITE_VA_FORMS_API_KEY` | `your-va-api-key` | **VA Forms API** - Search forms like 21-526EZ |
| `VITE_VA_BENEFITS_REF_API_KEY` | `your-va-api-key` | **Benefits Reference Data** - Disabilities list |

> **Note:** VA may issue a single API key that works for all three Open Data APIs. If so, use the same key for all three variables.

### Step 3: Redeploy

After adding variables, trigger a manual deploy or push a commit.

---

## 📋 Demo Requirements Checklist

Based on the VA API team's requirements:

### ✅ API Integration Status

| API | Status | Implementation |
|-----|--------|----------------|
| **Facilities API** | ✅ Ready | [vaSandbox.js](src/api/vaSandbox.js#L254) |
| **Forms API** | ✅ Ready | [vaSandbox.js](src/api/vaSandbox.js#L276) |
| **Benefits Reference Data API** | ✅ Ready | [vaSandbox.js](src/api/vaSandbox.js#L285) |
| **Benefits Claims API** | ✅ Ready | [va.js](src/api/va.js#L223) |
| **Appeals Status API** | ✅ Ready | [vaSandbox.js](src/api/vaSandbox.js#L167) |
| **Appealable Issues API** | ✅ Ready | [vaSandbox.js](src/api/vaSandbox.js#L156) |
| **Service History & Eligibility** | ✅ Ready | [va.js](src/api/va.js#L182) |

**All 7 APIs Implemented ✓**

### ✅ Authorization & Consent Flow

- **OAuth 2.0 with PKCE**: [useVaAuth.js](src/hooks/useVaAuth.js)
- **Configuration**: [vaAuth.js](src/config/vaAuth.js)
- **Consent Screen**: Handled by VA.gov OAuth flow
- **Token Management**: Automatic with session storage

### ✅ Account Management

- **Create Account**: Automatic on first OAuth login
- **Deactivate Account**: "Disconnect" button revokes tokens via `/oauth2/revoke`

### ✅ Development Environment

```bash
# Local development
npm install
npm run dev

# Accessible at http://localhost:5173
```

### ✅ Sandbox Integration

- **Test Dashboard**: VA Sandbox Validation Dashboard (in-app)
- **Sandbox Test Users**: Available at [developer.va.gov](https://developer.va.gov/explore/verification/sandbox-access)
- **Proxy**: Vite development proxy bypasses CORS

---

## 🔧 Local Development Setup

### 1. Create `.env.local` file

```bash
# Copy the example
cp .env.local.example .env.local
```

### 2. Add your credentials

```env
# VA OAuth (from developer.va.gov)
VITE_VA_CLIENT_ID=0oaXXXXXXXXXXXXXXX
VITE_VA_REDIRECT_URL=http://localhost:5173/callback
VITE_VA_API_ENV=sandbox

# VA API Key (for open data APIs)
VITE_VA_API_KEY=your-api-key-here
```

### 3. Register Redirect URI at VA

Make sure your redirect URIs are registered at [developer.va.gov](https://developer.va.gov):

- **Development**: `http://localhost:5173/callback`
- **Production**: `https://vet-rate.org/callback`

---

## 🎯 Demo Workflow

### Demo Sequence

1. **Open VA Sandbox Dashboard** → Click API button in app
2. **Test Open Data APIs** → Facilities, Forms, Benefits Reference Data
3. **Connect VA Account** → OAuth PKCE flow with VA.gov
4. **Test Authenticated APIs** → Service History, Claims, Appeals
5. **Disconnect Account** → Token revocation

### What Reviewers Will See

1. **Facilities API Test**
   - Real-time facility search by ZIP code
   - Returns VA medical centers, benefits offices, vet centers

2. **Forms API Test**
   - Search for VA forms (21-526EZ, etc.)
   - Returns form metadata and PDF links

3. **Benefits Reference Data Test**
   - Fetches disabilities list from VA
   - Used for condition validation

4. **OAuth Flow**
   - Click "Connect VA Account"
   - Redirect to VA.gov login
   - Consent screen shows requested scopes
   - Redirect back with authorization code
   - PKCE verification and token exchange

5. **Service History API**
   - Displays veteran's service branches
   - Shows dates, discharge status

6. **Claims & Appeals APIs**
   - Live claims data
   - Appealable issues

---

## 🐛 Troubleshooting

### "Tracking Prevention blocked access to storage"

This is a browser-side warning (Edge/Chrome tracking protection). It's cosmetic and doesn't affect functionality.

### "Invalid VA.gov OAuth configuration"

**Cause**: Missing environment variables in production

**Fix**:

1. Go to Render Dashboard
2. Add `VITE_VA_CLIENT_ID` and `VITE_VA_REDIRECT_URL`
3. Redeploy

### "invalid_scope" error during OAuth

**Cause**: Requesting scopes that aren't approved for your Client ID

**Fix**:
Edit [vaAuth.js](src/config/vaAuth.js) and comment out unapproved scopes:

```javascript
export const VA_SCOPES = [
  'openid',
  'profile',
  // 'claim.read',  // Uncomment when approved
].join(' ');
```

### CORS errors in production

**Cause**: Production makes direct API calls (no dev proxy)

**Fix**: Ensure your production domain is registered at developer.va.gov

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [src/config/vaAuth.js](src/config/vaAuth.js) | OAuth configuration & scopes |
| [src/hooks/useVaAuth.js](src/hooks/useVaAuth.js) | OAuth PKCE implementation |
| [src/api/va.js](src/api/va.js) | All VA API functions |
| [src/api/vaSandbox.js](src/api/vaSandbox.js) | Sandbox-specific utilities |
| [src/components/VaSandboxTest.jsx](src/components/VaSandboxTest.jsx) | Validation dashboard |
| [render.yaml](render.yaml) | Render deployment config |
| [vite.config.js](vite.config.js) | Dev proxy configuration |

---

## 📧 Ready for Demo?

Once configured:

1. Verify all APIs work in the Sandbox Dashboard
2. Reply to Nathan Edmondson confirming readiness
3. Schedule demo call

**Technical Staff for Demo**: Anth (ajohnsonnow)
