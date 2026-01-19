# Terms of Service - Quick Testing Guide

## 🧪 How to Test the ToS Implementation

### Test 1: First-Visit Modal
**Objective:** Verify the clickwrap modal appears on first visit

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Local Storage** → `localhost` or your domain
4. Delete these keys (if they exist):
   - `vet-rate-tos-accepted`
   - `vet-rate-tos-accepted-date`
5. Refresh the page (F5)
6. **Expected Result:** Full-screen ToS modal appears immediately

### Test 2: Countdown Timer
**Objective:** Verify 3-second forced delay

1. Trigger the modal (see Test 1)
2. Observe the button at bottom-right
3. **Expected Results:**
   - Button is gray and disabled
   - Shows "Please Read (3s)"
   - Counts down: "(2s)" → "(1s)" → "(0s)"
   - After 3 seconds, button turns green
   - Text changes to "I Understand & Accept the Risks"
   - Button becomes clickable

### Test 3: Cannot Close Without Accepting
**Objective:** Verify modal cannot be bypassed

1. Trigger the modal
2. Try these actions:
   - Press ESC key
   - Click outside modal (on dark background)
   - Use browser back button
   - Right-click anywhere
3. **Expected Result:** Modal remains open, site is inaccessible

### Test 4: Acceptance & Storage
**Objective:** Verify localStorage is set correctly

1. Trigger the modal
2. Wait for countdown (3 seconds)
3. Click "I Understand & Accept the Risks"
4. Open DevTools → Application/Storage → Local Storage
5. **Expected Results:**
   - Key `vet-rate-tos-accepted` = `"true"`
   - Key `vet-rate-tos-accepted-date` = ISO timestamp (e.g., "2026-01-18T12:34:56.789Z")
   - Modal closes and site is now accessible

### Test 5: Returning Visitor
**Objective:** Verify modal doesn't show again

1. Accept the ToS (see Test 4)
2. Close browser completely
3. Reopen browser and navigate to site
4. **Expected Result:** Modal does NOT appear, direct access to site

### Test 6: Footer Links
**Objective:** Verify ToS page is accessible

1. Scroll to footer
2. Find **"�-️ Legal Notice"** section
3. Click **"Terms of Service →"** button
4. **Expected Result:** Full ToS page opens
5. Click **"Close"** button
6. **Expected Result:** Returns to main site

**Alternative:**
1. Scroll to footer navigation links
2. Find **"Terms of Service"** link (between "Contact Us" and "Forms Helper")
3. Click it
4. **Expected Result:** Same as above

### Test 7: Responsive Design
**Objective:** Verify mobile compatibility

**Desktop (1920x1080):**
- Modal should be centered, max-width ~1024px
- All text readable
- Countdown visible

**Tablet (768x1024):**
- Modal should adapt, slightly narrower
- All sections still readable
- Button remains accessible

**Mobile (375x667):**
- Modal should be full-screen with scroll
- Text should wrap properly
- Button should be visible and tappable
- No horizontal scroll

**Testing Method:**
1. Open DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select different devices
4. Trigger modal and test

### Test 8: Keyboard Navigation
**Objective:** Verify accessibility

1. Trigger modal
2. Use **TAB** key to navigate
3. **Expected Results:**
   - Can scroll content with arrow keys
   - Focus visible on button when reached
   - Can activate button with ENTER/SPACE (after countdown)

### Test 9: Link Functionality
**Objective:** Verify external links work

1. Open ToS modal or page
2. Find **"VA.gov/ogc/accreditation.asp"** link (Section 1)
3. Click it
4. **Expected Results:**
   - Opens in new tab (`target="_blank"`)
   - Navigates to VA website
   - Original tab remains on Vet-Rate.org

### Test 10: Content Verification
**Objective:** Ensure all 5 Kill Clauses are present

Read through modal, verify these sections exist:

- [x] **1. Non-Accreditation Clause** (38 U.S.C. § 5901)
  - States NOT a VSO, attorney, or claims agent
  - Link to VA.gov accreditation search
  
- [x] **2. Not Medical Advice**
  - States tools are organizational, not diagnostic
  - Must obtain proper medical evidence
  
- [x] **3. AI Accuracy Disclaimer**
  - Acknowledges AI can make errors
  - User must verify all content
  
- [x] **4. Data Volatility Warning**
  - Red warning box about data loss
  - Explains localStorage-only architecture
  - "WE CANNOT RECOVER YOUR DATA" statement
  
- [x] **5. No Guarantees**
  - No promises of claim approval
  - Lists factors beyond control

---

## 🐛 Troubleshooting

### Modal Won't Appear
**Problem:** Cleared localStorage but modal still doesn't show

**Solution:**
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload(true); // Hard refresh
```

### Modal Shows Every Time
**Problem:** Modal appears on every visit despite accepting

**Possible Causes:**
1. Browser in Private/Incognito mode (localStorage doesn't persist)
2. Browser settings auto-clear data on close
3. Privacy extension blocking localStorage
4. Check: Is localStorage key actually being set?

**Debug:**
```javascript
// In console after accepting:
console.log(localStorage.getItem('vet-rate-tos-accepted')); // Should be "true"
console.log(localStorage.getItem('vet-rate-tos-accepted-date')); // Should be ISO date
```

### Button Stuck Disabled
**Problem:** Countdown finishes but button stays disabled

**Check:**
1. Open DevTools → Console
2. Look for JavaScript errors
3. Verify React state is updating
4. Hard refresh (Ctrl+F5)

### Styling Issues
**Problem:** Modal looks broken or unstyled

**Possible Causes:**
1. Tailwind CSS not loading
2. Build process not complete
3. CSS purging removed needed classes

**Solution:**
```bash
npm run build
# or
npm run dev
```

---

## 📋 Quick Commands

### Force Modal to Show Again
```javascript
// Browser console:
localStorage.removeItem('vet-rate-tos-accepted');
localStorage.removeItem('vet-rate-tos-accepted-date');
location.reload();
```

### Check if User Has Accepted
```javascript
// Browser console:
const hasAccepted = localStorage.getItem('vet-rate-tos-accepted') === 'true';
console.log('User has accepted ToS:', hasAccepted);

if (hasAccepted) {
  const acceptedDate = localStorage.getItem('vet-rate-tos-accepted-date');
  console.log('Accepted on:', new Date(acceptedDate).toLocaleString());
}
```

### Reset All ToS Data
```javascript
// Browser console:
localStorage.removeItem('vet-rate-tos-accepted');
localStorage.removeItem('vet-rate-tos-accepted-date');
console.log('ToS data reset - refresh to see modal');
```

---

## ✅ Pre-Launch Checklist

Before deploying to production:

- [ ] All 10 tests above passed
- [ ] Tested on Chrome/Edge
- [ ] Tested on Firefox
- [ ] Tested on Safari (if applicable)
- [ ] Tested on mobile devices
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility checked
- [ ] External links open in new tabs
- [ ] No console errors
- [ ] localStorage works across page reloads
- [ ] Modal content is readable (plain English)
- [ ] All 5 Kill Clauses are present and clear
- [ ] Legal review completed (if possible)
- [ ] "Last Updated" date is correct
- [ ] Footer links point to correct components

---

## 🚀 Deployment Notes

### After Deployment:
1. Test on live domain (not just localhost)
2. Verify localStorage works across domain
3. Check HTTPS doesn't interfere with localStorage
4. Test with real users (small group first)
5. Monitor for issues in first 48 hours

### User Feedback to Monitor:
- Are users reading the terms? (track acceptance time)
- Any confusion about requirements?
- Any accessibility issues reported?
- Modal displaying correctly on all devices?

---

## 📞 Support

If you encounter issues during testing:

1. Check browser console for errors
2. Verify React app is running (`npm run dev`)
3. Check that all files exist:
   - `src/components/TermsOfServiceModal.jsx`
   - `src/components/TermsOfServicePage.jsx`
   - `src/App.jsx` (with ToS imports)
4. Try hard refresh (Ctrl+Shift+R)
5. Clear all browser data and retry

---

**Testing completed?** Check off items in Pre-Launch Checklist above.

**All tests passing?** You're ready to deploy the legal framework! 🛡️
