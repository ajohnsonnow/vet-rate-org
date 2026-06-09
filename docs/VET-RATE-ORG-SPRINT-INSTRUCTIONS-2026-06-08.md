# VET-RATE.ORG — COMPREHENSIVE SPRINT INSTRUCTION BLOCKS
**Based on Audit:** June 8, 2026 | Version: v1.23.1  
**Priority Order:** Critical → High → Medium → Low  

---

# 🔴 SPRINT 1: CRITICAL SAFETY & FUNCTIONALITY (1-2 days)

## SPRINT 1A — Crisis Safety Gate in C&P Simulator
**Priority:** P0 - CRITICAL SAFETY
**Issue:** #28 — Suicidal ideation question shows no crisis line

### Task Description
The C&P Exam Simulator Question 4 for PTSD asks "Do you experience suicidal thoughts, severe depression, or inability to care for yourself?" When a veteran selects "Yes, frequently" or "Yes, occasionally," the system must immediately display the Veterans Crisis Line.

### Implementation Instructions
```
FILE: src/components/tools/CPExamSimulator/Question.jsx (or equivalent)

1. Add crisis detection logic:
   - Identify questions that contain suicidal ideation indicators
   - Tag such questions in the question data with: { hasCrisisIndicator: true }
   - For PTSD DC 9411 Question 4, add this flag to the question config

2. Add conditional rendering:
   const dangerAnswers = ['Yes, frequently', 'Yes, occasionally'];
   
   if (question.hasCrisisIndicator && dangerAnswers.includes(selectedAnswer)) {
     // Show crisis component IMMEDIATELY, before Next button
   }

3. Create CrisisAlert component:
   <CrisisAlert>
     <div className="crisis-banner" role="alert" aria-live="assertive">
       <strong>⚠️ You Are Not Alone</strong>
       <p>If you're having thoughts of suicide or self-harm, please reach out:</p>
       <a href="tel:988" className="crisis-btn">📞 Call 988, Press 1</a>
       <a href="sms:838255" className="crisis-btn">💬 Text 838255</a>
       <a href="https://www.veteranscrisisline.net/get-help/chat" 
          target="_blank" rel="noopener">🌐 Chat Online 24/7</a>
     </div>
   </CrisisAlert>

4. Styling requirements:
   - Red/orange background, high contrast text
   - Must appear ABOVE the "Next" button, not below
   - Must be visible without scrolling
   - Must persist — do NOT auto-dismiss crisis banners

5. Accessibility:
   - role="alert" aria-live="assertive" for screen readers
   - Focus management: auto-focus the crisis banner when shown
   - Do not move focus away from crisis resources until user explicitly continues
```

### Acceptance Criteria
- [ ] Selecting "Yes, frequently" shows crisis resources immediately
- [ ] Selecting "Yes, occasionally" shows crisis resources immediately
- [ ] Crisis banner is keyboard accessible
- [ ] Screen reader announces the crisis resources
- [ ] Crisis banner does NOT appear when selecting "No" or past answers

---

## SPRINT 1B — Fix Time Machine Start Countdown (BROKEN)
**Priority:** P0 - CRITICAL BUG
**Issue:** #34 — Modal closes without showing results

### Task Description
The Time Machine ITF tracker closes the modal when "Start Countdown" is clicked instead of displaying the countdown and backpay calculation.

### Investigation Steps
```
1. Open browser DevTools
2. Add console.log to the Start Countdown handler
3. Check for:
   a. onClose() being called when it shouldn't be
   b. Form validation preventing the countdown from rendering
   c. State update causing component unmount
   d. Missing conditional rendering after startCountdown state is set

FILE: src/components/tools/TimeMachine/TimeMachine.jsx (or equivalent)

LIKELY CAUSE: The form submit or button click handler may be calling
the modal close function instead of transitioning to the results view.

Check for:
  const handleStartCountdown = () => {
    // BUG: Is onClose() being called here accidentally?
    setShowResults(true); // This should happen instead
  };

FIX:
  const handleStartCountdown = (e) => {
    e.preventDefault(); // Prevent any form submission
    if (!itfDate) {
      setError('Please enter your Intent to File date');
      return;
    }
    setIsRunning(true);
    setShowResults(true);
    // DO NOT call onClose() here
  };
```

### Expected Behavior After Fix
- Enter date → Click "Start Countdown" → See countdown timer + backpay calculation
- Modal stays OPEN
- Shows "X days remaining" countdown
- Shows "Potential backpay if approved: $XX,XXX"
- Shows "Effective date: [ITF date]"

### Acceptance Criteria
- [ ] Clicking "Start Countdown" with a valid date shows results
- [ ] Modal remains open
- [ ] Countdown shows days remaining until 365-day ITF deadline
- [ ] Backpay estimate shows based on rating
- [ ] Reset/Change Date button returns to input view

---

## SPRINT 1C — Fix Field Manual Template Variables
**Priority:** P0 - CRITICAL CONTENT BUG  
**Issue:** #46 — Raw JS template literals visible to users

### Task Description
The Field Manual displays raw JavaScript template literals instead of resolved values.

### Finding Locations
```
Search codebase for:
  {getTotalToolCount()}
  {PROJECT_STATS.disabilitiesValidated}
  Any other { } patterns in markdown/MDX files

FILES TO CHECK:
  - docs/ folder (all .md and .mdx files)
  - src/data/fieldManual/ folder
  - Any build/generation script for docs

LIKELY CAUSE: The Field Manual content uses a template system 
but the template is not being processed at build time or runtime.

FIX OPTION A (Build-time): 
  Use a preprocessor in vite.config.js to replace template vars:
  {
    name: 'template-replacer',
    transform(code, id) {
      if (id.includes('/docs/')) {
        return code
          .replace(/{getTotalToolCount()}/g, '42')
          .replace(/{PROJECT_STATS.disabilitiesValidated}/g, '748');
      }
    }
  }

FIX OPTION B (Runtime):
  Pass context to the FieldManual renderer:
  const context = { toolCount: 42, conditionCount: 748 };
  // Apply to template string replacement in the render function

FIX OPTION C (Simple):
  Just hardcode the correct values directly in the markdown files
  and use a CHANGELOG-style update process to update them.
```

### Acceptance Criteria
- [ ] "All 42+ Tools" renders correctly (or whatever the accurate count is)
- [ ] "748 rated disabilities" renders correctly
- [ ] No raw {variableName} patterns visible anywhere in the Field Manual
- [ ] Search the entire codebase for other potential template leaks

---

# 🔴 SPRINT 2: HIGH PRIORITY BUGS (2-3 days)

## SPRINT 2A — Escape Key Modal Dismissal (WCAG 2.1.2)
**Priority:** P1 - HIGH (Accessibility)
**Issue:** #24 — ESC key doesn't close modals

### Task Description
WCAG 2.1 Success Criterion 2.1.2 (No Keyboard Trap) requires that keyboard users can close all modal dialogs using the Escape key. Currently at least the Secondary Scout Results modal fails this.

### Implementation Instructions
```
GLOBAL FIX — Apply to ALL modals in the application:

1. Create a useModalEscape hook:

   // src/hooks/useModalEscape.js
   import { useEffect } from 'react';
   
   export function useModalEscape(onClose, isOpen = true) {
     useEffect(() => {
       if (!isOpen) return;
       
       const handleKeyDown = (e) => {
         if (e.key === 'Escape') {
           e.preventDefault();
           e.stopPropagation();
           onClose();
         }
       };
       
       document.addEventListener('keydown', handleKeyDown);
       return () => document.removeEventListener('keydown', handleKeyDown);
     }, [onClose, isOpen]);
   }

2. Apply to EVERY modal component:
   // In each modal component:
   import { useModalEscape } from '../../hooks/useModalEscape';
   
   function SecondaryScoutModal({ onClose, isOpen }) {
     useModalEscape(onClose, isOpen);
     // ... rest of component
   }

3. Modal components to update (non-exhaustive):
   - SecondaryScoutResults
   - TacticalCalculator
   - CPExamSimulator  
   - DecisionDecoder
   - TimeMachine
   - SharkRadar
   - PACTActNavigator
   - MyPacket
   - MissionBriefings
   - FieldManual sidebar
   - All confirmation dialogs

4. Test keyboard navigation:
   - Tab through modal content
   - Press ESC → modal closes
   - Focus returns to the element that opened the modal
```

### Acceptance Criteria
- [ ] ALL modals close when ESC is pressed
- [ ] Focus returns to the trigger element after closing
- [ ] Nested modals (if any) close in the correct order (innermost first)
- [ ] Screen readers announce modal open/close state

---

## SPRINT 2B — Close Button Hit Target Fix (WCAG 2.5.5)
**Priority:** P1 - HIGH (Accessibility)
**Issue:** #25 — Close buttons too small (<44px)

### Implementation Instructions
```
GLOBAL CSS FIX:

/* Add to global stylesheet or tailwind config */
.modal-close-button,
[data-modal-close],
button[aria-label="Close"] {
  min-width: 44px !important;
  min-height: 44px !important;
  padding: 10px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  /* Invisible touch area extension */
  position: relative;
}

/* Extend the clickable area without changing visual size */
.modal-close-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px;
  min-height: 44px;
}

ALSO: Ensure all close buttons have:
  aria-label="Close [tool name] dialog"
  type="button"
  
COMPONENT AUDIT:
  Run: grep -r "onClick.*close\|onClose" src/components --include="*.jsx" 
  For each found: verify 44px minimum and aria-label
```

### Acceptance Criteria
- [ ] All close buttons have minimum 44×44px click target
- [ ] All close buttons have descriptive aria-labels
- [ ] Close buttons remain visually the same size but have expanded touch targets

---

## SPRINT 2C — "Luna" Tooltip Auto-Dismiss
**Priority:** P1 - HIGH (UX)
**Issue:** #19 — Persistent mascot tooltip covers important content

### Implementation Instructions
```
FILE: src/components/mascot/LunaTip.jsx (or equivalent)

1. Add auto-dismiss timer:
   useEffect(() => {
     const timer = setTimeout(() => {
       setVisible(false);
     }, 7000); // 7 seconds
     
     return () => clearTimeout(timer);
   }, []);

2. Add dismiss on any click outside:
   useEffect(() => {
     const handleClickOutside = (e) => {
       if (!tipRef.current?.contains(e.target)) {
         setVisible(false);
       }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

3. Ensure the tooltip NEVER overlaps:
   a. Monthly Pay amount
   b. Calculate/Add/Submit buttons
   c. Form input fields
   
   Position the tooltip to avoid these critical areas using a 
   smart placement algorithm (prefer bottom-left positioning).

4. Add CSS pointer-events: none when fading out so it doesn't 
   block clicks during the fade animation.

5. Rate-limit Luna appearances:
   - Do not show Luna more than once per tool session
   - Store shown state in sessionStorage per tool
```

### Acceptance Criteria
- [ ] Luna tooltip auto-dismisses after 7 seconds
- [ ] Luna dismisses when user clicks anywhere outside
- [ ] Luna never overlaps the monthly pay amount or action buttons
- [ ] Luna appears at most once per tool per session

---

## SPRINT 2D — Fix Search "No Results" Race Condition
**Priority:** P1 - HIGH (UX)
**Issue:** #12 — "No matching disabilities" shows while autocomplete shows results

### Implementation Instructions
```
FILE: src/components/search/DisabilitySearch.jsx (or equivalent)

The problem is likely that "No Results" renders based on a different 
state than the autocomplete suggestions.

CURRENT (BROKEN) behavior:
  - searchResults (empty until suggestion selected) → shows "No Results"  
  - suggestions (populated while typing) → shows suggestions
  
These two states are asynchronous and race.

FIX:
  const shouldShowNoResults = 
    query.length > 2 &&          // User has typed enough
    !isLoading &&                  // Not still searching
    suggestions.length === 0 &&   // No autocomplete suggestions
    searchResults.length === 0 && // No committed search results
    hasSearched;                  // User has committed to a search (Enter/click)
    
  // "No Results" should ONLY show after user commits to search:
  const handleSearch = (term) => {
    setHasSearched(true);
    // ... perform search
  };
  
  // While typing (not yet searched), show only autocomplete
  // "No Results" only shows after Enter or selecting a suggestion
```

### Acceptance Criteria
- [ ] "No matching disabilities found" only appears after Enter or suggestion selection
- [ ] While typing, only autocomplete suggestions appear
- [ ] Empty state is clear and helpful ("No results for [term]. Try [suggestion]")
- [ ] Clear search button (X) resets the no-results state

---

## SPRINT 2E — Fix ITF Rate in Time Machine
**Priority:** P1 - HIGH (Data Accuracy)
**Issue:** #20 — Time Machine shows $1,716/mo for 70% instead of $1,808.45

### Implementation Instructions
```
1. Find the rate data source in the Time Machine component
2. It likely uses a hardcoded or outdated rate table
3. Replace with import from the same data source as Tactical Calculator:

   import { VA_PAY_RATES_2026 } from '../../data/payRates2026';
   
   // Use the same rate lookup function:
   const monthlyRate = getVAPayRate(combinedRating, dependents);

4. Verify all 2026 rates match the official VA table:
   - 10%: $180.42
   - 20%: $356.66  
   - 30%: $552.47 (no dependents)
   - 40%: $795.84
   - 50%: $1,132.90
   - 60%: $1,435.02
   - 70%: $1,808.45  ← This is the correct rate
   - 80%: $2,102.15
   - 90%: $2,362.30
   - 100%: $3,938.58

5. Create a single source of truth for pay rates:
   FILE: src/data/payRates2026.js
   Export the rate table and use it everywhere.
```

---

# 🟡 SPRINT 3: MEDIUM PRIORITY UX (3-5 days)

## SPRINT 3A — Tool Count Standardization
**Priority:** P2 - MEDIUM
**Issue:** #5, #47 — Inconsistent tool count (39 vs 40 vs 42)

### Implementation Instructions
```
1. Create a single constant:
   FILE: src/constants/siteConfig.js
   
   export const SITE_CONFIG = {
     TOOL_COUNT: 42,           // Update this ONE place when adding tools
     CONDITION_COUNT: 748,
     VERSION: '1.23.1',
     YEAR: 2026,
   };

2. Replace ALL hardcoded numbers:
   Search for: "39 Pro Tools", "40 Professional", "42 professional", 
               "39 powerful", any standalone "39", "40", "42" near "tools"
   
   Replace with: {SITE_CONFIG.TOOL_COUNT}

3. Update page title in index.html / vite.config.js:
   <title>Vet-Rate.org | {TOOL_COUNT} Pro Tools · ...</title>
   
   Note: HTML titles can't use JS variables directly — 
   use vite-plugin-html or update during build.

4. Update Field Manual template variable resolution (see Sprint 1C)
```

---

## SPRINT 3B — Atomic Wipe Safety Gate
**Priority:** P2 - MEDIUM
**Issue:** #7 — Dangerous "Clear All Data" button easily accessible

### Implementation Instructions  
```
1. Move the Atomic Wipe button OUT of the floating top-left position
   - Place it in Settings/Accessibility panel instead
   - Or place it at the bottom of the My Packet modal

2. Add a mandatory confirmation dialog:
   const handleAtomicWipe = () => {
     const confirmed = await showConfirmDialog({
       title: '⚠️ Delete ALL Your Data?',
       message: 'This will permanently delete ALL your conditions, ' +
                'ratings, forms, and saved work. This cannot be undone.',
       confirmText: 'Yes, Delete Everything',
       cancelText: 'Cancel - Keep My Data',
       confirmStyle: 'danger',
       requireTyping: 'DELETE'  // User must type DELETE to confirm
     });
     if (confirmed) performAtomicWipe();
   };

3. Change visual styling:
   - Make it subtle, not prominent
   - Remove from any keyboard-accessible position in the main flow
   - Add a "Last cleared: [date]" log so veterans know when it happened
```

---

## SPRINT 3C — Condition Detail Panel UX (Auto-scroll)
**Priority:** P2 - MEDIUM
**Issue:** #13 — Detail panel opens below fold without notification

### Implementation Instructions
```
FILE: src/components/search/ConditionCard.jsx (or equivalent)

1. When detail panel opens, auto-scroll to it:
   const detailRef = useRef(null);
   
   useEffect(() => {
     if (isOpen && detailRef.current) {
       detailRef.current.scrollIntoView({ 
         behavior: 'smooth', 
         block: 'start',
         inline: 'nearest'
       });
     }
   }, [isOpen]);

2. OR: Convert the condition detail to a full modal/drawer instead 
   of an inline expansion. This eliminates the scroll issue entirely.
   
   Recommendation: Use a bottom drawer on mobile, side panel on desktop.

3. Visual indicator: Add a "View Details ↓" animation arrow when 
   clicking "Click to view full details" to indicate scroll direction.

4. Rename "Click to view full details" to "📋 Open Full Details"
   and make the entire card clickable (not just this text).
```

---

## SPRINT 3D — AI-Required Tools: Non-AI Fallback State
**Priority:** P2 - MEDIUM
**Issues:** #31, #37 — Decision Decoder and Shark Radar non-functional without AI

### Implementation Instructions
```
For Decision Decoder:

1. Implement pattern-matching fallback (no AI required):
   - Build a dictionary of common VA denial phrases and their plain-English meanings
   - This dictionary already partially exists in the "Common VA Denial Language" section
   
   const DENIAL_PATTERNS = [
     { pattern: /nexus/i, meaning: "The VA says they need a doctor's letter connecting..." },
     { pattern: /not incurred in service/i, meaning: "The VA says they couldn't find evidence..." },
     // etc.
   ];
   
   function analyzeWithoutAI(text) {
     const matches = DENIAL_PATTERNS.filter(p => p.pattern.test(text));
     return matches.map(m => m.meaning);
   }

2. Show the fallback results immediately, with note:
   "Basic Analysis (AI not required) — For deeper analysis, load AI above."

For Shark Radar:
1. Add pattern matching for known red-flag phrases:
   const RED_FLAG_PATTERNS = [
     '5x your monthly increase',
     'guaranteed rating',
     'pay upfront',
     'access your VA.gov',
     // Add 50+ patterns from CFR § 14.636 violations
   ];
   
2. Show matches immediately without AI.
3. AI can provide deeper analysis, but basic protection works offline.
```

---

## SPRINT 3E — Claim Readiness Gauge Fix
**Priority:** P2 - MEDIUM
**Issue:** #39 — Claim shows 0% complete despite having a condition

### Implementation Instructions
```
1. Define the claim readiness calculation:
   
   const getReadinessPercentage = (claim) => {
     let score = 0;
     const weights = {
       hasCondition: 20,      // Condition has been identified
       hasRatingCriteria: 10, // Rating criteria reviewed
       hasStatement: 20,      // Personal statement built
       hasNexusDocs: 20,       // Nexus/medical documents noted
       hasBuddyLetter: 10,    // Buddy letter created
       hasMedicalDocs: 15,    // Medical records identified
       hasSubmitted: 5,       // Marked as filed
     };
     
     if (claim.conditionName) score += weights.hasCondition;
     if (claim.ratingViewed) score += weights.hasRatingCriteria;
     if (claim.statement) score += weights.hasStatement;
     // etc.
     
     return score;
   };

2. When a condition is saved to My Packet, set:
   claim.conditionName = condition.name  → triggers +20% readiness

3. Show progress breakdown:
   "20% - Condition identified ✅"
   "0% - Personal statement needed ⬜"
   "0% - Medical documentation needed ⬜"
   etc.
```

---

# 🟢 SPRINT 4: LOW PRIORITY & POLISH (5-7 days)

## SPRINT 4A — Onboarding Optimization
**Issue:** #2 — Three sequential modals create fatigue

```
SOLUTION:
1. Store ToS acceptance in localStorage with timestamp
2. On return visits (localStorage shows accepted), skip ToS → show only:
   - Brief "What's New" if version has changed (collapsed by default)
   - OR: Combine Welcome + Changelog into single modal for first-timers

3. Add "I've been here before, skip intro" to Welcome modal
4. ToS: Add scroll progress bar ("Reading: 67% complete") 
5. Changelog: Default to collapsed, auto-expand for major versions only
```

## SPRINT 4B — Tool Count Single Source of Truth
**See Sprint 3A** — Also update:
```
- Browser tab title (index.html): "39 Pro Tools" → dynamic
- Open Graph meta tags: og:description with tool count
- README.md if it mentions tool count
```

## SPRINT 4C — My Packet: Calculator Sync
**Issue:** #41 — Ratings calculated in Tactical Calculator don't appear in My Packet Ratings tab

```
1. After adding conditions to Tactical Calculator, show:
   "Save to My Packet" button in Calculator
   
2. When saved, create Rating record in My Packet:
   {
     date: new Date(),
     source: 'tactical_calculator',
     conditions: [...], 
     combinedRating: 80,
     monthlyPay: 2102.15
   }

3. The Ratings tab should show:
   "Calculated Rating History"
   [date] - 80% Combined ($2,102.15/mo) [from Tactical Calculator]
```

## SPRINT 4D — Performance Optimization
**Issues:** #55, #56 — Page freezes on save operations

```
1. Profile the "Save to Packet" operation:
   - Wrap in performance.now() before/after
   - Check if localStorage write is synchronous and blocking
   
2. Move localStorage writes to a web worker or setTimeout(fn, 0)
   to avoid blocking the main thread:
   
   // Instead of:
   localStorage.setItem('packet', JSON.stringify(bigObject));
   
   // Use:
   setTimeout(() => {
     localStorage.setItem('packet', JSON.stringify(bigObject));
   }, 0);
   
   // Or better, use a debounced write:
   const debouncedSave = useMemo(
     () => debounce((data) => localStorage.setItem('packet', data), 300),
     []
   );

3. Consider IndexedDB for large data (>5MB) instead of localStorage
```

---

# ♿ SPRINT 5: ACCESSIBILITY DEEP DIVE (3-4 days)

## SPRINT 5A — Full Keyboard Navigation Audit

```
TESTING PROTOCOL:
1. Disable mouse, navigate entire site keyboard-only
2. Test all modals: Tab, Shift+Tab, Enter, Space, Escape
3. Verify focus trap works in modals (focus doesn't escape to background)
4. Verify focus returns to trigger element when modal closes
5. Test with screen reader (NVDA on Windows)

REQUIRED FIXES LIKELY:
- Focus trap in all modals (currently broken)
- Focus return on modal close
- Skip links (already present but verify they work)
- Form labels for all inputs
- Error messages announced with aria-live
```

## SPRINT 5B — Screen Reader Audit

```
ITEMS TO FIX:
1. Emoji in UI elements: Add aria-hidden="true" to decorative emoji
   Example: <span aria-hidden="true">🎖️</span>
   For meaningful emoji: <span role="img" aria-label="medal">🎖️</span>

2. Dynamic content: All search results, calculator updates, tool outputs
   must announce to screen readers:
   <div aria-live="polite" aria-atomic="false">
     {searchResults.length} results found for "{query}"
   </div>

3. Modal titles: Ensure all modals have:
   <dialog aria-labelledby="modal-title" aria-modal="true">
     <h2 id="modal-title">Tool Name</h2>

4. Progress bars: 
   <progress max="15" value={complete} aria-label="Mission readiness">
   OR: <div role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
```

---

# 🚀 SPRINT 6: ADDITIONAL TOOLS RECOMMENDED (Future Sprints)

## Priority Features to Add:

### 6A — SMC Calculator (Special Monthly Compensation)
```
VA Form 21-526EZ Line 18c — Many veterans leave SMC benefits unclaimed.
Calculate eligibility for:
  - SMC-S (Housebound): 100% + 60% in separate disability
  - SMC-L: Loss or loss of use of hand/foot
  - SMC-K: Tinnitus at 100% + other disability
  
Data source: 38 CFR § 3.350
```

### 6B — CUE (Clear and Unmistakable Error) Checker
```
Many veterans have errors in past rating decisions.
Tool: 
  1. Input past decision date and rating
  2. Cross-reference against regulations in effect at THAT date
  3. Flag potential errors (wrong rating table, missing bilateral factor, etc.)
  4. Generate CUE template claim
```

### 6C — VSO Appointment Scheduler Enhancement
```
Current VSO Finder shows contact info.
Add: 
  - Calendar integration (Google Calendar / iCal download)
  - Pre-appointment checklist (what to bring)
  - "Share My Packet" button to send packet summary to VSO
```

---

# 📊 DEFINITION OF DONE (All Sprints)

Every feature/fix must meet these standards before closing:

**Functionality:**
- [ ] Core feature works as described in issue
- [ ] Edge cases tested (empty states, error states, mobile viewport)
- [ ] No console errors in browser DevTools

**Accessibility:**
- [ ] Keyboard accessible (Tab, Enter, Space, Escape)
- [ ] Screen reader tested (NVDA minimum)
- [ ] Minimum 44×44px touch targets for all interactive elements
- [ ] Color contrast ratio ≥ 4.5:1 (WCAG AA)

**Performance:**
- [ ] No operations that block the main thread >100ms
- [ ] localStorage writes are non-blocking
- [ ] Modal opens in <200ms

**Veteran Experience:**
- [ ] Plain language (Flesch-Kincaid Grade 8 or below)
- [ ] No jargon without explanation
- [ ] Works on 3G connection
- [ ] Works on 5-year-old laptop/tablet

**Testing:**
- [ ] Manual test on mobile viewport (375px wide)
- [ ] Manual test with keyboard only
- [ ] Manual test with font size doubled (browser zoom 200%)
- [ ] Tested in light mode AND dark mode

---

*Sprint Instructions generated from Vet-Rate.org Comprehensive Audit — June 8, 2026*
*Generated by: Claude Sonnet 4.6 Browser Audit*
