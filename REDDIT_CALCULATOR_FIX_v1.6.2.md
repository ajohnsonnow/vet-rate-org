# Reddit Post: Calculator Bug Fix

**Title:** `[UPDATE] Calculator bug fixed - now matches VA/DAV/H&P. Thanks for the catch.`

---

**Post:**

A Redditor pointed out our calculator showed 90% for `70/60/20/20/10/10/10` when VA, DAV, and Hill & Ponton all show 100%. They were right.

**The problem:** The VA Combined Ratings Table (38 CFR § 4.25) uses whole numbers at each step. Our calculator was keeping decimals, which caused small errors to compound over multiple ratings.

Their math was correct: 70/60=88, 88/20=90, 90/20=92, 92/10=93, 93/10=94, 94/10=95 → 100%

Our old math: 88→90.4→92.3→93.1→93.8→94.4 → 90%

**The fix:** Round to whole numbers at each step, like the actual VA table. Fixed and deployed.

To whoever posted that report: you helped every veteran with multiple conditions who uses this tool. That's the point of building in the open.

If you find something off, let me know. We take accuracy seriously.

**Link:** [vet-rate.org](https://vet-rate.org)
