#!/usr/bin/env python3
"""
VetRate Training Data Expansion Script
Generates training samples from Diamond Knowledge Base (public domain)

Sources:
- diagnosticCodes.json (38 CFR Part 4)
- VA rating criteria
- Public domain VA regulations
"""

import json
import os
import random
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "src" / "data"
OUTPUT_DIR = Path.home() / "vet-rate-swarm" / "data"
DISABILITY_FILE = DATA_DIR / "disabilityData.json"

# =============================================================================
# AUDITOR V2 TRAINING DATA - Regulatory accuracy verification
# =============================================================================

AUDITOR_TEMPLATES = [
    # Correct examples
    {
        "input": "A veteran claims PTSD requires 4 symptoms for a 50% rating. Verify this.",
        "output": """ACCURACY CHECK: INCORRECT

The veteran's claim contains inaccurate information.

CORRECT CRITERIA (38 CFR § 4.130, DC 9411):
50% PTSD rating requires:
- Occupational and social impairment with reduced reliability and productivity
- Due to such symptoms as: flattened affect; circumstantial, circumlocutory, or stereotyped speech; panic attacks more than once a week; difficulty in understanding complex commands; impairment of short- and long-term memory; impaired judgment; impaired abstract thinking; disturbances of motivation and mood; difficulty in establishing and maintaining effective work and social relationships

KEY POINT: There is no specific "4 symptom" requirement. The rating is based on OVERALL occupational and social impairment level, not symptom counting.

SOURCE: 38 CFR § 4.130 - Schedule of ratings—Mental disorders""",
        "is_correct": False
    },
    {
        "input": "The VA uses a 'whole person' calculation where ratings are combined, not added. For example, 50% + 30% = 65%, not 80%. Is this accurate?",
        "output": """ACCURACY CHECK: CORRECT

The veteran's understanding is accurate.

VERIFICATION (38 CFR § 4.25):
The VA Combined Ratings Table uses the "whole person" theory:
- Start with highest rating (50%)
- Remaining efficiency: 100% - 50% = 50%
- Apply next rating to remaining: 30% of 50% = 15%
- Combined: 50% + 15% = 65%

The ratings are NOT simply added (50% + 30% ≠ 80%).

This prevents combined ratings from exceeding 100% and reflects that each additional disability affects only the "remaining" healthy portion.

SOURCE: 38 CFR § 4.25 - Combined ratings table""",
        "is_correct": True
    },
    {
        "input": "A 100% scheduler rating automatically qualifies for TDIU.",
        "output": """ACCURACY CHECK: INCORRECT

This statement contains a logical error.

CORRECTION:
- TDIU (Total Disability Individual Unemployability) is for veterans who CANNOT work due to service-connected disabilities
- If a veteran already has a 100% schedular rating, TDIU is MOOT (not needed)
- TDIU provides 100% compensation when schedular ratings are BELOW 100%

TDIU REQUIREMENTS (38 CFR § 4.16):
- One disability rated 60% or more, OR
- Combined rating of 70% with one disability at 40%+
- Unable to secure/maintain substantially gainful employment

A veteran AT 100% schedular does not need TDIU - they already receive maximum compensation.

SOURCE: 38 CFR § 4.16 - Total disability ratings for compensation based on unemployability""",
        "is_correct": False
    }
]

# =============================================================================
# WRITER V2 TRAINING DATA - Drafting assistance (not legal advice)
# =============================================================================

WRITER_TEMPLATES = [
    {
        "condition": "PTSD",
        "context": "Combat veteran with nightmares, hypervigilance, avoidance",
        "output": """DRAFT PERSONAL STATEMENT - FOR VETERAN REVIEW AND CUSTOMIZATION

---

**IMPORTANT DISCLAIMER**: This is a DRAFT template to help you organize your thoughts. You MUST:
1. Review and customize with YOUR specific experiences
2. Use YOUR own words and details
3. Consider consulting with a VSO or attorney
4. Verify all dates and facts before submission

---

**SUGGESTED STRUCTURE:**

**Section 1: Service Information**
"I served in [BRANCH] from [DATE] to [DATE]. During my deployment to [LOCATION], I experienced [GENERAL DESCRIPTION OF STRESSOR]."

**Section 2: Current Symptoms**
Consider describing how these affect your daily life:
- Sleep disturbances (nightmares, insomnia)
- Hypervigilance (always on alert, startle response)
- Avoidance behaviors (avoiding crowds, triggers)
- Mood changes (irritability, emotional numbness)
- Relationship impacts

**Section 3: Functional Impact**
Describe how symptoms affect:
- Work performance
- Social relationships
- Daily activities
- Family life

**Section 4: Treatment History**
List any treatment you've received:
- VA or private mental health care
- Medications prescribed
- Therapy participation

---

**TIPS FOR STRENGTHENING YOUR STATEMENT:**
- Be specific about frequency ("nightmares 3-4 times per week")
- Describe the IMPACT, not just symptoms
- Include buddy statements if available
- Reference medical records when possible

---

*This draft was generated to assist with organization. The veteran retains full responsibility for the accuracy and content of their final submission.*"""
    },
    {
        "condition": "Tinnitus",
        "context": "Artillery, constant ringing, affects concentration",
        "output": """DRAFT PERSONAL STATEMENT - FOR VETERAN REVIEW AND CUSTOMIZATION

---

**IMPORTANT DISCLAIMER**: This is a DRAFT template to help you organize your thoughts. You MUST customize with your specific experiences and verify all information.

---

**SUGGESTED STRUCTURE:**

**Section 1: Noise Exposure During Service**
"During my service as [MOS/RATE] from [DATE] to [DATE], I was regularly exposed to hazardous noise levels including [SPECIFIC SOURCES: artillery fire, flight line, weapons qualification, heavy machinery, etc.]."

**Section 2: Hearing Protection**
"Hearing protection was [provided/not provided/inconsistently used] during [SPECIFIC ACTIVITIES]."

**Section 3: Onset of Tinnitus**
"I first noticed ringing in my ears [during service/shortly after]. The sound is [constant/intermittent] and can be described as [ringing/buzzing/hissing/whooshing]."

**Section 4: Current Impact**
Consider describing:
- Difficulty concentrating at work
- Problems hearing conversations
- Sleep disturbances
- Impact on quality of life

**Section 5: Continuity**
"This condition has [persisted/worsened] since my service. I [have/have not] sought treatment for this condition."

---

**NOTE ON TINNITUS RATINGS:**
- Tinnitus is rated at a maximum of 10% under DC 6260
- This is the highest schedular rating available for tinnitus
- The rating is the same regardless of whether it affects one or both ears

---

*This draft was generated to assist with organization. Customize with your specific details.*"""
    }
]

# =============================================================================
# RATER V2 TRAINING DATA - Outputs Python calculator code
# =============================================================================

RATER_TEMPLATES = [
    {
        "input": "Calculate combined rating for: 70% knee, 50% back, 30% shoulder, 10% tinnitus",
        "output": """To calculate this combined VA rating, use the VA Calculator Tool:

```python
from vaCalculatorTool import VACalculator

calc = VACalculator()
result = calc.calculate_combined_rating([70, 50, 30, 10])

print(f"Combined Rating: {result['combined_rating']}%")
print(f"Exact Value: {result['exact_value']:.2f}%")
print(f"TDIU Eligible: {result['tdiu_eligible']}")
```

**Expected Output:**
- Combined Rating: **90%**
- Exact Value: 90.55%
- TDIU Eligible: Yes (one disability 60%+)

**Calculation Steps:**
1. Start: 70% → Remaining: 30%
2. Apply 50% to 30% → 15% → Total: 85%, Remaining: 15%
3. Apply 30% to 15% → 4.5% → Total: 89.5%, Remaining: 10.5%
4. Apply 10% to 10.5% → 1.05% → Total: 90.55%
5. Round to nearest 10: **90%**"""
    },
    {
        "input": "I have bilateral knee conditions: left 30%, right 20%. What's my rating with the bilateral factor?",
        "output": """For bilateral (paired) extremity conditions, the VA applies a special bilateral factor:

```python
from vaCalculatorTool import VACalculator

calc = VACalculator()

# Define bilateral conditions
bilateral_ratings = [30, 20]  # Left and right knee

result = calc.calculate_bilateral_factor(bilateral_ratings)

print(f"Combined bilateral: {result['combined_bilateral']}%")
print(f"Bilateral factor (10%): {result['bilateral_factor']:.1f}%")
print(f"Final with factor: {result['final_rating']}%")
```

**Expected Output:**
- Combined bilateral value: 44%
- Bilateral factor bonus: 4.4%
- Final rating: **50%** (44 + 4.4 = 48.4, rounds to 50)

**Why the Bilateral Factor?**
Per 38 CFR § 4.26, when paired extremities (arms, legs, eyes, ears) are both service-connected, the VA adds 10% of the combined bilateral value before combining with other disabilities. This recognizes the compounding difficulty of bilateral impairment."""
    },
    {
        "input": "My ratings are: 40% PTSD, 20% back, 10% knee. Am I eligible for TDIU?",
        "output": """Let me check TDIU eligibility:

```python
from vaCalculatorTool import VACalculator

calc = VACalculator()
ratings = [40, 20, 10]

result = calc.calculate_combined_rating(ratings)
tdiu = calc.calculate_tdiu_eligibility(ratings)

print(f"Combined Rating: {result['combined_rating']}%")
print(f"TDIU Eligible (schedular): {tdiu['schedular_eligible']}")
print(f"Reason: {tdiu['reason']}")
```

**Expected Output:**
- Combined Rating: **60%**
- TDIU Schedular Eligible: **No**

**TDIU Requirements (38 CFR § 4.16(a)):**
- ONE disability at 60%+, OR
- Combined 70%+ with ONE disability at 40%+

**Your Situation:**
- Highest single: 40% (needs 60%)
- Combined: 60% (needs 70%)
- Does NOT meet schedular TDIU

**Options:**
1. **38 CFR § 4.16(b)**: Extraschedular TDIU - if you cannot work due to service-connected disabilities despite not meeting schedular requirements, you can request extraschedular consideration
2. **Increase ratings**: Pursue increases if conditions have worsened
3. **Add secondary conditions**: Conditions caused by service-connected disabilities"""
    }
]

# =============================================================================
# DIAGNOSTIC CODE BASED GENERATION
# =============================================================================

def load_diagnostic_codes():
    """Load diagnostic codes from the project data"""
    if DISABILITY_FILE.exists():
        with open(DISABILITY_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Return as dict keyed by diagnostic code
            return {d['diagnosticCode']: d for d in data.get('disabilities', [])}
    return {}

def generate_auditor_from_dc(dc_code, dc_data):
    """Generate auditor training samples from diagnostic code data"""
    samples = []
    
    condition_name = dc_data.get('conditionName', 'Unknown')
    rating_criteria = dc_data.get('ratingCriteria', {})
    ratings = rating_criteria.get('ratings', {})
    
    if ratings:
        # Generate verification sample
        rating_text = "\n".join([f"- {pct}%: {desc[:100]}..." if len(desc) > 100 else f"- {pct}%: {desc}" 
                                  for pct, desc in ratings.items()])
        
        samples.append({
            "messages": [
                {"role": "system", "content": "You are a VA regulatory accuracy auditor. Verify claims against 38 CFR."},
                {"role": "user", "content": f"What are the rating criteria for {condition_name} (DC {dc_code})?"},
                {"role": "assistant", "content": f"""VERIFICATION FOR DC {dc_code}: {condition_name}

CFR Reference: {dc_data.get('ratingSchedule', '38 CFR § 4.XX')}

**Rating Levels:**
{rating_text}

**Documentation Required:**
{dc_data.get('documentationRequirements', 'See 38 CFR for specific requirements.')}

Source: {dc_data.get('ecfrUrl', 'https://www.ecfr.gov/current/title-38/chapter-I/part-4')}"""}
            ]
        })
    
    return samples

def generate_writer_from_dc(dc_code, dc_data):
    """Generate writer training samples from diagnostic code data"""
    condition_name = dc_data.get('conditionName', 'condition')
    doc_reqs = dc_data.get('documentationRequirements', '')
    secondary = dc_data.get('relatedSecondaryConditions', [])
    
    secondary_text = ""
    if secondary and isinstance(secondary, list):
        sec_items = []
        for s in secondary[:5]:
            if isinstance(s, dict):
                sec_items.append(f"- {s.get('name', 'Unknown')} (DC {s.get('diagnosticCode', 'XXXX')})")
            elif isinstance(s, str):
                sec_items.append(f"- {s}")
        if sec_items:
            secondary_text = "\n**Related Secondary Conditions to Consider:**\n" + "\n".join(sec_items)
    
    return {
        "messages": [
            {"role": "system", "content": "You are a veteran personal statement drafting assistant. Generate templates that veterans can customize. Always include disclaimers."},
            {"role": "user", "content": f"Help me draft a personal statement for {condition_name} (DC {dc_code})."},
            {"role": "assistant", "content": f"""DRAFT PERSONAL STATEMENT TEMPLATE - {condition_name.upper()} (DC {dc_code})

**DISCLAIMER**: This is a DRAFT template. You MUST customize with YOUR specific experiences and verify all information before submission.

---

**Section 1: Service Connection**
"During my service from [DATE] to [DATE], I [developed/was diagnosed with/experienced symptoms of] {condition_name}. [Describe the in-service event, injury, or onset of symptoms]."

**Section 2: Current Symptoms**
Describe your current symptoms and their severity. Be specific about frequency and intensity.

**Section 3: Impact on Daily Life**
Explain how {condition_name} affects your:
- Work/employment capabilities
- Daily activities and self-care
- Relationships and social functioning
- Overall quality of life

**Section 4: Medical Evidence**
Reference supporting documentation:
{doc_reqs if doc_reqs else '- Service treatment records\n- VA medical records\n- Private medical opinions\n- Buddy statements'}
{secondary_text}

---

*Customize this template with your specific details. Consider working with a VSO or accredited claims agent.*"""}
        ]
    }

def generate_rater_from_dc(dc_code, dc_data):
    """Generate rater training samples - teaches to use calculator tool"""
    rating_criteria = dc_data.get('ratingCriteria', {})
    ratings = rating_criteria.get('ratings', {})
    condition_name = dc_data.get('conditionName', 'Unknown')
    
    if not ratings:
        return None
    
    rating_levels = sorted([int(r) for r in ratings.keys()], reverse=True)
    rating_list = ', '.join([f"{r}%" for r in rating_levels])
    
    return {
        "messages": [
            {"role": "system", "content": "You are a VA disability rating calculator assistant. For any rating calculations, output Python code using the VACalculator tool. Never calculate manually."},
            {"role": "user", "content": f"What are the rating levels for {condition_name} (DC {dc_code}) and how do I calculate my combined rating?"},
            {"role": "assistant", "content": f"""**DC {dc_code}: {condition_name}**

**Available Rating Levels:** {rating_list}

To calculate a combined rating including {condition_name}:

```python
from vaCalculatorTool import VACalculator

calc = VACalculator()

# Replace XX with your actual rating for {condition_name}
# Available levels: {rating_list}
your_{dc_code}_rating = XX  

# Add any other service-connected ratings
all_ratings = [your_{dc_code}_rating]  # Add more ratings here

result = calc.calculate_combined_rating(all_ratings)
print(f"Combined Rating: {{result['combined_rating']}}%")
print(f"TDIU Eligible: {{result['tdiu_eligible']}}")
```

**Rating Criteria Summary:**
{chr(10).join([f"- {pct}%: {desc[:80]}..." if len(str(desc)) > 80 else f"- {pct}%: {desc}" for pct, desc in ratings.items()])}

Reference: {dc_data.get('ratingSchedule', '38 CFR § 4.XX')}"""}
        ]
    }

# =============================================================================
# MAIN GENERATION
# =============================================================================

def main():
    print("=" * 60)
    print("VetRate Training Data Expansion")
    print("=" * 60)
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Load diagnostic codes
    dc_data = load_diagnostic_codes()
    print(f"Loaded {len(dc_data)} diagnostic codes from DKB")
    
    # Generate Auditor samples
    auditor_samples = []
    for template in AUDITOR_TEMPLATES:
        auditor_samples.append({
            "messages": [
                {"role": "system", "content": "You are a VA regulatory accuracy auditor. Your job is to verify veteran claims against official 38 CFR regulations. Always cite your sources."},
                {"role": "user", "content": template["input"]},
                {"role": "assistant", "content": template["output"]}
            ]
        })
    
    # Add DC-based auditor samples
    for code, data in dc_data.items():
        samples = generate_auditor_from_dc(code, data)
        auditor_samples.extend(samples)
    
    # Generate Writer samples
    writer_samples = []
    for template in WRITER_TEMPLATES:
        writer_samples.append({
            "messages": [
                {"role": "system", "content": "You are a veteran personal statement drafting assistant. You help veterans organize their thoughts into structured statement templates. Always include disclaimers that veterans must customize and verify."},
                {"role": "user", "content": f"Help me draft a statement for {template['condition']}. Context: {template['context']}"},
                {"role": "assistant", "content": template["output"]}
            ]
        })
    
    # Add DC-based writer samples
    for code, data in dc_data.items():
        sample = generate_writer_from_dc(code, data)
        if sample:
            writer_samples.append(sample)
    
    # Generate Rater samples
    rater_samples = []
    for template in RATER_TEMPLATES:
        rater_samples.append({
            "messages": [
                {"role": "system", "content": "You are a VA disability rating calculator assistant. For any rating calculations, output Python code using the VACalculator tool. Never calculate manually - always use the tool."},
                {"role": "user", "content": template["input"]},
                {"role": "assistant", "content": template["output"]}
            ]
        })
    
    # Add DC-based rater samples
    for code, data in dc_data.items():
        sample = generate_rater_from_dc(code, data)
        if sample:
            rater_samples.append(sample)
    
    # Write output files
    auditor_file = OUTPUT_DIR / "train_auditor_v2.jsonl"
    with open(auditor_file, 'w', encoding='utf-8') as f:
        for sample in auditor_samples:
            f.write(json.dumps(sample) + '\n')
    print(f"✓ Auditor: {len(auditor_samples)} samples → {auditor_file}")
    
    writer_file = OUTPUT_DIR / "train_writer_v2.jsonl"
    with open(writer_file, 'w', encoding='utf-8') as f:
        for sample in writer_samples:
            f.write(json.dumps(sample) + '\n')
    print(f"✓ Writer: {len(writer_samples)} samples → {writer_file}")
    
    rater_file = OUTPUT_DIR / "train_rater_v2.jsonl"
    with open(rater_file, 'w', encoding='utf-8') as f:
        for sample in rater_samples:
            f.write(json.dumps(sample) + '\n')
    print(f"✓ Rater: {len(rater_samples)} samples → {rater_file}")
    
    print("\n" + "=" * 60)
    print(f"Total samples generated: {len(auditor_samples) + len(writer_samples) + len(rater_samples)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
