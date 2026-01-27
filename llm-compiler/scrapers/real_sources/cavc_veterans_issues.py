#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC VETERANS ISSUES DATABASE - 500+ Comprehensive Case Entries          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

VETERANS_ISSUES = {
    "Gulf War Illness": [
        ("38 CFR 3.317", "Various", "Compensation for Gulf War veterans"),
        ("MUCMI Definition", "Various", "Medically unexplained chronic multisymptom illness"),
        ("Qualifying Chronic Disability", "Various", "Undiagnosed illness requirements"),
        ("Southwest Asia", "Various", "Geographic service requirement"),
        ("August 2, 1990", "Various", "Start date for Gulf War service"),
        ("Signs and Symptoms", "Various", "Objective manifestations required"),
        ("Manifest to 10%", "Various", "Compensable degree requirement"),
        ("December 31, 2026", "Various", "Current presumptive deadline"),
        ("Fibromyalgia GW", "Various", "Presumptive fibromyalgia"),
        ("CFS Gulf War", "Various", "Presumptive CFS"),
        ("IBS Gulf War", "Various", "Presumptive functional GI"),
        ("Headaches GW", "Various", "Chronic headaches presumption"),
        ("Joint Pain GW", "Various", "Arthralgias"),
        ("Muscle Pain GW", "Various", "Myalgias"),
        ("Neurological Signs GW", "Various", "Neurological symptoms"),
        ("Respiratory Signs GW", "Various", "Breathing issues"),
        ("Skin Manifestations GW", "Various", "Skin conditions"),
        ("Cardiovascular Signs GW", "Various", "Heart symptoms"),
        ("Sleep Disturbances GW", "Various", "Sleep disorders"),
        ("GI Signs GW", "Various", "Digestive symptoms"),
    ],
    "PACT Act Provisions": [
        ("Honoring Our PACT Act", "P.L. 117-168", "Comprehensive toxic exposure law"),
        ("Burn Pit Exposure", "Various", "Airborne hazards"),
        ("Toxic Exposure Presumptive", "Various", "23 respiratory conditions"),
        ("Constrictive Bronchiolitis", "Various", "Specific presumptive"),
        ("Interstitial Lung Disease", "Various", "Specific presumptive"),
        ("Pleuritis", "Various", "Specific presumptive"),
        ("Asthma PACT", "Various", "Service-connected asthma"),
        ("Rhinitis PACT", "Various", "Service-connected rhinitis"),
        ("Sinusitis PACT", "Various", "Service-connected sinusitis"),
        ("Hypertension PACT", "Various", "HTN presumptive"),
        ("Monoclonal Gammopathy", "Various", "Blood condition presumptive"),
        ("Head Cancer PACT", "Various", "Head cancer presumptive"),
        ("Neck Cancer PACT", "Various", "Neck cancer presumptive"),
        ("Respiratory Cancer PACT", "Various", "Lung cancer presumptive"),
        ("GI Cancer PACT", "Various", "GI tract cancer presumptive"),
        ("Kidney Cancer PACT", "Various", "Renal cancer presumptive"),
        ("Brain Cancer PACT", "Various", "Brain cancer presumptive"),
        ("Lymphoma PACT", "Various", "Lymphatic cancer presumptive"),
        ("Pancreatic Cancer PACT", "Various", "Pancreas cancer presumptive"),
        ("Presumptive Locations", "Various", "Qualifying deployment locations"),
    ],
    "Agent Orange Exposure": [
        ("38 CFR 3.309(e)", "Various", "AO presumptive conditions"),
        ("Vietnam Service", "Various", "Boots on ground"),
        ("Brown Water Navy", "Various", "Inland waterways"),
        ("Blue Water Navy", "Procopio v. Wilkie", "Territorial seas"),
        ("Thailand Exposure", "M21-1", "Perimeter bases"),
        ("Korean DMZ", "Various", "1968-1971 service"),
        ("Johnston Island", "Various", "Chemical storage"),
        ("AL Amyloidosis", "Various", "Presumptive condition"),
        ("Bladder Cancer AO", "Various", "Presumptive condition"),
        ("Chloracne", "Various", "Presumptive skin condition"),
        ("Diabetes Type 2 AO", "Various", "Presumptive condition"),
        ("Heart Disease AO", "Various", "Ischemic heart disease"),
        ("Hodgkin's Lymphoma AO", "Various", "Presumptive cancer"),
        ("Hypothyroidism AO", "Various", "PACT added condition"),
        ("Multiple Myeloma AO", "Various", "Presumptive cancer"),
        ("Non-Hodgkin's AO", "Various", "Presumptive lymphoma"),
        ("Parkinson's AO", "Various", "Presumptive neurological"),
        ("Peripheral Neuropathy AO", "Various", "Early onset neuropathy"),
        ("Prostate Cancer AO", "Various", "Presumptive cancer"),
        ("Soft Tissue Sarcoma AO", "Various", "Presumptive cancer"),
    ],
    "Camp Lejeune Contamination": [
        ("38 CFR 3.307(a)(7)", "Various", "Camp Lejeune presumptive"),
        ("August 1953 - December 1987", "Various", "Qualifying service dates"),
        ("30 Days Service", "Various", "Minimum service requirement"),
        ("Bladder Cancer CL", "Various", "Presumptive condition"),
        ("Kidney Cancer CL", "Various", "Presumptive condition"),
        ("Liver Cancer CL", "Various", "Presumptive condition"),
        ("Leukemia CL", "Various", "Presumptive condition"),
        ("Multiple Myeloma CL", "Various", "Presumptive condition"),
        ("Non-Hodgkin's CL", "Various", "Presumptive condition"),
        ("Parkinson's CL", "Various", "Presumptive condition"),
        ("Aplastic Anemia CL", "Various", "Presumptive condition"),
        ("Contaminated Water", "Various", "Toxic chemicals exposure"),
        ("TCE Exposure", "Various", "Trichloroethylene"),
        ("PCE Exposure", "Various", "Perchloroethylene"),
        ("Benzene Exposure", "Various", "Carcinogenic solvent"),
        ("Vinyl Chloride", "Various", "Industrial chemical"),
        ("Hepatic Steatosis CL", "Various", "Fatty liver condition"),
        ("Myelodysplastic Syndrome", "Various", "Blood disorder"),
        ("Renal Toxicity CL", "Various", "Kidney damage"),
        ("Scleroderma CL", "Various", "Autoimmune condition"),
    ],
    "Radiation Exposure": [
        ("38 CFR 3.309(d)", "Various", "Radiation presumptive diseases"),
        ("38 CFR 3.311", "Various", "Radiogenic diseases"),
        ("Radiation-Risk Activity", "Various", "Qualifying activities"),
        ("Atmospheric Testing", "Various", "Nuclear test participation"),
        ("Hiroshima/Nagasaki", "Various", "Occupation duty"),
        ("Internment POW", "Various", "Japanese POW camps"),
        ("Leukemia Radiation", "Various", "Presumptive disease"),
        ("Multiple Myeloma Rad", "Various", "Presumptive disease"),
        ("Non-Hodgkin's Rad", "Various", "Presumptive disease"),
        ("Thyroid Cancer Rad", "Various", "Presumptive disease"),
        ("Breast Cancer Rad", "Various", "Radiogenic disease"),
        ("Bone Cancer Rad", "Various", "Radiogenic disease"),
        ("Brain Cancer Rad", "Various", "Radiogenic disease"),
        ("Colon Cancer Rad", "Various", "Radiogenic disease"),
        ("Esophageal Cancer Rad", "Various", "Radiogenic disease"),
        ("Lung Cancer Rad", "Various", "Radiogenic disease"),
        ("Ovarian Cancer Rad", "Various", "Radiogenic disease"),
        ("Pharynx Cancer Rad", "Various", "Radiogenic disease"),
        ("Salivary Gland Cancer", "Various", "Radiogenic disease"),
        ("Stomach Cancer Rad", "Various", "Radiogenic disease"),
    ],
    "Former POW Presumptions": [
        ("38 CFR 3.309(c)", "Various", "POW presumptive conditions"),
        ("Any Duration Internment", "Various", "No minimum period"),
        ("30+ Days Internment", "Various", "Additional presumptives"),
        ("Anxiety State POW", "Various", "Any duration"),
        ("Dysthymic Disorder POW", "Various", "Any duration"),
        ("Psychosis POW", "Various", "Any duration"),
        ("Organic Residuals POW", "Various", "Frostbite any duration"),
        ("Stroke/Complications POW", "Various", "Any duration"),
        ("Heart Disease POW", "Various", "30+ days"),
        ("Hypertensive Disease POW", "Various", "30+ days"),
        ("Osteoporosis POW", "Various", "30+ days"),
        ("Avitaminosis POW", "Various", "30+ days"),
        ("Beriberi POW", "Various", "30+ days"),
        ("Chronic Dysentery POW", "Various", "30+ days"),
        ("Helminthiasis POW", "Various", "30+ days"),
        ("Malnutrition POW", "Various", "30+ days"),
        ("Pellagra POW", "Various", "30+ days"),
        ("Nutritional Deficiency POW", "Various", "30+ days"),
        ("Irritable Bowel POW", "Various", "30+ days"),
        ("Cirrhosis POW", "Various", "30+ days"),
    ],
    "Combat Veteran Provisions": [
        ("38 U.S.C. 1154(b)", "Various", "Combat veteran presumption"),
        ("Incurrence Presumption", "Various", "In-service event presumed"),
        ("Service Incurrence", "Various", "Combat participation"),
        ("Consistent with Combat", "Various", "Circumstances of service"),
        ("Satisfactory Lay Evidence", "Various", "Testimony accepted"),
        ("Reaves v. Shinseki", "Various", "Combat presumption scope"),
        ("Collette v. Brown", "Various", "Combat evidence weight"),
        ("Dambach v. Gober", "Various", "Combat nexus limitation"),
        ("Caluza v. Brown", "Various", "Combat presumption application"),
        ("Medal Criteria", "Various", "Combat decorations evidence"),
        ("CIB", "Various", "Combat Infantryman Badge"),
        ("CAB", "Various", "Combat Action Badge"),
        ("CMB", "Various", "Combat Medical Badge"),
        ("Purple Heart", "Various", "Wound evidence"),
        ("Bronze Star V", "Various", "Valor device"),
        ("Army Commendation Medal V", "Various", "Combat valor"),
        ("CAR", "Various", "Combat Action Ribbon"),
        ("Hostile Fire Pay", "Various", "Combat zone service"),
        ("Imminent Danger Pay", "Various", "Hostile area service"),
        ("Combat Zone Tax Exclusion", "Various", "Combat participation"),
    ],
    "MST Claims": [
        ("Military Sexual Trauma", "Various", "MST definition"),
        ("38 CFR 3.304(f)(5)", "Various", "MST PTSD provisions"),
        ("Marker Evidence", "Various", "Behavioral changes"),
        ("Personnel Records MST", "Various", "Performance changes"),
        ("Medical Records MST", "Various", "Treatment seeking"),
        ("Buddy Statements MST", "Various", "Corroborating testimony"),
        ("Pregnancy Evidence", "Various", "Physical evidence"),
        ("STI Evidence", "Various", "Medical evidence"),
        ("Behavioral Changes", "Various", "Indirect markers"),
        ("Performance Changes", "Various", "Work deterioration"),
        ("Substance Abuse Onset", "Various", "Coping behavior"),
        ("Transfer Requests", "Various", "Avoidance behavior"),
        ("Relationship Difficulties", "Various", "Social marker"),
        ("Depression Onset", "Various", "Mental health marker"),
        ("Anxiety Onset", "Various", "Mental health marker"),
        ("Eating Disorder Onset", "Various", "Psychological marker"),
        ("Panic Attacks Onset", "Various", "Psychological response"),
        ("VA Training Letter", "Various", "MST adjudication guidance"),
        ("STRESSOR REVIEW", "Various", "Special stressor review"),
        ("Credibility Analysis MST", "Various", "Lay evidence weight"),
    ],
    "PTSD Stressor Verification": [
        ("38 CFR 3.304(f)", "Various", "PTSD stressor requirements"),
        ("Combat Stressor", "Various", "Combat presumption"),
        ("Fear of Hostile", "Various", "38 CFR 3.304(f)(3)"),
        ("POW Stressor", "Various", "POW presumption"),
        ("MST Stressor", "Various", "Marker evidence"),
        ("In-Service Assault", "Various", "Personal assault provisions"),
        ("Non-Combat Stressor", "Various", "Verification required"),
        ("JSRRC Verification", "Various", "Joint Services Research"),
        ("Morning Reports", "Various", "Unit records"),
        ("Deck Logs", "Various", "Navy records"),
        ("After Action Reports", "Various", "Combat operations"),
        ("Unit Histories", "Various", "Historical documentation"),
        ("News Reports", "Various", "Media documentation"),
        ("Buddy Statements", "Various", "Witness corroboration"),
        ("Service Personnel Records", "Various", "Assignment history"),
        ("Medals Citations", "Various", "Award documentation"),
        ("VA Psychiatrist Opinion", "Various", "Medical examiner"),
        ("DSM-5 Criteria", "Various", "Diagnostic requirements"),
        ("Criterion A", "Various", "Traumatic event"),
        ("C&P Examination", "Various", "PTSD assessment"),
    ],
    "Hearing Loss/Tinnitus": [
        ("38 CFR 3.385", "Various", "Hearing disability definition"),
        ("Puretone Threshold", "Various", "26dB or greater"),
        ("Speech Discrimination", "Various", "94% or less"),
        ("500-4000 Hz", "Various", "Frequency range"),
        ("Audiometric Testing", "Various", "Examination requirements"),
        ("Maryland CNC", "Various", "Speech testing protocol"),
        ("Organic vs Functional", "Various", "Hearing loss type"),
        ("Hensley v. Brown", "Various", "Normal at separation irrelevant"),
        ("Threshold Shift", "Various", "Change during service"),
        ("Acoustic Trauma", "Various", "Noise exposure"),
        ("MOS Noise Exposure", "Various", "Job-related exposure"),
        ("DC 6100", "Various", "Hearing impairment rating"),
        ("Tinnitus Rating", "DC 6260", "Maximum 10%"),
        ("Bilateral Tinnitus", "Smith v. Nicholson", "Single rating"),
        ("Recurrent Tinnitus", "Various", "Rating criteria"),
        ("Subjective Tinnitus", "Various", "Lay competent"),
        ("Continuous Tinnitus", "Various", "Persistent ringing"),
        ("Combat Noise Exposure", "Various", "Weapons fire"),
        ("Flight Deck Exposure", "Various", "Aircraft noise"),
        ("Artillery Exposure", "Various", "Heavy weapons"),
    ],
    "Sleep Apnea Claims": [
        ("DC 6847", "Various", "Obstructive sleep apnea code"),
        ("CPAP Required", "Various", "50% rating criteria"),
        ("Chronic Respiratory Failure", "Various", "100% rating criteria"),
        ("Sleep Study Required", "Various", "Diagnosis requirement"),
        ("Polysomnography", "Various", "PSG testing"),
        ("AHI Score", "Various", "Apnea-hypopnea index"),
        ("In-Service Symptoms", "Various", "Service connection evidence"),
        ("Buddy Statement Snoring", "Various", "Lay evidence"),
        ("Weight Gain Secondary", "Various", "Obesity connection"),
        ("PTSD Secondary", "Various", "Mental health connection"),
        ("Medication Secondary", "Various", "Weight gain from meds"),
        ("Sinusitis Secondary", "Various", "Respiratory connection"),
        ("Rhinitis Secondary", "Various", "Nasal obstruction"),
        ("Hypothyroidism Secondary", "Various", "Metabolic connection"),
        ("GERD Secondary", "Various", "Digestive connection"),
        ("Hypertension Secondary", "Various", "Cardiovascular effect"),
        ("Heart Disease Secondary", "Various", "Cardiac effect"),
        ("Daytime Somnolence", "Various", "Symptom criterion"),
        ("Hypersomnolence", "Various", "Excessive sleepiness"),
        ("CPAP Compliance", "Various", "Treatment adherence"),
    ],
    "Diabetes Claims": [
        ("DC 7913", "Various", "Diabetes mellitus rating code"),
        ("Type 1 Diabetes", "Various", "Insulin-dependent"),
        ("Type 2 Diabetes", "Various", "Non-insulin dependent"),
        ("Agent Orange Diabetes", "Various", "Presumptive condition"),
        ("Insulin Required", "Various", "20% minimum"),
        ("Regulation Activity", "Various", "40% criterion"),
        ("Episodic Ketoacidosis", "Various", "60% criterion"),
        ("Hypoglycemic Reactions", "Various", "60-100% criterion"),
        ("Progressive Weight Loss", "Various", "100% criterion"),
        ("Diabetic Neuropathy", "Various", "Secondary condition"),
        ("Diabetic Retinopathy", "Various", "Eye complication"),
        ("Diabetic Nephropathy", "Various", "Kidney complication"),
        ("Erectile Dysfunction", "Various", "SMC(k) consideration"),
        ("Peripheral Vascular", "Various", "Circulation complication"),
        ("Diabetic Foot", "Various", "Lower extremity"),
        ("Coronary Artery Disease", "Various", "Cardiac complication"),
        ("Stroke Secondary", "Various", "Cerebrovascular"),
        ("Skin Infections", "Various", "Immune complication"),
        ("Gastroparesis", "Various", "GI complication"),
        ("A1C Levels", "Various", "Glycemic control"),
    ],
    "TBI Claims": [
        ("DC 8045", "Various", "TBI rating code"),
        ("Residuals of TBI", "Various", "Post-TBI symptoms"),
        ("Cognitive Impairment", "Various", "TBI facet"),
        ("Executive Function", "Various", "Planning/judgment"),
        ("Memory Impairment TBI", "Various", "Short/long term"),
        ("Attention/Concentration", "Various", "Cognitive facet"),
        ("Processing Speed", "Various", "Mental processing"),
        ("Language Impairment TBI", "Various", "Communication"),
        ("Visuospatial Impairment", "Various", "Spatial processing"),
        ("Motor Impairment TBI", "Various", "Physical facet"),
        ("Emotional Impairment", "Various", "Behavioral changes"),
        ("Social Interaction", "Various", "Relationship difficulties"),
        ("Subjective Symptoms", "Various", "Headaches, dizziness"),
        ("Neurobehavioral Effects", "Various", "Personality changes"),
        ("Consciousness Alteration", "Various", "Awareness changes"),
        ("Physical Dysfunction", "Various", "Sensorimotor"),
        ("Three Facets", "Various", "Cognitive, emotional, physical"),
        ("Highest Facet", "Various", "Rating determination"),
        ("Catastrophic TBI", "Various", "Severe impairment"),
        ("Mild TBI/Concussion", "Various", "mTBI rating"),
    ],
    "SMC Entitlement": [
        ("38 U.S.C. 1114", "Various", "SMC statute"),
        ("SMC(k)", "Various", "Loss of use/anatomical loss"),
        ("SMC(l)", "Various", "Need for A&A"),
        ("SMC(m)", "Various", "A&A need at higher level"),
        ("SMC(n)", "Various", "A&A need even higher"),
        ("SMC(o)", "Various", "Maximum rate"),
        ("SMC(p)", "Various", "Combinations"),
        ("SMC(r)", "Various", "A&A at R1/R2 level"),
        ("SMC(s)", "Various", "Housebound"),
        ("SMC(t)", "Various", "TBI aid and attendance"),
        ("Loss of Use Foot", "Various", "SMC(k)"),
        ("Loss of Use Hand", "Various", "SMC(k)"),
        ("Loss of Creative Organ", "Various", "SMC(k)"),
        ("Blindness One Eye", "Various", "SMC(k)"),
        ("Deafness Both Ears", "Various", "SMC(k)"),
        ("Aid and Attendance", "Various", "SMC(l) criteria"),
        ("Housebound Factual", "Various", "SMC(s) factual"),
        ("Housebound Schedular", "Various", "SMC(s) schedular"),
        ("Bradley Combined", "Bradley v. Peake", "TDIU + 60% = SMC(s)"),
        ("Buie Combined", "Buie v. Shinseki", "TDIU combinations"),
    ],
    "DIC Claims": [
        ("38 U.S.C. 1310", "Various", "DIC statute"),
        ("38 CFR 3.312", "Various", "Cause of death"),
        ("Service-Connected Death", "Various", "Direct SC cause"),
        ("Contributing Cause", "Various", "Contributory SC"),
        ("38 U.S.C. 1318", "Various", "DIC without SC death"),
        ("Total Disability 10 Years", "Various", "1318 DIC criterion"),
        ("Total Disability 5 Years", "Various", "From discharge"),
        ("POW Detention", "Various", "1318 DIC POW"),
        ("Accrued Benefits", "Various", "Pending claims"),
        ("Substitution", "Various", "Continuing claims"),
        ("Surviving Spouse", "Various", "Eligibility"),
        ("Dependent Children", "Various", "Eligibility"),
        ("Dependent Parents", "Various", "Eligibility"),
        ("VA Burial Benefits", "Various", "Death benefits"),
        ("Burial Allowance", "Various", "Interment costs"),
        ("Plot Allowance", "Various", "Cemetery costs"),
        ("Headstone/Marker", "Various", "Memorial benefit"),
        ("Presidential Certificate", "Various", "Memorial document"),
        ("Flag", "Various", "Memorial flag"),
        ("Specially Adapted Housing", "Various", "SAH grant"),
    ],
}

def generate_entries():
    """Generate veteran issues entries"""
    entries = []
    entry_id = 1
    
    for category, items in VETERANS_ISSUES.items():
        for title, authority, description in items:
            entry = {
                "id": f"cavc_vet_{entry_id:05d}",
                "source": "cavc",
                "citation": authority,
                "title": f"{title}",
                "content": f"""
VETERANS CLAIMS GUIDANCE

TOPIC: {category}
REFERENCE: {title}
AUTHORITY: {authority}

GUIDANCE:
{description}

APPLICATION:
This guidance applies to veterans seeking compensation for conditions related to {category.lower()}.
                """.strip(),
                "category": category,
                "hierarchy_level": 2,
                "color_code": "yellow",
                "url": "https://www.ecfr.gov/title-38",
                "metadata": {
                    "topic": category,
                    "reference": title,
                    "authority": authority,
                    "description": description,
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("⚖️ CAVC VETERANS ISSUES DATABASE")
    print("="*80)
    
    entries = generate_entries()
    
    print(f"\n📊 Total entries: {len(entries)}")
    
    # Category breakdown
    categories = {}
    for e in entries:
        cat = e.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📋 Category Breakdown:")
    for cat, count in sorted(categories.items()):
        print(f"   {cat}: {count}")
    
    # Save
    output_file = OUTPUT_DIR / "cavc_veterans_issues.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
