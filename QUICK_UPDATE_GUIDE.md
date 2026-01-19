# 🚀 QUICK UPDATE GUIDE

## Standard Update Process (5 Minutes)

### 1️⃣ **Update Version** (30 seconds)
```javascript
// src/utils/version.js
export const APP_VERSION = '1.0.1';  // ← Change this
export const SCHEMA_VERSION = '1.0.0'; // ← Only if data structure changed
export const LAST_UPDATE_DATE = '2026-01-19'; // ← Today's date
```

### 2️⃣ **Update Changelog** (1 minute)
```json
// src/data/changelog.json
{
  "version": "1.0.1",  // ← Match APP_VERSION
  "date": "2026-01-19",
  "changelog": [
    {
      "type": "fix",  // feature|fix|security|improvement|change
      "title": "Fixed Nexus Letter bug",
      "description": "Letters now export with correct formatting"
    }
  ]
}
```

### 3️⃣ **Update Server Version** (30 seconds)
```json
// public/version.json
{
  "version": "1.0.1",  // ← Match APP_VERSION
  "updateDate": "2026-01-19",
  "changelog": [ /* same as above */ ]
}
```

### 4️⃣ **Build & Deploy** (3 minutes)
```bash
npm run build
# Then deploy to Render/hosting
```

### 5️⃣ **Verify** (1 minute)
- Visit site in incognito
- Check console for migration logs
- Wait 15 min, verify update banner shows (or clear localStorage)

---

## Schema Migration (If Data Changed)

### When You Need It:
- Renamed a field
- Changed data structure
- Added required new fields

### How To Do It:
```javascript
// src/utils/migrationManager.js - Add to MIGRATIONS array:
{
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  description: 'Added painLevel field to claims',
  migrate: () => {
    const claims = JSON.parse(localStorage.getItem('vet_rate_saved_claims') || '[]');
    const migrated = claims.map(claim => ({
      ...claim,
      painLevel: claim.painLevel || 'moderate', // Default for old data
    }));
    localStorage.setItem('vet_rate_saved_claims', JSON.stringify(migrated));
  }
}
```

Then update `SCHEMA_VERSION` in `version.js`

---

## Debug User Issues

### Step 1: Get Their Data
Ask user to:
1. Click copyright text in footer **7 times rapidly**
2. Send you the downloaded JSON file

### Step 2: Load It Locally
```javascript
// In browser console on localhost:
const debugData = /* paste their JSON */;
Object.entries(debugData.localStorage).forEach(([key, value]) => {
  localStorage.setItem(key, value);
});
location.reload();
```

Now you see exactly what they see!

---

## Emergency Fixes

### Hotfix Process:
1. Fix the bug in code
2. Increment **PATCH** version (1.0.0 → 1.0.1)
3. Add to changelog as "fix" type
4. Deploy immediately
5. Users auto-update within 15 minutes

### User Has Corrupted Data:
Ask them to run in console:
```javascript
localStorage.clear();
location.reload();
```
⚠️ They'll lose unsaved work - suggest export first if possible

---

## Common Tasks

### Test Update Banner Locally:
```javascript
// Console:
localStorage.setItem('vet_rate_app_version', '0.9.0');
location.reload();
// Should see banner
```

### Force "What's New" Modal:
```javascript
// Console:
localStorage.removeItem('vet_rate_last_seen_version');
location.reload();
```

### Check User's Version:
```javascript
// Console:
console.log('App:', localStorage.getItem('vet_rate_app_version'));
console.log('Schema:', localStorage.getItem('vet_rate_data_schema_version'));
```

---

## Version Number Rules

| Change Type | Version | Example |
|-------------|---------|---------|
| Bug fix | PATCH | 1.0.0 → 1.0.1 |
| New feature | MINOR | 1.0.0 → 1.1.0 |
| Breaking change | MAJOR | 1.0.0 → 2.0.0 |

---

## Files to Update Every Deploy

✅ `src/utils/version.js` - APP_VERSION  
✅ `src/data/changelog.json` - Add new entry  
✅ `public/version.json` - Match version  
❓ `src/utils/migrationManager.js` - Only if schema changed  

---

## Testing Checklist

Before deploy:
- [ ] Built successfully (`npm run build`)
- [ ] Tested in incognito (clean slate)
- [ ] Tested with old user data (export/import)
- [ ] Verified version numbers match across files
- [ ] Changelog entries look good

After deploy:
- [ ] Site loads correctly
- [ ] Console shows no errors
- [ ] Debug dump works (7 clicks)
- [ ] Update banner appears (after 15 min or force test)

---

**Keep this guide handy for every update! 📌**
