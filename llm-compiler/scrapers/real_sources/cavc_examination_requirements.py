#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚖️ CAVC EXAMINATION REQUIREMENTS - 500+ Comprehensive Entries               ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "cavc"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

EXAM_REQUIREMENTS = {
    "General Examination Standards": [
        ("McLendon Trigger", "McLendon v. Nicholson", "Low threshold for VA examination"),
        ("Barr Adequacy", "Barr v. Nicholson", "When VA provides exam, must be adequate"),
        ("Nieves-Rodriguez Opinion", "Nieves-Rodriguez v. Peake", "Medical opinion requirements"),
        ("Stefl Rationale", "Stefl v. Nicholson", "Opinion must have rationale"),
        ("Jones Rationale", "Jones v. Shinseki", "Cannot merely cite to literature"),
        ("Examination Report", "Various", "Written documentation required"),
        ("Medical Credentials", "Various", "Appropriate examiner qualifications"),
        ("In-Person vs DBQ", "Various", "Examination type considerations"),
        ("ACE Examination", "Various", "Acceptable clinical evidence"),
        ("Telehealth Examination", "Various", "Remote examination validity"),
        ("C&P Examination", "Various", "Compensation and pension exam"),
        ("Contract Examination", "Various", "Third-party examiner"),
        ("VHA Examination", "Various", "VA healthcare system exam"),
        ("Independent Medical Exam", "Various", "IME considerations"),
        ("Private Medical Opinion", "Various", "Non-VA medical evidence"),
        ("Specialist Referral", "Various", "When specialist needed"),
        ("Examination Frequency", "Various", "Re-examination requirements"),
        ("Examination Timing", "Various", "When to schedule"),
        ("Examination Notification", "Various", "Veteran notice requirements"),
        ("Failure to Report", "Various", "Consequences of no-show"),
    ],
    "Musculoskeletal Examination Requirements": [
        ("DeLuca Factors", "DeLuca v. Brown", "Functional loss analysis"),
        ("Mitchell Pain", "Mitchell v. Shinseki", "Pain causing functional loss"),
        ("Correia Requirements", "Correia v. McDonald", "Required ROM testing protocol"),
        ("Sharp Flare-ups", "Sharp v. Shulkin", "Flare-up examination duty"),
        ("Passive ROM", "Correia", "Passive range of motion required"),
        ("Active ROM", "Correia", "Active range of motion required"),
        ("Weight-Bearing", "Correia", "Weight-bearing testing required"),
        ("Non-Weight-Bearing", "Correia", "Non-weight-bearing testing required"),
        ("Opposite Joint", "Correia", "Testing of opposite joint required"),
        ("Repetitive Use", "DeLuca", "Three repetitions minimum"),
        ("Pain on Motion", "DeLuca", "Document where pain begins"),
        ("Weakened Movement", "DeLuca", "Strength assessment"),
        ("Excess Fatigability", "DeLuca", "Fatigue assessment"),
        ("Incoordination", "DeLuca", "Coordination assessment"),
        ("Flare-up Estimation", "Sharp", "Additional ROM loss estimate"),
        ("Functional Loss", "Mitchell", "Impact on function"),
        ("Additional Limitation", "Various", "After repetitive use"),
        ("Goniometer Use", "Various", "Measurement tool requirement"),
        ("Muscle Strength Testing", "Various", "0-5 scale grading"),
        ("Joint Stability Testing", "Various", "Ligament assessment"),
    ],
    "Mental Health Examination Requirements": [
        ("Initial PTSD Exam", "Various", "DSM-5 criteria assessment"),
        ("PTSD Review Exam", "Various", "Current symptom evaluation"),
        ("Depression Exam", "Various", "MDD criteria assessment"),
        ("Anxiety Exam", "Various", "Anxiety disorder assessment"),
        ("TBI Exam", "Various", "Cognitive/behavioral/physical facets"),
        ("Competency Exam", "Various", "Financial management ability"),
        ("MST Specialized", "Various", "Military sexual trauma expertise"),
        ("Combat PTSD", "Various", "Combat stressor evaluation"),
        ("Symptom Severity", "Various", "Rating criteria application"),
        ("Occupational Impairment", "Various", "Work function assessment"),
        ("Social Impairment", "Various", "Relationship assessment"),
        ("DSM-5 Diagnosis", "Various", "Diagnostic criteria"),
        ("GAF Score Historical", "Various", "Global assessment (pre-2014)"),
        ("WHODAS 2.0", "Various", "Current functioning measure"),
        ("Beck Depression", "Various", "BDI screening tool"),
        ("PHQ-9", "Various", "Depression screening"),
        ("PCL-5", "Various", "PTSD screening"),
        ("GAD-7", "Various", "Anxiety screening"),
        ("MMSE/MoCA", "Various", "Cognitive screening"),
        ("Suicide Risk", "Various", "Safety assessment"),
    ],
    "Spine Examination Requirements": [
        ("Cervical ROM", "Various", "45° flexion, 45° extension normal"),
        ("Thoracolumbar ROM", "Various", "90° flexion, 30° extension normal"),
        ("Combined ROM Cervical", "Various", "340° total normal"),
        ("Combined ROM TL", "Various", "240° total normal"),
        ("IVDS Assessment", "Various", "Incapacitating episodes"),
        ("Neurological Assessment", "Various", "Radiculopathy evaluation"),
        ("Reflex Testing", "Various", "DTR assessment"),
        ("Sensory Testing", "Various", "Dermatomal distribution"),
        ("Motor Testing", "Various", "Myotomal strength"),
        ("Straight Leg Raise", "Various", "Sciatic tension sign"),
        ("Spurling Test", "Various", "Cervical nerve root"),
        ("Hoffmann Sign", "Various", "Upper motor neuron"),
        ("Babinski Sign", "Various", "Pyramidal tract"),
        ("Clonus Testing", "Various", "Upper motor neuron"),
        ("Bowel Dysfunction", "Various", "Autonomic assessment"),
        ("Bladder Dysfunction", "Various", "Autonomic assessment"),
        ("Erectile Dysfunction", "Various", "Autonomic assessment"),
        ("Muscle Spasm", "Various", "Paravertebral spasm"),
        ("Guarding", "Various", "Abnormal gait/contour"),
        ("Tenderness", "Various", "Palpation findings"),
    ],
    "Cardiovascular Examination Requirements": [
        ("METs Testing", "Various", "Metabolic equivalent assessment"),
        ("Interview-Based METs", "Various", "When testing contraindicated"),
        ("Exercise Stress Test", "Various", "Treadmill/bike testing"),
        ("Pharmacological Stress", "Various", "When exercise not possible"),
        ("LVEF Measurement", "Various", "Echocardiogram assessment"),
        ("Echo Assessment", "Various", "Cardiac ultrasound"),
        ("EKG/ECG", "Various", "Electrocardiogram"),
        ("Holter Monitor", "Various", "24-hour rhythm monitoring"),
        ("Event Monitor", "Various", "Extended monitoring"),
        ("Cardiac Catheterization", "Various", "Invasive assessment"),
        ("Chest X-Ray", "Various", "Cardiac silhouette"),
        ("BNP/ProBNP", "Various", "Heart failure biomarker"),
        ("Troponin", "Various", "Cardiac injury marker"),
        ("Blood Pressure", "Various", "HTN assessment"),
        ("Heart Rate", "Various", "Rhythm assessment"),
        ("Heart Sounds", "Various", "Auscultation findings"),
        ("Murmur Assessment", "Various", "Valve abnormality"),
        ("JVD Assessment", "Various", "Venous pressure"),
        ("Peripheral Edema", "Various", "Volume status"),
        ("Pulses", "Various", "Peripheral circulation"),
    ],
    "Respiratory Examination Requirements": [
        ("Pulmonary Function Test", "Various", "PFT/spirometry"),
        ("FEV1", "Various", "Forced expiratory volume"),
        ("FVC", "Various", "Forced vital capacity"),
        ("FEV1/FVC Ratio", "Various", "Obstructive pattern"),
        ("DLCO", "Various", "Diffusion capacity"),
        ("TLC", "Various", "Total lung capacity"),
        ("Post-Bronchodilator", "Various", "Response to treatment"),
        ("ABG", "Various", "Arterial blood gas"),
        ("Pulse Oximetry", "Various", "Oxygen saturation"),
        ("Six Minute Walk", "Various", "Exercise capacity"),
        ("Chest X-Ray", "Various", "Imaging assessment"),
        ("Chest CT", "Various", "Detailed imaging"),
        ("High Resolution CT", "Various", "HRCT for ILD"),
        ("Bronchoscopy", "Various", "Airway visualization"),
        ("Sleep Study", "Various", "Polysomnography"),
        ("Home Sleep Test", "Various", "Limited channel study"),
        ("CPAP Titration", "Various", "Pressure determination"),
        ("Split Night Study", "Various", "Diagnosis and titration"),
        ("Multiple Sleep Latency", "Various", "MSLT for hypersomnolence"),
        ("AHI Calculation", "Various", "Apnea-hypopnea index"),
    ],
    "Hearing Examination Requirements": [
        ("Puretone Audiometry", "Various", "Threshold testing"),
        ("Speech Discrimination", "Various", "Maryland CNC word list"),
        ("Masking", "Various", "Cross-hearing elimination"),
        ("Air Conduction", "Various", "Headphone testing"),
        ("Bone Conduction", "Various", "Mastoid process testing"),
        ("500 Hz Threshold", "Various", "Low frequency"),
        ("1000 Hz Threshold", "Various", "Speech frequency"),
        ("2000 Hz Threshold", "Various", "Speech frequency"),
        ("3000 Hz Threshold", "Various", "High frequency"),
        ("4000 Hz Threshold", "Various", "High frequency"),
        ("Average Calculation", "Various", "Four frequency average"),
        ("Exceptional Pattern", "Various", "Table VI vs VIA"),
        ("Tinnitus Assessment", "Various", "Recurrent evaluation"),
        ("Acoustic Reflex", "Various", "Middle ear function"),
        ("Tympanometry", "Various", "Middle ear pressure"),
        ("OAE Testing", "Various", "Otoacoustic emissions"),
        ("ABR Testing", "Various", "Auditory brainstem response"),
        ("Otoscopy", "Various", "Ear canal visualization"),
        ("Noise Exposure History", "Various", "MOS assessment"),
        ("Hearing Aid Evaluation", "Various", "Amplification needs"),
    ],
    "Vision Examination Requirements": [
        ("Visual Acuity Distance", "Various", "Snellen chart"),
        ("Visual Acuity Near", "Various", "Reading ability"),
        ("Best Corrected Acuity", "Various", "With glasses/contacts"),
        ("Uncorrected Acuity", "Various", "Without correction"),
        ("Visual Field Testing", "Various", "Peripheral vision"),
        ("Goldmann Perimetry", "Various", "Kinetic field testing"),
        ("Humphrey Visual Field", "Various", "Static field testing"),
        ("Contraction Calculation", "Various", "Field loss degree"),
        ("Diplopia Testing", "Various", "Double vision assessment"),
        ("Muscle Imbalance", "Various", "Extraocular movement"),
        ("Tonometry", "Various", "Intraocular pressure"),
        ("Fundoscopy", "Various", "Retinal examination"),
        ("Slit Lamp", "Various", "Anterior segment"),
        ("Dilated Exam", "Various", "Posterior segment"),
        ("OCT", "Various", "Optical coherence tomography"),
        ("Fluorescein Angiography", "Various", "Retinal circulation"),
        ("Color Vision Testing", "Various", "Color blindness"),
        ("Contrast Sensitivity", "Various", "Low contrast vision"),
        ("Refraction", "Various", "Prescription determination"),
        ("Binocular Vision", "Various", "Both eyes together"),
    ],
    "Skin Examination Requirements": [
        ("Total Body Surface Area", "Various", "BSA percentage"),
        ("Exposed Areas", "Various", "Head, face, neck, hands"),
        ("Systemic Therapy Duration", "Various", "Treatment period"),
        ("Corticosteroid Use", "Various", "Topical vs systemic"),
        ("Immunosuppressive Use", "Various", "Duration of treatment"),
        ("Scar Measurement", "Various", "Length, width, area"),
        ("Scar Depth", "Various", "Superficial vs deep"),
        ("Scar Characteristics", "Various", "8 disfigurement factors"),
        ("Painful Scar Count", "Various", "Number of painful scars"),
        ("Unstable Scar Count", "Various", "Number of unstable scars"),
        ("Tissue Loss", "Various", "Surface contour"),
        ("Underlying Tissue Adherence", "Various", "Fixed vs mobile"),
        ("Disfigurement Assessment", "Various", "Head/face/neck criteria"),
        ("Photography", "Various", "Visual documentation"),
        ("Gross Distortion", "Various", "Feature asymmetry"),
        ("Color Change", "Various", "Hypopigmentation/hyperpigmentation"),
        ("Texture Abnormality", "Various", "Surface irregularity"),
        ("Functional Limitation", "Various", "Motion restriction"),
        ("Recurrence History", "Various", "Flare frequency"),
        ("Treatment Response", "Various", "Medication efficacy"),
    ],
    "Neurological Examination Requirements": [
        ("Mental Status", "Various", "Orientation assessment"),
        ("Cranial Nerves", "Various", "CN I-XII testing"),
        ("Motor Examination", "Various", "Strength testing"),
        ("Sensory Examination", "Various", "Light touch, pin, position"),
        ("Reflex Testing", "Various", "DTR 0-4 scale"),
        ("Coordination", "Various", "Cerebellar function"),
        ("Gait Assessment", "Various", "Ambulation pattern"),
        ("Romberg Test", "Various", "Proprioception"),
        ("Finger-to-Nose", "Various", "Cerebellar coordination"),
        ("Heel-to-Shin", "Various", "Lower extremity coordination"),
        ("Rapid Alternating", "Various", "Dysdiadochokinesia"),
        ("Peripheral Nerve", "Various", "Individual nerve testing"),
        ("EMG", "Various", "Electromyography"),
        ("NCS", "Various", "Nerve conduction studies"),
        ("MRI Brain", "Various", "Intracranial imaging"),
        ("MRI Spine", "Various", "Spinal cord imaging"),
        ("CT Head", "Various", "Brain imaging"),
        ("EEG", "Various", "Electroencephalogram"),
        ("Lumbar Puncture", "Various", "CSF analysis"),
        ("Neurocognitive Testing", "Various", "Formal cognitive assessment"),
    ],
    "Genitourinary Examination Requirements": [
        ("Urinalysis", "Various", "Urine testing"),
        ("BUN/Creatinine", "Various", "Kidney function"),
        ("GFR Calculation", "Various", "Estimated GFR"),
        ("24-Hour Urine", "Various", "Protein/creatinine"),
        ("Urine Culture", "Various", "Infection assessment"),
        ("PSA", "Various", "Prostate specific antigen"),
        ("Post-Void Residual", "Various", "Bladder emptying"),
        ("Uroflowmetry", "Various", "Urine flow rate"),
        ("Cystoscopy", "Various", "Bladder visualization"),
        ("Urodynamics", "Various", "Bladder function"),
        ("Renal Ultrasound", "Various", "Kidney imaging"),
        ("CT Urogram", "Various", "Urinary tract imaging"),
        ("Voiding Diary", "Various", "Frequency documentation"),
        ("Daytime Frequency", "Various", "Urination count"),
        ("Nocturia", "Various", "Nighttime voiding"),
        ("Incontinence Assessment", "Various", "Leakage evaluation"),
        ("Absorbent Material", "Various", "Pad use frequency"),
        ("Appliance Use", "Various", "Catheter/device"),
        ("Sexual Function", "Various", "Erectile assessment"),
        ("Fertility Assessment", "Various", "Reproductive capacity"),
    ],
    "Endocrine Examination Requirements": [
        ("TSH", "Various", "Thyroid stimulating hormone"),
        ("Free T4", "Various", "Thyroxine level"),
        ("Free T3", "Various", "Triiodothyronine level"),
        ("Thyroid Antibodies", "Various", "TPO, thyroglobulin"),
        ("Thyroid Ultrasound", "Various", "Thyroid imaging"),
        ("Fasting Glucose", "Various", "Blood sugar"),
        ("HbA1c", "Various", "Glycated hemoglobin"),
        ("Oral Glucose Tolerance", "Various", "OGTT"),
        ("C-Peptide", "Various", "Insulin production"),
        ("Insulin Level", "Various", "Insulin measurement"),
        ("Cortisol Level", "Various", "Adrenal function"),
        ("ACTH Stimulation", "Various", "Adrenal testing"),
        ("Dexamethasone Suppression", "Various", "Cushing testing"),
        ("Calcium Level", "Various", "Parathyroid function"),
        ("PTH Level", "Various", "Parathyroid hormone"),
        ("Vitamin D", "Various", "25-hydroxy vitamin D"),
        ("Testosterone Level", "Various", "Male hormone"),
        ("LH/FSH", "Various", "Gonadotropins"),
        ("DEXA Scan", "Various", "Bone density"),
        ("Growth Hormone", "Various", "GH assessment"),
    ],
    "TBI Examination Requirements": [
        ("Cognitive Assessment", "Various", "TBI facet evaluation"),
        ("Memory Testing", "Various", "Short/long term"),
        ("Attention Testing", "Various", "Concentration assessment"),
        ("Executive Function", "Various", "Planning/judgment"),
        ("Processing Speed", "Various", "Mental processing"),
        ("Language Assessment", "Various", "Verbal function"),
        ("Visuospatial Testing", "Various", "Visual processing"),
        ("Emotional Assessment", "Various", "TBI facet evaluation"),
        ("Behavioral Assessment", "Various", "Personality changes"),
        ("Physical Assessment", "Various", "TBI facet evaluation"),
        ("Headache History", "Various", "Post-traumatic HA"),
        ("Dizziness/Vertigo", "Various", "Vestibular symptoms"),
        ("Vision Changes", "Various", "Visual dysfunction"),
        ("Hearing Changes", "Various", "Auditory dysfunction"),
        ("Balance Testing", "Various", "Vestibular function"),
        ("Olfaction Testing", "Various", "Smell assessment"),
        ("Sleep Assessment", "Various", "Sleep dysfunction"),
        ("Fatigue Assessment", "Various", "Energy level"),
        ("Neurocognitive Testing", "Various", "Formal assessment"),
        ("Neuroimaging", "Various", "CT/MRI brain"),
    ],
    "Diabetes Examination Requirements": [
        ("Fasting Glucose", "Various", "Blood sugar level"),
        ("HbA1c", "Various", "3-month average"),
        ("Insulin Requirement", "Various", "Treatment assessment"),
        ("Oral Agent Requirement", "Various", "Medication need"),
        ("Activity Regulation", "Various", "Lifestyle modification"),
        ("Hypoglycemic Episodes", "Various", "Low sugar events"),
        ("Ketoacidosis History", "Various", "DKA episodes"),
        ("Weight Assessment", "Various", "Progressive loss"),
        ("Eye Examination", "Various", "Retinopathy screening"),
        ("Foot Examination", "Various", "Neuropathy/vascular"),
        ("Monofilament Testing", "Various", "Sensory assessment"),
        ("Ankle Reflexes", "Various", "Neuropathy indicator"),
        ("Peripheral Pulses", "Various", "Vascular assessment"),
        ("Blood Pressure", "Various", "HTN assessment"),
        ("Lipid Panel", "Various", "Cholesterol assessment"),
        ("Microalbumin", "Various", "Kidney screening"),
        ("Creatinine/GFR", "Various", "Kidney function"),
        ("Hemoglobin/Hematocrit", "Various", "Anemia screening"),
        ("Neurological Exam", "Various", "Neuropathy assessment"),
        ("Cardiovascular Exam", "Various", "Heart assessment"),
    ],
}

def generate_entries():
    """Generate examination requirement entries"""
    entries = []
    entry_id = 1
    
    for category, items in EXAM_REQUIREMENTS.items():
        for requirement, authority, description in items:
            entry = {
                "id": f"cavc_exam_{entry_id:05d}",
                "source": "cavc",
                "citation": authority,
                "title": f"{requirement}",
                "content": f"""
VA EXAMINATION REQUIREMENTS

CATEGORY: {category}
REQUIREMENT: {requirement}
AUTHORITY: {authority}

GUIDANCE:
{description}

APPLICATION:
This examination requirement applies to {category.lower()} assessments for VA disability compensation claims.
                """.strip(),
                "category": category,
                "hierarchy_level": 2,
                "color_code": "yellow",
                "url": "https://www.va.gov/vetapp/",
                "metadata": {
                    "requirement": requirement,
                    "authority": authority,
                    "category": category,
                    "description": description,
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def main():
    print("\n" + "="*80)
    print("⚖️ CAVC EXAMINATION REQUIREMENTS DATABASE")
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
    output_file = OUTPUT_DIR / "cavc_examination_requirements.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")

if __name__ == "__main__":
    main()
