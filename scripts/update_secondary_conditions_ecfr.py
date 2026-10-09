#!/usr/bin/env python3
"""
Script to update secondary_conditions_db.json with proper eCFR diagnostic codes
and rename medical_citations to medical_evidence for clarity.

This ensures compliance with the requirement to base everything on eCFR while
clearly distinguishing between eCFR legal framework and medical literature
used for nexus purposes.
"""

import json
import os

# Mapping of conditions to their eCFR diagnostic codes
ECFR_DIAGNOSTIC_CODES = {
    # Sleep/Respiratory
    "Obstructive Sleep Apnea (OSA)": "DC 6847",
    "Sleep Apnea": "DC 6847",
    
    # Digestive
    "Gastroesophageal Reflux Disease (GERD)": "DC 7206",
    "GERD": "DC 7206",
    "Irritable Bowel Syndrome (IBS)": "DC 7319",
    "IBS": "DC 7319",
    
    # Dental/TMJ
    "Bruxism (Teeth Grinding/TMJ Disorder)": "DC 9905",
    "TMJ Disorder": "DC 9905",
    
    # Cardiovascular
    "Hypertension (High Blood Pressure)": "DC 7101",
    "Hypertension": "DC 7101",
    "Coronary Artery Disease / Ischemic Heart Disease": "DC 7005",
    "Coronary Artery Disease": "DC 7005",
    "Cardiac Arrhythmias / Atrial Fibrillation": "DC 7010",
    "Atrial Fibrillation": "DC 7010",
    "Pulmonary Hypertension": "DC 6817",
    
    # Genitourinary
    "Erectile Dysfunction": "DC 7522",
    "Urinary Incontinence / Bladder Dysfunction": "DC 7542 (or voiding dysfunction criteria)",
    "Chronic Pelvic Pain Syndrome": "Rated by analogy under genitourinary system",
    
    # Neurological
    "Migraine Headaches": "DC 8100",
    "Migraines": "DC 8100",
    "Stroke / Cerebrovascular Disease": "DC 8007-8009",
    "Cognitive Impairment / Mild Cognitive Decline": "DC 8045 or DC 9326",
    "Radiculopathy": "DC 8520 (sciatic) or DC 8510-8513 (cervical)",
    "Peripheral Neuropathy": "DC 8520 (varies by nerve affected)",
    
    # Mental Health
    "Depression / Major Depressive Disorder": "DC 9434",
    "Depression": "DC 9434",
    "Major Depressive Disorder": "DC 9434",
    "Depression and Anxiety": "DC 9434/DC 9400",
    "Anxiety": "DC 9400",
    "Generalized Anxiety Disorder": "DC 9400",
    
    # Metabolic/Endocrine
    "Type 2 Diabetes Mellitus": "DC 7913",
    "Diabetes": "DC 7913",
    "Weight Gain / Obesity": "Rated under resulting conditions (e.g., DC 6847, DC 7101)",
    
    # Musculoskeletal
    "Degenerative Disc Disease / Lumbar Spine": "DC 5237/5242/5243",
    "Chronic Pain Syndrome": "Rated by analogy or under specific condition",
    "Foot Ulcers / Diabetic Foot Complications": "DC 5284",
    
    # Primary conditions
    "PTSD": "DC 9411",
    "Post-Traumatic Stress Disorder (PTSD)": "DC 9411",
    "Generalized Anxiety Disorder": "DC 9400",
    "Major Depressive Disorder": "DC 9434",
    "Tinnitus": "DC 6260",
    "Hearing Loss": "DC 6100",
    "Knee - Right": "DC 5260/5261",
    "Knee - Left": "DC 5260/5261",
    "Lumbar Spine Condition": "DC 5237/5242/5243",
    "Shoulder - Right": "DC 5201",
    "Chronic Pain with NSAID Use": "Rated under specific condition",
    "Ankle - Right": "DC 5270/5271",
    "Peripheral Neuropathy (Lower Extremity)": "DC 8520",
    "Obstructive Sleep Apnea (OSA)": "DC 6847",
    "Chronic Prostatitis / Prostate Condition": "DC 7527",
}

# eCFR references for primary conditions
ECFR_REFERENCES = {
    "ptsd": "38 CFR § 4.130",
    "anxiety": "38 CFR § 4.130",
    "depression": "38 CFR § 4.130",
    "tinnitus": "38 CFR § 4.87",
    "hearing_loss": "38 CFR § 4.85-4.87",
    "knee_right": "38 CFR § 4.71a",
    "knee_left": "38 CFR § 4.71a",
    "lumbar_spine": "38 CFR § 4.71a",
    "shoulder_right": "38 CFR § 4.71a",
    "chronic_pain_nsaid": "38 CFR Part 4 (various)",
    "ankle_right": "38 CFR § 4.71a",
    "peripheral_neuropathy": "38 CFR § 4.124a",
    "sleep_apnea": "38 CFR § 4.97",
    "prostate_chronic": "38 CFR § 4.115b",
}

def update_database():
    """Update the secondary_conditions_db.json with eCFR codes."""
    
    # Path to the database file
    db_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'src', 'data', 'secondary_conditions_db.json'
    )
    
    print(f"Reading database from: {db_path}")
    
    with open(db_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Process each primary condition
    for primary_key, primary_data in data.items():
        # Skip metadata
        if primary_key.startswith('_'):
            continue
            
        print(f"\nProcessing: {primary_key}")
        
        # Add eCFR reference for primary condition
        if primary_key in ECFR_REFERENCES:
            primary_data['ecfr_reference'] = ECFR_REFERENCES[primary_key]
        
        # Add diagnostic code for primary if not present
        primary_name = primary_data.get('name', '')
        if 'ecfr_diagnostic_code' not in primary_data:
            for condition_name, dc_code in ECFR_DIAGNOSTIC_CODES.items():
                if condition_name.lower() in primary_name.lower() or primary_name.lower() in condition_name.lower():
                    primary_data['ecfr_diagnostic_code'] = dc_code
                    print(f"  Added primary DC: {dc_code}")
                    break
        
        # Process secondary conditions
        if 'potential_secondaries' in primary_data:
            for secondary in primary_data['potential_secondaries']:
                condition_name = secondary.get('condition', '')
                
                # Add diagnostic code for secondary condition
                if 'ecfr_diagnostic_code' not in secondary:
                    for cond_name, dc_code in ECFR_DIAGNOSTIC_CODES.items():
                        if cond_name.lower() in condition_name.lower() or condition_name.lower() in cond_name.lower():
                            secondary['ecfr_diagnostic_code'] = dc_code
                            print(f"    Secondary '{condition_name}': {dc_code}")
                            break
                
                # Rename medical_citations to medical_evidence
                if 'medical_citations' in secondary:
                    secondary['medical_evidence'] = secondary.pop('medical_citations')
                    secondary['evidence_type'] = "Medical Literature (for IMO/Nexus purposes)"
                    print(f"    Renamed medical_citations -> medical_evidence")
    
    # Write updated database
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Database updated successfully!")
    print(f"  Path: {db_path}")

if __name__ == '__main__':
    update_database()
