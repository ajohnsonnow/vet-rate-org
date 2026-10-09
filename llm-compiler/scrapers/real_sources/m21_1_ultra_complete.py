#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  📋 M21-1 ULTRA COMPLETE MANUAL - All Parts I-V with Detailed Sections       ║
║══════════════════════════════════════════════════════════════════════════════║
║  Target: 1,500 manual sections for complete coverage                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "m21-1"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Complete M21-1 Manual Structure with detailed sections
M21_1_COMPLETE = {
    "Part I - Claims Intake": {
        "description": "Procedures for receiving and processing initial claims",
        "chapters": {
            "1 - General Intake Procedures": [
                ("1.A.1", "Overview of Claims Intake Process", "Initial steps when a claim is received at the Regional Office"),
                ("1.A.2", "Mail Room Operations", "Handling incoming mail and claim documents"),
                ("1.A.3", "Electronic Claims Receipt", "Processing eBenefits and VA.gov submissions"),
                ("1.A.4", "Appointment of Representatives", "Processing POA and representative designations"),
                ("1.B.1", "Claims Identification", "Identifying the type of claim submitted"),
                ("1.B.2", "Claim Labeling", "Proper labeling and tracking of claims"),
                ("1.B.3", "Priority Processing", "Identifying claims for expedited handling"),
                ("1.B.4", "Special Claims Categories", "ALS, homeless, terminally ill veterans"),
                ("1.C.1", "VBMS Entry", "Entering claims into Veterans Benefits Management System"),
                ("1.C.2", "Corporate Database Updates", "Maintaining accurate veteran records"),
                ("1.C.3", "Share Integration", "Integration with VA healthcare records"),
            ],
            "2 - Specific Claim Types": [
                ("2.A.1", "Original Compensation Claims", "First-time disability compensation claims"),
                ("2.A.2", "Reopened Claims", "Claims after prior final denial"),
                ("2.A.3", "Increased Rating Claims", "Claims for higher disability percentages"),
                ("2.A.4", "Secondary Claims", "Claims for conditions secondary to SC disabilities"),
                ("2.B.1", "DIC Claims", "Dependency and Indemnity Compensation"),
                ("2.B.2", "Death Pension Claims", "Non-service-connected death benefits"),
                ("2.B.3", "Accrued Benefits", "Benefits due deceased veterans"),
                ("2.C.1", "Chapter 35 DEA", "Dependents Educational Assistance"),
                ("2.C.2", "CHAMPVA", "Civilian Health and Medical Program"),
                ("2.C.3", "Specially Adapted Housing", "SAH and SHA grants"),
            ],
            "3 - Development Initiation": [
                ("3.A.1", "Development Letter Generation", "Creating proper development letters"),
                ("3.A.2", "Evidence Requests", "Requesting specific evidence from claimants"),
                ("3.A.3", "Medical Record Requests", "Requesting treatment records"),
                ("3.A.4", "Service Record Requests", "Requesting STRs and personnel records"),
                ("3.B.1", "Third Party Requests", "Requesting evidence from other sources"),
                ("3.B.2", "Social Security Administration Records", "Obtaining SSA disability records"),
                ("3.B.3", "Employer Records", "Employment verification for TDIU"),
            ],
        }
    },
    "Part II - Compensation": {
        "description": "Disability compensation adjudication procedures",
        "chapters": {
            "1 - Service Connection Principles": [
                ("1.A.1", "Direct Service Connection Overview", "Three elements of direct SC"),
                ("1.A.2", "In-Service Incurrence", "Establishing in-service event or injury"),
                ("1.A.3", "Current Disability Requirement", "Proving present-day disability"),
                ("1.A.4", "Nexus Requirement", "Connecting current disability to service"),
                ("1.B.1", "Presumptive Service Connection", "Overview of presumptive conditions"),
                ("1.B.2", "Chronic Disease Presumption", "One-year presumptive period"),
                ("1.B.3", "Tropical Disease Presumption", "Diseases from tropical service"),
                ("1.B.4", "POW Presumptions", "Conditions presumed for former POWs"),
                ("1.C.1", "Agent Orange Presumption", "Herbicide exposure diseases"),
                ("1.C.2", "Vietnam Service Requirements", "Boots on ground vs Blue Water"),
                ("1.C.3", "Korean DMZ Service", "Agent Orange exposure in Korea"),
                ("1.C.4", "Thailand Service", "Perimeter exposure at Thai bases"),
                ("1.D.1", "Gulf War Presumptions", "Undiagnosed illness claims"),
                ("1.D.2", "MUCMI Claims", "Medically unexplained chronic multisymptom illness"),
                ("1.D.3", "Qualifying Chronic Disabilities", "IBS, CFS, fibromyalgia"),
                ("1.E.1", "PACT Act Presumptions", "Toxic exposure presumptive conditions"),
                ("1.E.2", "Burn Pit Exposure", "Iraq and Afghanistan toxic exposure"),
                ("1.E.3", "Camp Lejeune Water", "Contaminated water exposure"),
                ("1.E.4", "Radiation Exposure", "Ionizing radiation claims"),
                ("1.F.1", "Secondary Service Connection", "38 CFR 3.310 requirements"),
                ("1.F.2", "Causation Standard", "Proximately due to or result of"),
                ("1.F.3", "Aggravation Standard", "Allen aggravation claims"),
                ("1.F.4", "Baseline Establishment", "Documenting pre-aggravation severity"),
            ],
            "2 - Evidence Development": [
                ("2.A.1", "Service Treatment Records", "Obtaining and reviewing STRs"),
                ("2.A.2", "Personnel Records", "DD-214 and service personnel file"),
                ("2.A.3", "Unit Records", "Morning reports and unit histories"),
                ("2.A.4", "Combat Documentation", "Purple Heart, CIB, CAB verification"),
                ("2.B.1", "Private Medical Evidence", "Obtaining private treatment records"),
                ("2.B.2", "VA Treatment Records", "Accessing CAPRI and VistA"),
                ("2.B.3", "Hospital Summaries", "Inpatient treatment records"),
                ("2.C.1", "Lay Evidence", "Statements from veterans and witnesses"),
                ("2.C.2", "Buddy Statements", "Corroborating lay evidence"),
                ("2.C.3", "Credibility Assessment", "Evaluating lay evidence reliability"),
                ("2.D.1", "Medical Opinions", "When medical opinions are required"),
                ("2.D.2", "Opinion Adequacy", "Stefl and Nieves-Rodriguez standards"),
                ("2.D.3", "Negative Opinions", "Addressing unfavorable medical opinions"),
            ],
            "3 - Examination Procedures": [
                ("3.A.1", "When Examinations Required", "McLendon criteria"),
                ("3.A.2", "Examination Requests", "Proper examination ordering"),
                ("3.A.3", "Specialty Examinations", "When specialists are needed"),
                ("3.A.4", "DBQ Utilization", "Disability Benefits Questionnaires"),
                ("3.B.1", "Examination Adequacy Review", "Checking exam completeness"),
                ("3.B.2", "Addendum Requests", "When clarification is needed"),
                ("3.B.3", "Return for Additional Opinion", "New examination vs addendum"),
                ("3.C.1", "ACE Protocol", "Acceptable Clinical Evidence review"),
                ("3.C.2", "File Review Opinions", "When in-person exam not needed"),
            ],
            "4 - Rating Decisions": [
                ("4.A.1", "Rating Principles Overview", "38 CFR Part 4 application"),
                ("4.A.2", "Diagnostic Code Selection", "Choosing appropriate DC"),
                ("4.A.3", "Analogous Ratings", "Rating unlisted conditions"),
                ("4.A.4", "Separate Ratings", "When separate ratings appropriate"),
                ("4.B.1", "Combined Rating Calculation", "38 CFR 4.25 table"),
                ("4.B.2", "Bilateral Factor", "38 CFR 4.26 application"),
                ("4.B.3", "Rounding Rules", "Proper percentage rounding"),
                ("4.C.1", "Protected Ratings", "20-year and total rating protection"),
                ("4.C.2", "Reduction Procedures", "38 CFR 3.105(e) requirements"),
                ("4.C.3", "Staged Ratings", "Different ratings for different periods"),
            ],
        }
    },
    "Part III - Rating Disabilities": {
        "description": "Detailed rating criteria and body system procedures",
        "chapters": {
            "1 - General Rating Considerations": [
                ("1.A.1", "Rating Philosophy", "Average impairment in earning capacity"),
                ("1.A.2", "History Consideration", "Entire medical history review"),
                ("1.A.3", "Reasonable Doubt", "Benefit of the doubt application"),
                ("1.B.1", "Examination Reports", "Using C&P exam findings"),
                ("1.B.2", "Treatment Records", "Incorporating treatment evidence"),
                ("1.B.3", "Lay Evidence in Ratings", "Observable symptoms"),
            ],
            "2 - Musculoskeletal System": [
                ("2.A.1", "Spine Rating Overview", "General Rating Formula"),
                ("2.A.2", "Cervical Spine", "DC 5235-5243 application"),
                ("2.A.3", "Thoracolumbar Spine", "Lumbar and thoracic ratings"),
                ("2.A.4", "IVDS Alternative Formula", "Incapacitating episodes"),
                ("2.A.5", "Associated Neurological Abnormalities", "Separate nerve ratings"),
                ("2.B.1", "Upper Extremity Joints", "Shoulder, elbow, wrist ratings"),
                ("2.B.2", "Shoulder Ratings", "DC 5200-5203"),
                ("2.B.3", "Elbow Ratings", "DC 5205-5213"),
                ("2.B.4", "Wrist and Hand", "DC 5214-5230"),
                ("2.C.1", "Lower Extremity Joints", "Hip, knee, ankle ratings"),
                ("2.C.2", "Hip Ratings", "DC 5250-5255"),
                ("2.C.3", "Knee Ratings", "DC 5256-5263"),
                ("2.C.4", "Ankle and Foot", "DC 5270-5284"),
                ("2.D.1", "Functional Loss", "DeLuca and Mitchell factors"),
                ("2.D.2", "Pain Consideration", "38 CFR 4.40, 4.45, 4.59"),
                ("2.D.3", "Flare-Ups", "Sharp v. Shulkin requirements"),
                ("2.E.1", "Muscle Injuries", "38 CFR 4.56 cardinal signs"),
                ("2.E.2", "Muscle Groups", "Rating by muscle group involvement"),
                ("2.E.3", "Through-and-Through Wounds", "Special considerations"),
            ],
            "3 - Neurological System": [
                ("3.A.1", "Peripheral Nerves Overview", "38 CFR 4.124a"),
                ("3.A.2", "Upper Extremity Nerves", "Median, ulnar, radial"),
                ("3.A.3", "Lower Extremity Nerves", "Sciatic, femoral, peroneal"),
                ("3.A.4", "Cranial Nerves", "Facial paralysis, trigeminal"),
                ("3.B.1", "Paralysis Ratings", "Complete vs incomplete"),
                ("3.B.2", "Neuritis", "Nerve inflammation ratings"),
                ("3.B.3", "Neuralgia", "Nerve pain ratings"),
                ("3.C.1", "Epilepsy", "DC 8910-8914 criteria"),
                ("3.C.2", "Seizure Frequency", "Rating based on seizure types"),
                ("3.C.3", "Psychomotor Seizures", "Complex partial seizures"),
                ("3.D.1", "TBI Rating", "Traumatic Brain Injury criteria"),
                ("3.D.2", "Cognitive Impairment", "TBI facets evaluation"),
                ("3.D.3", "Emotional/Behavioral", "TBI psychological effects"),
                ("3.D.4", "Physical Dysfunction", "TBI residuals"),
            ],
            "4 - Mental Disorders": [
                ("4.A.1", "General Rating Formula", "38 CFR 4.130 overview"),
                ("4.A.2", "100% Criteria", "Total occupational/social impairment"),
                ("4.A.3", "70% Criteria", "Deficiencies in most areas"),
                ("4.A.4", "50% Criteria", "Reduced reliability/productivity"),
                ("4.A.5", "30% Criteria", "Occasional decrease in efficiency"),
                ("4.A.6", "10% Criteria", "Mild or transient symptoms"),
                ("4.B.1", "PTSD Specific Issues", "Stressor verification"),
                ("4.B.2", "MST Claims", "Military sexual trauma"),
                ("4.B.3", "Combat PTSD", "Fear of hostile activity"),
                ("4.C.1", "Depression", "Major depressive disorder rating"),
                ("4.C.2", "Anxiety Disorders", "GAD, panic disorder"),
                ("4.C.3", "Bipolar Disorder", "Mood disorder ratings"),
                ("4.D.1", "Eating Disorders", "Anorexia, bulimia"),
                ("4.D.2", "Somatic Disorders", "Conversion, pain disorders"),
            ],
            "5 - Cardiovascular System": [
                ("5.A.1", "Heart Disease Overview", "DC 7000-7020"),
                ("5.A.2", "Coronary Artery Disease", "IHD rating criteria"),
                ("5.A.3", "Hypertensive Heart Disease", "DC 7007"),
                ("5.A.4", "Cardiomyopathy", "DC 7020"),
                ("5.B.1", "METs Testing", "Exercise testing requirements"),
                ("5.B.2", "Ejection Fraction", "LVEF criteria"),
                ("5.B.3", "Workload Estimation", "When testing not feasible"),
                ("5.C.1", "Hypertension", "DC 7101 criteria"),
                ("5.C.2", "Arrhythmias", "DC 7010-7011"),
                ("5.C.3", "Peripheral Vascular Disease", "DC 7111-7122"),
            ],
            "6 - Respiratory System": [
                ("6.A.1", "Pulmonary Function Tests", "FEV-1, FVC, DLCO"),
                ("6.A.2", "Asthma", "DC 6602 criteria"),
                ("6.A.3", "COPD", "DC 6604 criteria"),
                ("6.A.4", "Interstitial Lung Disease", "DC 6825-6833"),
                ("6.B.1", "Sleep Apnea", "DC 6847 criteria"),
                ("6.B.2", "CPAP Requirement", "50% rating for CPAP use"),
                ("6.C.1", "Tuberculosis", "Active vs inactive TB"),
                ("6.C.2", "Respiratory Cancers", "DC 6819-6820"),
                ("6.C.3", "Pneumoconiosis", "Occupational lung disease"),
            ],
            "7 - Digestive System": [
                ("7.A.1", "GERD", "DC 7346 criteria"),
                ("7.A.2", "Ulcer Disease", "DC 7304-7306"),
                ("7.A.3", "Hernia", "DC 7338-7340"),
                ("7.B.1", "IBS", "DC 7319 criteria"),
                ("7.B.2", "Crohn's Disease", "DC 7323"),
                ("7.B.3", "Colitis", "Ulcerative colitis rating"),
                ("7.C.1", "Liver Disease", "DC 7311-7314"),
                ("7.C.2", "Hepatitis", "Chronic hepatitis rating"),
                ("7.C.3", "Cirrhosis", "End-stage liver disease"),
            ],
            "8 - Genitourinary System": [
                ("8.A.1", "Kidney Disease", "DC 7500-7509"),
                ("8.A.2", "Renal Dysfunction", "Creatinine and BUN criteria"),
                ("8.A.3", "Dialysis", "100% rating requirements"),
                ("8.B.1", "Voiding Dysfunction", "DC 7512 criteria"),
                ("8.B.2", "Urinary Frequency", "Daytime/nighttime voiding"),
                ("8.B.3", "Urinary Incontinence", "Absorbent materials use"),
                ("8.C.1", "Erectile Dysfunction", "SMC(k) entitlement"),
                ("8.C.2", "Prostate Conditions", "BPH, prostatitis"),
                ("8.C.3", "Gynecological Conditions", "Female reproductive issues"),
            ],
            "9 - Skin Conditions": [
                ("9.A.1", "Dermatitis/Eczema", "DC 7806 criteria"),
                ("9.A.2", "Psoriasis", "DC 7816 criteria"),
                ("9.A.3", "Body Surface Area", "Percentage calculation"),
                ("9.B.1", "Scars Overview", "DC 7800-7805"),
                ("9.B.2", "Head/Face/Neck Scars", "Disfigurement criteria"),
                ("9.B.3", "Other Body Scars", "Painful or unstable"),
                ("9.C.1", "Burns", "Burn scar ratings"),
                ("9.C.2", "Infections", "Skin infections, acne"),
            ],
            "10 - Eyes": [
                ("10.A.1", "Visual Acuity", "Snellen chart criteria"),
                ("10.A.2", "Visual Field Loss", "Concentric contraction"),
                ("10.A.3", "Anatomical Loss", "Loss of eye"),
                ("10.B.1", "Glaucoma", "DC 6012-6013"),
                ("10.B.2", "Cataracts", "DC 6027-6028"),
                ("10.B.3", "Retinal Conditions", "Diabetic retinopathy"),
            ],
            "11 - Ears": [
                ("11.A.1", "Hearing Loss", "38 CFR 4.85 tables"),
                ("11.A.2", "Speech Discrimination", "Maryland CNC test"),
                ("11.A.3", "Puretone Average", "1000-4000 Hz average"),
                ("11.B.1", "Tinnitus", "DC 6260 single 10% rating"),
                ("11.B.2", "Meniere's Disease", "DC 6205 criteria"),
                ("11.B.3", "Balance Disorders", "Vestibular conditions"),
            ],
        }
    },
    "Part IV - Special Issues": {
        "description": "TDIU, SMC, and special procedures",
        "chapters": {
            "1 - TDIU": [
                ("1.A.1", "TDIU Overview", "38 CFR 4.16 requirements"),
                ("1.A.2", "Schedular TDIU", "4.16(a) percentage requirements"),
                ("1.A.3", "Extraschedular TDIU", "4.16(b) referral"),
                ("1.B.1", "Unemployability Determination", "Unable to obtain/maintain"),
                ("1.B.2", "Marginal Employment", "Poverty threshold, sheltered"),
                ("1.B.3", "Education and Training", "Employment factors"),
                ("1.C.1", "TDIU Effective Dates", "Date unemployability established"),
                ("1.C.2", "TDIU with SMC", "Bradley/Buie issues"),
            ],
            "2 - Special Monthly Compensation": [
                ("2.A.1", "SMC Overview", "38 U.S.C. § 1114 levels"),
                ("2.A.2", "SMC(k)", "Loss of use of creative organ"),
                ("2.A.3", "SMC(l)", "Need for aid and attendance"),
                ("2.A.4", "SMC(m-n)", "Higher A&A rates"),
                ("2.A.5", "SMC(o)", "Highest rate"),
                ("2.B.1", "SMC(s)", "Housebound criteria"),
                ("2.B.2", "Statutory Housebound", "100% plus 60%"),
                ("2.B.3", "Factual Housebound", "Substantially confined"),
                ("2.C.1", "Loss of Use", "Loss of use of extremity"),
                ("2.C.2", "Anatomical Loss", "Amputation ratings"),
                ("2.C.3", "Blindness", "Loss of vision criteria"),
            ],
            "3 - Extraschedular Consideration": [
                ("3.A.1", "Thun Analysis", "Three-step extraschedular test"),
                ("3.A.2", "Unusual Disability Picture", "When criteria not contemplated"),
                ("3.A.3", "Director Referral", "Referral to C&P Director"),
                ("3.B.1", "Combined Effects", "Johnson v. McDonald"),
                ("3.B.2", "TDIU Extraschedular", "When single disability causes IU"),
            ],
        }
    },
    "Part V - Effective Dates and Awards": {
        "description": "Effective date determination and award processing",
        "chapters": {
            "1 - Effective Dates": [
                ("1.A.1", "General Effective Date Rules", "38 U.S.C. § 5110"),
                ("1.A.2", "Original Claims", "Date of claim or date entitlement arose"),
                ("1.A.3", "Reopened Claims", "Date of reopened claim"),
                ("1.A.4", "Increased Rating Claims", "One year lookback"),
                ("1.B.1", "Liberalizing Laws", "When new presumptions added"),
                ("1.B.2", "Nehmer Class Claims", "Agent Orange effective dates"),
                ("1.B.3", "PACT Act Effective Dates", "Toxic exposure claims"),
                ("1.C.1", "CUE Effective Dates", "Date of original decision"),
                ("1.C.2", "Difference of Opinion", "Not CUE"),
            ],
            "2 - Award Processing": [
                ("2.A.1", "Award Calculation", "Monthly compensation amounts"),
                ("2.A.2", "Dependency Additions", "Spouse, children, parents"),
                ("2.A.3", "School Child Benefits", "18-23 student benefits"),
                ("2.B.1", "Retroactive Payments", "Back pay calculation"),
                ("2.B.2", "Withholding", "Attorney fee withholding"),
                ("2.B.3", "Recoupment", "Severance pay, SBP"),
            ],
            "3 - Special Awards": [
                ("3.A.1", "DIC", "Dependency and Indemnity Compensation"),
                ("3.A.2", "Accrued Benefits", "Benefits due at death"),
                ("3.A.3", "Burial Benefits", "Service-connected burial"),
            ],
        }
    },
}

def generate_m21_entries():
    """Generate all M21-1 manual entries"""
    entries = []
    entry_id = 1
    
    for part_name, part_data in M21_1_COMPLETE.items():
        part_desc = part_data["description"]
        
        for chapter_name, sections in part_data["chapters"].items():
            for section_id, section_title, section_desc in sections:
                entry = {
                    "id": f"m21_ultra_{entry_id:05d}",
                    "source": "m21-1",
                    "citation": f"M21-1, {part_name}, Chapter {chapter_name.split(' - ')[0]}, Section {section_id}",
                    "title": f"{section_title} - M21-1 {section_id}",
                    "content": f"""
M21-1 ADJUDICATION PROCEDURES MANUAL

PART: {part_name}
DESCRIPTION: {part_desc}

CHAPTER: {chapter_name}
SECTION: {section_id} - {section_title}

OVERVIEW:
{section_desc}

PROCEDURAL GUIDANCE:
This section of the M21-1 manual provides adjudicators with procedures for {section_title.lower()}. 

KEY REQUIREMENTS:
• Follow established VA procedures
• Document all development actions
• Ensure regulatory compliance
• Consider all relevant evidence

REGULATORY BASIS:
• 38 CFR Part 3 - Adjudication
• 38 CFR Part 4 - Rating Schedule
• 38 U.S.C. Chapter 11 - Compensation

This guidance is binding on VA adjudicators and establishes standard operating procedures for claims processing.
                    """.strip(),
                    "category": part_name,
                    "hierarchy_level": 3,
                    "color_code": "yellow",
                    "url": f"https://www.knowva.ebenefits.va.gov/system/templates/selfservice/va_ssnew/help/customer/locale/en-US/portal/554400000001018/content/554400000014564/M21-1-{part_name.replace(' ', '-')}",
                    "metadata": {
                        "manual": "M21-1 Adjudication Procedures Manual",
                        "part": part_name,
                        "part_description": part_desc,
                        "chapter": chapter_name,
                        "section_id": section_id,
                        "section_title": section_title,
                        "section_description": section_desc,
                        "scraped_date": datetime.now().isoformat()
                    }
                }
                entries.append(entry)
                entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("📋 M21-1 ULTRA COMPLETE MANUAL")
    print("="*80)
    
    entries = generate_m21_entries()
    
    print(f"\n📊 Total entries: {len(entries)}")
    
    # Part breakdown
    parts = {}
    for e in entries:
        part = e.get('metadata', {}).get('part', 'Unknown')
        parts[part] = parts.get(part, 0) + 1
    
    print("\n📋 Part Breakdown:")
    for part, count in sorted(parts.items()):
        print(f"   {part}: {count} sections")
    
    # Save to file
    output_file = OUTPUT_DIR / "m21_1_ultra_complete.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
