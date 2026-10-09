# eCFR vs Local Database Reconciliation

**Generated:** 2026-01-22 10:30:53

## Summary

| Category | Count |
|----------|-------|
| Matched (verified) | 652 |
| Name mismatches | 88 |
| Local only | 8 |
| eCFR valid missing from local | 1 |
| eCFR removed codes | 43 |
| eCFR metadata (not codes) | 57 |
| **Total inventory** | **792** |

## Explanation of 841 vs 748 Discrepancy

The eCFR scrape found 841 entries, but many are NOT diagnostic codes:

- **57 entries** are table headers/metadata
- **43 codes** have been officially REMOVED
- **1 codes** are legitimately missing from our DB

## Removed Codes (Officially Obsolete)

These codes are marked as [Removed] in 38 CFR and should be tagged as obsolete:

| Code | Status |
|------|--------|
| 5018 | REMOVED |
| 5020 | REMOVED |
| 5022 | REMOVED |
| 9202 | REMOVED |
| 9203 | REMOVED |
| 9204 | REMOVED |
| 9205 | REMOVED |
| 9327 | REMOVED |
| 5103 | REMOVED |
| 6286 | REMOVED |
| 6517 | REMOVED |
| 6705 | REMOVED |
| 6801 | REMOVED |
| 6813 | REMOVED |
| 6815 | REMOVED |
| 6816 | REMOVED |
| 6818 | REMOVED |
| 7013 | REMOVED |
| 7014 | REMOVED |
| 7302 | REMOVED |
| 7316 | REMOVED |
| 7322 | REMOVED |
| 7324 | REMOVED |
| 7340 | REMOVED |
| 7341 | REMOVED |
| 7503 | REMOVED |
| 7513 | REMOVED |
| 7526 | REMOVED |
| 7622 | REMOVED |
| 7623 | REMOVED |
| 7700 | REMOVED |
| 7701 | REMOVED |
| 7713 | REMOVED |
| 7810 | REMOVED |
| 7812 | REMOVED |
| 7814 | REMOVED |
| 7910 | REMOVED |
| 9200 | REMOVED |
| 9503 | REMOVED |
| 9906 | REMOVED |
| 9907 | REMOVED |
| 9910 | REMOVED |
| 9912 | REMOVED |

## Missing Valid Codes (Need to Add)

These are valid DC codes found in eCFR but missing from our database:

| Code | Name |
|------|------|
| 6037 | Pinguecula |

## Name Mismatches (Consider Updating)

| Code | Local Name | eCFR Name |
|------|-----------|----------|
| 5152 | Single finger: Thumb | Thumb, amputation of |
| 5298 | Complex Regional Pain Syndrome | Coccyx, removal of |
| 6000 | Visual Acuity Impairment | Choroidopathy, including uveit |
| 6002 | Diabetes Mellitus | Scleritis |
| 6017 | Conjunctivitis, trachomatous,  | Trachomatous conjunctivitis |
| 6026 | Glaucoma | Optic neuropathy |
| 6081 | Scotoma | Scotoma, unilateral |
| 6260 | Tinnitus | Tinnitus, recurrent |
| 6300 | Tuberculosis | Vibriosis (Cholera, Non-choler |
| 6310 | Syphilis | Syphilis, and other treponema  |
| 6510 | Sinusitis (Chronic) | Sinusitis, pansinusitis, chron |
| 6602 | Asthma | Asthma, bronchial |
| 6703 | Pulmonary TB, active, minimal | Tuberculosis, pulmonary, chron |
| 6723 | Pulmonary TB, inactive, minima | Tuberculosis, pulmonary, chron |
| 7001 | Endocarditis | Endocarditis, or |
| 7002 | Congestive Heart Failure | Pericarditis |
| 7010 | Atrial Fibrillation | Supraventricular tachycardia |
| 7117 | Peripheral Artery Disease | Raynaud's syndrome (also known |
| 7331 | Peritonitis | Peritonitis, tuberculous, acti |
| 7342 | Visceroptosis | Visceroptosis, symptomatic, ma |
| 7501 | Chronic Kidney Disease | Kidney, abscess of |
| 7800 | Skin Conditions (Various) | Burn scar(s) of the head, face |
| 7900 | Hyperthyroidism (Graves' disea | Hyperthyroidism, including, bu |
| 8002 | Paralysis of Facial Nerve (Bel | Malignant |
| 8003 | Brain, new growth of, benign | Benign, minimum |
| 8022 | Spinal cord, new growth of, be | Benign, minimum rating |
| 8305 | Neuritis, fifth cranial nerve | Neuritis |
| 8405 | Neuralgia, fifth cranial nerve | Neuralgia |
| 8307 | Neuritis, seventh cranial nerv | Neuritis |
| 8407 | Neuralgia, seventh cranial ner | Neuralgia |
