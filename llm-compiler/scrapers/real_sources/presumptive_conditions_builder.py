#!/usr/bin/env python3
"""
💎 DIAMOND Presumptive Conditions Database Builder
===================================================
Compiles comprehensive database of VA presumptive conditions.

Presumptive conditions = conditions VA automatically assumes are service-connected
if the veteran meets certain criteria (no nexus letter needed!)

Categories:
1. PACT Act (2022) - Burn pits, toxic exposures
2. Gulf War Illness - Undiagnosed illnesses, chronic multi-symptom
3. Agent Orange - Vietnam, Thailand, Korea, Blue Water Navy
4. Radiation Exposure - Atomic veterans
5. Camp Lejeune - Water contamination
6. Chronic Diseases - Within 1 year of discharge
7. Tropical Diseases - Within specified periods
8. POW-related - Former prisoners of war

Sources:
- VA.gov official pages
- 38 CFR Part 3
- PACT Act legislation
"""

import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Output paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "presumptive"
OUTPUT_FILE = OUTPUT_DIR / "presumptive_conditions.json"


def build_pact_act_conditions() -> List[Dict]:
    """PACT Act (2022) - Burn pits and toxic exposure conditions."""
    
    # Burn pit presumptive conditions
    burn_pit_conditions = [
        "Asthma diagnosed after service",
        "Head cancer (any type)",
        "Neck cancer (any type)",
        "Respiratory cancer (any type)",
        "Gastrointestinal cancer (any type)",
        "Reproductive cancer (any type)",
        "Lymphoma cancer (any type)",
        "Lymphomatic cancer (any type)",
        "Kidney cancer (any type)",
        "Brain cancer (any type)",
        "Melanoma",
        "Pancreatic cancer",
        "Chronic bronchitis",
        "COPD (Chronic Obstructive Pulmonary Disease)",
        "Constrictive bronchiolitis or obliterative bronchiolitis",
        "Emphysema",
        "Granulomatous disease",
        "Interstitial lung disease",
        "Pleuritis",
        "Pneumonitis",
        "Pulmonary fibrosis",
        "Sarcoidosis",
        "Chronic rhinitis",
        "Chronic sinusitis",
        "Glioblastoma",
        "Squamous cell carcinoma of the larynx",
        "Squamous cell carcinoma of the trachea",
    ]
    
    entries = []
    
    # Add main PACT Act entry
    entries.append({
        "id": "pact_act_overview",
        "title": "PACT Act - Presumptive Conditions Overview",
        "content": """The PACT Act (Sergeant First Class Heath Robinson Honoring our Promise to Address Comprehensive Toxics Act) of 2022 is the largest expansion of VA benefits in decades.

KEY PROVISIONS:
- Expands VA health care eligibility to Veterans exposed to burn pits and other toxic substances
- Adds 23+ presumptive conditions for burn pit exposure
- Extends the period to enroll in VA health care for combat Veterans
- Creates a framework for future presumptive conditions
- Covers Veterans who served in Gulf War, Afghanistan, Iraq, and other locations

WHO QUALIFIES:
- Served in Afghanistan, Iraq, or certain other locations after August 2, 1990
- Were exposed to burn pits or airborne hazards during service
- Have been diagnosed with a covered condition

EFFECTIVE DATES:
- August 10, 2022: Initial provisions
- October 1, 2022: Expanded presumptive conditions
- 2026: Screening requirements fully implemented

NO NEXUS LETTER REQUIRED for presumptive conditions - VA assumes service connection if you meet the criteria.""",
        "metadata": {
            "source": "PACT_ACT_OFFICIAL",
            "type": "presumptive_overview",
            "category": "PACT Act",
            "effective_date": "2022-08-10",
            "url": "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
            "legal_weight": "STATUTORY - Public Law 117-168",
            "source_disclaimer": "Official PACT Act presumptive conditions",
        }
    })
    
    # Add each burn pit condition
    for condition in burn_pit_conditions:
        entries.append({
            "id": f"pact_{condition.lower().replace(' ', '_').replace('(', '').replace(')', '')}",
            "title": f"PACT Act Presumptive: {condition}",
            "content": f"""{condition} is a PRESUMPTIVE condition under the PACT Act.

SERVICE CONNECTION REQUIREMENT:
- Served in a covered location (Afghanistan, Iraq, Gulf War theater, etc.)
- Served after August 2, 1990
- Diagnosed with {condition}

NO NEXUS LETTER REQUIRED - VA presumes this condition is service-connected for eligible Veterans.

COVERED LOCATIONS:
- Afghanistan
- Djibouti
- Egypt
- Jordan
- Lebanon
- Syria
- Yemen
- Uzbekistan
- Gulf War locations
- Any location where burn pits were used

HOW TO FILE:
1. File VA Form 21-526EZ
2. Indicate service in covered location
3. Provide medical diagnosis of {condition}
4. No nexus letter needed - condition is presumptive""",
            "metadata": {
                "source": "PACT_ACT_OFFICIAL",
                "type": "presumptive_condition",
                "category": "PACT Act - Burn Pit",
                "condition_name": condition,
                "nexus_required": False,
                "effective_date": "2022-08-10",
                "legal_reference": "Public Law 117-168",
            }
        })
    
    return entries


def build_agent_orange_conditions() -> List[Dict]:
    """Agent Orange presumptive conditions."""
    
    ao_conditions = [
        ("AL Amyloidosis", "A rare disease caused when an abnormal protein, amyloid, enters tissues or organs"),
        ("Bladder Cancer", "Cancer of the bladder"),
        ("Chronic B-cell Leukemias", "A type of cancer which affects white blood cells"),
        ("Chloracne", "A skin condition that occurs soon after exposure to chemicals and looks like common forms of acne"),
        ("Diabetes Mellitus Type 2", "A disease characterized by high blood sugar levels resulting from the body's inability to respond properly to the hormone insulin"),
        ("Hodgkin's Disease", "A malignant lymphoma (cancer) characterized by progressive enlargement of the lymph nodes, liver, and spleen"),
        ("Hypertension", "High blood pressure (added 2021)"),
        ("Hypothyroidism", "Condition where thyroid doesn't produce enough hormones"),
        ("Ischemic Heart Disease", "A disease characterized by a reduced supply of blood to the heart"),
        ("Monoclonal Gammopathy of Undetermined Significance (MGUS)", "A condition in which an abnormal protein is found in the blood"),
        ("Multiple Myeloma", "A cancer of plasma cells, a type of white blood cell"),
        ("Non-Hodgkin's Lymphoma", "A group of cancers that affect the lymph glands and other lymphatic tissue"),
        ("Parkinson's Disease", "A progressive disorder of the nervous system that affects movement"),
        ("Parkinsonism", "Any condition that causes a combination of movement abnormalities seen in Parkinson's disease"),
        ("Peripheral Neuropathy, Early-Onset", "A nervous system condition that causes numbness, tingling, and motor weakness"),
        ("Porphyria Cutanea Tarda", "A disorder characterized by liver dysfunction and by thinning and blistering of the skin"),
        ("Prostate Cancer", "Cancer of the prostate"),
        ("Respiratory Cancers", "Cancers of the lung, larynx, trachea, and bronchus"),
        ("Soft Tissue Sarcomas", "A group of different types of cancers in body tissues such as muscle, fat, blood vessels"),
    ]
    
    entries = []
    
    # Overview entry
    entries.append({
        "id": "agent_orange_overview",
        "title": "Agent Orange - Presumptive Conditions Overview",
        "content": """Agent Orange was an herbicide used during the Vietnam War. Veterans exposed to Agent Orange may be eligible for disability compensation for certain conditions.

WHO QUALIFIES:
- Served in Vietnam between January 9, 1962 and May 7, 1975
- Served in Thailand at U.S. military bases anytime between January 9, 1962 and June 30, 1976
- Served in Korea in/near the DMZ between September 1, 1967 and August 31, 1971
- Was aboard U.S. Navy/Coast Guard ship operating on inland waterways of Vietnam
- Was aboard ship operating within 12 nautical miles of Vietnam shore (Blue Water Navy)
- Served on C-123 aircraft known to have been used to spray Agent Orange during Vietnam War

ALL LISTED CONDITIONS ARE PRESUMPTIVE - No nexus letter required if you served in covered locations.

SPECIAL NOTE: Children of Vietnam Veterans with spina bifida may also qualify for benefits.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_overview",
            "category": "Agent Orange",
            "legal_reference": "38 CFR 3.307, 3.309",
            "url": "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/agent-orange/",
        }
    })
    
    # Individual conditions
    for condition, description in ao_conditions:
        entries.append({
            "id": f"ao_{condition.lower().replace(' ', '_').replace('(', '').replace(')', '').replace(',', '')}",
            "title": f"Agent Orange Presumptive: {condition}",
            "content": f"""{condition} is a PRESUMPTIVE condition for Agent Orange exposure.

DESCRIPTION: {description}

SERVICE CONNECTION REQUIREMENT:
- Served in Vietnam, Thailand (at bases), Korea DMZ, or Blue Water Navy
- During the covered time periods
- Diagnosed with {condition}

NO NEXUS LETTER REQUIRED - VA presumes service connection.

COVERED SERVICE PERIODS:
- Vietnam: January 9, 1962 - May 7, 1975
- Thailand: January 9, 1962 - June 30, 1976
- Korea DMZ: September 1, 1967 - August 31, 1971
- Blue Water Navy: January 9, 1962 - May 7, 1975

HOW TO FILE:
1. File VA Form 21-526EZ
2. Provide evidence of qualifying service
3. Provide medical diagnosis
4. No nexus letter needed""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Agent Orange",
                "condition_name": condition,
                "description": description,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.309(e)",
            }
        })
    
    return entries


def build_gulf_war_conditions() -> List[Dict]:
    """Gulf War presumptive conditions."""
    
    entries = []
    
    # Gulf War undiagnosed illness
    entries.append({
        "id": "gulf_war_undiagnosed_illness",
        "title": "Gulf War Syndrome - Undiagnosed Illness",
        "content": """Gulf War Veterans may be entitled to disability compensation for chronic undiagnosed illnesses.

QUALIFYING CONDITIONS:
Chronic symptoms lasting 6+ months that cannot be attributed to a known diagnosis, including:
- Fatigue
- Skin conditions
- Headaches
- Muscle pain
- Joint pain
- Neurological symptoms
- Neuropsychological symptoms
- Respiratory symptoms
- Sleep disturbances
- Gastrointestinal symptoms
- Cardiovascular symptoms
- Abnormal weight loss
- Menstrual disorders

QUALIFYING SERVICE:
- Served in Southwest Asia theater of operations (Gulf War)
- Active duty on or after August 2, 1990
- Symptoms manifest during active duty or by December 31, 2026

LOCATIONS COVERED:
- Iraq
- Kuwait
- Saudi Arabia
- Bahrain
- Qatar
- United Arab Emirates
- Oman
- Gulf of Aden
- Gulf of Oman
- Persian Gulf
- Red Sea
- Airspace above these locations

NO SPECIFIC DIAGNOSIS REQUIRED - This is specifically for symptoms that CANNOT be diagnosed.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_condition",
            "category": "Gulf War",
            "legal_reference": "38 CFR 3.317",
            "url": "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/gulf-war-illness-southwest-asia/",
            "deadline": "2026-12-31",
        }
    })
    
    # Chronic Multi-Symptom Illness
    entries.append({
        "id": "gulf_war_chronic_multisymptom",
        "title": "Gulf War - Chronic Multi-Symptom Illness",
        "content": """Gulf War Veterans may qualify for presumptive service connection for Chronic Multi-Symptom Illness (CMSI).

QUALIFYING CONDITIONS:
- Chronic Fatigue Syndrome (CFS)
- Fibromyalgia
- Functional Gastrointestinal Disorders (including IBS)
- Any undiagnosed illness with multiple symptoms

CRITERIA FOR CMSI:
1. Symptoms must have existed for 6+ months
2. Must have at least 2 of the following characteristics:
   - Fatigue
   - Pain
   - Cognitive dysfunction
3. Cannot be attributed to another diagnosis

QUALIFYING SERVICE:
Same as Gulf War Undiagnosed Illness - service in Southwest Asia on/after August 2, 1990.

KEY BENEFIT:
No nexus letter required if diagnosed with CFS, Fibromyalgia, or IBS and you served in the Gulf War theater.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_condition",
            "category": "Gulf War",
            "conditions": ["Chronic Fatigue Syndrome", "Fibromyalgia", "IBS", "Functional GI Disorders"],
            "legal_reference": "38 CFR 3.317",
        }
    })
    
    # Specific Gulf War conditions
    gw_specific = [
        "Brucellosis",
        "Campylobacter jejuni",
        "Coxiella burnetii (Q fever)",
        "Malaria",
        "Mycobacterium tuberculosis",
        "Nontyphoid Salmonella",
        "Shigella",
        "Visceral leishmaniasis",
        "West Nile virus",
    ]
    
    for condition in gw_specific:
        entries.append({
            "id": f"gw_{condition.lower().replace(' ', '_').replace('(', '').replace(')', '')}",
            "title": f"Gulf War Presumptive: {condition}",
            "content": f"""{condition} is a PRESUMPTIVE infectious disease for Gulf War Veterans.

SERVICE CONNECTION:
- Must have served in Southwest Asia theater
- On or after August 2, 1990
- Disease manifested during active duty or within required time period

NO NEXUS LETTER REQUIRED for Gulf War Veterans with this diagnosis.""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Gulf War - Infectious Disease",
                "condition_name": condition,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.317(c)",
            }
        })
    
    return entries


def build_radiation_conditions() -> List[Dict]:
    """Radiation exposure presumptive conditions (atomic veterans)."""
    
    radiation_cancers = [
        "Leukemia (other than chronic lymphocytic leukemia)",
        "Cancer of the thyroid",
        "Cancer of the breast",
        "Cancer of the pharynx",
        "Cancer of the esophagus",
        "Cancer of the stomach",
        "Cancer of the small intestine",
        "Cancer of the pancreas",
        "Multiple myeloma",
        "Lymphomas (except Hodgkin's disease)",
        "Cancer of the bile ducts",
        "Cancer of the gall bladder",
        "Primary liver cancer",
        "Cancer of the salivary gland",
        "Cancer of the urinary tract",
        "Bronchiolo-alveolar carcinoma",
        "Cancer of the bone",
        "Cancer of the brain",
        "Cancer of the colon",
        "Cancer of the lung",
        "Cancer of the ovary",
    ]
    
    entries = []
    
    # Overview
    entries.append({
        "id": "radiation_overview",
        "title": "Radiation Exposure - Presumptive Conditions Overview",
        "content": """Veterans exposed to ionizing radiation during service may be eligible for presumptive service connection.

QUALIFYING ACTIVITIES:
- Participated in atmospheric nuclear tests (1945-1962)
- Occupation of Hiroshima or Nagasaki, Japan (through July 1, 1946)
- POW in Japan (during WWII)
- Served at gaseous diffusion plants (Paducah, KY; Portsmouth, OH; Oak Ridge, TN)
- Participated in underground nuclear tests at Amchitka Island, Alaska
- Served at cleanup of Enewetak Atoll

PROJECT 112/SHAD:
Veterans who participated in Projects 112/SHAD (chemical and biological warfare testing) may also qualify.

RADIOGENIC DISEASES:
21 specific cancers are presumptive for radiation-exposed Veterans. No nexus letter required if you have qualifying service and a covered diagnosis.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_overview",
            "category": "Radiation Exposure",
            "legal_reference": "38 CFR 3.309(d), 3.311",
            "url": "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/ionizing-radiation/",
        }
    })
    
    # Individual cancers
    for cancer in radiation_cancers:
        entries.append({
            "id": f"rad_{cancer.lower().replace(' ', '_').replace('(', '').replace(')', '').replace(',', '')}",
            "title": f"Radiation Presumptive: {cancer}",
            "content": f"""{cancer} is a PRESUMPTIVE radiogenic disease for radiation-exposed Veterans.

SERVICE CONNECTION:
- Must have participated in a radiation-risk activity
- Diagnosed with {cancer}

NO NEXUS LETTER REQUIRED - VA presumes service connection.

RADIATION-RISK ACTIVITIES:
- Atmospheric nuclear testing (1945-1962)
- Hiroshima/Nagasaki occupation (through July 1, 1946)
- Underground nuclear tests at Amchitka Island, Alaska
- Enewetak Atoll cleanup
- Gaseous diffusion plants

HOW TO FILE:
1. File VA Form 21-526EZ
2. Provide evidence of radiation-risk activity
3. Provide medical diagnosis of {cancer}
4. No nexus letter required""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Radiation Exposure",
                "condition_name": cancer,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.309(d)",
            }
        })
    
    return entries


def build_camp_lejeune_conditions() -> List[Dict]:
    """Camp Lejeune water contamination presumptive conditions."""
    
    cl_conditions = [
        ("Adult Leukemia", "Cancer of blood-forming tissues"),
        ("Aplastic Anemia and Other Myelodysplastic Syndromes", "Conditions affecting blood cell production"),
        ("Bladder Cancer", "Cancer of the bladder"),
        ("Kidney Cancer", "Cancer of the kidney"),
        ("Liver Cancer", "Cancer of the liver"),
        ("Multiple Myeloma", "Cancer of plasma cells"),
        ("Non-Hodgkin's Lymphoma", "Cancer affecting the lymphatic system"),
        ("Parkinson's Disease", "Progressive nervous system disorder"),
    ]
    
    entries = []
    
    # Overview
    entries.append({
        "id": "camp_lejeune_overview",
        "title": "Camp Lejeune - Water Contamination Presumptive Conditions",
        "content": """Veterans and family members who lived or worked at Marine Corps Base Camp Lejeune for at least 30 cumulative days between August 1, 1953 and December 31, 1987 may be eligible for disability compensation.

CONTAMINATION DETAILS:
The water supply at Camp Lejeune was contaminated with industrial solvents, benzene, and other chemicals. Contaminants included:
- Trichloroethylene (TCE)
- Perchloroethylene (PCE)
- Benzene
- Vinyl chloride

WHO QUALIFIES:
- Served at Camp Lejeune for 30+ cumulative days
- Between August 1, 1953 and December 31, 1987
- Diagnosed with a covered condition

COVERED FAMILY MEMBERS:
Family members who resided at Camp Lejeune during this period may also qualify for health care benefits.

PACT ACT ADDITION:
The PACT Act (2022) expanded benefits for Camp Lejeune Veterans.

CAMP LEJEUNE JUSTICE ACT (2022):
Allows Veterans and family members to file federal claims for harm caused by contaminated water.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_overview",
            "category": "Camp Lejeune",
            "legal_reference": "38 CFR 3.307(a)(7), 3.309(f)",
            "url": "https://www.va.gov/disability/eligibility/hazardous-materials-exposure/camp-lejeune-water-contamination/",
            "qualifying_dates": "August 1, 1953 - December 31, 1987",
            "minimum_exposure": "30 cumulative days",
        }
    })
    
    # Individual conditions
    for condition, description in cl_conditions:
        entries.append({
            "id": f"cl_{condition.lower().replace(' ', '_').replace('(', '').replace(')', '').replace(',', '').replace('-', '_')}",
            "title": f"Camp Lejeune Presumptive: {condition}",
            "content": f"""{condition} is a PRESUMPTIVE condition for Camp Lejeune Veterans.

DESCRIPTION: {description}

SERVICE CONNECTION REQUIREMENT:
- Served at Camp Lejeune, NC for 30+ cumulative days
- Between August 1, 1953 and December 31, 1987
- Diagnosed with {condition}

NO NEXUS LETTER REQUIRED - VA presumes service connection.

HOW TO FILE:
1. File VA Form 21-526EZ
2. Provide evidence of service at Camp Lejeune during covered period
3. Provide medical diagnosis of {condition}
4. No nexus letter needed - condition is presumptive""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Camp Lejeune",
                "condition_name": condition,
                "description": description,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.309(f)",
            }
        })
    
    return entries


def build_chronic_disease_conditions() -> List[Dict]:
    """Chronic diseases presumptive within 1 year of discharge."""
    
    chronic_diseases = [
        ("Arthritis", "Joint inflammation and degeneration"),
        ("Diabetes mellitus", "Blood sugar regulation disorder"),
        ("Epilepsies", "Seizure disorders"),
        ("Hansen's disease (leprosy)", "Bacterial infection"),
        ("Arteriosclerosis", "Hardening of the arteries"),
        ("Cardiovascular-renal disease", "Heart and kidney disease"),
        ("Endocarditis", "Infection of the heart lining"),
        ("Myocarditis", "Inflammation of heart muscle"),
        ("Nephritis", "Kidney inflammation"),
        ("Organic diseases of the nervous system", "Neurological conditions"),
        ("Psychoses", "Severe mental disorders"),
        ("Multiple sclerosis", "Autoimmune disease affecting nerves"),
        ("Amyotrophic lateral sclerosis (ALS)", "Motor neuron disease"),
        ("Ulcers (peptic)", "Stomach/intestinal ulcers"),
        ("Cirrhosis of the liver", "Liver scarring"),
        ("Leukemia", "Blood cancer"),
        ("Malignant tumors", "Cancer"),
        ("Hodgkin's disease", "Lymphatic cancer"),
        ("Addison's disease", "Adrenal insufficiency"),
        ("Graves' disease", "Hyperthyroidism"),
        ("Myasthenia gravis", "Muscle weakness disease"),
        ("Anemia (primary)", "Blood disorders"),
        ("Lupus erythematosus (systemic)", "Autoimmune disease"),
        ("Brain hemorrhage/thrombosis", "Stroke"),
        ("Calculi of the kidney, bladder, or gallbladder", "Stones"),
        ("Bronchiectasis", "Chronic lung condition"),
        ("Atrophy, progressive muscular", "Muscle wasting"),
        ("Sarcoidosis", "Inflammatory disease"),
        ("Scleroderma", "Connective tissue disease"),
    ]
    
    entries = []
    
    # Overview
    entries.append({
        "id": "chronic_disease_overview",
        "title": "Chronic Diseases - 1 Year Presumptive Period",
        "content": """Certain chronic diseases are presumptively service-connected if they manifest to a degree of 10% or more within ONE YEAR of discharge from active duty.

KEY BENEFIT:
If a listed chronic disease appears within 1 year after you leave the military, VA will presume it is connected to your service - even if you have no documentation of the condition during service.

NO NEXUS LETTER REQUIRED if:
1. You had active military service
2. The chronic disease manifested within 1 year of discharge
3. The condition is rated at least 10% disabling

IMPORTANT:
- The 1-year period starts from date of discharge
- Medical evidence must show the condition existed within that year
- The condition must be at least 10% disabling when it first appeared

EXCEPTIONS:
- Leprosy (Hansen's disease): 3 years
- Tuberculosis: 3 years
- Multiple Sclerosis: 7 years
- ALS: No time limit (any time after service)""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_overview",
            "category": "Chronic Disease",
            "legal_reference": "38 CFR 3.307(a)(3), 3.309(a)",
            "presumptive_period": "1 year",
        }
    })
    
    # Individual chronic diseases
    for disease, description in chronic_diseases:
        period = "1 year"
        if "hansen" in disease.lower() or "leprosy" in disease.lower():
            period = "3 years"
        elif "tuberculosis" in disease.lower():
            period = "3 years"
        elif "multiple sclerosis" in disease.lower():
            period = "7 years"
        elif "als" in disease.lower() or "amyotrophic" in disease.lower():
            period = "No time limit"
        
        entries.append({
            "id": f"chronic_{disease.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('-', '_').replace(',', '')}",
            "title": f"Chronic Disease Presumptive: {disease}",
            "content": f"""{disease} is a PRESUMPTIVE chronic disease under 38 CFR 3.309(a).

DESCRIPTION: {description}

PRESUMPTIVE PERIOD: {period} from date of discharge

SERVICE CONNECTION REQUIREMENT:
- Active military service
- Condition manifested within {period} of discharge
- Condition rated at least 10% disabling at manifestation

NO NEXUS LETTER REQUIRED if criteria are met.

HOW TO FILE:
1. File VA Form 21-526EZ
2. Provide medical evidence showing condition appeared within {period}
3. No nexus letter needed - chronic disease presumption applies""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Chronic Disease",
                "condition_name": disease,
                "description": description,
                "presumptive_period": period,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.309(a)",
            }
        })
    
    return entries


def build_pow_conditions() -> List[Dict]:
    """Former POW presumptive conditions."""
    
    pow_conditions = [
        ("Psychosis", "Any time after POW experience"),
        ("Anxiety disorder", "Any time after POW experience"),
        ("Dysthymic disorder", "Any time after POW experience"),
        ("PTSD", "Any time after POW experience"),
        ("Avitaminosis", "Any degree at any time"),
        ("Beriberi (including beriberi heart disease)", "Any degree at any time"),
        ("Chronic dysentery", "Any degree at any time"),
        ("Helminthiasis", "Any degree at any time"),
        ("Malnutrition (including optic atrophy)", "Any degree at any time"),
        ("Pellagra", "Any degree at any time"),
        ("Any other nutritional deficiency", "Any degree at any time"),
        ("Cirrhosis of the liver", "10% within 1 year"),
        ("Irritable bowel syndrome", "10% at any time"),
        ("Peptic ulcer disease", "10% at any time"),
        ("Peripheral neuropathy", "10% at any time"),
        ("Atherosclerotic heart disease", "10% at any time if POW 30+ days"),
        ("Hypertensive vascular disease", "10% at any time if POW 30+ days"),
        ("Stroke and complications", "10% at any time if POW 30+ days"),
        ("Osteoporosis", "10% at any time if POW 30+ days"),
    ]
    
    entries = []
    
    # Overview
    entries.append({
        "id": "pow_overview",
        "title": "Former POW - Presumptive Conditions Overview",
        "content": """Former Prisoners of War (POWs) are entitled to special presumptions for certain conditions that are commonly associated with captivity.

QUALIFYING SERVICE:
- Held as a prisoner of war during wartime service
- Certain conditions require 30+ days of captivity

BENEFITS:
- Many conditions are presumptive with NO time limit
- Some conditions require the condition to be 10% disabling
- Mental health conditions are presumptive at any time

SPECIAL PROVISIONS:
- POWs receive priority processing of claims
- Many conditions have lower evidentiary requirements
- Physical trauma from captivity is presumed

NO NEXUS LETTER REQUIRED for listed conditions.

IMPORTANT: Former POWs should contact VA immediately upon diagnosis of any condition - the presumptions are very favorable.""",
        "metadata": {
            "source": "VA_OFFICIAL",
            "type": "presumptive_overview",
            "category": "Former POW",
            "legal_reference": "38 CFR 3.309(c)",
            "url": "https://www.va.gov/disability/eligibility/former-pows/",
        }
    })
    
    for condition, criteria in pow_conditions:
        entries.append({
            "id": f"pow_{condition.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('-', '_').replace(',', '')}",
            "title": f"Former POW Presumptive: {condition}",
            "content": f"""{condition} is a PRESUMPTIVE condition for Former Prisoners of War.

CRITERIA: {criteria}

SERVICE CONNECTION REQUIREMENT:
- Former POW status
- Diagnosed with {condition}
- Meets rating/timing criteria: {criteria}

NO NEXUS LETTER REQUIRED - VA presumes service connection.

HOW TO FILE:
1. File VA Form 21-526EZ
2. Provide evidence of POW status
3. Provide medical diagnosis
4. No nexus letter needed""",
            "metadata": {
                "source": "VA_OFFICIAL",
                "type": "presumptive_condition",
                "category": "Former POW",
                "condition_name": condition,
                "criteria": criteria,
                "nexus_required": False,
                "legal_reference": "38 CFR 3.309(c)",
            }
        })
    
    return entries


def main():
    print("=" * 70)
    print("💎 DIAMOND Presumptive Conditions Database Builder")
    print("=" * 70)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    all_entries = []
    
    # Build each category
    print("\n📋 Building PACT Act conditions...")
    pact_entries = build_pact_act_conditions()
    all_entries.extend(pact_entries)
    print(f"   ✅ Added {len(pact_entries)} entries")
    
    print("\n📋 Building Agent Orange conditions...")
    ao_entries = build_agent_orange_conditions()
    all_entries.extend(ao_entries)
    print(f"   ✅ Added {len(ao_entries)} entries")
    
    print("\n📋 Building Gulf War conditions...")
    gw_entries = build_gulf_war_conditions()
    all_entries.extend(gw_entries)
    print(f"   ✅ Added {len(gw_entries)} entries")
    
    print("\n📋 Building Radiation Exposure conditions...")
    rad_entries = build_radiation_conditions()
    all_entries.extend(rad_entries)
    print(f"   ✅ Added {len(rad_entries)} entries")
    
    print("\n📋 Building Camp Lejeune conditions...")
    cl_entries = build_camp_lejeune_conditions()
    all_entries.extend(cl_entries)
    print(f"   ✅ Added {len(cl_entries)} entries")
    
    print("\n📋 Building Chronic Disease conditions...")
    chronic_entries = build_chronic_disease_conditions()
    all_entries.extend(chronic_entries)
    print(f"   ✅ Added {len(chronic_entries)} entries")
    
    print("\n📋 Building Former POW conditions...")
    pow_entries = build_pow_conditions()
    all_entries.extend(pow_entries)
    print(f"   ✅ Added {len(pow_entries)} entries")
    
    # Save output
    output_data = {
        "source": "VA Presumptive Conditions Database",
        "description": "Comprehensive database of VA presumptive service-connected conditions",
        "created_at": datetime.now().isoformat(),
        "categories": [
            "PACT Act (Burn Pits)",
            "Agent Orange",
            "Gulf War",
            "Radiation Exposure",
            "Camp Lejeune",
            "Chronic Diseases",
            "Former POW"
        ],
        "total_entries": len(all_entries),
        "note": "Presumptive conditions do NOT require nexus letters - VA assumes service connection",
        "entries": all_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 70)
    print("💎 PRESUMPTIVE CONDITIONS DATABASE COMPLETE")
    print("=" * 70)
    print(f"\n📊 Total Entries: {len(all_entries)}")
    print(f"   - PACT Act: {len(pact_entries)}")
    print(f"   - Agent Orange: {len(ao_entries)}")
    print(f"   - Gulf War: {len(gw_entries)}")
    print(f"   - Radiation: {len(rad_entries)}")
    print(f"   - Camp Lejeune: {len(cl_entries)}")
    print(f"   - Chronic Disease: {len(chronic_entries)}")
    print(f"   - Former POW: {len(pow_entries)}")
    print(f"\n📁 Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    return all_entries


if __name__ == "__main__":
    entries = main()
