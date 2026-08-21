# Tactical Calculator

Tactical Calculator is Vet-Rate.org's core VA combined-ratings calculator - "The Rate You Deserve." It's more than a simple adder: it shows the gap to your next rating tier, correctly applies the Bilateral Factor, and calculates real take-home pay with dependents.

<div class="crisis-banner">
🆘 <strong>Veterans Crisis Line:</strong> Call 988, Press 1 | Text 838255 | Available 24/7
</div>

---

## Launching Tactical Calculator

On the home page, the **⚡ Essential Tools** section leads with Tactical Calculator - click **"🎯 Calculate My Rating"**. It's also reachable from the header's **🛠️ Tools → Calculate** menu, and results from C&P Exam Simulator can flow directly in.

![Tactical Calculator's default calculator tab](../assets/images/screenshots/tactical-calculator/tactical-calculator-default.png)
_Tactical Calculator opens on the Calculator tab if you have no saved ratings yet, or your My Ratings tab if you do._

---

## Adding Conditions

For each condition, choose:

- **Body Part / Condition Type** - a dropdown covering extremities (which can be bilateral) and other body systems
- **Side** - Not Bilateral, Left, Right, or **Both (Bilateral)**
- **Rating %** - the percentage for that condition
- An optional **custom label** if the condition name doesn't fit the dropdown

Click **➕ Add to Calculator** to add it to your working list.

## The Bilateral Factor

38 CFR § 4.26 adds an extra **10% boost** when you have matching left/right conditions (e.g. Left Knee and Right Knee) - a boost the naive combined-ratings math misses if you calculate each side separately. Tactical Calculator applies it automatically the moment you select **Both (Bilateral)** for a qualifying body part.

![Tactical Calculator after adding a bilateral Knee condition, showing the Bilateral Factor applied](../assets/images/screenshots/tactical-calculator/tactical-calculator-bilateral-demo.png)
_Selecting "Both (Bilateral)" for an eligible body part (like Knee) automatically applies the +10% Bilateral Factor to the combined result._

---

## Reading Your Results

Once you've added conditions, Tactical Calculator shows:

- **Combined rating** - the official VA math result, rounded to the nearest 10%
- **Bilateral Factor applied** - called out separately when it applies
- **Gap to next tier** - how many more percentage points would push you to the next rating level
- **Estimated monthly pay** - based on current-year VA compensation rates and the dependents you enter (spouse, Aid & Attendance, children under 18, children in school, dependent parents)
- **Step-by-step breakdown** - expand "Show Steps" to see exactly how the VA math combined each condition, in order from highest to lowest rating

## My Ratings vs. Calculator Tab

- **Calculator tab** - a scratch workspace for testing any combination of conditions
- **My Ratings tab** - your saved, actual VA ratings (only appears once you've saved at least one). Saving here keeps your real ratings available to other tools like Pathfinder, TDIU Builder, and Million Dollar Dashboard.

## Pasting Ratings From VA.gov

Use the **VA.gov Rating Paster** to paste your rating decision letter text directly and have Tactical Calculator parse out the conditions and percentages automatically.

---

## Important Disclaimer

!!! warning "Estimates Only"
Tactical Calculator's combined-rating math follows the official 38 CFR § 4.25/§ 4.26 formulas, but pay estimates and gap calculations are **planning tools**, not official VA determinations. Your actual rating decision comes only from the VA.
