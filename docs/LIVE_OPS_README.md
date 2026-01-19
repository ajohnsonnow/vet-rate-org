# 🛡️ Live Operations System

## Overview

This system protects your users' data and ensures smooth updates when you push changes to production. It consists of four integrated components:

## Components

### 1. Version Management (`src/utils/version.js`)
Single source of truth for app versioning.
- `APP_VERSION` - Current application version
- `SCHEMA_VERSION` - Data structure version  
- Version constants used throughout the app

### 2. Migration Manager (`src/utils/migrationManager.js`)
Automatically migrates user data when schema changes.
- Runs on every app load
- Detects outdated user data
- Applies migrations in sequence
- Logs results to console

### 3. Update Checker (`src/utils/updateChecker.js`)
Monitors for new versions from the server.
- Checks `/version.json` every 15 minutes
- Compares server version with local version
- Triggers banner when update available
- Supports manual checks

### 4. Debug Dump (`src/utils/debugDump.js`)
Hidden diagnostic tool for troubleshooting.
- Activated by clicking copyright 7 times
- Downloads complete localStorage state
- Includes browser/system metadata
- Essential for remote debugging

## UI Components

### UpdateBanner (`src/components/UpdateBanner.jsx`)
Non-intrusive notification bar at top of screen.
- Appears when update detected
- "Update Now" button forces hard reload
- Can be dismissed temporarily

### WhatsNewModal (`src/components/WhatsNewModal.jsx`)
Changelog display after updates.
- Shows once per version
- Reads from `changelog.json`
- Categorized by update type
- Dismissible

## Data Files

### `public/version.json`
Server-side version for update detection.
```json
{
  "version": "1.0.0",
  "updateDate": "2026-01-18",
  "changelog": []
}
```

### `src/data/changelog.json`
Full changelog history.
```json
{
  "version": "1.0.0",
  "updates": [...]
}
```

## How It Works

### On App Load:
1. **Migration Check** - `migrateUserData()` runs first
2. **Version Check** - Compare user's last seen version
3. **Changelog Display** - Show "What's New" if new version
4. **Update Checker** - Start monitoring for server updates

### On Update Available:
1. **Detection** - Server version > local version
2. **Banner** - `UpdateBanner` slides down from top
3. **User Action** - Click "Update Now"
4. **Hard Reload** - `window.location.reload(true)` bypasses cache

### On User Reports Issue:
1. **Debug Dump** - User clicks copyright 7 times
2. **Download** - Full localStorage exported as JSON
3. **Analysis** - Developer loads dump locally
4. **Reproduce** - See exact user state

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `vet_rate_app_version` | User's current app version |
| `vet_rate_data_schema_version` | User's data structure version |
| `vet_rate_last_seen_version` | Last changelog version shown |

## Integration Points

### App.jsx
- Imports all live ops utilities
- Runs migration on mount
- Manages update banner state
- Handles "What's New" modal
- Adds debug dump to footer

### Footer (App.jsx)
- Copyright text is clickable (invisible)
- 7 rapid clicks trigger debug dump
- Visual notification on activation

## Architecture Decisions

### Why Client-Side Versioning?
- No server dependencies
- Works with static hosting
- User data never leaves browser
- Privacy-first approach

### Why 15-Minute Check Interval?
- Balance between freshness and server load
- Fast enough for critical updates
- Slow enough to avoid spam

### Why 7 Clicks for Debug?
- Prevents accidental activation
- Easy to communicate to users
- Fast enough when needed
- Hidden from casual users

### Why Hard Reload?
- Bypasses service worker cache
- Bypasses browser cache
- Bypasses CDN cache
- Ensures fresh code

## Best Practices

### DO:
✅ Test migrations with real user data  
✅ Increment versions properly (semantic versioning)  
✅ Keep old migrations forever (history)  
✅ Log everything to console  
✅ Update all version files together  

### DON'T:
❌ Delete old migrations  
❌ Skip version numbers  
❌ Change SCHEMA_VERSION without migration  
❌ Test only with clean slate  
❌ Deploy without updating changelog  

## Monitoring

### Success Indicators:
- No console errors on app load
- Migration logs show "✅ User data is current"
- Update banner appears when expected
- Debug dump downloads successfully

### Warning Signs:
- Migration errors in console
- Users report "broken" app
- Update banner doesn't appear
- Version mismatch errors

## Troubleshooting

See [`LIVE_OPS_PROTOCOL.md`](./LIVE_OPS_PROTOCOL.md) for detailed troubleshooting guide.

Quick fixes:
- **Update not showing:** Check `version.json` accessibility
- **Migration failed:** Check console logs, verify migration code
- **Data corrupted:** Guide user to emergency reset
- **Can't reproduce bug:** Request debug dump from user

## Testing

### Local Testing:
```javascript
// Force old version
localStorage.setItem('vet_rate_app_version', '0.9.0');
location.reload();

// Force migration
localStorage.setItem('vet_rate_data_schema_version', '0.9.0');
location.reload();

// Force changelog
localStorage.removeItem('vet_rate_last_seen_version');
location.reload();

// Test debug dump
// Click copyright 7 times rapidly
```

### Production Testing:
1. Deploy update with version bump
2. Visit site in incognito (clean slate)
3. Check console logs
4. Wait 15 minutes or force check
5. Verify banner appears
6. Click "Update Now"
7. Verify hard reload occurs

## Maintenance

### Regular Tasks:
- Review migration logs after each deploy
- Monitor for failed migrations
- Keep changelog up to date
- Test debug dump quarterly
- Archive old changelog entries annually

### When to Update:
- **version.js:** Every deploy
- **changelog.json:** Every deploy  
- **version.json:** Every deploy
- **migrationManager.js:** Only on schema changes
- **Other files:** Rarely (bug fixes, features)

## Future Enhancements

Potential improvements:
- Server-side migration tracking
- Automatic rollback on failure
- A/B testing for updates
- Progressive rollout (%)
- Update history viewer
- Migration dry-run mode

## Credits

Built for veterans, by a veteran. This system ensures your updates never break a veteran's work on their disability claim.

**Status:** Production Ready ✅  
**Last Updated:** 2026-01-18  
**Maintainer:** Anthony Johnson
