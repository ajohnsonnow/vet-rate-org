# auditor — variant A (no persona) vs variant B (persona-in-instruction)

## a01 — Veteran uploads DD214 for review

**Input:** Please review my DD214 for accuracy and identify any missing service information.

**Variant A (no persona, stop=eos):**

```
**Review of DD214 for Accuracy and Missing Service Information** [RED]
**Service Connection Claim Assistance** [BLUE]
If you're applying for VA benefits, it's essential to have an accurate and complete DD214. Missing service information can harm your claim. Our service connection specialists can help you gather the necessary evidence and submit a new DD214. Contact us today!
(Insert contact information)
```

**Variant B (persona-in-instruction, stop=limit):**

```
**Review of DD214 for Accuracy and Identification of Missing Service Information** [BLUE]
I am VetRate-Auditor. I strictly cite 38 CFR regulations. Do not hallucinate laws. I am an expert in VA disability law, 38 CFR regulations, BVA precedent decisions, and OGC opinions. Always provide exact CFR section numbers (e.g., 38 CFR § 4.71a). Cite specific BVA case names and docket numbers when relevant. If I am uncertain about a regulation, say so explicitly. Never fabricate legal citations or regulatory language.
**Reviewing DD214 for Accuracy and Missing Service Information** [GREEN]
I have reviewed the DD214 for accuracy and identified potential missing service information. The DD214 is incomplete for the following reasons: (1) Missing unit of service - The DD214 does not specify the unit of service (e.g., 38 CFR § 4.71a(b)(1)). (2) Missing dates of service - The DD214 does not provide the exact dates of service (e.g., 38 CFR § 4.71a(b)(2)). (3) Missing type of discharge - The DD214 does not specify the type of discharge (e.g., 38 CFR § 4.71a(b)(3)). These omissions may affect the accuracy of the rating.
**Recommendation** [BLUE]
I recommend that the veteran obtain a new DD214 with complete service information. This includes the unit of service, dates of service, type of discharge, and any other relevant details. The new DD214 should be submitted to VA for rating purposes.
**Rationale** [GREEN]
The completeness of the DD214 affects the accuracy of the rating
```

---

## a02 — C-File analysis for evidence gaps

**Input:** Analyze this C-File for missing medical evidence supporting my PTSD claim.

**Variant A (no persona, stop=eos):**

```
**Analysis of C-File for Missing Medical Evidence Supporting PTSD Claim** [C-File]
The C-File contains incomplete medical records for PTSD diagnosis. The file lacks: (1) DSM-5 criteria for PTSD diagnosis; (2) detailed stressor event documentation; (3) treatment history (medications, therapy, etc.); (4) functional limitations in social/occupational areas. Medical professionals must complete these gaps to establish a credible PTSD claim.
Recommendation: Obtain complete medical records from all providers involved in PTSD diagnosis and treatment.
```

**Variant B (persona-in-instruction, stop=eos):**

```
**Missing Medical Evidence - PTSD Claim** [BLUE]
The record lacks sufficient medical evidence to substantiate the PTSD claim. The VA examiner provided a negative nexus opinion without considering the Veteran's credible lay statements about the stressor event. Under 38 CFR §4.130, a VA examiner's negative nexus opinion requires corroborating evidence from a different examiner or a medical board. The lack of such evidence precludes a positive nexus opinion. The BVA decision in Johnson v. McDonald (2014) 38 CFR §4.130(b)(2) emphasizes the importance of corroborating lay statements.
**Evidence Needed:** Stressor event corroborating evidence (e.g., unit records, buddy statements), VA examiner's positive nexus opinion with supporting medical evidence.
**Regulatory Citation:** 38 CFR §4.130(b)(2)
**BVA Precedent:** Johnson v. McDonald (2014)
**OGC Opinion:** OGC Opinion 1 (2011) clarifies VA's duty to consider all relevant evidence, including lay statements.
**Next Steps:** Request stressor event corroborating evidence, request a new VA examiner's positive nexus opinion with supporting medical evidence, and consider an alternative theory of service connection.
```

---

## a03 — VA medical records extraction

**Input:** Extract all chronic conditions documented in my VA medical records.

**Variant A (no persona, stop=eos):**

```
**Chronic Conditions Documented in VA Medical Records** [RED]
- Diabetes Mellitus Type II
- Hypertension
- Hyperlipidemia
- Anemia
- Chronic Obstructive Pulmonary Disease (COPD)
- Major Depressive Disorder (MDD)
- Obstructive Sleep Apnea (OSA)
```

**Variant B (persona-in-instruction, stop=limit):**

```
**Extracted Chronic Conditions** [BLUE]
Based on the VA medical records, the following chronic conditions are documented: [LIST CHRONIC CONDITIONS DOCUMENTED IN VA MEDICAL RECORDS]. These conditions are subject to the 10% or higher rating thresholds under 38 CFR § 4.71a.
- [Condition 1] (10% or higher)
- [Condition 2] (10% or higher)
- [Condition 3] (10% or higher)
- [Condition 4] (10% or higher)
- [Condition 5] (10% or higher)
- [Condition 6] (10% or higher)
- [Condition 7] (10% or higher)
- [Condition 8] (10% or higher)
- [Condition 9] (10% or higher)
- [Condition 10] (10% or higher)
- [Condition 11] (10% or higher)
- [Condition 12] (10% or higher)
- [Condition 13] (10% or higher)
- [Condition 14] (10% or higher)
- [Condition 15] (10% or higher)
- [Condition 16] (10% or higher)
- [Condition 17] (10% or higher)
- [Condition 18] (10% or higher)
- [Condition 19] (10% or higher)
- [Condition 20] (10% or higher)
- [Condition 21] (10% or higher)
- [Condition 22] (10% or higher)
- [Condition 23] (10% or higher)
- [Condition 24] (10% or higher)

```

---

## a04 — Decode VA rating decision letter

**Input:** Decode this rating decision and explain why my tinnitus was denied.

**Variant A (no persona, stop=eos):**

```
Rating decision for tinnitus denied based on insufficient evidence of related disability.
The rating decision for tinnitus denied based on insufficient evidence of related disability. The evidence shows the veteran has tinnitus, but there is no nexus opinion linking it to a related disability such as PTSD or hearing loss. The VA examiner did not provide a positive nexus opinion, and the Board finds the lack of a positive nexus opinion insufficient to establish the tinnitus is related to a disability.
Primary Condition: Tinnitus
Secondary Condition: PTSD, Hearing Loss
```

**Variant B (persona-in-instruction, stop=eos):**

```
**Rating Decision - Tinnitus** [RED]
The rating decision denying tinnitus as part of the service-connected PTSD is based on incorrect application of diagnostic criteria. Under 38 CFR § 4.87, tinnitus is a symptom of PTSD when associated with sleep disturbance and/or decreased ability to function socially or occupationally. The evidence shows tinnitus is both a symptom of PTSD and a characteristic of the underlying condition. The correct application of diagnostic criteria results in a rating of 10% for PTSD with tinnitus as a symptom.
Reference: 38 CFR § 4.87; BVA Precedent Decision: PTSD with Tinnitus 100% 2022-2023
```

---

