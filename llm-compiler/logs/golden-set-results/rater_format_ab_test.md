# rater — variant A (no persona) vs variant B (persona-in-instruction)

## a11 — Standard combined rating

**Input:** Calculate my combined rating for: 50% PTSD, 30% tinnitus, 20% back, 10% knee.

**Variant A (no persona, stop=eos):**

```
The combined rating for the listed conditions is: 50% (PTSD) + 30% (tinnitus) + 20% (back) + 10% (knee) = 110%.
```

**Variant B (persona-in-instruction, stop=limit):**

```
To calculate your combined rating, we will use the bilateral factor of 30% and the whole-person formula.

1. **Bilateral Factor:** The bilateral factor for 50% PTSD is 100% (50% for each condition).
2. **Tinnitus:** 30% tinnitus is already assigned a 30% rating.
3. **Back:** 20% back is assigned a 20% rating.
4. **Knee:** 10% knee is assigned a 10% rating.

**Step 1:** Calculate the total rating for all conditions without considering the bilateral factor.
- PTSD (50%): 100% (50% x 2)
- Tinnitus (30%): 30%
- Back (20%): 20%
- Knee (10%): 10%

Total rating without bilateral factor: 100% + 30% + 20% + 10% = 160%

**Step 2:** Apply the bilateral factor to adjust the total rating.
- Since we have two conditions (PTSD and tinnitus), we will use the bilateral factor of 30% for both.
- Adjusted total rating: 160% x 30% = 480%

**Step 3:** Apply the whole-person formula to adjust the rating further if necessary.
- The whole-person formula does not apply in this case since we have already applied the bilateral factor.

**Combined Rating:** 480%

The combined rating for your conditions is 480%. This reflects the 100% rating for PTSD, the 30% rating for tinnitus, and the 20% rating for back, with the bilateral factor applied to account for the two conditions. The knee condition is not assigned a
```

---

## a12 — Combined with bilateral factor

**Input:** Calculate combined rating with bilateral factor for both knees at 10% each plus 30% back.

**Variant A (no persona, stop=eos):**

```
To calculate the combined rating with bilateral factor for both knees at 10% each plus 30% back, we need to follow these steps:
- Calculate the combined rating for both knees: Since both knees have the same rating (10%), we can simply add them together: 10% + 10% = 20%.
- Apply the bilateral factor: The bilateral factor for both knees is 2. This means we multiply the combined rating by 2: 20% * 2 = 40%.
- Calculate the rating for the back: The rating for the back is 30%.
- Add the ratings together: 40% (knees) + 30% (back) = 70%. The combined rating with bilateral factor for both knees at 10% each plus 30% back is 70%.
```

**Variant B (persona-in-instruction, stop=eos):**

```
To calculate the combined rating for both knees at 10% each plus the rating for the back at 30%, we follow these steps:

1. **Calculate the combined rating for the knees:**
   - Each knee is rated at 10% under Diagnostic Code 50038 (Patellofemoral Pain Syndrome).
   - The bilateral factor for knee conditions is 2x (2 times the individual rating).
   - So, the combined rating for both knees is 10% x 2 = 20%.
   - The individual rating for each knee is 10%, so the total rating for both knees is 20%.

2. **Add the rating for the back:**
   - The rating for the back under Diagnostic Code 5005 (Ankylosing Spondylitis) is 30%.
   - We add this to the combined rating for the knees: 20% (knees) + 30% (back) = 50%.

The combined rating for both knees at 10% each plus the rating for the back at 30% is 50%. Documentation must include: current diagnostic codes, specific criteria for each condition, current severity, functional limitations, and any treatment (medications, physical therapy, surgery).
```

---

## a13 — TDIU eligibility check

**Input:** Am I eligible for TDIU with one 60% rating and three 20% ratings?

**Variant A (no persona, stop=limit):**

```
No, you are not eligible for Total Disability Individual Unemployability (TDIU) with one 60% rating and three 20% ratings. The rating requirements for TDIU are:
- 100%: A total disability rating of 100% or the equivalent in separate ratings
- 70%: A total disability rating of 70% or the equivalent in separate ratings
- 60%: A total disability rating of 60% or the equivalent in separate ratings
- 50%: A total disability rating of 50% or the equivalent in separate ratings
- 40%: A total disability rating of 40% or the equivalent in separate ratings
- 30%: A total disability rating of 30% or the equivalent in separate ratings
- 20%: A total disability rating of 20% or the equivalent in separate ratings
- 10%: A total disability rating of 10% or the equivalent in separate ratings
- 0%: A total disability rating of 0% or the equivalent in separate ratings
- Equivalent: The equivalent rating under Diagnostic Code 100% (Total Disability) or any other rating that reflects the individual's inability to work
- Combined: The individual's combined disability rating must be at least 70% or the equivalent in separate ratings
- Separately Rated: The individual must have at least one rating of 100% or the equivalent in separate ratings
- Percentage: The individual's total disability rating must be at least 70% or the equivalent in separate ratings
- Individual: The individual must have a total disability rating of 100% or the equivalent in separate ratings
- Separate: The individual must have at least one
```

**Variant B (persona-in-instruction, stop=eos):**

```
To determine eligibility for Total Disability Individual Unemployability (TDIU), we must calculate the combined rating and then apply the rating schedule for TDIU.

**Step 1: Calculate Combined Rating**
- One 60% rating
- Three 20% ratings = 60 + (3 * 20) = 60 + 60 = 120

**Step 2: Apply TDIU Rating Schedule**
The rating schedule for TDIU is 100%: If the combined rating is 100% or more, the veteran is eligible for TDIU.
- Combined rating: 120%
- Eligible for TDIU: Yes

Since the veteran's combined rating is 120%, they are eligible for TDIU under 38 CFR 4.16. Documentation must be provided to support the unemployability claim.
```

---

## a14 — Analyze current rating breakdown

**Input:** Analyze my 80% combined rating and explain how the math works.

**Variant A (no persona, stop=limit):**

```
Your 80% combined rating is calculated by adding 80% of your Social Security earnings record to 80% of your disability benefits. The formula for this calculation is:
\[ \text{Combined Rating} = 0.8 \times (\text{Earnings Record} + \text{Disability Benefits}) \]
For example, if your earnings record is $100,000 and your disability benefits are $20,000, your combined rating would be:
\[ \text{Combined Rating} = 0.8 \times (100,000 + 20,000) = 0.8 \times 120,000 = 96,000 \]
This means your combined rating is $96,000. The math works by applying an 80% multiplier to both your earnings record and your disability benefits, then adding the two results together. The combined rating is then used to determine your overall rating. The specific formula used may vary depending on the Social Security Administration's (SSA) current policies and regulations. However, the general concept remains the same. The SSA uses this combined rating to calculate your average indexed monthly earnings (AIME) and to determine your retirement benefits. The AIME is then used to calculate your primary insurance amount (PIA), which is the amount of monthly benefits you are eligible to receive based on your earnings record. The PIA is adjusted based on your age and the number of years you've been receiving benefits. The SSA uses the PIA to calculate your full retirement benefit amount, which is the maximum amount you can receive based on your earnings record. The full retirement benefit amount is then adjusted based on your age, with higher benefits available for those who delay their retirement beyond full retirement age
```

**Variant B (persona-in-instruction, stop=limit):**

```
The calculation for an 80% combined rating involves:
- 100% for the higher rated service-connected condition
- 60% for the lower rated service-connected condition
- 30% for the non-service-connected condition

The math for this rating combination is:
- 100% (higher rated) + 60% (lower rated) + 30% (non-service-connected) = 190%
- Since the total cannot exceed 100%, the excess (190% - 100%) is 90%
- The excess is then divided by 100% to find the percentage increase: 90% / 100% = 0.9
- The increase is then added to the higher rating: 100% + 0.9 = 100.9%
- The excess from the lower rating is: 60% - 50% (50% is the maximum for the lower rating) = 10%
- The excess is then divided by 50% to find the percentage increase: 10% / 50% = 0.2
- The increase is then added to the lower rating: 60% + 0.2 = 60.2%
- The non-service-connected condition's rating is: 30% + 10% (10% is the maximum for the non-service-connected condition) = 40%
- The combined rating is: 100.9% (higher rating) + 60.2% (lower rating) + 40% (non-service-connected) = 201.1%
- Since the total cannot exceed 100%, the excess (201.1% - 100%) is 101.1%
- The excess is then divided
```

---

