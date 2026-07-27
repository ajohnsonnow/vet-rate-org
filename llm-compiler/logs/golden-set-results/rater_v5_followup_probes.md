# rater v5 targeted follow-up probes

## bilateral_retry_1 (stop=eos)

**Input:** Calculate combined rating with bilateral factor for both knees at 10% each plus 30% back.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- back: 30%
- knee 1: 10%
- knee 2: 10%

Bilateral factor (38 CFR § 4.26): your two paired-extremity conditions (30% and 10%) are combined first, then boosted 10% before joining the rest of the combined-rating table.
  Step 1: Combine 30% and 10% — remaining efficiency after 30% is 70%. 10% of 70% ≈ 7, so 30 + 7 = 37.
  Step 2: Apply the 10% bilateral boost: 37 × 1.1 = 40 (rounded). This 40 value now stands in for both paired conditions.
  Step 3: Remaining efficiency is 60%. 10% of 60% ≈ 6, so 40 + 6 = 46.

Exact combined value before rounding: 46%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 50%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## bilateral_retry_2 (stop=eos)

**Input:** I have a 30% back rating and 10% ratings in each knee. What's my combined rating accounting for the bilateral factor?

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- back: 30%
- knee (one): 10%
- knee (other): 10%

Bilateral factor (38 CFR § 4.26): your two paired-extremity conditions (30% and 10%) are combined first, then boosted 10% before joining the rest of the combined-rating table.
  Step 1: Combine 30% and 10% — remaining efficiency after 30% is 70%. 10% of 70% ≈ 7, so 30 + 7 = 37.
  Step 2: Apply the 10% bilateral boost: 37 × 1.1 = 40.7 (rounded).

Exact combined value before rounding: 40.7%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 40%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

## bilateral_pair_lowest (stop=eos)

**Input:** Combined rating for 50% PTSD, 30% back, and bilateral factor for ankles at 10% each.

**Response:**

```
VA disability ratings don't add up like ordinary arithmetic — they use the "whole person" efficiency formula from 38 CFR § 4.25. Each condition is applied against your *remaining* efficiency, starting with the highest rating.

Conditions, highest to lowest:
- PTSD: 50%
- back: 30%
- bilateral ankles: 10%

  Step 1: Remaining efficiency is 50%. 30% of that ≈ 15, so 50 + 15 = 65.
  Step 2: Remaining efficiency is 35%. 10% of that ≈ 4, so 65 + 4 = 69.

Exact combined value before rounding: 69%. Per 38 CFR § 4.25, the combined rating table rounds to the nearest 10%, giving a final combined rating of 70%.
Note: pyramiding rules (38 CFR § 4.14) mean each of these must represent a distinct disabling manifestation, not the same symptom rated twice under different codes.
```

---

