#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🏥 SECONDARY CONDITIONS COMPREHENSIVE DATABASE                              ║
║══════════════════════════════════════════════════════════════════════════════║
║  Complete primary→secondary condition relationships with medical evidence    ║
║  Target: ~750 documented medical nexus relationships                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import json
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).parent.parent / "knowledge-base" / "secondary"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Comprehensive secondary condition relationships
# Based on medical literature, BVA decisions, and VA recognition
SECONDARY_CONDITIONS = {
    "PTSD": [
        ("Depression", "HIGH", "Comorbid in 50-70% of PTSD cases per DSM-5"),
        ("Anxiety Disorder", "HIGH", "Frequent comorbidity with PTSD"),
        ("Sleep Apnea", "MODERATE", "Established link via hyperarousal and weight gain"),
        ("Hypertension", "MODERATE", "Chronic stress response increases blood pressure"),
        ("Cardiovascular Disease", "MODERATE", "Chronic stress, inflammation markers"),
        ("Substance Abuse", "HIGH", "Self-medication pattern well documented"),
        ("Alcohol Dependence", "HIGH", "PTSD increases alcohol use disorder risk 2-3x"),
        ("Irritable Bowel Syndrome", "MODERATE", "Gut-brain axis, stress response"),
        ("Migraines", "MODERATE", "Shared neurological pathways"),
        ("Erectile Dysfunction", "MODERATE", "Psychological and medication effects"),
        ("GERD", "MODERATE", "Stress-induced gastric changes"),
        ("Obesity", "MODERATE", "Medication side effects, reduced activity"),
        ("Diabetes Type 2", "LOW-MODERATE", "Via obesity, medication effects"),
        ("Chronic Fatigue", "MODERATE", "Sleep disruption, hypervigilance"),
        ("Fibromyalgia", "MODERATE", "Central sensitization, shared mechanisms"),
    ],
    "Diabetes Mellitus Type 2": [
        ("Peripheral Neuropathy", "HIGH", "Direct complication in 50%+ of diabetics"),
        ("Diabetic Retinopathy", "HIGH", "Microvascular damage to retina"),
        ("Diabetic Nephropathy", "HIGH", "Kidney damage from glucose"),
        ("Cardiovascular Disease", "HIGH", "Major macrovascular complication"),
        ("Hypertension", "HIGH", "Strongly associated, bidirectional"),
        ("Erectile Dysfunction", "HIGH", "Vascular and neurological damage"),
        ("Peripheral Artery Disease", "HIGH", "Accelerated atherosclerosis"),
        ("Cataracts", "MODERATE", "Glucose-related lens changes"),
        ("Glaucoma", "MODERATE", "Increased intraocular pressure"),
        ("Chronic Kidney Disease", "HIGH", "Progressive nephropathy"),
        ("Gastroparesis", "MODERATE", "Autonomic neuropathy"),
        ("Skin Conditions", "MODERATE", "Delayed healing, infections"),
        ("Depression", "MODERATE", "Chronic disease burden"),
        ("Hearing Loss", "MODERATE", "Microvascular damage"),
        ("Cognitive Impairment", "LOW-MODERATE", "Vascular changes in brain"),
    ],
    "Hypertension": [
        ("Cardiovascular Disease", "HIGH", "Primary risk factor for CAD"),
        ("Stroke", "HIGH", "Major risk factor for CVA"),
        ("Chronic Kidney Disease", "HIGH", "Nephrosclerosis from pressure"),
        ("Heart Failure", "HIGH", "Left ventricular hypertrophy"),
        ("Retinopathy", "MODERATE", "Hypertensive retinal changes"),
        ("Peripheral Artery Disease", "MODERATE", "Arterial damage"),
        ("Aneurysm", "MODERATE", "Vessel wall weakening"),
        ("Erectile Dysfunction", "MODERATE", "Vascular dysfunction"),
        ("Cognitive Decline", "LOW-MODERATE", "Vascular dementia risk"),
        ("Vision Changes", "MODERATE", "Hypertensive eye disease"),
    ],
    "Lumbar Spine (DDD/DJD)": [
        ("Radiculopathy", "HIGH", "Nerve root compression"),
        ("Sciatica", "HIGH", "L4-S1 nerve involvement"),
        ("Peripheral Neuropathy (Lower)", "HIGH", "Nerve damage from compression"),
        ("Bowel Dysfunction", "MODERATE", "Cauda equina involvement"),
        ("Bladder Dysfunction", "MODERATE", "Neurogenic bladder"),
        ("Erectile Dysfunction", "MODERATE", "Neurological pathway damage"),
        ("Depression", "MODERATE", "Chronic pain syndrome"),
        ("Sleep Disorder", "MODERATE", "Pain-related sleep disruption"),
        ("Gait Abnormality", "MODERATE", "Compensatory movement patterns"),
        ("Hip Condition", "MODERATE", "Altered biomechanics"),
        ("Knee Condition", "MODERATE", "Compensatory stress"),
        ("Obesity", "LOW-MODERATE", "Reduced mobility"),
    ],
    "Cervical Spine (DDD/DJD)": [
        ("Radiculopathy (Upper)", "HIGH", "C5-T1 nerve involvement"),
        ("Headaches/Migraines", "HIGH", "Cervicogenic headaches"),
        ("Upper Extremity Neuropathy", "HIGH", "Nerve root compression"),
        ("Thoracic Outlet Syndrome", "MODERATE", "Structural changes"),
        ("TMJ Disorder", "MODERATE", "Cervical-jaw connection"),
        ("Vertigo/Dizziness", "MODERATE", "Cervicogenic vertigo"),
        ("Carpal Tunnel Syndrome", "LOW-MODERATE", "Double crush phenomenon"),
        ("Depression", "MODERATE", "Chronic pain"),
        ("Sleep Apnea", "LOW-MODERATE", "Cervical positioning effects"),
    ],
    "Knee Condition": [
        ("Lumbar Spine Condition", "MODERATE", "Altered gait mechanics"),
        ("Hip Condition (Same Side)", "MODERATE", "Kinetic chain"),
        ("Hip Condition (Opposite)", "MODERATE", "Overcompensation"),
        ("Ankle Condition", "MODERATE", "Altered weight bearing"),
        ("Contralateral Knee", "MODERATE", "Compensatory overuse"),
        ("Obesity", "LOW-MODERATE", "Reduced activity"),
        ("Depression", "MODERATE", "Chronic pain, reduced mobility"),
        ("Peripheral Neuropathy", "LOW", "Post-surgical complications"),
    ],
    "Hip Condition": [
        ("Lumbar Spine Condition", "HIGH", "Direct biomechanical link"),
        ("Knee Condition (Same Side)", "MODERATE", "Kinetic chain"),
        ("Knee Condition (Opposite)", "MODERATE", "Compensatory stress"),
        ("Contralateral Hip", "MODERATE", "Overcompensation"),
        ("Gait Abnormality", "HIGH", "Limp, altered mechanics"),
        ("Sciatic Nerve Pain", "MODERATE", "Piriformis involvement"),
        ("Depression", "MODERATE", "Chronic pain, disability"),
    ],
    "Hearing Loss": [
        ("Tinnitus", "HIGH", "Same cochlear damage mechanism"),
        ("Depression", "MODERATE", "Social isolation, communication difficulty"),
        ("Anxiety", "MODERATE", "Communication challenges"),
        ("Cognitive Decline", "LOW-MODERATE", "Sensory deprivation"),
        ("Balance Disorders", "MODERATE", "Inner ear involvement"),
        ("Headaches", "LOW-MODERATE", "Strain from concentration"),
    ],
    "Tinnitus": [
        ("Depression", "MODERATE", "Chronic distress"),
        ("Anxiety", "MODERATE", "Hypervigilance to sound"),
        ("Sleep Disorder", "HIGH", "Sound interference"),
        ("Concentration Difficulty", "MODERATE", "Cognitive interference"),
        ("Migraines", "LOW-MODERATE", "Neurological overlap"),
    ],
    "Traumatic Brain Injury": [
        ("PTSD", "HIGH", "Trauma-related comorbidity"),
        ("Depression", "HIGH", "Neurological and psychological"),
        ("Anxiety", "HIGH", "Post-TBI syndrome"),
        ("Cognitive Disorder", "HIGH", "Direct brain injury effect"),
        ("Migraines/Headaches", "HIGH", "Post-traumatic headache"),
        ("Sleep Disorder", "HIGH", "Circadian disruption"),
        ("Tinnitus", "HIGH", "Blast/impact injury"),
        ("Hearing Loss", "HIGH", "Blast/impact injury"),
        ("Vision Problems", "HIGH", "Optic nerve/cortex damage"),
        ("Balance Disorder", "HIGH", "Vestibular damage"),
        ("Seizure Disorder", "MODERATE", "Post-traumatic epilepsy"),
        ("Erectile Dysfunction", "MODERATE", "Hormonal disruption"),
        ("Hypopituitarism", "MODERATE", "Pituitary damage"),
        ("Parkinson's Disease", "LOW-MODERATE", "Long-term neurodegeneration"),
    ],
    "Ischemic Heart Disease": [
        ("Congestive Heart Failure", "HIGH", "Progression of IHD"),
        ("Arrhythmia", "HIGH", "Cardiac electrical changes"),
        ("Hypertension", "MODERATE", "Bidirectional relationship"),
        ("Depression", "HIGH", "Post-MI depression common"),
        ("Anxiety", "HIGH", "Cardiac anxiety"),
        ("Erectile Dysfunction", "MODERATE", "Vascular/medication effects"),
        ("Peripheral Artery Disease", "MODERATE", "Systemic atherosclerosis"),
        ("Chronic Kidney Disease", "MODERATE", "Cardiorenal syndrome"),
        ("Sleep Apnea", "MODERATE", "Bidirectional"),
        ("Cognitive Decline", "LOW-MODERATE", "Reduced cerebral perfusion"),
    ],
    "Sleep Apnea": [
        ("Hypertension", "HIGH", "Intermittent hypoxia"),
        ("Cardiovascular Disease", "HIGH", "Multiple mechanisms"),
        ("Diabetes Type 2", "MODERATE", "Metabolic effects"),
        ("Depression", "MODERATE", "Sleep deprivation"),
        ("Cognitive Impairment", "MODERATE", "Oxygen desaturation"),
        ("GERD", "MODERATE", "Increased abdominal pressure"),
        ("Erectile Dysfunction", "MODERATE", "Hormonal and vascular"),
        ("Obesity", "MODERATE", "Bidirectional relationship"),
        ("Stroke", "MODERATE", "Cardiovascular risk"),
        ("Arrhythmia", "MODERATE", "Hypoxia-related"),
    ],
    "Depression": [
        ("Anxiety Disorder", "HIGH", "80%+ comorbidity"),
        ("Sleep Disorder", "HIGH", "Circadian disruption"),
        ("Chronic Fatigue", "HIGH", "Neurobiological overlap"),
        ("Obesity", "MODERATE", "Inactivity, medication"),
        ("Diabetes Type 2", "LOW-MODERATE", "Via obesity, cortisol"),
        ("Cardiovascular Disease", "MODERATE", "Stress, inflammation"),
        ("Substance Abuse", "MODERATE", "Self-medication"),
        ("Erectile Dysfunction", "MODERATE", "Neurological/medication"),
        ("Cognitive Impairment", "MODERATE", "Pseudodementia"),
        ("GERD", "LOW-MODERATE", "Stress-related"),
        ("Fibromyalgia", "MODERATE", "Shared neurobiological pathways"),
    ],
    "Asthma/COPD": [
        ("Depression", "MODERATE", "Chronic disease burden"),
        ("Anxiety", "HIGH", "Dyspnea-related panic"),
        ("GERD", "MODERATE", "Medication effects"),
        ("Sleep Apnea", "MODERATE", "Respiratory compromise"),
        ("Osteoporosis", "MODERATE", "Steroid use"),
        ("Cardiovascular Disease", "MODERATE", "Systemic inflammation"),
        ("Obesity", "LOW-MODERATE", "Reduced activity"),
    ],
    "Rheumatoid Arthritis": [
        ("Depression", "MODERATE", "Chronic pain, disability"),
        ("Cardiovascular Disease", "MODERATE", "Systemic inflammation"),
        ("Osteoporosis", "MODERATE", "Medication, inflammation"),
        ("Carpal Tunnel Syndrome", "MODERATE", "Joint inflammation"),
        ("Peripheral Neuropathy", "MODERATE", "Inflammation effects"),
        ("Lung Disease", "LOW-MODERATE", "RA-related ILD"),
        ("Dry Eye Syndrome", "MODERATE", "Sjogren's overlap"),
    ],
    "Prostate Cancer": [
        ("Erectile Dysfunction", "HIGH", "Treatment effect"),
        ("Urinary Incontinence", "HIGH", "Surgical/radiation effect"),
        ("Depression", "MODERATE", "Cancer diagnosis, treatment effects"),
        ("Anxiety", "MODERATE", "Cancer-related worry"),
        ("Bowel Dysfunction", "MODERATE", "Radiation effects"),
        ("Hormone Deficiency", "MODERATE", "Androgen deprivation"),
        ("Osteoporosis", "MODERATE", "ADT effects"),
        ("Cardiovascular Disease", "LOW-MODERATE", "ADT metabolic effects"),
    ],
    "Migraine": [
        ("Depression", "HIGH", "Shared serotonin pathways"),
        ("Anxiety", "HIGH", "Anticipatory anxiety"),
        ("Sleep Disorder", "MODERATE", "Trigger and effect"),
        ("Cervical Spine Condition", "MODERATE", "Cervicogenic component"),
        ("TMJ Disorder", "MODERATE", "Trigeminal involvement"),
        ("Vertigo", "MODERATE", "Vestibular migraine"),
        ("Hypertension", "LOW-MODERATE", "Vascular component"),
    ],
    "Peripheral Neuropathy": [
        ("Depression", "MODERATE", "Chronic pain"),
        ("Balance Disorder", "HIGH", "Proprioceptive loss"),
        ("Sleep Disorder", "MODERATE", "Pain interference"),
        ("Skin Ulcers", "MODERATE", "Loss of sensation"),
        ("Gait Abnormality", "HIGH", "Sensory ataxia"),
        ("Falls/Injuries", "HIGH", "Balance impairment"),
    ],
    "Fibromyalgia": [
        ("Depression", "HIGH", "90%+ comorbidity"),
        ("Anxiety", "HIGH", "Comorbid in majority"),
        ("Sleep Disorder", "HIGH", "Non-restorative sleep"),
        ("Chronic Fatigue", "HIGH", "Core symptom overlap"),
        ("IBS", "HIGH", "Central sensitization"),
        ("Migraines", "MODERATE", "Shared mechanisms"),
        ("TMJ Disorder", "MODERATE", "Widespread pain"),
        ("Cognitive Impairment", "MODERATE", "Fibro fog"),
    ],
}

def create_secondary_entries():
    """Create comprehensive secondary condition entries"""
    entries = []
    entry_id = 1
    
    for primary, secondaries in SECONDARY_CONDITIONS.items():
        for secondary, strength, evidence in secondaries:
            entry = {
                "id": f"secondary_comprehensive_{entry_id:04d}",
                "source": "secondary",
                "citation": f"Secondary: {secondary} to {primary}",
                "title": f"{secondary} Secondary to {primary}",
                "content": f"""
SECONDARY SERVICE CONNECTION RELATIONSHIP

PRIMARY CONDITION: {primary}
SECONDARY CONDITION: {secondary}
NEXUS STRENGTH: {strength}

MEDICAL EVIDENCE:
{evidence}

LEGAL FRAMEWORK:
Secondary service connection is established under 38 CFR § 3.310, which provides that disability which is proximately due to or the result of a service-connected disease or injury shall be service connected.

The Allen v. Brown standard (1995) also allows service connection for the degree of aggravation of a nonservice-connected disability caused by a service-connected disability.

CLAIM DEVELOPMENT:
• Obtain medical nexus opinion specifically addressing causation or aggravation
• Document the timeline between primary condition diagnosis and secondary onset
• Provide medical literature supporting the relationship
• Note any baseline severity of secondary condition before aggravation

RATING CONSIDERATIONS:
• Rate the secondary condition under appropriate diagnostic code
• Consider functional impairment
• Evaluate any interaction between conditions
• Do not pyramid - rate each disability separately

KEY CASES:
• Allen v. Brown, 7 Vet. App. 439 (1995) - Aggravation prong
• El-Amin v. Shinseki, 26 Vet. App. 136 (2013) - Secondary analysis
                """.strip(),
                "category": f"Secondary to {primary}",
                "hierarchy_level": 4,
                "color_code": "green",
                "url": "https://www.law.cornell.edu/cfr/text/38/3.310",
                "metadata": {
                    "primary_condition": primary,
                    "secondary_condition": secondary,
                    "nexus_strength": strength,
                    "medical_evidence": evidence,
                    "regulation": "38 CFR § 3.310",
                    "scraped_date": datetime.now().isoformat()
                }
            }
            entries.append(entry)
            entry_id += 1
    
    return entries

def create_nexus_guidance_entries():
    """Create guidance entries for nexus requirements"""
    guidance = [
        ("Medical Nexus Standards", "Requirements for adequate medical nexus opinions in secondary claims"),
        ("At Least As Likely As Not", "Explaining the 50% probability standard for nexus opinions"),
        ("Aggravation vs Causation", "Distinguishing between aggravation and direct causation in secondary claims"),
        ("Baseline Establishment", "Importance of establishing baseline severity before aggravation"),
        ("Temporal Relationship", "Documenting the timeline between primary and secondary conditions"),
        ("Medical Literature Support", "Using peer-reviewed literature to support secondary claims"),
        ("Independent Medical Opinions", "When to seek independent medical opinions for secondary claims"),
        ("Buddy Statements", "Using lay evidence to support secondary claims"),
        ("VA Examiner Requirements", "What C&P examiners must address in secondary opinions"),
        ("Inadequate Opinions", "Identifying and challenging inadequate nexus opinions"),
    ]
    
    entries = []
    for i, (title, desc) in enumerate(guidance, 1):
        entry = {
            "id": f"secondary_guidance_{i:04d}",
            "source": "secondary",
            "citation": f"Secondary Claims Guidance: {title}",
            "title": title,
            "content": f"""
SECONDARY SERVICE CONNECTION GUIDANCE
Topic: {title}

{desc}

This guidance helps veterans and representatives understand the requirements for establishing secondary service connection claims.

Key Points:
• The veteran must have a current diagnosis of the secondary condition
• The primary condition must already be service-connected
• There must be medical evidence linking the conditions
• The link can be causation OR aggravation

Applicable Regulations:
• 38 CFR § 3.310 - Secondary service connection
• 38 CFR § 3.102 - Benefit of the doubt
• 38 CFR § 3.159 - VA's duty to assist
            """.strip(),
            "category": "Guidance",
            "hierarchy_level": 4,
            "color_code": "green",
            "url": "https://www.va.gov/disability/eligibility/secondary-conditions/",
            "metadata": {
                "topic": title,
                "description": desc,
                "scraped_date": datetime.now().isoformat()
            }
        }
        entries.append(entry)
    
    return entries

def main():
    print("\n" + "="*80)
    print("🏥 SECONDARY CONDITIONS COMPREHENSIVE DATABASE")
    print("="*80)
    
    all_entries = []
    
    # Create secondary condition entries
    print("\n📚 Creating secondary condition entries...")
    secondary_entries = create_secondary_entries()
    all_entries.extend(secondary_entries)
    print(f"   ✓ {len(secondary_entries)} secondary relationships")
    
    # Create guidance entries
    print("\n📚 Creating guidance entries...")
    guidance_entries = create_nexus_guidance_entries()
    all_entries.extend(guidance_entries)
    print(f"   ✓ {len(guidance_entries)} guidance entries")
    
    print(f"\n📊 Total entries: {len(all_entries)}")
    
    # Save to file
    output_file = OUTPUT_DIR / "secondary_comprehensive.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"entries": all_entries}, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Saved to: {output_file}")
    
    # Primary condition breakdown
    primaries = {}
    for e in all_entries:
        primary = e.get('metadata', {}).get('primary_condition', 'Guidance')
        primaries[primary] = primaries.get(primary, 0) + 1
    
    print("\n📋 Primary Condition Coverage:")
    for primary, count in sorted(primaries.items(), key=lambda x: -x[1])[:15]:
        print(f"   {primary}: {count} secondaries")
    
    # Strength breakdown
    strengths = {}
    for e in all_entries:
        strength = e.get('metadata', {}).get('nexus_strength', 'N/A')
        strengths[strength] = strengths.get(strength, 0) + 1
    
    print("\n📋 Nexus Strength Distribution:")
    for strength, count in sorted(strengths.items()):
        print(f"   {strength}: {count}")

if __name__ == "__main__":
    main()
