# ✅ DEPLOYMENT CHECKLIST - v1.0.0

## Pre-Flight Check (Do this before EVERY deploy)

### 1. Version Files Updated
- [ ] `src/utils/version.js` - APP_VERSION = "1.0.0"
- [ ] `src/utils/version.js` - SCHEMA_VERSION = "1.0.0"
- [ ] `src/utils/version.js` - LAST_UPDATE_DATE = "2026-01-18"
- [ ] `src/data/changelog.json` - Entry added for v1.0.0
- [ ] `public/version.json` - version = "1.0.0"

### 2. Code Quality
- [ ] `npm run build` completes without errors
- [ ] No console errors in development
- [ ] All new features tested manually
- [ ] Existing features still work

### 3. Data Safety
- [ ] If schema changed: Migration added to `migrationManager.js`
- [ ] Migration tested with old user data (export/import test)
- [ ] Backwards compatibility verified

### 4. Documentation
- [ ] Changelog entries are clear and user-friendly
- [ ] Breaking changes clearly documented
- [ ] Update type correct (feature/fix/security/improvement/change)

---

## Build Process

```bash
# 1. Clean install
npm ci

# 2. Run build
npm run build

# 3. Verify build output
ls -la dist/
```

Expected output:
- `dist/index.html`
- `dist/assets/` folder with JS/CSS
- `dist/version.json`

---

## Deploy to Render

### Method 1: Git Push (Automatic)
```bash
git add .
git commit -m "chore: release v1.0.0"
git push origin main
```
Render auto-deploys from main branch.

### Method 2: Manual Deploy
1. Go to Render dashboard
2. Select your service
3. Click "Manual Deploy"
4. Select branch: main
5. Click "Deploy"

---

## Post-Deploy Verification (CRITICAL)

### Immediate Checks (0-5 minutes)
- [ ] Site loads at production URL
- [ ] No 404 errors in browser console
- [ ] `version.json` is accessible: `https://your-site.com/version.json`
- [ ] Copyright shows "© 2024-2026"

### Version System Checks (5-10 minutes)
- [ ] Open site in **incognito/private browsing**
- [ ] Open browser console (F12)
- [ ] Look for: "🛡️ LIVE OPS: Initializing protection systems..."
- [ ] Should see: "✅ User data is current. No migration needed." (first-time users)
- [ ] Or: "🆕 First-time user detected. Initializing at current schema version."

### Update Detection Test (10-15 minutes)
Option A - Wait naturally:
- [ ] Wait 15 minutes
- [ ] Update banner should appear

Option B - Force test:
```javascript
// In console:
localStorage.setItem('vet_rate_app_version', '0.9.0');
location.reload();
// Should see blue update banner at top
```

### What's New Modal Test
```javascript
// In console:
localStorage.removeItem('vet_rate_last_seen_version');
location.reload();
// Should see "What's New" modal
```

### Debug Dump Test
- [ ] Click copyright text in footer 7 times rapidly
- [ ] Should see purple notification: "🐛 Debug dump downloaded!"
- [ ] File downloads: `vet-rate-debug-dump-[timestamp].json`
- [ ] Open file - should contain localStorage data and metadata

---

## Rollback Procedure (If Something Goes Wrong)

### Quick Rollback
1. Go to Render dashboard
2. Navigate to your service
3. Click "Rollback" to previous deploy
4. Confirm rollback

### Manual Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main
```

### Emergency Version Lock
Update `public/version.json` on server to previous version:
```json
{
  "version": "0.9.9",
  "updateDate": "2026-01-17",
  "changelog": []
}
```
This stops the update banner from appearing.

---

## User Communication

### Announce Update (Optional but Recommended)
Post to support channels:
```
🎉 Update v1.0.0 is live!

What's new:
- Live Operations Protection System
- Automatic update notifications  
- What's New changelog
- Enhanced data safety

Your saved data is protected. The app will notify you of future updates automatically.

All updates happen automatically - no action needed! �-️
```

---

## Monitoring (First 24 Hours)

### Watch for:
- [ ] Error reports from users
- [ ] Browser console errors
- [ ] Migration failures
- [ ] Update detection issues
- [ ] Performance problems

### Where to Check:
- Email support
- Bug reports (via BugSquasher)
- Render logs
- Browser console (test accounts)

---

## Success Criteria

✅ **Deploy is successful if:**
- Site loads without errors
- Version system initializes correctly  
- Update detection works
- Debug dump activates
- No user reports of data loss
- 95%+ users see update within 24 hours

---

## Post-Deploy Tasks

### Within 1 Hour:
- [ ] Test all critical features
- [ ] Verify version numbers in console
- [ ] Check Render logs for errors
- [ ] Test on mobile device

### Within 24 Hours:
- [ ] Monitor for user bug reports
- [ ] Check update adoption rate (if trackable)
- [ ] Review Render analytics
- [ ] Document any issues encountered

### Within 1 Week:
- [ ] Update `LIVE_OPS_PROTOCOL.md` with lessons learned
- [ ] Archive old debug dumps
- [ ] Plan next update

---

## Common Issues & Solutions

### Issue: Update banner not appearing
**Solution:** Verify `version.json` is accessible and version number is higher

### Issue: Migration errors in console
**Solution:** Check migration code, test with old data, may need hotfix

### Issue: "What's New" modal not showing
**Solution:** Check changelog.json entry exists for current version

### Issue: Debug dump not downloading
**Solution:** Check browser blocks popups, try different browser, check console for errors

### Issue: Users report "broken" app
**Solution:** Request debug dump, check for migration failures, may need to guide user to reset

---

## Next Steps

After successful v1.0.0 deploy:
1. Monitor for 24 hours
2. Address any urgent issues
3. Plan v1.0.1 (bug fixes) or v1.1.0 (new features)
4. Update this checklist with lessons learned

---

**Date:** 2026-01-18  
**Version:** 1.0.0  
**Status:** READY FOR DEPLOY ✅  
**Risk Level:** LOW (First deploy with protection systems)

---

## Sign-Off

I have reviewed this checklist and verified all items:

**Deployer:** _______________  
**Date:** _______________  
**Deploy Time:** _______________  
**Result:** ⬜ Success ⬜ Issues (document below)

**Notes:**
_______________________________________
_______________________________________
_______________________________________
