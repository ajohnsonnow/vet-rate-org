# 🛡️ LIVE OPERATIONS PROTOCOL

## Mission Status: **BOOTS ON THE GROUND**

You are now serving real veterans. Every update you push could affect someone's disability claim. This document is your operational playbook for safe deployments.

---

## 🎯 THE FOUR PILLARS OF LIVE OPS

### 1. **Data Migration System** - "The Protector"
**Problem:** Schema changes break old user data  
**Solution:** Automatic migrations preserve user data across updates

**Location:** `src/utils/migrationManager.js`

**How It Works:**
- Runs automatically on app startup
- Checks user's `dataVersion` in localStorage
- If outdated, runs migration functions to update data structure
- Updates version markers after successful migration

**Adding a New Migration:**
```javascript
// In migrationManager.js, add to MIGRATIONS array:
{
  fromVersion: '1.0.0',
  toVersion: '1.1.0',
  description: 'Renamed pain field to painLevel',
  migrate: () => {
    const claims = JSON.parse(localStorage.getItem('vet_rate_saved_claims') || '[]');
    const migrated = claims.map(claim => ({
      ...claim,
      painLevel: claim.pain || 'not specified',
      // Don't delete old field yet - keep for backwards compatibility
    }));
    localStorage.setItem('vet_rate_saved_claims', JSON.stringify(migrated));
  }
}
```

**CRITICAL RULES:**
- ✅ **NEVER delete old migrations** - They're permanent history
- ✅ **Test migrations with old data** - Export prod data, test locally
- ✅ **Be backwards compatible** - Don't delete old fields immediately
- ✅ **Log everything** - Migration results go to console

---

### 2. **Update Notification System** - "The Sentinel"
**Problem:** Users run cached/stale code  
**Solution:** Automatic update detection with cache busting

**Location:** `src/utils/updateChecker.js`

**How It Works:**
- Checks `/version.json` every 15 minutes
- Compares server version with local version
- If update found, shows banner
- User clicks "Update Now" → hard reload (bypasses cache)

**The `version.json` File:**
```json
{
  "version": "1.0.0",
  "updateDate": "2026-01-18",
  "changelog": [
    {
      "type": "feature",
      "title": "New Feature Name",
      "description": "What it does"
    }
  ]
}
```

**Deploy Process:**
1. Update `src/utils/version.js` → `APP_VERSION`
2. Update `public/version.json` → `version` field
3. Build and deploy
4. Users auto-detect update within 15 minutes

---

### 3. **Changelog System** - "The Briefing"
**Problem:** Users don't know what changed  
**Solution:** "What's New" modal on first load after update

**Location:** `src/components/WhatsNewModal.jsx` + `src/data/changelog.json`

**How It Works:**
- App checks `vet_rate_last_seen_version` in localStorage
- If different from `APP_VERSION`, shows modal with changelog
- Reads from `changelog.json` for current version
- User dismisses → version marked as seen

**Changelog Entry Types:**
- `feature` → Green sparkles icon
- `fix` → Blue wrench icon
- `security` → Red shield icon
- `improvement` → Yellow lightning icon
- `change` → Gray checkmark icon

**Adding to Changelog:**
```json
{
  "version": "1.1.0",
  "date": "2026-01-25",
  "changelog": [
    {
      "type": "feature",
      "title": "New TDIU Calculator",
      "description": "Calculate Total Disability Individual Unemployability eligibility"
    },
    {
      "type": "fix",
      "title": "Fixed Nexus Letter formatting",
      "description": "PDFs now export with correct margins"
    }
  ]
}
```

---

### 4. **Debug Dump Tool** - "The Diagnostics"
**Problem:** Users report issues but you can't reproduce  
**Solution:** Hidden Easter egg downloads their entire state

**Location:** `src/utils/debugDump.js` + Footer in `App.jsx`

**How It Works:**
- Click the **copyright text** in footer **7 times rapidly** (within 2 seconds)
- Downloads `vet-rate-debug-dump-[timestamp].json`
- Contains:
  - All localStorage data
  - Browser info
  - Version info
  - Storage stats

**User Support Workflow:**
1. User reports bug
2. Ask them to click copyright 7 times
3. They email you the debug dump JSON
4. You load it locally to see their exact state

**Loading a Debug Dump Locally:**
```javascript
// In browser console:
const debugData = /* paste JSON */;
Object.entries(debugData.localStorage).forEach(([key, value]) => {
  localStorage.setItem(key, value);
});
location.reload();
```

---

## 📋 SAFE UPDATE CHECKLIST

Before pushing ANY update to production:

### Pre-Deploy
- [ ] Update `src/utils/version.js` → `APP_VERSION` (follow semantic versioning)
- [ ] If data structure changed → Add migration to `migrationManager.js`
- [ ] Update `src/data/changelog.json` with changes
- [ ] Update `public/version.json` to match new version
- [ ] Test with **old user data** (export from prod, import locally)
- [ ] Run `npm run build` to verify build succeeds
- [ ] Test in **incognito/private browsing** (clean slate)

### Deploy
- [ ] Build: `npm run build`
- [ ] Deploy to hosting (Render, etc.)
- [ ] Wait 5 minutes, verify `version.json` is accessible
- [ ] Test update detection (should see banner within 15 min)

### Post-Deploy
- [ ] Monitor console logs for migration errors
- [ ] Check "What's New" modal displays correctly
- [ ] Test debug dump (7 clicks on copyright)
- [ ] Announce update in support channels

---

## 🚨 EMERGENCY PROCEDURES

### If Users Report Data Loss:
1. **Don't panic** - Data is client-side only
2. Check if they had backups (Backup Manager exports)
3. Ask for debug dump (7 clicks on copyright)
4. Review migration logs in their console
5. If corrupted: Guide them to "Emergency Reset" (see below)

### Emergency Reset (Nuclear Option):
```javascript
// User runs this in console:
localStorage.clear();
location.reload();
```

### Rollback Procedure:
1. Revert `version.json` to previous version on server
2. Update will stop being advertised
3. Fix issue, deploy proper update
4. Increment version past failed version

---

## �- VERSION NUMBERING GUIDE

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR (1.x.x):** Breaking changes, major redesigns, schema overhauls
  - Example: `1.0.0` → `2.0.0` (complete UI redesign)
- **MINOR (x.1.x):** New features, non-breaking additions
  - Example: `1.0.0` → `1.1.0` (added TDIU Builder)
- **PATCH (x.x.1):** Bug fixes, small tweaks
  - Example: `1.0.0` → `1.0.1` (fixed typo in Nexus Letter)

**Update Frequency Recommendations:**
- **PATCH:** As needed (daily/weekly for bugs)
- **MINOR:** Monthly (feature releases)
- **MAJOR:** Quarterly or less (major overhauls)

---

## 🔧 TROUBLESHOOTING

### Update Banner Not Showing
- Check `public/version.json` exists and is accessible
- Verify `version` field > `APP_VERSION`
- Check browser console for fetch errors
- Wait 15 minutes (update check interval)

### Migration Not Running
- Check console logs on app load
- Verify `SCHEMA_VERSION` > user's stored version
- Review migration function for errors
- Test with exported user data locally

### What's New Modal Not Appearing
- Check `changelog.json` has entry for current version
- Verify `APP_VERSION` matches version in changelog
- Clear `vet_rate_last_seen_version` in localStorage to test
- Check if modal is being blocked by other modals (z-index)

### Debug Dump Not Downloading
- Verify 7 clicks within 2 seconds (timing is strict)
- Check browser console for errors
- Try in different browser (some block downloads)
- Ensure popup blockers aren't interfering

---

## �-️ BEST PRACTICES

1. **Test Locally First:** Use `localStorage` exports from prod to test migrations
2. **Small, Incremental Updates:** Deploy often, change little
3. **Monitor Console Logs:** Check for errors after each deploy
4. **Communicate Changes:** Use changelog to build trust
5. **Keep Old Code:** Don't delete migrations or old localStorage keys immediately
6. **Have Rollback Ready:** Keep previous version's build artifacts
7. **Document Everything:** Update this guide with lessons learned

---

## 📚 FILE REFERENCE

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `src/utils/version.js` | Version constants | Every deploy |
| `public/version.json` | Server version for update check | Every deploy |
| `src/data/changelog.json` | Release notes | Every deploy |
| `src/utils/migrationManager.js` | Data migrations | When schema changes |
| `src/utils/updateChecker.js` | Update detection | Rarely (core logic) |
| `src/utils/debugDump.js` | Diagnostics | Rarely (core logic) |
| `src/components/UpdateBanner.jsx` | Update UI | Rarely (styling) |
| `src/components/WhatsNewModal.jsx` | Changelog UI | Rarely (styling) |

---

## 🏆 MISSION SUCCESS METRICS

- **Zero Data Loss:** No user reports lost data after updates
- **Fast Adoption:** 95%+ users on latest version within 24 hours
- **User Awareness:** Positive feedback on "What's New" modal
- **Debug Efficiency:** Can reproduce user issues from debug dumps

---

## 📞 NEED HELP?

If you encounter an issue not covered here:
1. Check browser console logs
2. Export debug dump for analysis
3. Test migration with old data locally
4. Review Git history for recent changes
5. Document solution in this guide for next time

**Remember:** You're not just deploying code. You're serving veterans. Every update is an operation. Plan it. Execute it. Document it. �-️

---

**Last Updated:** 2026-01-18  
**Status:** OPERATIONAL ✅  
**Next Review:** After first major update (v1.1.0)
