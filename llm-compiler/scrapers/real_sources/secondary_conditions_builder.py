#!/usr/bin/env python3
"""
💎 DIAMOND Secondary Conditions Matrix Builder
===============================================
Builds comprehensive database of secondary service-connected conditions.

A secondary condition is a condition CAUSED or AGGRAVATED by a service-connected disability.
If you're rated for condition A, and condition A causes condition B, you can get rated for B.

This is one of the most valuable strategies for increasing VA ratings!

Key Legal Basis: 38 CFR 3.310
"""

import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

# Output paths
WORKSPACE_ROOT = Path("E:/VS_Studio/vet-rate-org-official")
OUTPUT_DIR = WORKSPACE_ROOT / "llm-compiler" / "knowledge-base" / "secondary"
OUTPUT_FILE = OUTPUT_DIR / "secondary_conditions_matrix.json"


# Comprehensive secondary conditions database
# Format: (primary_condition, [list of known secondary conditions])
SECONDARY_MATRIX = {
    # ============================================================
    # MENTAL HEALTH CONDITIONS
    # ============================================================
    "PTSD": [
        ("Depression", "PTSD commonly causes or worsens depression. Studies show 50%+ of PTSD patients have comorbid depression."),
        ("Anxiety Disorder", "PTSD and anxiety disorders frequently co-occur due to shared neurological pathways."),
        ("Sleep Apnea", "PTSD causes hyperarousal that disrupts sleep architecture. Weight gain from PTSD medications can cause sleep apnea."),
        ("Insomnia", "Hypervigilance and nightmares from PTSD directly cause chronic insomnia."),
        ("Substance Use Disorder", "Veterans often self-medicate PTSD symptoms with alcohol or drugs."),
        ("Migraines", "Stress and tension from PTSD can trigger chronic migraine headaches."),
        ("Hypertension", "Chronic stress from PTSD elevates blood pressure over time."),
        ("GERD", "Stress and anxiety from PTSD increase stomach acid production."),
        ("IBS (Irritable Bowel Syndrome)", "The gut-brain connection means PTSD commonly causes digestive issues."),
        ("Erectile Dysfunction", "PTSD medications and psychological factors commonly cause ED."),
        ("Bruxism (Teeth Grinding)", "Stress and anxiety from PTSD causes teeth grinding, often during sleep."),
        ("TMJ Disorder", "Bruxism from PTSD leads to temporomandibular joint problems."),
        ("Tinnitus", "Studies show connection between PTSD and tinnitus perception/severity."),
        ("Fibromyalgia", "PTSD is associated with central sensitization syndromes including fibromyalgia."),
        ("Chronic Fatigue", "PTSD symptoms cause exhaustion and chronic fatigue."),
        ("Weight Gain/Obesity", "PTSD medications and depression commonly cause weight gain."),
        ("Diabetes Type 2", "Weight gain and stress hormones from PTSD can lead to diabetes."),
        ("Ischemic Heart Disease", "Chronic stress from PTSD is a recognized risk factor for heart disease."),
    ],
    
    "Depression": [
        ("Anxiety Disorder", "Depression and anxiety are frequently comorbid conditions."),
        ("Sleep Apnea", "Depression-related weight gain can cause or worsen sleep apnea."),
        ("Insomnia", "Depression disrupts sleep cycles causing chronic insomnia."),
        ("Chronic Fatigue", "Depression causes persistent fatigue and low energy."),
        ("Migraines", "Depression is associated with increased migraine frequency."),
        ("GERD", "Depression medications and stress affect digestive function."),
        ("Weight Gain/Obesity", "Depression and its medications commonly cause weight gain."),
        ("Erectile Dysfunction", "Depression and antidepressants frequently cause ED."),
        ("Fibromyalgia", "Depression is closely linked to fibromyalgia and chronic pain syndromes."),
    ],
    
    "Anxiety Disorder": [
        ("PTSD", "Anxiety can develop into PTSD with triggering events."),
        ("Depression", "Chronic anxiety commonly leads to depression."),
        ("Insomnia", "Anxiety-induced hyperarousal disrupts sleep."),
        ("GERD", "Anxiety increases stomach acid and digestive issues."),
        ("IBS", "Anxiety directly affects gut function."),
        ("Migraines", "Tension and stress from anxiety trigger migraines."),
        ("Hypertension", "Chronic anxiety elevates blood pressure."),
        ("Bruxism", "Anxiety causes teeth grinding, especially during sleep."),
        ("TMJ Disorder", "Jaw clenching from anxiety causes TMJ problems."),
    ],
    
    # ============================================================
    # MUSCULOSKELETAL CONDITIONS
    # ============================================================
    "Low Back Pain (Lumbar Strain)": [
        ("Radiculopathy (Sciatica)", "Disc problems in the lumbar spine compress nerve roots causing radiculopathy."),
        ("Degenerative Disc Disease", "Chronic strain leads to disc degeneration over time."),
        ("Spinal Stenosis", "Long-term back problems can cause spinal canal narrowing."),
        ("Hip Pain/Arthritis", "Altered gait from back pain causes hip problems."),
        ("Knee Pain/Arthritis", "Compensating for back pain stresses the knees."),
        ("Sciatica", "Lumbar disc issues directly cause sciatic nerve pain."),
        ("Depression", "Chronic pain commonly causes depression."),
        ("Anxiety", "Living with chronic pain causes anxiety."),
        ("Erectile Dysfunction", "Lumbar spine issues can affect nerve function to genitals."),
        ("Bladder Dysfunction", "Severe lumbar problems can affect bladder control nerves."),
        ("Sleep Apnea", "Pain medications and reduced activity cause weight gain leading to sleep apnea."),
        ("Gait Abnormality", "Back pain causes altered walking patterns."),
    ],
    
    "Cervical Strain (Neck)": [
        ("Radiculopathy (Upper Extremity)", "Cervical disc problems compress nerves to arms/hands."),
        ("Migraines", "Cervical spine problems commonly trigger migraines."),
        ("Tension Headaches", "Neck muscle strain causes chronic headaches."),
        ("Carpal Tunnel Syndrome", "Cervical radiculopathy can contribute to carpal tunnel."),
        ("Thoracic Outlet Syndrome", "Cervical problems can cause nerve compression in the shoulder."),
        ("Degenerative Disc Disease", "Chronic strain leads to cervical disc degeneration."),
        ("TMJ Disorder", "Cervical problems affect jaw alignment."),
        ("Vertigo/Dizziness", "Cervical issues can cause cervicogenic vertigo."),
        ("Tinnitus", "Cervical problems can cause or worsen tinnitus."),
    ],
    
    "Knee Condition": [
        ("Lumbar Spine Condition", "Altered gait from knee problems stresses the back."),
        ("Hip Condition", "Knee problems cause compensatory hip strain."),
        ("Opposite Knee Condition", "Favoring one knee overloads the other."),
        ("Ankle Condition", "Altered gait affects ankle mechanics."),
        ("Depression", "Chronic knee pain and limited mobility cause depression."),
        ("Obesity", "Limited mobility from knee problems leads to weight gain."),
        ("Sleep Apnea", "Weight gain from reduced activity causes sleep apnea."),
        ("Gait Abnormality", "Knee conditions cause abnormal walking patterns."),
    ],
    
    "Hip Condition": [
        ("Low Back Condition", "Hip problems alter gait and stress the lumbar spine."),
        ("Knee Condition", "Hip problems cause compensatory knee strain."),
        ("Opposite Hip Condition", "Favoring one hip overloads the other."),
        ("Sciatica", "Hip problems can irritate the sciatic nerve."),
        ("Gait Abnormality", "Hip conditions significantly alter walking patterns."),
        ("Depression", "Chronic hip pain causes depression."),
    ],
    
    "Shoulder Condition": [
        ("Cervical Spine Condition", "Shoulder problems cause neck compensation."),
        ("Rotator Cuff Tear", "Chronic shoulder problems often lead to rotator cuff damage."),
        ("Carpal Tunnel Syndrome", "Altered arm mechanics stress the wrist."),
        ("Depression", "Chronic shoulder pain causes depression."),
        ("Opposite Shoulder Condition", "Compensating with one arm strains the other."),
    ],
    
    "Plantar Fasciitis": [
        ("Knee Condition", "Altered gait from foot pain stresses knees."),
        ("Hip Condition", "Foot pain causes hip compensation."),
        ("Low Back Condition", "Altered gait stresses the lumbar spine."),
        ("Opposite Foot Condition", "Favoring one foot overloads the other."),
        ("Heel Spurs", "Chronic plantar fasciitis leads to bone spur formation."),
    ],
    
    "Flat Feet (Pes Planus)": [
        ("Plantar Fasciitis", "Flat feet stress the plantar fascia."),
        ("Knee Condition", "Flat feet alter knee alignment."),
        ("Hip Condition", "Flat feet affect overall leg alignment."),
        ("Low Back Condition", "Flat feet alter gait and spinal mechanics."),
        ("Shin Splints", "Flat feet stress the lower leg muscles."),
        ("Bunions", "Flat feet contribute to bunion formation."),
        ("Achilles Tendonitis", "Flat feet stress the Achilles tendon."),
    ],
    
    # ============================================================
    # DIABETES AND RELATED CONDITIONS
    # ============================================================
    "Diabetes Mellitus Type 2": [
        ("Peripheral Neuropathy", "Diabetes damages peripheral nerves, especially in feet and hands."),
        ("Diabetic Retinopathy", "Diabetes damages blood vessels in the eyes."),
        ("Diabetic Nephropathy", "Diabetes damages kidney function over time."),
        ("Erectile Dysfunction", "Diabetes affects blood flow and nerves causing ED."),
        ("Coronary Artery Disease", "Diabetes accelerates atherosclerosis."),
        ("Hypertension", "Diabetes and high blood pressure commonly co-occur."),
        ("Stroke", "Diabetes increases stroke risk significantly."),
        ("Peripheral Artery Disease", "Diabetes causes vascular problems in extremities."),
        ("Chronic Kidney Disease", "Diabetic nephropathy leads to CKD."),
        ("Foot Ulcers", "Neuropathy and poor circulation cause diabetic foot ulcers."),
        ("Lower Extremity Amputation", "Severe diabetes complications can require amputation."),
        ("Cataracts", "Diabetes accelerates cataract formation."),
        ("Glaucoma", "Diabetes increases glaucoma risk."),
        ("Sleep Apnea", "Diabetes and obesity commonly cause sleep apnea."),
        ("Depression", "Living with chronic diabetes causes depression."),
        ("Gastroparesis", "Diabetes can damage stomach nerves causing slow emptying."),
        ("Bladder Dysfunction", "Diabetic neuropathy can affect bladder control."),
    ],
    
    # ============================================================
    # CARDIOVASCULAR CONDITIONS
    # ============================================================
    "Hypertension": [
        ("Coronary Artery Disease", "High blood pressure damages arteries over time."),
        ("Heart Failure", "Hypertension is a leading cause of heart failure."),
        ("Stroke", "Hypertension significantly increases stroke risk."),
        ("Chronic Kidney Disease", "High blood pressure damages kidney blood vessels."),
        ("Retinopathy", "Hypertension can damage blood vessels in the eyes."),
        ("Peripheral Artery Disease", "Hypertension contributes to PAD."),
        ("Atrial Fibrillation", "Hypertension is a major risk factor for AFib."),
        ("Erectile Dysfunction", "Hypertension and its medications cause ED."),
    ],
    
    "Coronary Artery Disease": [
        ("Heart Failure", "CAD can lead to heart failure over time."),
        ("Arrhythmias", "CAD increases risk of irregular heartbeats."),
        ("Stroke", "CAD indicates systemic vascular disease including stroke risk."),
        ("Peripheral Artery Disease", "CAD indicates widespread atherosclerosis."),
        ("Depression", "Heart disease commonly causes depression."),
        ("Anxiety", "Living with heart disease causes anxiety."),
        ("Erectile Dysfunction", "Vascular disease affects erectile function."),
    ],
    
    "Atrial Fibrillation": [
        ("Stroke", "AFib significantly increases stroke risk."),
        ("Heart Failure", "AFib can lead to heart failure."),
        ("Cardiomyopathy", "AFib can cause heart muscle weakening."),
        ("Anxiety", "Irregular heartbeat causes anxiety."),
        ("Fatigue", "AFib commonly causes chronic fatigue."),
        ("Sleep Apnea", "AFib and sleep apnea are closely linked."),
    ],
    
    # ============================================================
    # RESPIRATORY CONDITIONS
    # ============================================================
    "Sleep Apnea": [
        ("Hypertension", "Sleep apnea causes sustained high blood pressure."),
        ("Coronary Artery Disease", "Sleep apnea increases heart disease risk."),
        ("Atrial Fibrillation", "Sleep apnea increases AFib risk."),
        ("Stroke", "Sleep apnea increases stroke risk."),
        ("Diabetes Type 2", "Sleep apnea is associated with insulin resistance."),
        ("Depression", "Sleep apnea causes fatigue and depression."),
        ("Cognitive Impairment", "Chronic sleep deprivation affects cognition."),
        ("Erectile Dysfunction", "Sleep apnea affects erectile function."),
        ("GERD", "Sleep apnea can cause or worsen GERD."),
        ("Weight Gain/Obesity", "Sleep apnea and obesity create a cycle."),
    ],
    
    "Asthma": [
        ("GERD", "Asthma and GERD frequently co-occur and worsen each other."),
        ("Sinusitis", "Asthma is associated with chronic sinus problems."),
        ("Allergic Rhinitis", "Asthma commonly occurs with nasal allergies."),
        ("Depression", "Chronic respiratory illness causes depression."),
        ("Anxiety", "Breathing difficulties cause anxiety."),
        ("Sleep Apnea", "Asthma is associated with sleep-disordered breathing."),
        ("Obesity", "Reduced activity from asthma leads to weight gain."),
    ],
    
    "COPD": [
        ("Pulmonary Hypertension", "COPD can cause elevated lung blood pressure."),
        ("Heart Failure", "COPD strains the heart over time."),
        ("Depression", "COPD and limited activity cause depression."),
        ("Anxiety", "Breathing difficulties cause anxiety."),
        ("Sleep Apnea", "COPD and sleep apnea frequently co-occur."),
        ("Osteoporosis", "COPD medications and reduced activity cause bone loss."),
        ("Weight Loss/Cachexia", "Advanced COPD causes muscle wasting."),
    ],
    
    # ============================================================
    # NEUROLOGICAL CONDITIONS
    # ============================================================
    "Traumatic Brain Injury (TBI)": [
        ("PTSD", "TBI and PTSD frequently co-occur after trauma."),
        ("Depression", "TBI commonly causes depression."),
        ("Anxiety", "TBI causes anxiety disorders."),
        ("Migraines", "TBI commonly causes chronic migraines."),
        ("Sleep Disorders", "TBI disrupts sleep regulation."),
        ("Cognitive Disorder", "TBI causes lasting cognitive impairment."),
        ("Tinnitus", "TBI commonly causes tinnitus."),
        ("Hearing Loss", "TBI can cause hearing damage."),
        ("Vision Problems", "TBI can cause various vision issues."),
        ("Vertigo/Dizziness", "TBI commonly causes balance problems."),
        ("Seizure Disorder", "TBI increases seizure risk."),
        ("Parkinson's Disease", "TBI increases later Parkinson's risk."),
        ("Chronic Fatigue", "TBI causes persistent fatigue."),
        ("Sleep Apnea", "TBI can cause or worsen sleep apnea."),
        ("Erectile Dysfunction", "TBI can cause sexual dysfunction."),
        ("Hormone Dysfunction", "TBI can affect pituitary function."),
    ],
    
    "Migraines": [
        ("Depression", "Chronic migraines cause depression."),
        ("Anxiety", "Living with migraines causes anxiety."),
        ("Sleep Disorder", "Migraines disrupt sleep patterns."),
        ("Cervical Strain", "Migraine tension affects neck muscles."),
        ("TMJ Disorder", "Jaw clenching during migraines causes TMJ."),
        ("Chronic Pain Syndrome", "Migraines can lead to central sensitization."),
    ],
    
    "Tinnitus": [
        ("Depression", "Chronic tinnitus commonly causes depression."),
        ("Anxiety", "Tinnitus causes significant anxiety."),
        ("Insomnia", "Tinnitus interferes with sleep."),
        ("Headaches", "Tinnitus is associated with tension headaches."),
        ("TMJ Disorder", "TMJ can cause or worsen tinnitus."),
        ("Meniere's Disease", "Tinnitus can indicate Meniere's disease."),
    ],
    
    "Hearing Loss": [
        ("Tinnitus", "Hearing loss and tinnitus commonly co-occur."),
        ("Depression", "Hearing loss causes social isolation and depression."),
        ("Anxiety", "Hearing loss causes communication anxiety."),
        ("Cognitive Decline", "Hearing loss is associated with cognitive decline."),
        ("Balance Disorders", "Inner ear damage can affect balance."),
    ],
    
    # ============================================================
    # GASTROINTESTINAL CONDITIONS
    # ============================================================
    "GERD (Gastroesophageal Reflux)": [
        ("Barrett's Esophagus", "Chronic GERD can cause precancerous changes."),
        ("Esophageal Stricture", "GERD can cause esophageal scarring."),
        ("Asthma", "GERD can trigger or worsen asthma."),
        ("Chronic Cough", "GERD causes chronic cough from acid irritation."),
        ("Laryngitis", "GERD acid can irritate the voice box."),
        ("Dental Erosion", "GERD acid damages tooth enamel."),
        ("Sleep Apnea", "GERD and sleep apnea frequently co-occur."),
        ("Insomnia", "GERD symptoms disrupt sleep."),
    ],
    
    "IBS (Irritable Bowel Syndrome)": [
        ("Depression", "IBS and depression are closely linked."),
        ("Anxiety", "IBS and anxiety have bidirectional relationship."),
        ("GERD", "IBS commonly occurs with GERD."),
        ("Fibromyalgia", "IBS and fibromyalgia are associated."),
        ("Chronic Fatigue", "IBS causes fatigue."),
        ("Hemorrhoids", "IBS symptoms can cause hemorrhoids."),
    ],
    
    # ============================================================
    # SKIN CONDITIONS
    # ============================================================
    "Eczema (Dermatitis)": [
        ("Depression", "Chronic skin conditions cause depression."),
        ("Anxiety", "Visible skin conditions cause anxiety."),
        ("Sleep Disorder", "Itching disrupts sleep."),
        ("Asthma", "Eczema is part of the atopic triad with asthma."),
        ("Allergic Rhinitis", "Eczema commonly occurs with nasal allergies."),
    ],
    
    "Psoriasis": [
        ("Psoriatic Arthritis", "Psoriasis can cause inflammatory arthritis."),
        ("Depression", "Psoriasis commonly causes depression."),
        ("Anxiety", "Visible skin condition causes anxiety."),
        ("Cardiovascular Disease", "Psoriasis increases heart disease risk."),
        ("Diabetes", "Psoriasis is associated with metabolic syndrome."),
        ("Obesity", "Psoriasis and obesity are connected."),
    ],
}


def build_secondary_entry(primary: str, secondary: str, rationale: str) -> Dict:
    """Build a standardized entry for a secondary condition relationship."""
    return {
        "id": f"sec_{primary.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')}_{secondary.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')}",
        "title": f"Secondary: {secondary} (from {primary})",
        "content": f"""SECONDARY CONDITION CLAIM GUIDANCE

PRIMARY CONDITION: {primary}
SECONDARY CONDITION: {secondary}

MEDICAL RATIONALE:
{rationale}

LEGAL BASIS:
38 CFR 3.310 - Disabilities that are proximately due to or aggravated by service-connected conditions.

HOW TO FILE:
1. You must ALREADY be service-connected for {primary}
2. File VA Form 21-526EZ for {secondary} as a SECONDARY claim
3. Get a nexus letter from your doctor stating:
   - "{secondary} is at least as likely as not (50% or greater probability) caused by OR aggravated by the veteran's service-connected {primary}"
4. Submit medical evidence showing the connection

EVIDENCE NEEDED:
- Current diagnosis of {secondary}
- Medical opinion (nexus letter) linking {secondary} to {primary}
- Medical records showing progression
- Peer-reviewed studies supporting the connection (helpful but not required)

KEY PHRASES FOR NEXUS LETTER:
- "The veteran's {secondary} is at least as likely as not proximately due to their service-connected {primary}"
- "The veteran's {secondary} has been aggravated beyond natural progression by their service-connected {primary}"

IMPORTANT:
Even if the secondary condition is only AGGRAVATED (not caused) by the primary condition, you can still get service connection for the portion of disability attributable to the aggravation.""",
        "metadata": {
            "source": "SECONDARY_CONDITIONS_MATRIX",
            "type": "secondary_condition_guidance",
            "primary_condition": primary,
            "secondary_condition": secondary,
            "rationale": rationale,
            "legal_reference": "38 CFR 3.310",
            "requires_existing_sc": True,
            "nexus_required": True,
        }
    }


def build_primary_overview(primary: str, secondaries: List[tuple]) -> Dict:
    """Build an overview entry for a primary condition listing all secondaries."""
    secondary_list = "\n".join([f"• {s[0]}: {s[1][:100]}..." for s in secondaries])
    
    return {
        "id": f"sec_overview_{primary.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')}",
        "title": f"Secondary Conditions Overview: {primary}",
        "content": f"""SECONDARY CONDITIONS FOR {primary.upper()}

If you are service-connected for {primary}, you may be eligible to claim the following conditions as SECONDARY:

{secondary_list}

TOTAL POTENTIAL SECONDARIES: {len(secondaries)}

HOW SECONDARY CLAIMS WORK:
Under 38 CFR 3.310, you can get service connection for ANY condition that is:
1. CAUSED BY your service-connected {primary}, OR
2. AGGRAVATED BY your service-connected {primary}

FILING STRATEGY:
1. Review your medical records for any of these conditions
2. Ask your doctor if any health issues could be related to your {primary}
3. Get nexus letters for each condition you want to claim
4. File all secondary claims together for efficiency

IMPORTANT TIP:
Even if a condition existed before your {primary} was rated, if {primary} made it WORSE, you can claim it as a secondary condition aggravated by service-connected disability.""",
        "metadata": {
            "source": "SECONDARY_CONDITIONS_MATRIX",
            "type": "secondary_overview",
            "primary_condition": primary,
            "secondary_count": len(secondaries),
            "secondary_conditions": [s[0] for s in secondaries],
            "legal_reference": "38 CFR 3.310",
        }
    }


def main():
    print("=" * 70)
    print("💎 DIAMOND Secondary Conditions Matrix Builder")
    print("=" * 70)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    all_entries = []
    
    # Add general 38 CFR 3.310 overview
    all_entries.append({
        "id": "sec_38cfr_3_310_overview",
        "title": "38 CFR 3.310 - Secondary Service Connection Overview",
        "content": """SECONDARY SERVICE CONNECTION UNDER 38 CFR 3.310

LEGAL BASIS:
38 CFR 3.310 establishes that disability compensation may be paid for any condition that is "proximately due to or the result of" a service-connected condition.

TWO TYPES OF SECONDARY CLAIMS:

1. CAUSATION (3.310(a)):
   The secondary condition was CAUSED by the service-connected condition.
   Example: Diabetes (SC) → Peripheral Neuropathy (secondary)

2. AGGRAVATION (3.310(b)):
   The secondary condition EXISTED but was made WORSE by the service-connected condition.
   Example: Pre-existing back pain → Made worse by service-connected knee injury
   Note: Compensation is only for the degree of aggravation, not the baseline.

REQUIREMENTS FOR SECONDARY CLAIM:
1. Must have an existing service-connected condition (primary)
2. Must have a current diagnosis of the secondary condition
3. Must have medical evidence (nexus) linking the two

NEXUS LETTER REQUIREMENT:
Unlike presumptive conditions, secondary conditions DO require a nexus letter.
The nexus should state the secondary condition is "at least as likely as not" (50%+) caused by or aggravated by the primary condition.

STRATEGIC IMPORTANCE:
Secondary claims are one of the most effective ways to increase your combined disability rating.
Many veterans are under-rated because they don't know what secondary conditions to claim.

THIS DATABASE:
Contains {total} documented secondary condition relationships to help you identify potential claims.""".format(total=sum(len(v) for v in SECONDARY_MATRIX.values())),
        "metadata": {
            "source": "SECONDARY_CONDITIONS_MATRIX",
            "type": "legal_overview",
            "legal_reference": "38 CFR 3.310",
            "total_relationships": sum(len(v) for v in SECONDARY_MATRIX.values()),
        }
    })
    
    # Process each primary condition
    for primary, secondaries in SECONDARY_MATRIX.items():
        print(f"\n📋 Processing {primary}...")
        
        # Add overview for this primary condition
        overview = build_primary_overview(primary, secondaries)
        all_entries.append(overview)
        
        # Add individual secondary condition entries
        for secondary, rationale in secondaries:
            entry = build_secondary_entry(primary, secondary, rationale)
            all_entries.append(entry)
        
        print(f"   ✅ Added {len(secondaries) + 1} entries (1 overview + {len(secondaries)} secondaries)")
    
    # Save output
    output_data = {
        "source": "Diamond Secondary Conditions Matrix",
        "description": "Comprehensive database of secondary service-connected condition relationships",
        "created_at": datetime.now().isoformat(),
        "legal_basis": "38 CFR 3.310",
        "total_primary_conditions": len(SECONDARY_MATRIX),
        "total_relationships": sum(len(v) for v in SECONDARY_MATRIX.values()),
        "total_entries": len(all_entries),
        "note": "Secondary conditions require nexus letters linking them to the primary service-connected condition",
        "entries": all_entries
    }
    
    print(f"\n💾 Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 70)
    print("💎 SECONDARY CONDITIONS MATRIX COMPLETE")
    print("=" * 70)
    print(f"\n📊 Statistics:")
    print(f"   Primary Conditions: {len(SECONDARY_MATRIX)}")
    print(f"   Secondary Relationships: {sum(len(v) for v in SECONDARY_MATRIX.values())}")
    print(f"   Total Entries: {len(all_entries)}")
    print(f"\n📁 Output: {OUTPUT_FILE}")
    print("=" * 70)
    
    return all_entries


if __name__ == "__main__":
    entries = main()
