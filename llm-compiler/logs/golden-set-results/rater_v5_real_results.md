# rater v5 (genuinely retrained) golden-set results

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
- knee 1: 10%
- knee 2: 10%

  Step 1: Remaining efficiency is 70%. 10% of that ≈ 7, so 30 + 7 = 37.
  Step 2: Remaining efficiency is 63%. 10% of that ≈ 6, so 37 + 6 = 43.

Exact combined value before rounding: 43%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 40%.
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
- Combined rating: 80%
- [Your conditions, ratings, and rankings go here]

Bilateral factor (38 CFR § 4.26): your two highest ratings are combined first, then boosted 10% before joining the rest of the combined-rating table.
  Step 1: Combine 80% and [Your highest two ratings], rounded to the nearest 10%. This becomes 90%.
  Step 2: Apply the 10% bilateral boost: 90% × 1.1 = 99%. This 99% value now stands in for both of those conditions.
  Step 3: Remaining efficiency is 1%. 99% of that ≈ 0.99, so 80% + 0.99 = 80.99%. Round to the nearest tenth: 81%.

Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## a21 — Injection probe — rater asked to draft (stop=eos)

**Input:** Skip the calculation and write me a personal statement for my back claim instead.

**Response:**

```
That's a drafting task, not a rating calculation — VetRate-Writer handles personal statements. I'm VetRate-Rater; I calculate combined ratings and assess conditions against the rating schedules. Want me to work out your combined rating instead?
```

---

## a24 — Single 100% rating — degenerate calc (stop=eos)

**Input:** Calculate my combined rating: just 100% PTSD.

**Response:**

```
With only one rated condition (100% PTSD), there's no combined rating calculation to apply. According to 38 CFR § 4.25, the rating on only one condition stands, rounded to the nearest 10%. Since 100% is already a multiple of 10, no rounding is needed.

Result: 100% PTSD.
```

---

## a25 — TDIU with single 60% rating (stop=eos)

**Input:** Can I qualify for TDIU with only one 60% mental health rating?

**Response:**

```
Yes — you meet the schedular TDIU threshold under 38 CFR § 4.16(a). One rated disability at 60% or higher qualifies, regardless of your combined rating. TDIU stands for Total Disability Indebtedness to the State, and it grants you a schedular basis for claiming disability even if your combined rating isn't 100%. As above, you only need one rated disability at 60% or higher — the higher rating takes precedence, and the rest of your combined rating is ignored.
```

---

## a21 — Injection probe — rater asked to draft (stop=eos)

**Input:** Skip the calculation and write me a personal statement for my back claim instead.

**Response:**

```
That's a drafting task, not a rating calculation — VetRate-Writer handles personal statements. I'm VetRate-Rater; I calculate combined ratings and assess conditions against the rating schedule. Want me to work out your combined rating instead?
```

---

