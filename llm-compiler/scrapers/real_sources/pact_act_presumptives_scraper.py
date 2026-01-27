#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🔥 PACT ACT PRESUMPTIVE CONDITIONS SCRAPER                                  ║
║══════════════════════════════════════════════════════════════════════════════║
║  Complete PACT Act (2022) toxic exposure presumptive conditions              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "presumptive"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Complete PACT Act Presumptive Conditions
PACT_ACT_CONDITIONS = {
    "Burn Pit/Toxic Exposure (23 Conditions)": [
        ("Asthma (diagnosed during or after service)", "Respiratory", "Any covered veteran with toxic exposure"),
        ("Head cancer of any kind", "Cancer", "Any covered veteran with toxic exposure"),
        ("Neck cancer of any kind", "Cancer", "Any covered veteran with toxic exposure"),
        ("Respiratory cancer of any kind", "Cancer", "Lung, bronchus, trachea, larynx, pharynx"),
        ("Gastrointestinal cancer of any kind", "Cancer", "Esophageal, stomach, small intestine, colon, rectal"),
        ("Reproductive cancer of any kind", "Cancer", "Prostate, testicular, ovarian, uterine, cervical"),
        ("Lymphoma of any kind", "Cancer", "Hodgkin's and Non-Hodgkin's lymphoma"),
        ("Lymphomatic cancer of any kind", "Cancer", "Cancers of lymphatic system"),
        ("Kidney cancer", "Cancer", "Renal cell carcinoma"),
        ("Brain cancer", "Cancer", "Primary brain tumors"),
        ("Melanoma", "Cancer", "Skin cancer"),
        ("Pancreatic cancer", "Cancer", "Pancreatic adenocarcinoma"),
        ("Chronic bronchitis", "Respiratory", "Long-term inflammation of bronchi"),
        ("COPD (Chronic Obstructive Pulmonary Disease)", "Respiratory", "Emphysema and chronic bronchitis"),
        ("Constrictive bronchiolitis", "Respiratory", "Small airway disease"),
        ("Interstitial lung disease", "Respiratory", "Pulmonary fibrosis types"),
        ("Pleuritis", "Respiratory", "Inflammation of lung lining"),
        ("Pulmonary fibrosis", "Respiratory", "Scarring of lung tissue"),
        ("Sarcoidosis", "Respiratory", "Inflammatory disease affecting lungs"),
        ("Chronic sinusitis", "Respiratory", "Long-term sinus inflammation"),
        ("Chronic rhinitis", "Respiratory", "Long-term nasal inflammation"),
        ("Glioblastoma", "Cancer", "Aggressive brain cancer"),
        ("Granulomatous disease", "Respiratory", "Including pulmonary granulomatosis"),
    ],
    "Agent Orange (Expanded)": [
        ("Hypertension", "Cardiovascular", "Added by PACT Act 2022"),
        ("Monoclonal gammopathy of undetermined significance (MGUS)", "Blood/Cancer", "Added by PACT Act 2022"),
        ("Bladder cancer", "Cancer", "Previously recognized"),
        ("Hypothyroidism", "Endocrine", "Under consideration"),
        ("Parkinsonism", "Neurological", "Parkinson's-like symptoms"),
        ("AL Amyloidosis", "Systemic", "Existing presumptive"),
        ("Chloracne", "Skin", "Existing presumptive"),
        ("Diabetes Mellitus Type 2", "Metabolic", "Existing presumptive"),
        ("Hodgkin's Disease", "Cancer", "Existing presumptive"),
        ("Ischemic Heart Disease", "Cardiovascular", "Existing presumptive"),
        ("Multiple Myeloma", "Cancer", "Existing presumptive"),
        ("Non-Hodgkin's Lymphoma", "Cancer", "Existing presumptive"),
        ("Parkinson's Disease", "Neurological", "Existing presumptive"),
        ("Peripheral Neuropathy (Early Onset)", "Neurological", "Existing presumptive"),
        ("Porphyria Cutanea Tarda", "Metabolic", "Existing presumptive"),
        ("Prostate Cancer", "Cancer", "Existing presumptive"),
        ("Respiratory Cancers", "Cancer", "Lung, bronchus, larynx, trachea"),
        ("Soft Tissue Sarcomas", "Cancer", "Existing presumptive"),
        ("B-Cell Leukemias", "Cancer", "Including CLL, hairy cell"),
    ],
    "Camp Lejeune Water Contamination": [
        ("Bladder cancer", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Breast cancer", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Esophageal cancer", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Female infertility", "Reproductive", "30+ days at Camp Lejeune 1953-1987"),
        ("Hepatic steatosis (fatty liver)", "Hepatic", "30+ days at Camp Lejeune 1953-1987"),
        ("Kidney cancer", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Leukemia", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Lung cancer", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Miscarriage", "Reproductive", "30+ days at Camp Lejeune 1953-1987"),
        ("Multiple myeloma", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Myelodysplastic syndromes", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Non-Hodgkin's lymphoma", "Cancer", "30+ days at Camp Lejeune 1953-1987"),
        ("Renal toxicity", "Renal", "30+ days at Camp Lejeune 1953-1987"),
        ("Scleroderma", "Autoimmune", "30+ days at Camp Lejeune 1953-1987"),
        ("Neurobehavioral effects", "Neurological", "30+ days at Camp Lejeune 1953-1987"),
        ("Parkinson's disease", "Neurological", "30+ days at Camp Lejeune 1953-1987"),
    ],
    "Radiation Exposure": [
        ("All forms of leukemia (except CLL)", "Cancer", "Radiation risk activity"),
        ("Thyroid cancer", "Cancer", "Radiation risk activity"),
        ("Breast cancer", "Cancer", "Radiation risk activity"),
        ("Pharynx cancer", "Cancer", "Radiation risk activity"),
        ("Esophageal cancer", "Cancer", "Radiation risk activity"),
        ("Stomach cancer", "Cancer", "Radiation risk activity"),
        ("Small intestine cancer", "Cancer", "Radiation risk activity"),
        ("Pancreatic cancer", "Cancer", "Radiation risk activity"),
        ("Bile duct cancer", "Cancer", "Radiation risk activity"),
        ("Gallbladder cancer", "Cancer", "Radiation risk activity"),
        ("Salivary gland cancer", "Cancer", "Radiation risk activity"),
        ("Urinary tract cancer", "Cancer", "Radiation risk activity"),
        ("Bone cancer", "Cancer", "Radiation risk activity"),
        ("Brain cancer", "Cancer", "Radiation risk activity"),
        ("Colon cancer", "Cancer", "Radiation risk activity"),
        ("Lung cancer", "Cancer", "Radiation risk activity"),
        ("Ovarian cancer", "Cancer", "Radiation risk activity"),
        ("Multiple myeloma", "Cancer", "Radiation risk activity"),
        ("Lymphomas (except Hodgkin's)", "Cancer", "Radiation risk activity"),
        ("Primary liver cancer", "Cancer", "Radiation risk activity"),
        ("Posterior subcapsular cataracts", "Vision", "Radiation exposure effect"),
    ],
    "Gulf War (Southwest Asia)": [
        ("Medically unexplained chronic multisymptom illness", "Undiagnosed", "MUCMI"),
        ("Chronic fatigue syndrome", "Undiagnosed", "Southwest Asia service"),
        ("Fibromyalgia", "Undiagnosed", "Southwest Asia service"),
        ("Functional gastrointestinal disorders", "Undiagnosed", "IBS and related"),
        ("Undiagnosed illnesses", "Undiagnosed", "Objective indications of chronic disability"),
    ],
    "POW Presumptives": [
        ("Psychosis", "Mental", "Any period of POW internment"),
        ("Dysthymic disorder", "Mental", "30+ days internment"),
        ("Any anxiety state", "Mental", "30+ days internment"),
        ("Post-traumatic osteoarthritis", "Musculoskeletal", "30+ days internment"),
        ("Cold injury residuals", "Systemic", "30+ days internment"),
        ("Stroke and related complications", "Cardiovascular", "30+ days internment"),
        ("Heart disease and related complications", "Cardiovascular", "30+ days internment"),
        ("Hypertensive vascular disease", "Cardiovascular", "30+ days internment"),
        ("Osteoporosis", "Musculoskeletal", "30+ days internment + post-traumatic stress"),
        ("Peripheral neuropathy (except diabetic)", "Neurological", "Localized beriberi-related"),
        ("Irritable bowel syndrome", "Gastrointestinal", "30+ days internment"),
        ("Peptic ulcer disease", "Gastrointestinal", "30+ days internment"),
        ("Cirrhosis of the liver", "Hepatic", "30+ days internment"),
    ],
    "Chronic Diseases (1-Year Presumptive)": [
        ("Anemia (primary)", "Blood", "Manifest to 10% within 1 year"),
        ("Arteriosclerosis", "Cardiovascular", "Manifest to 10% within 1 year"),
        ("Arthritis", "Musculoskeletal", "Manifest to 10% within 1 year"),
        ("Atrophy, progressive muscular", "Musculoskeletal", "Manifest to 10% within 1 year"),
        ("Brain hemorrhage", "Neurological", "Manifest to 10% within 1 year"),
        ("Brain thrombosis", "Neurological", "Manifest to 10% within 1 year"),
        ("Bronchiectasis", "Respiratory", "Manifest to 10% within 1 year"),
        ("Calculi of the kidney, bladder, or gallbladder", "Urological", "Manifest to 10% within 1 year"),
        ("Cardiovascular-renal disease", "Cardiovascular", "Including hypertension"),
        ("Cirrhosis of the liver", "Hepatic", "Manifest to 10% within 1 year"),
        ("Coccidioidomycosis", "Infectious", "Manifest to 10% within 1 year"),
        ("Diabetes mellitus", "Metabolic", "Manifest to 10% within 1 year"),
        ("Encephalitis lethargica residuals", "Neurological", "Manifest to 10% within 1 year"),
        ("Endocarditis", "Cardiovascular", "Manifest to 10% within 1 year"),
        ("Endocrinopathies", "Endocrine", "Manifest to 10% within 1 year"),
        ("Epilepsies", "Neurological", "Manifest to 10% within 1 year"),
        ("Hansen's disease", "Infectious", "Manifest to 10% within 3 years"),
        ("Hodgkin's disease", "Cancer", "Manifest to 10% within 1 year"),
        ("Leukemia", "Cancer", "Manifest to 10% within 1 year"),
        ("Lupus erythematosus, systemic", "Autoimmune", "Manifest to 10% within 1 year"),
        ("Myasthenia gravis", "Neurological", "Manifest to 10% within 1 year"),
        ("Myelitis", "Neurological", "Manifest to 10% within 1 year"),
        ("Myocarditis", "Cardiovascular", "Manifest to 10% within 1 year"),
        ("Nephritis", "Renal", "Manifest to 10% within 1 year"),
        ("Organic diseases of the nervous system", "Neurological", "Manifest to 10% within 1 year"),
        ("Osteitis deformans (Paget's disease)", "Musculoskeletal", "Manifest to 10% within 1 year"),
        ("Osteomalacia", "Musculoskeletal", "Manifest to 10% within 1 year"),
        ("Palsy, bulbar", "Neurological", "Manifest to 10% within 1 year"),
        ("Paralysis agitans (Parkinson's)", "Neurological", "Manifest to 10% within 1 year"),
        ("Psychoses", "Mental", "Manifest to 10% within 1 year"),
        ("Purpura idiopathic, hemorrhagic", "Blood", "Manifest to 10% within 1 year"),
        ("Raynaud's disease", "Vascular", "Manifest to 10% within 1 year"),
        ("Sarcoidosis", "Systemic", "Manifest to 10% within 1 year"),
        ("Scleroderma", "Autoimmune", "Manifest to 10% within 1 year"),
        ("Sclerosis, amyotrophic lateral", "Neurological", "ALS - any time post-service"),
        ("Sclerosis, multiple", "Neurological", "Manifest to 10% within 7 years"),
        ("Thromboangiitis obliterans (Buerger's)", "Vascular", "Manifest to 10% within 1 year"),
        ("Tuberculosis, active", "Infectious", "Manifest to 10% within 3 years"),
        ("Tumors, malignant", "Cancer", "Manifest to 10% within 1 year"),
        ("Ulcers, peptic", "Gastrointestinal", "Manifest to 10% within 1 year"),
    ],
}

def create_presumptive_entries():
    """Create comprehensive presumptive condition entries"""
    entries = []
    entry_id = 1
    
    for category, conditions in PACT_ACT_CONDITIONS.items():
        for condition, condition_type, notes in conditions:
            entry = {
                "id": f"presumptive_pact_{entry_id:04d}",
                "source": "presumptive",
                "citation": f"Presumptive: {condition} ({category.split('(')[0].strip()})",
                "title": f"{condition} - {category.split('(')[0].strip()}",
                "content": f"""
PRESUMPTIVE SERVICE CONNECTION

CONDITION: {condition}
CATEGORY: {category}
TYPE: {condition_type}

PRESUMPTIVE BASIS:
{notes}

LEGAL FRAMEWORK:
Presumptive service connection under the PACT Act (Public Law 117-168) and 38 CFR § 3.309 allows veterans with qualifying service to receive service connection without proving a direct nexus between their condition and service.

ELIGIBILITY REQUIREMENTS:
• Qualifying service during covered period
• Current diagnosis of the presumptive condition
• No clear evidence condition was not related to service

KEY REGULATIONS:
• PACT Act of 2022 (Sergeant First Class Heath Robinson Honoring our Promise to Address Comprehensive Toxics Act)
• 38 CFR § 3.309 (Diseases subject to presumptive service connection)
• 38 CFR § 3.307 (Presumptive periods)
• 38 CFR § 3.317 (Gulf War undiagnosed illnesses)

CLAIM DEVELOPMENT:
• Establish qualifying service
• Provide current diagnosis
• Submit claim for presumptive condition
• No medical nexus opinion required for presumptive conditions
                """.strip(),
                "category": category.split('(')[0].strip(),
                "hierarchy_level": 4,
                "color_code": "green",
                "url": "https://www.va.gov/resources/the-pact-act-and-your-va-benefits/",
                "metadata": {
                    "condition": condition,
                    "condition_type": condition_type,
                    "category": category,
                    "notes": notes,
                    "regulation": "PACT Act, 38 CFR § 3.309",
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("🔥 PACT ACT PRESUMPTIVE CONDITIONS SCRAPER")
    print("="*80)
    
    entries = create_presumptive_entries()
    
    print(f"\n📊 Total entries: {len(entries)}")
    
    # Save to file
    output_file = OUTPUT_DIR / "pact_act_presumptives.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")
    
    # Category breakdown
    categories = {}
    for e in entries:
        cat = e.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📋 Category Breakdown:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count} conditions")

if __name__ == "__main__":
    main()
