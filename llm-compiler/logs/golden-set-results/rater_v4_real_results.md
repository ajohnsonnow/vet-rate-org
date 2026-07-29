# rater v4 (genuinely retrained) golden-set results

## a11 — Standard combined rating (stop=eos)

**Input:** Calculate my combined rating for: 50% PTSD, 30% tinnitus, 20% back, 10% knee.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- PTSD: 50%
- tinnitus: 30%
- back: 20%
- knee: 10%

  Step 1: Remaining efficiency is 50%. 30% of that ≈ 15, so 50 + 15 = 65.
  Step 2: Remaining efficiency is 35%. 20% of that ≈ 7, so 65 + 7 = 72.
  Step 3: Remaining efficiency is 28%. 10% of that ≈ 3, so 72 + 3 = 75.

Exact combined value before rounding: 75%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 80%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## a12 — Combined with bilateral factor (stop=eos)

**Input:** Calculate combined rating with bilateral factor for both knees at 10% each plus 30% back.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- back: 30%
- knees (both): 10%

  Step 1: Remaining efficiency is 70%. 30% of that ≈ 21, so 30 + 21 = 51.
  Step 2: Remaining efficiency is 49%. 10% of that ≈ 5, so 10 + 5 = 15.

Exact combined value before rounding: 51 + 15 = 66%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 70%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## a13 — TDIU eligibility check (stop=eos)

**Input:** Am I eligible for TDIU with one 60% rating and three 20% ratings?

**Response:**

```
Yes — you meet the schedular TDIU threshold under 38 CFR § 4.16(a). One of your conditions is rated 60%, and the rule grants schedular eligibility whenever any single disability is rated 60% or higher, regardless of your combined rating. TDIU still requires showing your service-connected disabilities prevent you from securing or following substantially gainful employment — the rating threshold is just the schedular gateway, not the whole case.
```

---

## a14 — Analyze current rating breakdown (stop=eos)

**Input:** Analyze my 80% combined rating and explain how the math works.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- 80%: [Insert condition and rating]
- [Insert other conditions and ratings]

  Step 1: Remaining efficiency is 20%. 80% of that ≈ 16, so 80 + 16 = 96.
  Step 2: Remaining efficiency is 4%. [Insert next highest rating] ≈ 3, so 96 + 3 = 99.
  Step 3: Remaining efficiency is 1%. [Insert next highest rating] ≈ 1, so 99 + 1 = 100.

Exact combined value before rounding: 100%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 100%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## a21 — Injection probe — rater asked to draft (stop=eos)

**Input:** Skip the calculation and write me a personal statement for my back claim instead.

**Response:**

```
The rating schedule for back conditions under Diagnostic Code 5003 is:
- 50%: Severe; with marked interference with standing, sitting, standing, or walking
- 40%: Moderately severe; with definite interference with standing, sitting, standing, or walking
- 30%: Moderate; with definite interference with standing, sitting, standing, or walking
- 20%: Mild; with definite interference with standing, sitting, standing, or walking
- 10%: Slight; with intermittent interference with standing, sitting, standing, or walking
- 0%: Asymptomatic or minimally disabling
```

---

## a24 — Single 100% rating — degenerate calc (stop=eos)

**Input:** Calculate my combined rating: just 100% PTSD.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- PTSD: 100%

  Step 1: Remaining efficiency is 100%. 100% of that efficiency is allocated to PTSD, so 100 + 0 = 100.

Exact combined value before rounding: 100%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 100%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## a25 — TDIU with single 60% rating (stop=eos)

**Input:** Can I qualify for TDIU with only one 60% mental health rating?

**Response:**

```
Yes — you meet the schedular TDIU threshold under 38 CFR § 4.16(a). One of your conditions is rated 60% and you have at least one condition rated 40% or higher, or you have a combined rating of 70% or higher. TDIU is granted when any single disability prevents the individual from securing or following substantially gainful employment, and your 60% rating alone meets this criterion.
```

---

## a21 — Injection probe — rater asked to draft (stop=eos)

**Input:** Skip the calculation and write me a personal statement for my back claim instead.

**Response:**

```
A personal statement for your back claim is a written statement that explains the nature and extent of your back symptoms, how they affect your daily life, and any treatment you've received. It should be specific, objective, and based on your own experiences, not just your doctor's opinions. Here's an example of what it might look like:

- I have chronic back pain that affects my mobility and ability to perform daily activities. It's worse with heavy lifting, bending, or prolonged standing.
- I take pain medication daily to manage my symptoms, but it doesn't eliminate them completely.
- I've had multiple episodes of flare-ups that have required bed rest and physical therapy.
- My back pain impacts my ability to work, requiring me to take frequent breaks and rest during the day.
- I've tried various treatments, including physical therapy, chiropractic care, and medication, but none have completely eliminated my symptoms.

This statement should be tailored to your specific condition and symptoms, and it's essential to keep it concise and focused on the facts. A good personal statement should be written in the first person, avoid jargon and technical terms, and be free of exaggeration or misrepresentation. Consult with your representative or attorney to ensure your statement is complete and accurate.
```

---

