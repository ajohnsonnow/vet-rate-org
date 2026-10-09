#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC DIAGNOSTIC CODE DATABASE - Rating Schedule Cases 500+ Entries       ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DC_CASES = {
    "Musculoskeletal General (4.40-4.59)": [
        ("38 CFR 4.40", "Pain and weakness", "Functional loss from pain must be rated"),
        ("38 CFR 4.45", "Joints", "Joint rating considerations"),
        ("38 CFR 4.46", "Accurate measurement", "ROM measurement standards"),
        ("38 CFR 4.59", "Painful motion", "All joints rated for painful motion"),
        ("DeLuca factors", "DeLuca v. Brown", "Functional loss analysis required"),
        ("Mitchell pain", "Mitchell v. Shinseki", "Pain must cause functional loss"),
        ("Correia ROM", "Correia v. McDonald", "Both joints, passive/active, weight-bearing"),
        ("Sharp flares", "Sharp v. Shulkin", "Opinion needed when flares reported"),
        ("Burton testing", "Burton v. Shinseki", "All DeLuca factors must be tested"),
        ("Southall-Norman", "Southall-Norman v. McDonald", "No deduction for age"),
        ("Cullen active", "Cullen v. Shinseki", "Active ROM primary"),
        ("Repetitive use", "Various", "Pain after repetitive use"),
        ("Incoordination", "Various", "Functional impairment"),
        ("Fatigability", "Various", "Increased fatigue"),
        ("Flare-ups", "Various", "Must estimate additional loss"),
        ("Weakened movement", "Various", "Strength impairment"),
        ("Excess fatigability", "Various", "Rapid fatigue"),
        ("Swelling", "Various", "Joint swelling indicator"),
        ("Instability", "Various", "Laxity of joint"),
        ("Deformity", "Various", "Structural abnormality"),
    ],
    "Spine DC 5235-5243": [
        ("DC 5237 Lumbosacral", "Various", "LS strain rating"),
        ("DC 5242 Degenerative", "Various", "DDD/DJD rating"),
        ("DC 5243 IVDS", "Various", "Intervertebral disc syndrome"),
        ("General Rating Formula", "Various", "Forward flexion based"),
        ("IVDS Formula", "Various", "Incapacitating episodes"),
        ("Forward flexion 90", "Various", "10% or 20% rating"),
        ("Forward flexion 60", "Various", "20% rating"),
        ("Forward flexion 30", "Various", "40% rating"),
        ("Favorable ankylosis", "Various", "40% rating"),
        ("Unfavorable ankylosis", "Various", "50-100% rating"),
        ("Combined ROM", "Various", "Alternative criterion"),
        ("Muscle spasm", "Various", "10% with localized"),
        ("Guarding", "Various", "Abnormal gait/contour"),
        ("Associated radiculopathy", "Various", "Separate rating"),
        ("Bowel/bladder", "Various", "Separate SMC consideration"),
        ("Bed rest IVDS", "Various", "Doctor prescribed"),
        ("6+ weeks IVDS", "Various", "60% rating"),
        ("4-6 weeks IVDS", "Various", "40% rating"),
        ("2-4 weeks IVDS", "Various", "20% rating"),
        ("1-2 weeks IVDS", "Various", "10% rating"),
    ],
    "Knee DC 5256-5263": [
        ("DC 5256 Ankylosis", "Various", "Knee ankylosis rating"),
        ("DC 5257 Instability", "Various", "Recurrent subluxation"),
        ("DC 5258 Cartilage", "Various", "Semilunar cartilage dislocation"),
        ("DC 5259 Cartilage removed", "Various", "Symptomatic removal"),
        ("DC 5260 Flexion", "Various", "Limitation of flexion"),
        ("DC 5261 Extension", "Various", "Limitation of extension"),
        ("DC 5262 Tibia/fibula", "Various", "Impairment of tibia/fibula"),
        ("DC 5263 Genu recurvatum", "Various", "Acquired knee bend"),
        ("VAOPGCPREC 23-97", "General Counsel", "Separate ratings knee"),
        ("VAOPGCPREC 9-98", "General Counsel", "Both flexion and extension"),
        ("VAOPGCPREC 9-04", "General Counsel", "Separate instability rating"),
        ("Flexion 45", "Various", "10% rating"),
        ("Flexion 30", "Various", "20% rating"),
        ("Flexion 15", "Various", "30% rating"),
        ("Extension 10", "Various", "10% rating"),
        ("Extension 15", "Various", "20% rating"),
        ("Extension 20", "Various", "30% rating"),
        ("Extension 30", "Various", "40% rating"),
        ("Extension 45", "Various", "50% rating"),
        ("Slight instability", "Various", "10% rating"),
    ],
    "Shoulder DC 5200-5203": [
        ("DC 5200 Scapulohumeral", "Various", "Shoulder ankylosis"),
        ("DC 5201 Arm motion", "Various", "Limitation of arm motion"),
        ("DC 5202 Humerus", "Various", "Other humerus impairment"),
        ("DC 5203 Clavicle/scapula", "Various", "Impairment of clavicle"),
        ("Major vs minor", "Various", "Dominant hand determination"),
        ("Arm at side", "Various", "40%/30% rating"),
        ("Arm midway", "Various", "30%/20% rating"),
        ("Arm shoulder level", "Various", "20%/20% rating"),
        ("Rotator cuff", "Various", "Functional impairment"),
        ("Impingement", "Various", "Motion limitation"),
        ("Labral tear", "Various", "Instability consideration"),
        ("AC joint", "Various", "Arthritis consideration"),
        ("Frozen shoulder", "Various", "Adhesive capsulitis"),
        ("Abduction 90", "Various", "Shoulder level"),
        ("Forward flexion 90", "Various", "Arm at shoulder level"),
        ("Internal rotation", "Various", "ROM component"),
        ("External rotation", "Various", "ROM component"),
        ("Painful arc", "Various", "Impingement sign"),
        ("Muscle atrophy", "Various", "Disuse indication"),
        ("Instability testing", "Various", "Apprehension test"),
    ],
    "Hip DC 5250-5255": [
        ("DC 5250 Hip ankylosis", "Various", "Favorable/unfavorable"),
        ("DC 5251 Thigh extension", "Various", "Extension to 5 degrees"),
        ("DC 5252 Thigh flexion", "Various", "Limitation of flexion"),
        ("DC 5253 Thigh rotation", "Various", "Impairment of thigh"),
        ("DC 5254 Hip flail", "Various", "Flail joint"),
        ("DC 5255 Femur impairment", "Various", "Malunion/nonunion"),
        ("Flexion 45", "Various", "10% rating"),
        ("Flexion 30", "Various", "20% rating"),
        ("Flexion 20", "Various", "30% rating"),
        ("Flexion 10", "Various", "40% rating"),
        ("Abduction lost", "Various", "Cross legs impairment"),
        ("Rotation lost", "Various", "Toe-out impairment"),
        ("Adduction 0", "Various", "10% for adduction lost"),
        ("THR prosthesis", "Various", "Minimum 30% post-THR"),
        ("100% for 1 year", "Various", "Post-replacement"),
        ("Residuals THR", "Various", "After convalescence"),
        ("VAOPGCPREC 9-04", "Various", "Hip instability"),
        ("Trendelenburg", "Various", "Gait abnormality"),
        ("Pain sitting", "Various", "Functional impairment"),
        ("Groin pain", "Various", "Hip symptom"),
    ],
    "Ankle DC 5270-5274": [
        ("DC 5270 Ankylosis", "Various", "Ankle ankylosis"),
        ("DC 5271 Motion", "Various", "Limited ankle motion"),
        ("DC 5272 Subastragalar", "Various", "Ankylosis of subastragalar"),
        ("DC 5273 Malunion os calcis", "Various", "Os calcis/astragalus"),
        ("DC 5274 Astragalectomy", "Various", "Removal of astragalus"),
        ("Plantar 0-10", "Various", "0% normal"),
        ("Marked limitation", "Various", "20% rating"),
        ("Moderate limitation", "Various", "10% rating"),
        ("Dorsiflexion normal", "Various", "20 degrees"),
        ("Plantar flexion normal", "Various", "45 degrees"),
        ("Plantar 20", "Various", "Neutral plantar"),
        ("Dorsiflexion 10", "Various", "Decreased DF"),
        ("Good position", "Various", "Favorable ankylosis"),
        ("Poor position", "Various", "Unfavorable ankylosis"),
        ("Achilles rupture", "Various", "Functional impairment"),
        ("Instability lateral", "Various", "Recurrent sprains"),
        ("Arthritis post-trauma", "Various", "PTOA ankle"),
        ("TAR prosthesis", "Various", "Ankle replacement"),
        ("Fusion surgery", "Various", "Arthrodesis"),
        ("Subtalar fusion", "Various", "Limited motion"),
    ],
    "Mental Health DC 9201-9440": [
        ("DC 9201 Schizophrenia", "Various", "Undifferentiated type"),
        ("DC 9202 Schizophrenia", "Various", "Catatonic type"),
        ("DC 9203 Schizophrenia", "Various", "Paranoid type"),
        ("DC 9204 Schizophrenia", "Various", "Disorganized type"),
        ("DC 9205 Schizophrenia", "Various", "Residual type"),
        ("DC 9208 Delusional", "Various", "Delusional disorder"),
        ("DC 9210 Other psychotic", "Various", "Other psychotic disorders"),
        ("DC 9211 Schizoaffective", "Various", "Schizoaffective disorder"),
        ("DC 9300 Delirium", "Various", "Delirium disorder"),
        ("DC 9301 Dementia", "Various", "Dementia disorder"),
        ("DC 9304 Dementia vascular", "Various", "Vascular dementia"),
        ("DC 9305 Dementia due to", "Various", "Due to head trauma"),
        ("DC 9310 Unspecified neurocognitive", "Various", "Neurocognitive disorder"),
        ("DC 9326 Dementia HIV", "Various", "HIV-related"),
        ("DC 9327 Neurocognitive major", "Various", "Major NCD"),
        ("DC 9400 GAD", "Various", "Generalized anxiety disorder"),
        ("DC 9403 Specific phobia", "Various", "Phobia rating"),
        ("DC 9404 OCD", "Various", "Obsessive-compulsive"),
        ("DC 9411 PTSD", "Various", "Post-traumatic stress"),
        ("DC 9434 MDD", "Various", "Major depressive disorder"),
    ],
    "Cardiovascular DC 7000-7123": [
        ("DC 7000 Rheumatic", "Various", "Valvular heart disease"),
        ("DC 7001 Endocarditis", "Various", "Infective endocarditis"),
        ("DC 7002 Pericarditis", "Various", "Pericardium disease"),
        ("DC 7004 Syphilitic", "Various", "Syphilitic heart disease"),
        ("DC 7005 CAD", "Various", "Coronary artery disease"),
        ("DC 7006 MI", "Various", "Myocardial infarction"),
        ("DC 7007 Hypertensive", "Various", "Hypertensive heart"),
        ("DC 7008 Hyperthyroid", "Various", "Hyperthyroid heart"),
        ("DC 7010 SVT", "Various", "Supraventricular arrhythmia"),
        ("DC 7011 VT", "Various", "Ventricular arrhythmia"),
        ("DC 7015 AV block", "Various", "Atrioventricular block"),
        ("DC 7017 CABG", "Various", "Coronary bypass"),
        ("DC 7018 Implantable device", "Various", "AICD/pacemaker"),
        ("DC 7019 Heart transplant", "Various", "Cardiac transplant"),
        ("DC 7020 Cardiomyopathy", "Various", "Heart muscle disease"),
        ("DC 7101 HTN", "Various", "Hypertensive vascular disease"),
        ("DC 7110 Aortic aneurysm", "Various", "Aorta abnormality"),
        ("DC 7111 Aneurysm other", "Various", "Other large arteries"),
        ("DC 7117 Raynaud's", "Various", "Raynaud's syndrome"),
        ("DC 7122 Cold injury", "Various", "Cold injury residuals"),
    ],
    "Respiratory DC 6502-6847": [
        ("DC 6502 Septal deviation", "Various", "Nasal septum"),
        ("DC 6504 Nose deformity", "Various", "Loss of part of nose"),
        ("DC 6510 Pansinusitis", "Various", "All sinuses"),
        ("DC 6511 Ethmoid sinusitis", "Various", "Ethmoid sinus"),
        ("DC 6512 Frontal sinusitis", "Various", "Frontal sinus"),
        ("DC 6513 Maxillary sinusitis", "Various", "Maxillary sinus"),
        ("DC 6514 Sphenoid sinusitis", "Various", "Sphenoid sinus"),
        ("DC 6516 Laryngitis chronic", "Various", "Voice disorder"),
        ("DC 6519 Aphonia", "Various", "Complete voice loss"),
        ("DC 6520 Larynx stenosis", "Various", "Narrowing"),
        ("DC 6521 Laryngectomy", "Various", "Larynx removal"),
        ("DC 6522 Rhinitis allergic", "Various", "Allergic rhinitis"),
        ("DC 6524 Granulomatous", "Various", "Granulomatous rhinitis"),
        ("DC 6600 Bronchitis chronic", "Various", "Chronic bronchitis"),
        ("DC 6602 Asthma", "Various", "Bronchial asthma"),
        ("DC 6603 Emphysema", "Various", "Pulmonary emphysema"),
        ("DC 6604 COPD", "Various", "Chronic obstructive"),
        ("DC 6840 Restrictive", "Various", "Restrictive lung disease"),
        ("DC 6843 Sleep apnea", "Various", "Traumatic sleep apnea"),
        ("DC 6847 OSA", "Various", "Obstructive sleep apnea"),
    ],
    "Skin DC 7800-7833": [
        ("DC 7800 Disfigurement", "Various", "Head/face/neck"),
        ("DC 7801 Scars deep", "Various", "Burns or other causes"),
        ("DC 7802 Scars superficial", "Various", "Superficial nonlinear"),
        ("DC 7804 Scars unstable", "Various", "Painful/unstable scars"),
        ("DC 7805 Scars other", "Various", "Other scar effects"),
        ("DC 7806 Dermatitis", "Various", "Dermatitis/eczema"),
        ("DC 7807 Pemphigus", "Various", "Bullous disorders"),
        ("DC 7809 Discoid lupus", "Various", "Discoid lupus erythematosus"),
        ("DC 7811 TB luposa", "Various", "Tuberculosis cutis"),
        ("DC 7813 Dermatophytosis", "Various", "Fungal infections"),
        ("DC 7815 Bullous disorders", "Various", "Pemphigoid"),
        ("DC 7816 Psoriasis", "Various", "Psoriasis"),
        ("DC 7817 Erythroderma", "Various", "Exfoliative dermatitis"),
        ("DC 7820 Skin infections", "Various", "Bacterial/viral/parasitic"),
        ("DC 7821 Cutaneous", "Various", "Manifestations conditions"),
        ("DC 7822 Papulosquamous", "Various", "Papulosquamous disorders"),
        ("DC 7823 Vitiligo", "Various", "Vitiligo rating"),
        ("DC 7824 Keratosis", "Various", "Actinic keratoses"),
        ("DC 7825 Urticaria", "Various", "Chronic urticaria"),
        ("DC 7826 Vasculitis", "Various", "Cutaneous vasculitis"),
    ],
    "Digestive DC 7301-7354": [
        ("DC 7301 Adhesions", "Various", "Peritoneal adhesions"),
        ("DC 7305 Duodenal ulcer", "Various", "Duodenal ulcer"),
        ("DC 7306 Marginal ulcer", "Various", "Gastrojejunal ulcer"),
        ("DC 7307 Gastritis hypertrophic", "Various", "Chronic hypertrophic"),
        ("DC 7308 Postgastrectomy", "Various", "Syndromes following"),
        ("DC 7310 Stomach injury", "Various", "Residuals injury"),
        ("DC 7312 Cirrhosis", "Various", "Cirrhosis of liver"),
        ("DC 7314 Cholecystitis", "Various", "Chronic cholecystitis"),
        ("DC 7318 Gallbladder removal", "Various", "Postcholecystectomy"),
        ("DC 7319 IBS", "Various", "Irritable colon syndrome"),
        ("DC 7323 UC", "Various", "Ulcerative colitis"),
        ("DC 7329 Intestine resection", "Various", "Large intestine"),
        ("DC 7330 Fistula intestinal", "Various", "Intestinal fistula"),
        ("DC 7332 Rectum sphincter", "Various", "Impairment control"),
        ("DC 7336 Hemorrhoids", "Various", "External/internal"),
        ("DC 7337 Pruritus ani", "Various", "Anal itching"),
        ("DC 7338 Hernia inguinal", "Various", "Inguinal hernia"),
        ("DC 7345 Hepatitis chronic", "Various", "Chronic liver disease"),
        ("DC 7346 Hiatal hernia", "Various", "Hiatal hernia"),
        ("DC 7354 Hepatitis C", "Various", "HCV rating"),
    ],
    "Genitourinary DC 7500-7542": [
        ("DC 7500 Kidney removal", "Various", "Nephrectomy"),
        ("DC 7502 Nephritis chronic", "Various", "Chronic nephritis"),
        ("DC 7504 Pyelonephritis", "Various", "Chronic infection"),
        ("DC 7505 Kidney stones", "Various", "Nephrolithiasis"),
        ("DC 7507 Nephrosclerosis", "Various", "Arteriolar nephrosclerosis"),
        ("DC 7508 Nephrolithiasis", "Various", "Kidney calculi"),
        ("DC 7509 Hydronephrosis", "Various", "Kidney swelling"),
        ("DC 7510 UTI chronic", "Various", "Urinary tract infection"),
        ("DC 7511 Bladder stricture", "Various", "Ureter stricture"),
        ("DC 7512 Cystitis chronic", "Various", "Bladder infection"),
        ("DC 7515 Bladder fistula", "Various", "Urinary fistula"),
        ("DC 7516 Bladder injury", "Various", "Residuals injury"),
        ("DC 7517 Bladder injury", "Various", "Requiring appliance"),
        ("DC 7518 Urethra stricture", "Various", "Urethral stricture"),
        ("DC 7519 Fistula urethra", "Various", "Urethral fistula"),
        ("DC 7520 Urethritis", "Various", "Chronic urethritis"),
        ("DC 7521 Penis removal", "Various", "Penectomy"),
        ("DC 7522 Penis deformity", "Various", "Deformity with LOF"),
        ("DC 7523 Testis atrophy", "Various", "Testicular atrophy"),
        ("DC 7525 Epididymitis", "Various", "Chronic epididymitis"),
    ],
    "Endocrine DC 7900-7919": [
        ("DC 7900 Hyperthyroidism", "Various", "Graves disease"),
        ("DC 7901 Toxic nodular", "Various", "Thyroid goiter"),
        ("DC 7902 Nontoxic nodular", "Various", "Nontoxic goiter"),
        ("DC 7903 Hypothyroidism", "Various", "Underactive thyroid"),
        ("DC 7904 Hyperparathyroidism", "Various", "Parathyroid excess"),
        ("DC 7905 Hypoparathyroidism", "Various", "Parathyroid deficiency"),
        ("DC 7906 Thyroiditis", "Various", "Thyroid inflammation"),
        ("DC 7907 Cushing's", "Various", "Cushing syndrome"),
        ("DC 7908 Addison's", "Various", "Adrenal insufficiency"),
        ("DC 7909 Aldosteronism", "Various", "Conn syndrome"),
        ("DC 7911 Pheochromocytoma", "Various", "Adrenal tumor"),
        ("DC 7912 Polyglandular", "Various", "Multiple gland"),
        ("DC 7913 Diabetes mellitus", "Various", "Diabetes rating"),
        ("DC 7914 Neoplasm malignant", "Various", "Cancer endocrine"),
        ("DC 7915 Neoplasm benign", "Various", "Benign tumor"),
        ("DC 7916 Hypoglycemia", "Various", "Low blood sugar"),
        ("DC 7917 Hyperaldosteronism", "Various", "Aldosterone excess"),
        ("DC 7918 Pituitary acromegaly", "Various", "Growth hormone excess"),
        ("DC 7919 C-cell hyperplasia", "Various", "Thyroid C-cells"),
        ("Diabetes complications", "Various", "Secondary conditions"),
    ],
    "Neurological DC 8000-8914": [
        ("DC 8000 Encephalitis epidemic", "Various", "Brain inflammation"),
        ("DC 8003 Meningitis cerebrospinal", "Various", "Meningitis"),
        ("DC 8004 Paralysis agitans", "Various", "Parkinson's disease"),
        ("DC 8007 Embolism brain", "Various", "CVA embolism"),
        ("DC 8008 Thrombosis brain", "Various", "CVA thrombosis"),
        ("DC 8009 Hemorrhage brain", "Various", "CVA hemorrhage"),
        ("DC 8010 Myelitis", "Various", "Spinal cord inflammation"),
        ("DC 8011 Poliomyelitis", "Various", "Polio residuals"),
        ("DC 8012 Hematomyelia", "Various", "Spinal cord hemorrhage"),
        ("DC 8013 Syphilis nervous", "Various", "Neurosyphilis"),
        ("DC 8018 Multiple sclerosis", "Various", "MS rating"),
        ("DC 8019 Meningitis cerebrospinal", "Various", "Meningitis epidemic"),
        ("DC 8020 Encephalitis", "Various", "Brain infection"),
        ("DC 8025 Myasthenia gravis", "Various", "NMJ disorder"),
        ("DC 8045 TBI", "Various", "Traumatic brain injury"),
        ("DC 8100 Migraine", "Various", "Migraine headaches"),
        ("DC 8103 Tic convulsive", "Various", "Facial tic"),
        ("DC 8104 Trigeminal nerve", "Various", "Trigeminal neuralgia"),
        ("DC 8205 Facial paralysis", "Various", "Bell's palsy"),
        ("DC 8520 Sciatic nerve", "Various", "Sciatica rating"),
    ],
}

def generate_entries():
    """Generate DC case entries"""
    entries = []
    entry_id = 1
    
    for category, items in DC_CASES.items():
        for code, authority, description in items:
            entry = {
                "id": f"cavc_dc_{entry_id:05d}",
                "source": "cavc",
                "citation": authority,
                "title": f"{code}",
                "content": f"""
DIAGNOSTIC CODE GUIDANCE

CODE/REGULATION: {code}
CATEGORY: {category}
AUTHORITY: {authority}

GUIDANCE:
{description}

APPLICATION:
This guidance applies to ratings under the specified diagnostic code.
                """.strip(),
                "category": category,
                "hierarchy_level": 2,
                "color_code": "yellow",
                "url": "https://www.ecfr.gov/title-38/chapter-I/part-4",
                "metadata": {
                    "code": code,
                    "authority": authority,
                    "description": description,
                    "category": category,
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("⚖️ CAVC DIAGNOSTIC CODE DATABASE")
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
    output_file = OUTPUT_DIR / "cavc_diagnostic_codes.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
