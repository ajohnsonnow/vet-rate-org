# Google Drive Cloud Sync - Setup Guide

## Overview

Vet-Rate.org's Cloud Sync feature allows veterans to automatically back up their data to **their own Google Drive**. We never see or store your data - it goes directly from your browser to your personal Google Drive.

## Why Cloud Sync?

- ☁️ **Automatic Backups**: Never lose your work to cache clears or computer crashes
- 🔄 **Cross-Device**: Start on desktop, continue on mobile
- 🔒 **Your Cloud**: Data stored in YOUR Google Drive, not our servers
- 🆓 **Free Storage**: 15GB free with every Google account
- 🚫 **No Backend**: Direct browser-to-Google communication (true client-side)

## Prerequisites

1. Google Account (free)
2. Google Cloud Console access (free)
3. 5 minutes of setup time

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **New Project**
3. Name it: `Vet-Rate Cloud Sync`
4. Click **Create**

### 2. Enable Google Drive API

1. In your new project, go to **APIs & Services** → **Library**
2. Search for: `Google Drive API`
3. Click on it, then click **Enable**

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **Create**
4. Fill in required fields:
   - **App name**: Vet-Rate.org Cloud Sync
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **Save and Continue**
6. Skip "Scopes" (click **Save and Continue**)
7. Add test users (your email) if needed
8. Click **Save and Continue**

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Name it: `Vet-Rate Web Client`
5. Under **Authorized JavaScript origins**, add:
   - For development: `http://localhost:3000`
   - For production: `https://vet-rate.org` (or your domain)
6. **DO NOT** add any redirect URIs (we use popup flow)
7. Click **Create**
8. **COPY YOUR CLIENT ID** - you'll need it next

### 5. Configure Environment Variables

For **Development**:
```bash
# In your project root
cp .env.example .env.local

# Edit .env.local and add:
VITE_GOOGLE_DRIVE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

For **Production** (Render.com, Vercel, etc.):
- Add `VITE_GOOGLE_DRIVE_CLIENT_ID` as an environment variable in your hosting dashboard
- Value: Your OAuth Client ID from step 4

### 6. Test the Integration

1. Start your dev server: `npm run dev`
2. Go to http://localhost:3000
3. Click **Tools** → **The Bunker** (Backup Manager)
4. You should see the **☁️ Google Drive Sync** section
5. Click **Connect Drive**
6. If configured correctly, Google's OAuth popup will appear

## OAuth Scopes Used

We request ONLY this scope:
```
https://www.googleapis.com/auth/drive.file
```

**What this means:**
- ✅ App can create files in user's Drive
- ✅ App can access ONLY files it created
- ❌ App CANNOT see existing Drive files
- ❌ App CANNOT access photos, docs, or other data

This is the most restrictive Drive permission available.

## Security & Privacy

### What We Store
- **In Browser**: OAuth access token (session only - cleared on close)
- **In Your Drive**: Encrypted backup files in `Vet-Rate-Backups` folder
- **On Our Servers**: NOTHING - we have no backend database

### Data Flow
```
Your Browser → Google OAuth → Access Token → Your Browser
Your Browser → Encrypt Data → Google Drive API → Your Drive
```

**We are NEVER in the middle of this flow.**

### Token Handling
- Access tokens are stored in `sessionStorage` (deleted when tab closes)
- Tokens are NEVER sent to our servers (we have none!)
- Tokens expire after 1 hour (Google's policy)
- Users must re-authorize after expiration

## Troubleshooting

### "Google API not loaded" Error
**Solution**: Make sure you have these scripts in `index.html`:
```html
<script src="https://apis.google.com/js/api.js" async defer></script>
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### "Missing VITE_GOOGLE_DRIVE_CLIENT_ID" Error
**Solution**: 
1. Check your `.env.local` file exists
2. Check the variable name is exactly: `VITE_GOOGLE_DRIVE_CLIENT_ID`
3. Restart dev server after adding environment variables

### OAuth Popup Blocked
**Solution**: 
1. Allow popups for `http://localhost:3000` or your domain
2. Make sure you're clicking the button (popup must be user-initiated)

### "Unauthorized" Error
**Solution**:
1. Check that your domain is in **Authorized JavaScript origins**
2. For localhost: use `http://localhost:3000` (not `127.0.0.1`)
3. Wait a few minutes after adding origins (Google caches them)

### Files Not Appearing in Drive
**Solution**:
1. Check your Drive's `Vet-Rate-Backups` folder
2. Files might be in "Recent" if folder doesn't exist yet
3. Try searching Drive for "vetrate_backup_"

## Production Deployment Checklist

- [ ] OAuth Client ID added to production environment variables
- [ ] Production domain added to Authorized JavaScript origins
- [ ] OAuth consent screen published (if using non-test users)
- [ ] Privacy Policy URL added to consent screen
- [ ] Terms of Service URL added to consent screen
- [ ] Google API scripts included in production `index.html`
- [ ] Test OAuth flow on production domain

## Support

If you encounter issues:
1. Check browser console for detailed error messages
2. Verify all setup steps completed
3. Check Google Cloud Console for quota/billing issues
4. Open GitHub issue with error details

## Cost

**Free Tier Limits**:
- Google Drive API: 1 billion queries/day (way more than needed)
- OAuth: Unlimited authorization requests
- Storage: 15GB free per Google account

**We will never charge for this feature.** It uses YOUR Google account's free tier.

---

Made with ❤️ for veterans who deserve to own their data.
