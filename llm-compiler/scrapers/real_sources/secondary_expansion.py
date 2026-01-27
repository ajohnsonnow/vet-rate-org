#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🔗 SECONDARY CONDITIONS EXPANSION - Additional Medical Relationships        ║
║══════════════════════════════════════════════════════════════════════════════║
║  Adding more conditions to reach 750 target                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "secondary"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Additional Secondary Conditions to reach 750 target
ADDITIONAL_SECONDARY = {
    "Fibromyalgia": [
        ("Depression", "Very Strong", "75% comorbidity, chronic pain syndrome"),
        ("Anxiety", "Very Strong", "Common in central sensitivity syndromes"),
        ("Sleep Disturbance", "Very Strong", "Non-restorative sleep is diagnostic"),
        ("IBS", "Strong", "Central sensitivity overlap"),
        ("Chronic Fatigue", "Very Strong", "Core symptom overlap"),
        ("Migraines", "Strong", "Central sensitization"),
        ("TMJ", "Moderate", "Myofascial pain overlap"),
        ("Interstitial Cystitis", "Moderate", "Pelvic floor dysfunction"),
        ("Cognitive Impairment", "Strong", "Fibro fog"),
        ("Raynaud's", "Moderate", "Vasomotor instability"),
    ],
    "Chronic Fatigue Syndrome": [
        ("Depression", "Strong", "Symptom overlap, chronic illness"),
        ("Anxiety", "Strong", "Uncertainty of illness"),
        ("Fibromyalgia", "Very Strong", "Central sensitivity overlap"),
        ("IBS", "Strong", "Autonomic dysfunction"),
        ("POTS", "Moderate", "Orthostatic intolerance"),
        ("Sleep Disturbance", "Very Strong", "Non-restorative sleep"),
        ("Cognitive Impairment", "Strong", "Brain fog"),
        ("Migraines", "Moderate", "Neurological overlap"),
    ],
    "Prostate Cancer": [
        ("Erectile Dysfunction", "Very Strong", "Treatment effect, nerve damage"),
        ("Urinary Incontinence", "Very Strong", "Post-prostatectomy"),
        ("Depression", "Strong", "Cancer diagnosis, sexual dysfunction"),
        ("Anxiety", "Strong", "Cancer recurrence fear"),
        ("Osteoporosis", "Moderate", "Androgen deprivation therapy"),
        ("Hot Flashes", "Strong", "Hormone therapy effect"),
        ("Gynecomastia", "Moderate", "Hormone therapy effect"),
        ("Fatigue", "Strong", "Treatment related"),
    ],
    "Hepatitis C": [
        ("Cirrhosis", "Very Strong", "Disease progression"),
        ("Hepatocellular Carcinoma", "Moderate", "Chronic liver disease"),
        ("Depression", "Strong", "Inflammatory pathway, IFN treatment"),
        ("Fatigue", "Very Strong", "Chronic infection"),
        ("Arthralgia", "Strong", "Extrahepatic manifestation"),
        ("Cryoglobulinemia", "Moderate", "Immune complex disease"),
        ("Diabetes", "Moderate", "Hepatic insulin resistance"),
        ("Kidney Disease", "Moderate", "Glomerulonephritis"),
    ],
    "Agent Orange Exposure": [
        ("Type 2 Diabetes", "Very Strong", "Presumptive condition"),
        ("Ischemic Heart Disease", "Very Strong", "Presumptive condition"),
        ("Parkinson's Disease", "Very Strong", "Presumptive condition"),
        ("Peripheral Neuropathy (early onset)", "Strong", "Presumptive if within 1 year"),
        ("Prostate Cancer", "Very Strong", "Presumptive condition"),
        ("Lung Cancer", "Very Strong", "Presumptive condition"),
        ("Soft Tissue Sarcoma", "Very Strong", "Presumptive condition"),
        ("Hodgkin's Disease", "Very Strong", "Presumptive condition"),
        ("Multiple Myeloma", "Very Strong", "Presumptive condition"),
        ("Non-Hodgkin's Lymphoma", "Very Strong", "Presumptive condition"),
        ("Chloracne", "Strong", "Must manifest within 1 year"),
        ("B-Cell Leukemia", "Very Strong", "CLL is presumptive"),
    ],
    "Gulf War Syndrome": [
        ("Chronic Fatigue", "Very Strong", "MUCMI manifestation"),
        ("Fibromyalgia", "Very Strong", "MUCMI manifestation"),
        ("IBS", "Very Strong", "MUCMI manifestation"),
        ("Headaches", "Strong", "Undiagnosed illness"),
        ("Joint Pain", "Strong", "Undiagnosed illness"),
        ("Sleep Disturbance", "Strong", "Undiagnosed illness"),
        ("Cognitive Problems", "Strong", "Undiagnosed illness"),
        ("Skin Conditions", "Moderate", "Undiagnosed illness"),
        ("Respiratory Issues", "Moderate", "Undiagnosed illness"),
    ],
    "Burn Pit Exposure": [
        ("Asthma", "Strong", "PACT Act presumptive pathway"),
        ("Chronic Bronchitis", "Strong", "Respiratory irritation"),
        ("COPD", "Strong", "Chronic inhalation"),
        ("Constrictive Bronchiolitis", "Strong", "Toxic exposure"),
        ("Sinusitis", "Strong", "Upper airway irritation"),
        ("Rhinitis", "Strong", "Nasal irritation"),
        ("Interstitial Lung Disease", "Moderate", "Pulmonary fibrosis"),
        ("Lung Cancer", "Moderate", "Carcinogen exposure"),
        ("Head/Neck Cancer", "Moderate", "Carcinogen exposure"),
        ("GI Conditions", "Moderate", "Systemic inflammation"),
    ],
    "Radiation Exposure": [
        ("Thyroid Cancer", "Very Strong", "Radiation sensitive tissue"),
        ("Leukemia", "Very Strong", "Bone marrow sensitivity"),
        ("Breast Cancer", "Strong", "Radiation dose dependent"),
        ("Lung Cancer", "Strong", "Radiation sensitive"),
        ("Bone Cancer", "Moderate", "Osteosarcoma risk"),
        ("Skin Cancer", "Moderate", "Direct exposure"),
        ("Brain Cancer", "Moderate", "CNS sensitivity"),
        ("Cataracts", "Strong", "Lens sensitivity"),
        ("Thyroid Disease", "Strong", "Non-malignant thyroid"),
    ],
    "Amputation": [
        ("Phantom Limb Pain", "Very Strong", "Neurological reorganization"),
        ("Depression", "Very Strong", "Body image, functional loss"),
        ("Anxiety", "Strong", "Adjustment disorder"),
        ("Residual Limb Pain", "Very Strong", "Neuroma, bone spurs"),
        ("Opposite Limb Condition", "Strong", "Overcompensation"),
        ("Back Pain", "Strong", "Altered gait, prosthesis use"),
        ("Skin Conditions", "Strong", "Socket irritation"),
        ("Cardiovascular Disease", "Moderate", "Decreased mobility"),
        ("Obesity", "Moderate", "Activity limitation"),
        ("Arthritis", "Strong", "Compensatory joint stress"),
    ],
    "Spinal Cord Injury": [
        ("Neurogenic Bladder", "Very Strong", "Autonomic dysfunction"),
        ("Neurogenic Bowel", "Very Strong", "Autonomic dysfunction"),
        ("Pressure Ulcers", "Very Strong", "Immobility, sensation loss"),
        ("Depression", "Very Strong", "Functional loss"),
        ("Autonomic Dysreflexia", "Strong", "Above T6 injuries"),
        ("Chronic Pain", "Very Strong", "Neuropathic pain"),
        ("Spasticity", "Very Strong", "Upper motor neuron"),
        ("Sexual Dysfunction", "Very Strong", "S2-S4 involvement"),
        ("UTIs", "Very Strong", "Catheter use, retention"),
        ("Respiratory Issues", "Moderate", "Cervical/high thoracic"),
        ("DVT", "Moderate", "Immobility"),
        ("Osteoporosis", "Moderate", "Disuse atrophy"),
    ],
    "Multiple Sclerosis": [
        ("Depression", "Very Strong", "Disease process, disability"),
        ("Fatigue", "Very Strong", "Primary MS symptom"),
        ("Bladder Dysfunction", "Very Strong", "Neurogenic bladder"),
        ("Bowel Dysfunction", "Strong", "Neurogenic bowel"),
        ("Cognitive Impairment", "Strong", "White matter lesions"),
        ("Sexual Dysfunction", "Strong", "Neurological involvement"),
        ("Spasticity", "Strong", "Upper motor neuron"),
        ("Trigeminal Neuralgia", "Moderate", "Demyelination"),
        ("Optic Neuritis", "Strong", "Common MS presentation"),
        ("Balance Problems", "Strong", "Cerebellar involvement"),
    ],
    "Parkinson's Disease": [
        ("Depression", "Very Strong", "Dopamine depletion"),
        ("Dementia", "Strong", "Late-stage disease"),
        ("Anxiety", "Strong", "Neurotransmitter effects"),
        ("Sleep Disturbance", "Very Strong", "REM behavior disorder"),
        ("Constipation", "Very Strong", "Autonomic dysfunction"),
        ("Orthostatic Hypotension", "Strong", "Autonomic dysfunction"),
        ("Dysphagia", "Strong", "Bulbar involvement"),
        ("Falls", "Very Strong", "Postural instability"),
        ("Urinary Dysfunction", "Strong", "Autonomic involvement"),
        ("Drooling", "Moderate", "Swallowing dysfunction"),
    ],
    "Heart Failure": [
        ("Depression", "Strong", "Chronic illness burden"),
        ("Anxiety", "Strong", "Dyspnea, fear of death"),
        ("Kidney Disease", "Strong", "Cardiorenal syndrome"),
        ("Sleep Apnea", "Strong", "Central and obstructive"),
        ("Cachexia", "Moderate", "Cardiac cachexia"),
        ("Arrhythmias", "Very Strong", "Structural changes"),
        ("Peripheral Edema", "Very Strong", "Fluid retention"),
        ("Hepatic Congestion", "Moderate", "Right heart failure"),
        ("Cognitive Impairment", "Moderate", "Cerebral hypoperfusion"),
    ],
    "Stroke": [
        ("Depression", "Very Strong", "Post-stroke depression"),
        ("Cognitive Impairment", "Very Strong", "Vascular dementia"),
        ("Dysphagia", "Strong", "Bulbar involvement"),
        ("Aphasia", "Strong", "Left hemisphere"),
        ("Hemiparesis", "Very Strong", "Motor cortex damage"),
        ("Spasticity", "Strong", "Upper motor neuron"),
        ("Seizures", "Moderate", "Post-stroke epilepsy"),
        ("Incontinence", "Moderate", "Frontal lobe involvement"),
        ("Falls", "Strong", "Balance, weakness"),
        ("Shoulder Pain", "Strong", "Hemiplegic shoulder"),
    ],
    "HIV/AIDS": [
        ("Depression", "Very Strong", "Chronic illness, stigma"),
        ("Anxiety", "Strong", "Disease management stress"),
        ("Peripheral Neuropathy", "Very Strong", "Viral, medication"),
        ("Lipodystrophy", "Strong", "HAART side effect"),
        ("Cardiovascular Disease", "Moderate", "Inflammation, medication"),
        ("Osteoporosis", "Moderate", "Medication, inflammation"),
        ("Cognitive Impairment", "Moderate", "HIV-associated dementia"),
        ("Chronic Kidney Disease", "Moderate", "HIV nephropathy, meds"),
    ],
    "Chronic Kidney Disease": [
        ("Anemia", "Very Strong", "Decreased EPO production"),
        ("Bone Disease", "Strong", "Mineral metabolism"),
        ("Hypertension", "Very Strong", "Fluid/sodium retention"),
        ("Cardiovascular Disease", "Very Strong", "Uremic toxins"),
        ("Peripheral Neuropathy", "Strong", "Uremic neuropathy"),
        ("Depression", "Strong", "Chronic illness burden"),
        ("Cognitive Impairment", "Moderate", "Uremic encephalopathy"),
        ("Pruritus", "Moderate", "Uremic itch"),
        ("Sexual Dysfunction", "Strong", "Hormonal, vascular"),
    ],
    "Ankle Condition": [
        ("Knee Condition", "Strong", "Kinetic chain, gait"),
        ("Hip Condition", "Moderate", "Kinetic chain"),
        ("Lumbar Spine", "Moderate", "Gait alteration"),
        ("Opposite Ankle", "Strong", "Overcompensation"),
        ("Foot Condition", "Strong", "Adjacent joint"),
        ("Depression", "Moderate", "Activity limitation"),
    ],
    "Hip Condition": [
        ("Lumbar Spine", "Strong", "Kinetic chain"),
        ("Knee Condition", "Strong", "Kinetic chain"),
        ("Opposite Hip", "Strong", "Overcompensation"),
        ("Gait Abnormality", "Very Strong", "Biomechanical"),
        ("Depression", "Moderate", "Chronic pain, limitation"),
        ("Falls", "Moderate", "Instability"),
    ],
    "Pes Planus": [
        ("Plantar Fasciitis", "Very Strong", "Biomechanical stress"),
        ("Ankle Condition", "Strong", "Altered mechanics"),
        ("Knee Condition", "Moderate", "Kinetic chain"),
        ("Hip Condition", "Moderate", "Kinetic chain"),
        ("Lumbar Spine", "Moderate", "Postural changes"),
        ("Achilles Tendinitis", "Strong", "Altered mechanics"),
    ],
}

def generate_entries():
    """Generate additional secondary condition entries"""
    entries = []
    entry_id = 1
    
    for primary, secondaries in ADDITIONAL_SECONDARY.items():
        for secondary, strength, mechanism in secondaries:
            entry = {
                "id": f"secondary_exp_{entry_id:05d}",
                "source": "secondary",
                "citation": f"38 CFR 3.310 - Secondary {secondary} to {primary}",
                "title": f"{secondary} Secondary to {primary}",
                "content": f"""
SECONDARY SERVICE CONNECTION RELATIONSHIP

PRIMARY CONDITION: {primary}
SECONDARY CONDITION: {secondary}
NEXUS STRENGTH: {strength}

MEDICAL RATIONALE:
{mechanism}

LEGAL BASIS:
38 CFR 3.310 - Disabilities that are proximately due to, or aggravated by, service-connected disease or injury.

EVIDENCE REQUIREMENTS:
1. Service-connected primary condition ({primary})
2. Current diagnosis of secondary condition ({secondary})
3. Medical opinion establishing the relationship
4. For aggravation claims, establish baseline severity

RATING IMPLICATIONS:
Secondary conditions are rated under their own diagnostic codes.
Allen aggravation requires baseline establishment before aggravation.
                """.strip(),
                "category": primary,
                "hierarchy_level": 2,
                "color_code": "green",
                "url": "https://www.ecfr.gov/current/title-38/chapter-I/part-3/subpart-A/subject-group-ECFRe5ccf3d3c4a7742/section-3.310",
                "metadata": {
                    "primary_condition": primary,
                    "secondary_condition": secondary,
                    "nexus_strength": strength,
                    "mechanism": mechanism,
                    "cfr_reference": "38 CFR 3.310",
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("🔗 SECONDARY CONDITIONS EXPANSION")
    print("="*80)
    
    entries = generate_entries()
    
    print(f"\n📊 Total NEW entries: {len(entries)}")
    
    # Save
    output_file = OUTPUT_DIR / "secondary_expansion.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
