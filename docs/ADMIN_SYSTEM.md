# Admin System Documentation

## Overview

Vet-Rate.org includes a secure admin panel for managing bug reports and feature requests. This system is designed with **gold standard security safeguards** to ensure only authorized administrators can access sensitive user feedback.

## Security Features

### 1. Hidden Access
- **No visible UI**: The admin login is completely hidden from regular users
- **Secret access**: Only accessible via `Ctrl+Shift+A` keyboard shortcut
- **No links or buttons**: No navigation elements expose admin functionality

### 2. PIN-Based Authentication
- **SHA-256 Hashing**: PINs are stored as hashed values, never plaintext
- **Salted Hashes**: Uses a unique salt to prevent rainbow table attacks
- **Constant-Time Comparison**: Prevents timing attacks during authentication

### 3. Account Lockout Protection
- **5 Failed Attempts**: Account locks after 5 consecutive failed login attempts
- **15-Minute Lockout**: Must wait 15 minutes before trying again
- **Lockout Countdown**: Visual feedback shows remaining lockout time

### 4. Session Management
- **30-Minute Timeout**: Sessions automatically expire after 30 minutes of inactivity
- **Manual Logout**: Admins can logout at any time
- **Session Timer**: Visual countdown shows time remaining in session
- **Secure Tokens**: Sessions use cryptographically random tokens

### 5. Audit Logging
- **All Events Logged**: Login attempts, logouts, failures, and lockouts
- **Timestamps**: Every action includes precise timestamps
- **IP Partial Logging**: First 3 octets of IP logged for security
- **User Agent Tracking**: Browser information recorded for suspicious activity detection

## Setup Instructions

### Step 1: Generate Your PIN Hash

```bash
# Navigate to project directory
cd e:\VS_Studio\vet-rate-org-official

# Generate hash for your chosen PIN (example: 123456)
node scripts/generate-admin-pin-hash.js YOUR_PIN_HERE
```

**PIN Requirements:**
- 4-10 digits
- Avoid obvious patterns (123456, 000000, etc.)
- Treat it like a bank PIN

### Step 2: Store the Hash

**For Development (.env.local):**
```env
VITE_ADMIN_PIN_HASH=your_generated_hash_here
```

**For Production (Render.com):**
1. Go to your Render.com dashboard
2. Navigate to your web service
3. Go to Environment tab
4. Add environment variable:
   - Name: `VITE_ADMIN_PIN_HASH`
   - Value: `your_generated_hash_here`
5. Redeploy the service

### Step 3: Restart/Redeploy

Development:
```bash
npm run dev
```

Production:
- Trigger a new deploy on Render.com

## Using the Admin Panel

### Accessing the Admin Panel

1. Press `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (Mac)
2. Enter your PIN in the login modal
3. Click "Login" or press Enter

### Admin Dashboard Features

The admin panel provides:

1. **Bug Reports Overview**
   - Total bug count
   - Status breakdown (new, investigating, resolved, etc.)
   - Search and filter capabilities
   - Export to JSON

2. **Feature Requests Overview**
   - Total request count
   - Status breakdown (new, under-review, planned, etc.)
   - Priority indicators
   - Export to JSON

3. **Quick Actions**
   - View Bug Reports (full BugLookup interface)
   - View Feature Requests (full FeatureLookup interface)
   - View Audit Log

4. **Session Information**
   - Time remaining in session
   - Quick logout button

### Viewing Audit Logs

The audit log records:
- Successful logins
- Failed login attempts
- Lockout events
- Logout events

Each entry includes:
- Timestamp
- Event type
- Associated username
- Partial IP address
- Browser user agent

## Adding New Admins

Currently, the system supports a single admin account. To add additional admins:

### Option 1: Multiple PIN Support (Recommended)

1. Generate hashes for each admin's PIN
2. Store as comma-separated values:
   ```env
   VITE_ADMIN_PIN_HASHES=hash1,hash2,hash3
   ```
3. Update `AdminAuthContext.jsx` to check against all hashes

### Option 2: Username + PIN System

For a more robust system, update the authentication to support username/PIN pairs:

```javascript
// Example structure in environment
VITE_ADMIN_CREDENTIALS=username1:hash1,username2:hash2
```

## Security Best Practices

### DO:
- ✅ Use a unique PIN you don't use elsewhere
- ✅ Log out when finished
- ✅ Monitor audit logs for suspicious activity
- ✅ Keep your .env.local file out of version control
- ✅ Change PIN periodically

### DON'T:
- ❌ Share your PIN with others
- ❌ Use obvious patterns (birthdays, 123456, etc.)
- ❌ Leave admin panel open unattended
- ❌ Commit PIN hashes to Git
- ❌ Store PINs in plaintext anywhere

## Troubleshooting

### "Invalid PIN"
- Verify you're entering the correct PIN
- Ensure the hash in environment matches the PIN
- Check that environment variable is properly set

### Account Locked
- Wait for the 15-minute lockout to expire
- Lockout counter shows remaining time

### Session Expired
- Normal behavior after 30 minutes
- Re-login with your PIN

### Admin Panel Not Opening
- Verify `Ctrl+Shift+A` keyboard shortcut
- Check browser developer console for errors
- Ensure AdminAuthProvider is wrapping the app

## Architecture

```
src/
├── contexts/
│   └── AdminAuthContext.jsx    # Auth state & security logic
├── components/
│   ├── AdminLogin.jsx          # PIN entry modal
│   ├── AdminPanel.jsx          # Main admin dashboard
│   ├── BugLookup.jsx           # Bug report management
│   └── FeatureLookup.jsx       # Feature request management
└── utils/
    ├── bugReportStorage.js     # Bug report IndexedDB
    └── featureRequestStorage.js # Feature request IndexedDB

scripts/
└── generate-admin-pin-hash.js  # PIN hash generator utility
```

## Future Enhancements

Planned improvements for the admin system:

1. **Two-Factor Authentication (2FA)** - Email or authenticator app verification
2. **Role-Based Access Control** - Different permission levels
3. **Remote Wipe** - Ability to clear local data remotely
4. **Activity Dashboard** - Real-time monitoring of user submissions
5. **Email Notifications** - Alerts for new submissions

---

**Questions?** Contact Anthony Johnson at Anth@StructuredForGrowth.com
