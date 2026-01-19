# Vet-Rate.org QA Battle Drill Checklist
## Freeze Phase Testing - Complete Robustness Validation

**Test Date:** _____________  
**Tester:** _____________  
**Version:** _____________  

---

## Section 1: Legal Safeguards Testing

### 1.1 Draft Watermarks
- [ ] **Test:** Generate an AI-enhanced nexus statement
- [ ] **Verify:** "DRAFT - FOR VETERAN REVIEW ONLY" watermark appears at top of content
- [ ] **Test:** Generate an AI-enhanced buddy statement
- [ ] **Verify:** Draft watermark appears on AI-generated content
- [ ] **Expected:** Watermark should be prominent and impossible to miss

### 1.2 Certification Checkbox
- [ ] **Test:** Navigate to Nexus Builder review step
- [ ] **Verify:** Certification checkbox appears above download buttons
- [ ] **Test:** Try to click download button WITHOUT checking certification
- [ ] **Expected:** Button should be disabled and show tooltip "Please certify..."
- [ ] **Test:** Check certification checkbox
- [ ] **Expected:** Download button should become enabled
- [ ] **Test:** Uncheck certification checkbox
- [ ] **Expected:** Download button should become disabled again
- [ ] **Test:** Repeat for Witness Bench buddy statements
- [ ] **Verify:** Same certification behavior works correctly

### 1.3 AI Warning Banners
- [ ] **Test:** Generate AI content in Nexus Builder
- [ ] **Verify:** Yellow warning banner appears with text about verifying legal references
- [ ] **Test:** Generate AI content in Witness Bench  
- [ ] **Verify:** Warning banner appears with hallucination warning
- [ ] **Expected:** Warning should be highly visible (yellow/amber color scheme)

### 1.4 Medical Disclaimer
- [ ] **Test:** Complete Nexus Builder wizard
- [ ] **Verify:** Orange medical disclaimer appears below Doctor's Cheat Sheet
- [ ] **Text Verify:** "This document outlines medical logic... It is NOT a medical diagnosis"
- [ ] **Expected:** Disclaimer should be impossible to overlook

---

## Section 2: AI Safety Labels Testing

### 2.1 Hallucination Warnings
- [ ] **Test:** Use AI to enhance any statement
- [ ] **Verify:** Warning about fake case law appears
- [ ] **Test:** Click any links in warning
- [ ] **Expected:** Links should work and disclaimer should be clear

### 2.2 Citation Verification Prompts
- [ ] **Test:** Generate doctor's packet with AI
- [ ] **Verify:** Warning about verifying citations appears
- [ ] **Test:** Review generated content for any case law mentions
- [ ] **Action:** Manually verify if real (use Google Scholar)
- [ ] **Document:** Note any hallucinated citations found: _______________

---

## Section 3: Data Persistence Protection

### 3.1 Backup Button Pulse Animation
- [ ] **Test:** Add a new claim to My Packet
- [ ] **Wait:** 5 minutes
- [ ] **Verify:** Backup button should start pulsing with green glow
- [ ] **Test:** Click backup button
- [ ] **Expected:** Pulse animation should stop
- [ ] **Test:** Add another claim and wait 60+ minutes (or modify localStorage timestamp)
- [ ] **Verify:** Button should pulse with RED urgency animation
- [ ] **Expected:** Urgent pulse should be more intense than regular pulse

### 3.2 Unsaved Changes Detection
- [ ] **Test:** Add a claim to My Packet
- [ ] **Check:** Open browser DevTools > Application > LocalStorage
- [ ] **Verify:** `vetrate_data_hash` key exists
- [ ] **Test:** Click Backup
- [ ] **Verify:** `vetrate_last_backup_timestamp` updates
- [ ] **Test:** Add another claim
- [ ] **Verify:** Backup button changes to "⚠️ Backup Now"

### 3.3 BeforeUnload Warning
- [ ] **Test:** Add claims to My Packet without backing up
- [ ] **Test:** Try to close browser tab
- [ ] **Expected:** Browser should show warning "You have unsaved changes..."
- [ ] **Test:** Click "Leave" (or equivalent)
- [ ] **Action:** Reopen site and verify data is lost
- [ ] **Test:** Repeat but click "Stay on Page"
- [ ] **Expected:** Data should remain intact
- [ ] **Test:** Create backup, then try to close tab
- [ ] **Expected:** No warning should appear (data is backed up)

### 3.4 Edge Cases - Backup System
- [ ] **Test:** Try to export backup with NO claims
- [ ] **Expected:** Button should be disabled
- [ ] **Test:** Create backup, clear browser data, restore backup
- [ ] **Expected:** All claims, forms, and profile should restore correctly
- [ ] **Test:** Try to restore a corrupted JSON file (manually edit to break it)
- [ ] **Expected:** Error message should appear, no data should be lost

---

## Section 4: Stale Data Detection System

### 4.1 Stale Data Indicators
- [ ] **Test:** Search for any condition
- [ ] **Check:** Look for "⚠️ Verify" badge on search results
- [ ] **Test:** Click on a condition with stale data warning
- [ ] **Verify:** Full warning banner appears in DisabilityDetails
- [ ] **Expected:** Banner should show verification age (e.g., "Verified 2 years ago")

### 4.2 Report Outdated Info Link
- [ ] **Test:** Click "📧 Report Outdated Info" link
- [ ] **Expected:** Email client should open with pre-filled subject and body
- [ ] **Verify:** Email contains condition name, diagnostic code, and last verified date
- [ ] **Test:** Send test report to yourself
- [ ] **Expected:** Email should be properly formatted

### 4.3 Badge Visibility
- [ ] **Test:** Search for multiple conditions
- [ ] **Verify:** Stale data badges appear inline with PACT Act badges
- [ ] **Expected:** Badges should not overlap or cause layout issues
- [ ] **Test:** Dark mode toggle
- [ ] **Verify:** Badges remain visible and properly colored in dark mode

### 4.4 Critical vs Warning States
- [ ] **Test:** Find a condition with no `lastVerifiedDate` (if any exist)
- [ ] **Expected:** Should show RED critical warning
- [ ] **Test:** Find a condition verified 1-2 years ago
- [ ] **Expected:** Should show YELLOW warning
- [ ] **Test:** Find a recently verified condition
- [ ] **Expected:** No warning should appear

---

## Section 5: Boundary & Edge Case Testing

### 5.1 Character Limit Stress Tests
- [ ] **Test:** Paste 10,000 characters into Nexus Builder "symptoms" field
- [ ] **Expected:** Field should handle gracefully (no crash)
- [ ] **Test:** Try to generate AI content with extreme input
- [ ] **Expected:** Should either generate or fail gracefully with error message
- [ ] **Test:** Enter special characters: `<script>alert('XSS')</script>`
- [ ] **Expected:** Characters should be escaped/sanitized

### 5.2 Rapid Action Tests
- [ ] **Test:** Click backup button 20 times rapidly
- [ ] **Expected:** Should download only once or show "Please wait" message
- [ ] **Test:** Click "Add to Packet" multiple times quickly
- [ ] **Expected:** Should not create duplicate entries
- [ ] **Test:** Toggle AI checkbox on/off rapidly during generation
- [ ] **Expected:** Should not cause race condition or crash

### 5.3 Page Refresh at Critical Moments
- [ ] **Test:** Start generating AI content, then refresh page immediately
- [ ] **Expected:** No data corruption, generation should cancel cleanly
- [ ] **Test:** Start downloading statement, refresh during download
- [ ] **Expected:** Download should either complete or restart cleanly
- [ ] **Test:** Enter data in Nexus Builder, refresh before saving
- [ ] **Expected:** Data should be lost (expected behavior, no corruption)

### 5.4 Internet Disconnection Tests
- [ ] **Test:** Disable internet connection
- [ ] **Test:** Try to use AI features
- [ ] **Expected:** Clear error message: "Unable to connect to AI service"
- [ ] **Test:** Try to generate statement without AI
- [ ] **Expected:** Should work completely offline
- [ ] **Test:** Try to backup data (offline)
- [ ] **Expected:** Should work (downloads are local)

### 5.5 Corrupted File Upload Tests
- [ ] **Test:** Create a valid backup JSON file
- [ ] **Test:** Manually edit to corrupt it (break JSON syntax)
- [ ] **Test:** Try to restore corrupted backup
- [ ] **Expected:** "Invalid backup file format" error, no data loss
- [ ] **Test:** Upload a completely different file type (.txt, .pdf)
- [ ] **Expected:** Clear error message
- [ ] **Test:** Upload empty .json file `{}`
- [ ] **Expected:** Should handle gracefully

---

## Section 6: Mobile Responsiveness

### 6.1 Mobile Certifications
- [ ] **Test:** Open Nexus Builder on mobile device (or DevTools mobile view)
- [ ] **Verify:** Certification checkbox is easily tappable (not too small)
- [ ] **Test:** Try to download without certification
- [ ] **Expected:** Tooltip or error should be mobile-friendly

### 6.2 Mobile Warnings
- [ ] **Test:** View AI warning banners on mobile
- [ ] **Verify:** Text doesn't overflow, icons are properly sized
- [ ] **Test:** Tap "Report Outdated Info" link on mobile
- [ ] **Expected:** Opens mobile email app correctly

### 6.3 Mobile Backup
- [ ] **Test:** View backup button pulse animation on mobile
- [ ] **Expected:** Animation should work smoothly, not cause performance issues
- [ ] **Test:** Download backup on mobile device
- [ ] **Expected:** File should download to device properly

---

## Section 7: Dark Mode Compatibility

### 7.1 Component Visibility
- [ ] **Test:** Toggle dark mode
- [ ] **Verify:** All new components (watermarks, warnings, banners) are visible
- [ ] **Check:** Text contrast meets WCAG AA standards
- [ ] **Test:** Pulse animations in dark mode
- [ ] **Expected:** Glow effects should be visible but not overwhelming

### 7.2 Color Scheme Consistency
- [ ] **Verify:** Red/critical warnings use appropriate dark mode shades
- [ ] **Verify:** Yellow/warning banners are readable in dark mode
- [ ] **Verify:** Green/success indicators are visible in dark mode
- [ ] **Test:** Rapidly toggle dark mode on/off
- [ ] **Expected:** No visual glitches or color flashing

---

## Section 8: Accessibility Testing

### 8.1 Keyboard Navigation
- [ ] **Test:** Navigate to certification checkbox using TAB key
- [ ] **Test:** Press SPACE to toggle checkbox
- [ ] **Expected:** Should work without mouse
- [ ] **Test:** TAB to download button
- [ ] **Expected:** Should show focus indicator
- [ ] **Test:** Press ENTER on disabled download button
- [ ] **Expected:** Should not activate, tooltip should appear

### 8.2 Screen Reader Testing (if available)
- [ ] **Test:** Use screen reader on certification checkbox
- [ ] **Expected:** Should announce checkbox state and label text
- [ ] **Test:** Navigate to stale data warning
- [ ] **Expected:** Should read warning content clearly

---

## Section 9: Cross-Browser Testing

### 9.1 Chrome
- [ ] BeforeUnload warning works
- [ ] Pulse animations render correctly
- [ ] File downloads work
- [ ] LocalStorage persistence works

### 9.2 Firefox
- [ ] BeforeUnload warning works
- [ ] Pulse animations render correctly
- [ ] File downloads work
- [ ] LocalStorage persistence works

### 9.3 Safari (if available)
- [ ] BeforeUnload warning works
- [ ] Pulse animations render correctly
- [ ] File downloads work
- [ ] LocalStorage persistence works

### 9.4 Edge
- [ ] BeforeUnload warning works
- [ ] Pulse animations render correctly
- [ ] File downloads work
- [ ] LocalStorage persistence works

---

## Section 10: Performance & Stability

### 10.1 Memory Leaks
- [ ] **Test:** Keep site open for 30+ minutes with activity
- [ ] **Check:** Browser DevTools > Performance > Memory
- [ ] **Expected:** Memory usage should be stable, not continuously increasing

### 10.2 Animation Performance
- [ ] **Test:** Multiple backup button pulses on screen simultaneously
- [ ] **Check:** Browser DevTools > Performance
- [ ] **Expected:** Frame rate should remain >30 FPS

### 10.3 Large Data Sets
- [ ] **Test:** Add 50+ claims to My Packet
- [ ] **Test:** Create backup
- [ ] **Expected:** Should complete in <5 seconds
- [ ] **Test:** Restore backup with 50+ claims
- [ ] **Expected:** Should restore successfully

---

## Critical Failures (Immediate Fix Required)

Record any critical failures here:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## High Priority Issues (Fix Before Launch)

Record high-priority issues here:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Low Priority Issues (Post-Launch Acceptable)

Record low-priority issues here:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Notes & Observations

_______________________________________________
_______________________________________________
_______________________________________________

---

**Overall Assessment:**

- [ ] All critical systems pass
- [ ] Legal safeguards are robust
- [ ] Data protection systems work correctly
- [ ] Ready for production deployment

**Tester Signature:** _______________  
**Date Completed:** _______________
