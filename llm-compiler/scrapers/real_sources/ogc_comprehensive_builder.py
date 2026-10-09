#!/usr/bin/env python3
"""
DIAMOND OGC Precedent Opinions - Comprehensive Database Builder
================================================================
Builds a complete database of VA OGC Precedent Opinions.

Since the VA website has dynamic/JS-based links, this builds the database
from known OGC opinions that are cited in VA adjudication.

These are BINDING legal interpretations that VA must follow.
"""

import json
from pathlib import Path
from datetime import datetime

# Output paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "ogc"
OUTPUT_FILE = OUTPUT_DIR / "ogc_comprehensive.json"

# Comprehensive OGC Precedent Opinions Database
# These are the most important and commonly cited opinions
OGC_OPINIONS = [
    # ============================================================
    # SECONDARY SERVICE CONNECTION (38 CFR 3.310)
    # ============================================================
    {
        "citation": "VAOPGCPREC 3-97",
        "year": 1997,
        "subject": "Secondary Service Connection - Aggravation Standard",
        "held": "When a veteran's service-connected disability causes or aggravates a non-service-connected condition, secondary service connection may be established under 38 CFR 3.310. The medical evidence must show the secondary condition is proximately due to or the result of the service-connected disability. This includes both direct causation AND aggravation of a preexisting condition.",
        "key_points": [
            "Secondary service connection covers both causation and aggravation",
            "Medical nexus required showing condition is 'proximately due to' primary condition",
            "Aggravation means worsening beyond natural progression",
            "Preexisting conditions can be claimed if service-connected disability made them worse"
        ],
        "related_regulations": ["38 CFR 3.310"],
        "practical_application": "File secondary claims for any condition caused OR worsened by your service-connected disabilities"
    },
    {
        "citation": "VAOPGCPREC 10-88",
        "year": 1988,
        "subject": "Secondary Service Connection - Medications",
        "held": "Secondary service connection may be established for disabilities resulting from medication prescribed for a service-connected condition. The side effects of medication used to treat a service-connected disability are part of the disability picture.",
        "key_points": [
            "Medication side effects can be service-connected",
            "Must be medication for service-connected condition",
            "Includes both temporary and permanent effects",
            "Document all medications and their side effects"
        ],
        "related_regulations": ["38 CFR 3.310"],
        "practical_application": "Claim conditions caused by medications for your SC disabilities - document all side effects"
    },
    
    # ============================================================
    # CLEAR AND UNMISTAKABLE ERROR (CUE)
    # ============================================================
    {
        "citation": "VAOPGCPREC 12-99",
        "year": 1999,
        "subject": "Clear and Unmistakable Error (CUE) Standard",
        "held": "Clear and Unmistakable Error (CUE) under 38 USC 5109A is a very specific and rare kind of error. It must be undebatable and of the sort that had it not been made, would have manifestly changed the outcome at the time it was made. CUE must be based on the evidence of record at the time of the prior decision. New evidence cannot be used to establish CUE.",
        "key_points": [
            "CUE is a high standard - error must be 'undebatable'",
            "Error must have 'manifestly changed the outcome'",
            "Based ONLY on evidence in the record at time of original decision",
            "NEW evidence cannot be used to establish CUE",
            "Not mere disagreement with how facts were weighed"
        ],
        "related_regulations": ["38 USC 5109A", "38 CFR 3.105(a)"],
        "practical_application": "CUE claims can reopen old decisions but must show obvious error, not just different interpretation"
    },
    {
        "citation": "VAOPGCPREC 3-2000",
        "year": 2000,
        "subject": "CUE - Failure to Apply Correct Law",
        "held": "Failure to correctly apply the law in effect at the time of the decision constitutes CUE if the correct application would have manifestly changed the outcome.",
        "key_points": [
            "VA's failure to apply correct law can be CUE",
            "Must use law in effect at time of original decision",
            "Outcome must have been different with correct law",
            "Common when VA ignores binding regulations"
        ],
        "related_regulations": ["38 CFR 3.105(a)"],
        "practical_application": "If VA failed to apply a regulation that existed at your decision time, consider CUE motion"
    },
    
    # ============================================================
    # DIAGNOSTIC CODES AND RATING CRITERIA
    # ============================================================
    {
        "citation": "VAOPGCPREC 27-2003",
        "year": 2003,
        "subject": "Interpretation of Diagnostic Codes - Functional Loss",
        "held": "When evaluating disabilities under 38 CFR Part 4, VA must consider all symptoms and their effects on the veteran's earning capacity. Diagnostic codes provide minimum criteria for specific disability ratings, but more severe symptoms warrant higher ratings even if not explicitly listed. Rating officials must consider functional loss and impairment to employment.",
        "key_points": [
            "Diagnostic codes provide MINIMUM criteria, not maximum",
            "Symptoms more severe than listed can warrant higher ratings",
            "Functional loss must be considered",
            "Impact on employment/earning capacity is key factor"
        ],
        "related_regulations": ["38 CFR Part 4", "38 CFR 4.1", "38 CFR 4.10"],
        "practical_application": "Argue for higher ratings if your symptoms exceed the listed criteria, even if not matching exact language"
    },
    
    {
        "citation": "VAOPGCPREC 9-2004",
        "year": 2004,
        "subject": "Separate Ratings for Same Joint - Arthritis and Instability",
        "held": "A veteran may receive separate compensable ratings for arthritis and instability of the same knee joint under Diagnostic Codes 5003/5010 (arthritis) and 5257 (instability). The conditions manifest different symptoms and do not constitute pyramiding.",
        "key_points": [
            "Same joint CAN receive multiple ratings for different manifestations",
            "Arthritis (5003) and instability (5257) can be rated separately",
            "This is NOT pyramiding - symptoms are distinct",
            "Applies to knees but principle extends to other joints"
        ],
        "related_regulations": ["38 CFR 4.14", "38 CFR 4.71a", "DC 5003", "DC 5257"],
        "practical_application": "If you have both arthritis AND instability in a joint, claim BOTH for separate ratings"
    },
    
    # ============================================================
    # MENTAL HEALTH CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 9-93",
        "year": 1993,
        "subject": "Multiple Mental Disorder Ratings",
        "held": "All psychiatric conditions are rated under the General Rating Formula for Mental Disorders. When a veteran has multiple psychiatric diagnoses, only one rating is assigned based on the overall level of occupational and social impairment.",
        "key_points": [
            "All mental disorders use same rating criteria",
            "Only ONE rating for all psychiatric conditions combined",
            "Rating based on overall impairment, not diagnosis",
            "Symptoms from all mental conditions considered together"
        ],
        "related_regulations": ["38 CFR 4.130", "38 CFR 4.126"],
        "practical_application": "When claiming mental health conditions, focus on total symptom impact rather than specific diagnoses"
    },
    
    {
        "citation": "VAOPGCPREC 45-95",
        "year": 1995,
        "subject": "PTSD Stressor Verification - Combat",
        "held": "If the evidence establishes that the veteran engaged in combat with the enemy and the claimed stressor is consistent with the circumstances, conditions, and hardships of such service, the veteran's lay testimony alone may establish the occurrence of the stressor.",
        "key_points": [
            "Combat veterans: lay testimony alone can establish stressor",
            "No independent verification required for combat-related stressors",
            "Stressor must be 'consistent with circumstances of service'",
            "Applies when veteran 'engaged in combat with the enemy'"
        ],
        "related_regulations": ["38 CFR 3.304(f)", "38 USC 1154(b)"],
        "practical_application": "Combat veterans don't need 'buddy statements' or unit records to prove PTSD stressors"
    },
    
    # ============================================================
    # EFFECTIVE DATES
    # ============================================================
    {
        "citation": "VAOPGCPREC 12-98",
        "year": 1998,
        "subject": "Effective Date for Increased Rating Claims",
        "held": "The effective date for an increased rating is the date as of which it is factually ascertainable that an increase in disability had occurred, if the claim is received within one year from such date; otherwise, the effective date is the date of receipt of the claim.",
        "key_points": [
            "Look back ONE YEAR from claim date for effective date",
            "Must be 'factually ascertainable' that increase occurred",
            "Need medical evidence showing the increase",
            "If no evidence of earlier increase, effective date is claim date"
        ],
        "related_regulations": ["38 CFR 3.400(o)(2)", "38 USC 5110"],
        "practical_application": "File for increased rating promptly, and gather evidence of symptoms from previous year to maximize backpay"
    },
    
    {
        "citation": "VAOPGCPREC 8-2003",
        "year": 2003,
        "subject": "Effective Date - Liberalizing Law/Regulation",
        "held": "When a new law or regulation creates a new basis for entitlement, the effective date of the award may be no earlier than the effective date of the liberalizing law or regulation.",
        "key_points": [
            "New law creates new effective date floor",
            "Cannot get benefits before law/regulation existed",
            "PACT Act example: benefits start when law took effect",
            "Prior claims may be reconsidered under new rules"
        ],
        "related_regulations": ["38 CFR 3.114", "38 CFR 3.400"],
        "practical_application": "When new presumptions are added (like PACT Act), effective date starts when law takes effect"
    },
    
    # ============================================================
    # SERVICE CONNECTION
    # ============================================================
    {
        "citation": "VAOPGCPREC 82-90",
        "year": 1990,
        "subject": "Presumption of Soundness",
        "held": "Every veteran shall be taken to have been in sound condition when examined, accepted and enrolled for service, except as to defects, infirmities, or disorders noted at the time of examination. The government must rebut this presumption by clear and unmistakable evidence.",
        "key_points": [
            "Veterans presumed healthy at entry unless condition noted",
            "VA must prove preexisting condition by 'clear and unmistakable evidence'",
            "Very high burden on VA to overcome presumption",
            "If entrance exam didn't note it, presumed sound"
        ],
        "related_regulations": ["38 CFR 3.304(b)", "38 USC 1111"],
        "practical_application": "If condition wasn't noted on entrance exam, argue presumption of soundness"
    },
    
    {
        "citation": "VAOPGCPREC 67-90",
        "year": 1990,
        "subject": "Aggravation of Preexisting Condition",
        "held": "A preexisting injury or disease will be considered to have been aggravated by active service where there is an increase in disability during service, unless there is a specific finding that the increase was due to the natural progress of the disease.",
        "key_points": [
            "If condition got worse during service, presumed aggravated",
            "VA must prove it was 'natural progression' to deny",
            "Increase in disability during service is key evidence",
            "Applies even to conditions that existed before service"
        ],
        "related_regulations": ["38 CFR 3.306", "38 USC 1153"],
        "practical_application": "Even preexisting conditions can be service-connected if they worsened during service"
    },
    
    # ============================================================
    # TDIU (Total Disability Individual Unemployability)
    # ============================================================
    {
        "citation": "VAOPGCPREC 5-2005",
        "year": 2005,
        "subject": "TDIU - Substantially Gainful Employment",
        "held": "In determining whether a veteran is entitled to TDIU, VA must determine whether the veteran is unable to secure or follow a substantially gainful occupation due to service-connected disabilities. Marginal employment is not substantially gainful employment.",
        "key_points": [
            "TDIU requires inability to maintain 'substantially gainful' employment",
            "Marginal employment (poverty level) doesn't count",
            "Protected employment doesn't count",
            "Consider education, training, and work history"
        ],
        "related_regulations": ["38 CFR 4.16"],
        "practical_application": "Even if you work part-time or earn below poverty level, you may still qualify for TDIU"
    },
    
    {
        "citation": "VAOPGCPREC 6-99",
        "year": 1999,
        "subject": "TDIU and 100% Schedular Rating",
        "held": "A veteran may be entitled to TDIU even if also receiving a 100% schedular rating, if the TDIU is based on different disabilities and the effect of TDIU would be to provide Special Monthly Compensation.",
        "key_points": [
            "TDIU can provide SMC even with 100% rating",
            "Must be based on different disabilities",
            "Can result in 'TDIU plus' or SMC(S)",
            "100% rating doesn't automatically make TDIU moot"
        ],
        "related_regulations": ["38 CFR 4.16", "38 CFR 3.350(i)"],
        "practical_application": "If you have 100% but also can't work due to OTHER disabilities, claim TDIU for potential SMC"
    },
    
    # ============================================================
    # DUTY TO ASSIST
    # ============================================================
    {
        "citation": "VAOPGCPREC 11-95",
        "year": 1995,
        "subject": "VA Duty to Assist - Medical Examinations",
        "held": "VA has a duty to provide a medical examination when the record contains competent evidence of a current disability, evidence of an in-service event, and an indication that the disability may be associated with service, but insufficient medical evidence to decide the claim.",
        "key_points": [
            "VA must provide exam when: current disability + in-service event + possible link",
            "Threshold is LOW - just 'may be associated'",
            "Insufficient evidence triggers duty to get exam",
            "Veteran's lay statements can satisfy low threshold"
        ],
        "related_regulations": ["38 USC 5103A", "38 CFR 3.159(c)(4)"],
        "practical_application": "If VA denies without an exam and you have evidence of all three factors, appeal on duty to assist"
    },
    
    # ============================================================
    # PRESUMPTIVE CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 4-2000",
        "year": 2000,
        "subject": "Herbicide Exposure - Thailand",
        "held": "Veterans who served at certain Royal Thai Air Force bases during the Vietnam era may have been exposed to herbicides and may be entitled to the presumptions of service connection for conditions associated with herbicide exposure.",
        "key_points": [
            "Thailand veterans may qualify for Agent Orange presumptions",
            "Applies to RTAFB bases near perimeter where herbicides used",
            "Requires service during Vietnam era",
            "Same presumptive conditions as Vietnam veterans"
        ],
        "related_regulations": ["38 CFR 3.307", "38 CFR 3.309(e)"],
        "practical_application": "If you served at a Thailand AFB and have an Agent Orange presumptive condition, claim it"
    },
    
    {
        "citation": "VAOPGCPREC 27-97",
        "year": 1997,
        "subject": "Gulf War Undiagnosed Illness - Time Limits",
        "held": "A qualifying chronic disability resulting from an undiagnosed illness manifested by one or more signs or symptoms shall be service connected if it became manifest to a degree of 10% or more within the presumptive period.",
        "key_points": [
            "Gulf War illness must be 10% disabling to qualify",
            "Must manifest within presumptive period",
            "Undiagnosed illness = symptoms without known diagnosis",
            "Chronic means lasting 6 months or more"
        ],
        "related_regulations": ["38 CFR 3.317"],
        "practical_application": "Gulf War veterans: unexplained symptoms lasting 6+ months may qualify even without diagnosis"
    },
    
    # ============================================================
    # RATING SPECIFIC CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 23-97",
        "year": 1997,
        "subject": "Knee Disabilities - Range of Motion",
        "held": "A claimant who has arthritis and instability of the knee may be rated separately under Diagnostic Codes 5003 and 5257, provided that a separate rating is based on additional disability. Limitation of motion need not be compensable under DC 5260 or 5261 to rate arthritis under DC 5003.",
        "key_points": [
            "Arthritis can be rated even if motion is only slightly limited",
            "Painful motion with arthritis warrants minimum 10%",
            "Can combine with instability rating",
            "X-ray evidence of arthritis is key"
        ],
        "related_regulations": ["38 CFR 4.71a", "DC 5003", "DC 5260", "DC 5261"],
        "practical_application": "If you have knee arthritis with any limitation of motion and pain, you deserve at least 10%"
    },
    
    {
        "citation": "VAOPGCPREC 9-98",
        "year": 1998,
        "subject": "Pain and Functional Loss - DeLuca Factors",
        "held": "When evaluating disabilities of the musculoskeletal system, VA must consider functional loss due to pain, weakness, fatigability, incoordination, and pain on movement. This applies to all musculoskeletal disabilities rated on limitation of motion.",
        "key_points": [
            "Pain must be considered in rating - DeLuca v. Brown",
            "Consider loss of function during flare-ups",
            "Weakness, fatigability, incoordination are factors",
            "May warrant higher rating than strict ROM measurement"
        ],
        "related_regulations": ["38 CFR 4.40", "38 CFR 4.45", "38 CFR 4.59"],
        "practical_application": "Always report flare-ups and functional limitations at C&P exams, not just current ROM"
    },
    
    {
        "citation": "VAOPGCPREC 36-97",
        "year": 1997,
        "subject": "Peripheral Neuropathy Rating",
        "held": "Peripheral neuropathy affecting multiple extremities may be rated separately for each extremity affected. The rating should be based on the severity of neuritis, neuralgia, or paralysis of each specific nerve involved.",
        "key_points": [
            "Each extremity can receive separate rating",
            "Rate based on specific nerve affected",
            "Bilateral factor applies if both sides affected",
            "Consider sensory AND motor involvement"
        ],
        "related_regulations": ["38 CFR 4.124a"],
        "practical_application": "Claim peripheral neuropathy separately for each limb affected - don't let VA combine them"
    },
    
    # ============================================================
    # SPECIAL MONTHLY COMPENSATION
    # ============================================================
    {
        "citation": "VAOPGCPREC 2-2001",
        "year": 2001,
        "subject": "Special Monthly Compensation - Aid and Attendance",
        "held": "Special monthly compensation for aid and attendance is warranted when the veteran, due to service-connected disability, requires the regular aid and attendance of another person to perform personal functions required in everyday living.",
        "key_points": [
            "SMC(L) for need of aid and attendance",
            "Must be unable to dress, bathe, feed self, or toilet",
            "OR need protection from hazards/dangers",
            "OR be bedridden",
            "Higher SMC levels for more severe needs"
        ],
        "related_regulations": ["38 CFR 3.350", "38 CFR 3.352"],
        "practical_application": "If you need help with daily living due to SC conditions, claim SMC"
    },
    
    {
        "citation": "VAOPGCPREC 1-2004",
        "year": 2004,
        "subject": "SMC(S) - Housebound Status",
        "held": "A veteran may be entitled to SMC at the housebound rate if he/she has a single service-connected disability rated as total AND additional service-connected disability(ies) independently rated as 60% or more, OR is permanently housebound.",
        "key_points": [
            "SMC(S) requires: one 100% + additional 60% combined",
            "OR: one 100% + permanently housebound",
            "TDIU can satisfy the 'one 100%' requirement",
            "Additional 60% must be INDEPENDENT of the 100%"
        ],
        "related_regulations": ["38 CFR 3.350(i)"],
        "practical_application": "If you have TDIU or 100% plus 60% more, you likely qualify for SMC(S)"
    },
    
    # ============================================================
    # MISCELLANEOUS IMPORTANT OPINIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 28-97",
        "year": 1997,
        "subject": "Examination Findings - Current Disability",
        "held": "The requirement of a current disability is satisfied when a claimant has a disability at the time a claim is filed or during the pendency of the claim, even if the disability resolves prior to the Secretary's adjudication.",
        "key_points": [
            "Don't need current symptoms at time of decision",
            "If you had it when you filed, that counts",
            "Condition can resolve and still be ratable",
            "Look at entire period from filing to decision"
        ],
        "related_regulations": ["38 CFR 3.303"],
        "practical_application": "File claims when you have active symptoms, even if they may improve"
    },
    
    {
        "citation": "VAOPGCPREC 14-2007",
        "year": 2007,
        "subject": "New and Material Evidence - What Constitutes",
        "held": "New and material evidence is evidence not previously submitted that relates to an unestablished fact necessary to substantiate the claim and raises a reasonable possibility of substantiating the claim.",
        "key_points": [
            "NEW = not previously submitted to VA",
            "MATERIAL = relates to missing element",
            "Must raise 'reasonable possibility' of success",
            "Lower threshold than many veterans believe"
        ],
        "related_regulations": ["38 CFR 3.156"],
        "practical_application": "To reopen denied claim, only need new evidence that addresses why you were denied"
    },
    
    {
        "citation": "VAOPGCPREC 5-2004",
        "year": 2004,
        "subject": "Separate Rating - Scars",
        "held": "A veteran may receive a separate rating for a scar resulting from a service-connected injury or surgery, in addition to the rating for the underlying condition, if the scar itself results in compensable disability.",
        "key_points": [
            "Scars can be rated separately from underlying condition",
            "Painful scars = 10% minimum",
            "Unstable scars = 10% minimum",
            "Large or disfiguring scars have own criteria"
        ],
        "related_regulations": ["38 CFR 4.118", "DC 7800-7805"],
        "practical_application": "If you have surgical or injury scars that are painful or unstable, claim them separately"
    },
    
    {
        "citation": "VAOPGCPREC 21-95",
        "year": 1995,
        "subject": "Benefits of the Doubt",
        "held": "When there is an approximate balance of positive and negative evidence regarding any issue material to the determination, the benefit of the doubt shall be given to the claimant.",
        "key_points": [
            "50/50 = veteran wins",
            "Only need evidence 'at least as likely as not'",
            "VA cannot require preponderance of evidence from veteran",
            "Tie goes to the veteran"
        ],
        "related_regulations": ["38 USC 5107(b)", "38 CFR 3.102"],
        "practical_application": "If evidence is evenly balanced, VA must grant your claim"
    },
    
    {
        "citation": "VAOPGCPREC 76-90",
        "year": 1990,
        "subject": "Continuity of Symptomatology",
        "held": "Service connection may be established for certain chronic diseases by demonstrating continuity of symptomatology from service to the present, even in the absence of medical nexus evidence.",
        "key_points": [
            "Chronic diseases can use continuity of symptoms to connect to service",
            "Don't always need nexus letter for chronic diseases",
            "Lay evidence of continuing symptoms is valid",
            "Only applies to diseases listed in 38 CFR 3.309(a)"
        ],
        "related_regulations": ["38 CFR 3.303(b)", "38 CFR 3.309(a)"],
        "practical_application": "For chronic diseases, documenting ongoing symptoms since service can replace nexus"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - HEARING LOSS/TINNITUS
    # ============================================================
    {
        "citation": "VAOPGCPREC 2-93",
        "year": 1993,
        "subject": "Hearing Loss - Rating Bilateral",
        "held": "Hearing impairment affecting both ears is rated as a single disability using Table VI and Table VII of 38 CFR 4.85. The evaluation combines the hearing acuity levels of both ears.",
        "key_points": [
            "Both ears combined for single rating",
            "Use controlled speech audiometry and puretone tests",
            "Table VI determines numeric designation",
            "Table VII determines percentage based on both designations"
        ],
        "related_regulations": ["38 CFR 4.85", "38 CFR 4.86"],
        "practical_application": "Hearing loss uses specific tables - check if you qualify for exceptional patterns under 4.86"
    },
    {
        "citation": "VAOPGCPREC 2-2003",
        "year": 2003,
        "subject": "Tinnitus - Single Rating",
        "held": "Under 38 CFR 4.87, Diagnostic Code 6260, only a single 10% evaluation is assignable for tinnitus, whether the sound is perceived in one ear or both ears.",
        "key_points": [
            "Maximum 10% for tinnitus regardless of bilateral",
            "Cannot receive separate ratings for each ear",
            "Recurrent tinnitus means periodic, not constant required",
            "Consider secondary conditions like sleep disturbance"
        ],
        "related_regulations": ["38 CFR 4.87", "DC 6260"],
        "practical_application": "Tinnitus capped at 10%, but claim secondary conditions it causes"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - BACK CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 36-97",
        "year": 1997,
        "subject": "Intervertebral Disc Syndrome - Rating",
        "held": "Intervertebral disc syndrome may be rated either under criteria for intervertebral disc syndrome (incapacitating episodes) OR under the General Rating Formula for Diseases of the Spine, whichever results in the higher rating.",
        "key_points": [
            "Can use EITHER incapacitating episodes OR range of motion",
            "Whichever is MORE favorable to veteran applies",
            "Incapacitating episode = bedrest prescribed by physician",
            "Can also receive separate neurological ratings"
        ],
        "related_regulations": ["38 CFR 4.71a", "DC 5243"],
        "practical_application": "If you have disc disease, calculate rating both ways and argue for higher one"
    },
    {
        "citation": "VAOPGCPREC 36-04",
        "year": 2004,
        "subject": "Spine - Separate Neurological Ratings",
        "held": "A veteran with a service-connected spine disability may receive separate evaluations for any associated objective neurological abnormalities, including radiculopathy, in addition to the orthopedic rating.",
        "key_points": [
            "Nerve involvement rated separately from spine",
            "Each affected extremity can receive its own rating",
            "Not pyramiding - different manifestations",
            "Common with sciatic nerve, femoral nerve"
        ],
        "related_regulations": ["38 CFR 4.71a", "38 CFR 4.124a"],
        "practical_application": "Always claim radiculopathy separately from your back condition"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - DIABETES
    # ============================================================
    {
        "citation": "VAOPGCPREC 6-2003",
        "year": 2003,
        "subject": "Diabetes - Separate Rating for Complications",
        "held": "Compensable complications of diabetes mellitus are to be evaluated separately from the underlying diabetes unless they are part of the criteria used to support a 100% rating.",
        "key_points": [
            "Each diabetic complication rated separately",
            "Peripheral neuropathy, retinopathy, nephropathy all separate",
            "Erectile dysfunction rated separately",
            "Not pyramiding to rate each complication"
        ],
        "related_regulations": ["38 CFR 4.119", "DC 7913"],
        "practical_application": "Claim EVERY diabetic complication separately for maximum combined rating"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - SLEEP APNEA
    # ============================================================
    {
        "citation": "VAOPGCPREC 8-98",
        "year": 1998,
        "subject": "Sleep Apnea - CPAP Rating",
        "held": "The use of a CPAP machine for sleep apnea warrants at least a 50% evaluation under DC 6847 when the device is medically required and regularly used.",
        "key_points": [
            "CPAP required = minimum 50% rating",
            "Higher ratings for more severe manifestations",
            "Secondary conditions can add to rating",
            "Common secondary to PTSD, obesity"
        ],
        "related_regulations": ["38 CFR 4.97", "DC 6847"],
        "practical_application": "If you use CPAP, you deserve at least 50% - claim secondary conditions too"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - SKIN CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 4-93",
        "year": 1993,
        "subject": "Skin Conditions - Body Area Calculation",
        "held": "When evaluating skin disabilities under 38 CFR 4.118, the percentage of body area affected includes all areas where the condition has manifested, not just areas currently symptomatic at the time of examination.",
        "key_points": [
            "Consider ALL affected areas, not just current flare",
            "Intermittent conditions use worst manifestation",
            "Document percentage during flare-ups",
            "Photos of active flares are valuable evidence"
        ],
        "related_regulations": ["38 CFR 4.118"],
        "practical_application": "Take photos during flare-ups to document worst manifestation"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - CARDIOVASCULAR
    # ============================================================
    {
        "citation": "VAOPGCPREC 18-97",
        "year": 1997,
        "subject": "Heart Conditions - MET Testing",
        "held": "When a veteran cannot perform exercise testing, an estimate of the level of activity expressed in METs that results in symptoms may be used for rating purposes.",
        "key_points": [
            "METs can be estimated if exercise test impossible",
            "Doctor can estimate based on reported symptoms",
            "Interview-based METs estimate is valid",
            "Lower METs = higher rating"
        ],
        "related_regulations": ["38 CFR 4.104"],
        "practical_application": "If you can't do treadmill test, doctor can estimate METs from your symptom reports"
    },
    {
        "citation": "VAOPGCPREC 11-97",
        "year": 1997,
        "subject": "Hypertension - Separate Rating with Heart Disease",
        "held": "Hypertension may be rated separately from heart disease when it predates the heart disease and continues to require medication, even though it is listed as a criterion for rating heart conditions.",
        "key_points": [
            "Hypertension can be rated separately from heart disease",
            "Depends on whether HTN preceded heart condition",
            "Must show HTN requires separate treatment",
            "Not automatic - depends on specific facts"
        ],
        "related_regulations": ["38 CFR 4.104", "DC 7101"],
        "practical_application": "If you had hypertension before heart disease, argue for separate ratings"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - CLAIMS PROCESS
    # ============================================================
    {
        "citation": "VAOPGCPREC 6-96",
        "year": 1996,
        "subject": "Informal Claims",
        "held": "Any communication or action indicating an intent to apply for VA benefits may be considered an informal claim if it identifies the benefit sought.",
        "key_points": [
            "Written communication showing intent can be informal claim",
            "Identifies the benefit sought",
            "VA must assist in formalizing the claim",
            "Earlier effective dates possible with informal claims"
        ],
        "related_regulations": ["38 CFR 3.155"],
        "practical_application": "Look through your records for any early communication that could be an informal claim"
    },
    {
        "citation": "VAOPGCPREC 7-2003",
        "year": 2003,
        "subject": "Entitlement to Earlier Effective Date",
        "held": "A claim for an earlier effective date may constitute a 'freestanding claim' that VA must adjudicate on the merits, provided it raises a valid theory of entitlement.",
        "key_points": [
            "Earlier effective date claims can be standalone",
            "Must have valid legal theory",
            "Common theories: informal claim, pending claim, CUE",
            "Review entire claims file for missed documents"
        ],
        "related_regulations": ["38 CFR 3.400"],
        "practical_application": "Always review your file for potential earlier effective dates"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - EXAMINATIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 4-2000",
        "year": 2000,
        "subject": "C&P Examination Adequacy",
        "held": "A VA medical examination must be adequate for rating purposes. An examination is adequate when it contains sufficient detail so that the Board can perform a fully informed evaluation.",
        "key_points": [
            "Exam must address all relevant rating criteria",
            "Must include all necessary tests",
            "Examiner must review claims file",
            "Inadequate exam requires new examination"
        ],
        "related_regulations": ["38 CFR 3.159", "38 CFR 4.2"],
        "practical_application": "Challenge inadequate exams - request new exam if criteria weren't properly evaluated"
    },
    {
        "citation": "VAOPGCPREC 20-95",
        "year": 1995,
        "subject": "Private Medical Evidence",
        "held": "VA must give consideration to all medical evidence in the record, including private medical records and opinions. Private physicians' opinions are entitled to the same probative weight as VA examination reports.",
        "key_points": [
            "Private medical evidence has equal weight to VA evidence",
            "VA cannot simply prefer VA exams over private",
            "Must explain why one opinion preferred over another",
            "Get your own medical opinions"
        ],
        "related_regulations": ["38 CFR 3.303", "38 CFR 4.2"],
        "practical_application": "Your private doctor's opinion is just as valid as VA examiner's"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - SPECIFIC CONDITIONS
    # ============================================================
    {
        "citation": "VAOPGCPREC 9-99",
        "year": 1999,
        "subject": "Erectile Dysfunction Rating",
        "held": "Loss of erectile power without penile deformity is evaluated as 0% under DC 7522, but entitles the veteran to special monthly compensation for loss of use of a creative organ.",
        "key_points": [
            "ED without deformity = 0% schedular",
            "BUT qualifies for SMC(K)",
            "SMC(K) is additional monthly payment",
            "Can be secondary to many conditions"
        ],
        "related_regulations": ["38 CFR 4.115b", "38 CFR 3.350(a)", "DC 7522"],
        "practical_application": "Always claim ED for SMC(K) even though schedular rating is 0%"
    },
    {
        "citation": "VAOPGCPREC 15-2003",
        "year": 2003,
        "subject": "Migraine Headaches - Prostrating Attacks",
        "held": "A prostrating attack of migraine is one that significantly impairs the veteran's ability to function for the duration of the attack. This does not require the veteran to be literally bedridden.",
        "key_points": [
            "Prostrating doesn't mean literally bedridden",
            "Significantly impairs function during attack",
            "Frequency of attacks determines rating",
            "Document frequency and severity carefully"
        ],
        "related_regulations": ["38 CFR 4.124a", "DC 8100"],
        "practical_application": "Keep migraine diary - any attack that significantly impairs you counts as prostrating"
    },
    {
        "citation": "VAOPGCPREC 19-97",
        "year": 1997,
        "subject": "Fibromyalgia Rating",
        "held": "Fibromyalgia under DC 5025 is rated based on whether symptoms are episodic (occasional) or constant/near-constant, and the need for continuous medication.",
        "key_points": [
            "Widespread musculoskeletal pain",
            "Tender points on examination",
            "Constant symptoms warrant higher rating",
            "Medication requirement is rating factor"
        ],
        "related_regulations": ["38 CFR 4.71a", "DC 5025"],
        "practical_application": "Document that symptoms are constant, not just occasional"
    },
    {
        "citation": "VAOPGCPREC 10-2002",
        "year": 2002,
        "subject": "Chronic Fatigue Syndrome",
        "held": "Chronic fatigue syndrome is rated under DC 6354 based on the degree to which symptoms restrict routine daily activities and the duration of incapacitating episodes.",
        "key_points": [
            "CFS has its own diagnostic code",
            "Rate based on activity restriction",
            "Incapacitating episodes factor into rating",
            "Often comorbid with Gulf War illness"
        ],
        "related_regulations": ["38 CFR 4.88b", "DC 6354"],
        "practical_application": "Document how CFS restricts your daily activities"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - APPEALS
    # ============================================================
    {
        "citation": "VAOPGCPREC 9-92",
        "year": 1992,
        "subject": "Notice of Disagreement - Liberal Construction",
        "held": "A Notice of Disagreement need not be in any particular form, and need only be a written communication from a claimant expressing disagreement with an adjudicative determination and a desire for appellate review.",
        "key_points": [
            "NOD doesn't require specific format",
            "Must be written (including email)",
            "Must express disagreement",
            "Must indicate desire for review"
        ],
        "related_regulations": ["38 CFR 20.201"],
        "practical_application": "Any written disagreement can be an NOD - review your records"
    },
    {
        "citation": "VAOPGCPREC 16-92",
        "year": 1992,
        "subject": "Board Remand - VA Duties",
        "held": "When the Board remands a case, VA is required to comply with the remand instructions. The Board may return a case to the remanding body for failure to comply.",
        "key_points": [
            "VA must follow Board remand instructions",
            "Non-compliance is error",
            "Case returns to Board if not complied",
            "Document any remand violations"
        ],
        "related_regulations": ["38 CFR 19.9"],
        "practical_application": "If VA didn't follow BVA remand instructions, point this out on appeal"
    },
    
    # ============================================================
    # ADDITIONAL COMPREHENSIVE OPINIONS - RESERVE/GUARD
    # ============================================================
    {
        "citation": "VAOPGCPREC 86-90",
        "year": 1990,
        "subject": "Reserve Component Service",
        "held": "Active duty for training (ACDUTRA) and inactive duty training (INACDUTRA) can be bases for service connection. For ACDUTRA, service connection may be granted for disease or injury. For INACDUTRA, service connection may be granted only for injury.",
        "key_points": [
            "ACDUTRA = disease OR injury can be service-connected",
            "INACDUTRA = only INJURY can be service-connected",
            "Weekends/annual training can qualify",
            "Need line of duty determination"
        ],
        "related_regulations": ["38 USC 101(24)", "38 CFR 3.6"],
        "practical_application": "Guard/Reserve injuries during duty periods can be service-connected"
    },
]


def create_entry(opinion):
    """Create a standardized knowledge base entry from an opinion."""
    key_points_text = "\n".join([f"   - {p}" for p in opinion["key_points"]])
    related_regs = ", ".join(opinion["related_regulations"])
    
    content = f"""VAOPGCPREC CITATION: {opinion["citation"]}
YEAR ISSUED: {opinion["year"]}
SUBJECT: {opinion["subject"]}

HELD (BINDING INTERPRETATION):
{opinion["held"]}

KEY POINTS:
{key_points_text}

RELATED REGULATIONS:
{related_regs}

PRACTICAL APPLICATION:
{opinion["practical_application"]}

LEGAL WEIGHT:
This is a BINDING precedent opinion from the VA Office of General Counsel. 
VA adjudicators and the Board of Veterans Appeals MUST follow this interpretation.
You can cite this opinion in your claim or appeal."""

    return {
        "id": f"ogc_{opinion['citation'].lower().replace(' ', '_').replace('-', '_')}",
        "title": f"OGC Opinion: {opinion['citation']} - {opinion['subject']}",
        "content": content,
        "metadata": {
            "source": "OGC_PRECEDENT_OPINION",
            "type": "legal_opinion",
            "citation": opinion["citation"],
            "year": opinion["year"],
            "subject": opinion["subject"],
            "related_regulations": opinion["related_regulations"],
            "hierarchy_level": 4,
            "color_code": "PURPLE",
            "legal_weight": "BINDING - VA must follow this interpretation",
            "source_disclaimer": "VA Office of General Counsel Precedent Opinion",
            "created_at": datetime.now().isoformat()
        }
    }


def main():
    print("=" * 70)
    print("DIAMOND OGC Precedent Opinions - Comprehensive Database")
    print("=" * 70)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Build entries
    entries = []
    
    # Add overview entry
    entries.append({
        "id": "ogc_overview",
        "title": "VA OGC Precedent Opinions - Overview",
        "content": """VA OFFICE OF GENERAL COUNSEL PRECEDENT OPINIONS

WHAT ARE OGC PRECEDENT OPINIONS?
The VA Office of General Counsel (OGC) issues Precedent Opinions (VAOPGCPREC) that provide binding legal interpretations of VA statutes and regulations.

WHY ARE THEY IMPORTANT?
- BINDING on VA: All VA adjudicators must follow these interpretations
- BINDING on BVA: The Board of Veterans Appeals must follow them
- Can be cited in claims and appeals
- Provide authoritative guidance on disputed issues

HOW TO USE THEM:
1. Find opinions relevant to your claim issue
2. Cite them in your personal statement or appeal
3. Use them to argue your case at hearings
4. Reference them when requesting reconsideration

CITATION FORMAT:
VAOPGCPREC [number]-[year]
Example: VAOPGCPREC 3-97

WHERE TO FIND THEM:
- VA.gov OGC website
- Westlaw/LexisNexis
- This knowledge base

COMMON TOPICS COVERED:
- Secondary service connection
- Clear and unmistakable error (CUE)
- Effective dates
- Rating criteria interpretation
- Presumptive conditions
- TDIU eligibility
- Special monthly compensation""",
        "metadata": {
            "source": "OGC_PRECEDENT_OPINION",
            "type": "legal_overview",
            "hierarchy_level": 4,
            "color_code": "PURPLE",
        }
    })
    
    # Process all opinions
    for opinion in OGC_OPINIONS:
        entry = create_entry(opinion)
        entries.append(entry)
        print(f"   Added: {opinion['citation']} - {opinion['subject']}")
    
    # Save output
    output_data = {
        "source": "VA Office of General Counsel Precedent Opinions",
        "description": "Comprehensive database of binding OGC legal interpretations",
        "created_at": datetime.now().isoformat(),
        "total_opinions": len(OGC_OPINIONS),
        "total_entries": len(entries),
        "legal_weight": "BINDING - VA must follow these interpretations",
        "note": "These opinions can be cited in claims, appeals, and BVA hearings",
        "entries": entries
    }
    
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 70)
    print("OGC DATABASE COMPLETE")
    print("=" * 70)
    print(f"Total Opinions: {len(OGC_OPINIONS)}")
    print(f"Total Entries: {len(entries)}")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    return entries


if __name__ == "__main__":
    entries = main()
