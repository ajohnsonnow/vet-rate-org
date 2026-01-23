#!/usr/bin/env python3
"""
Create training data templates for VetRate LLM v2.0 models.
Run this in WSL to generate the JSONL files.
"""

import json
import os

# Ensure directory exists
os.makedirs('/home/antho/vet-rate-swarm/data', exist_ok=True)

# Auditor v2 samples (with contrastive examples)
auditor_samples = [
    {
        "instruction": "Under 38 CFR 4.130, what distinguishes a 50% PTSD rating from a 70% PTSD rating?",
        "input": "",
        "output": """Under 38 CFR 4.130:

50% Rating: Occupational and social impairment with reduced reliability and productivity. Symptoms include flattened affect, panic attacks weekly, difficulty understanding complex commands, impaired memory, disturbances of motivation.

70% Rating: Occupational and social impairment with deficiencies in MOST areas. Symptoms include suicidal ideation, obsessional rituals, near-continuous panic/depression, impaired impulse control, neglect of hygiene, inability to maintain relationships.

Key difference: 50% = reduced reliability. 70% = deficiencies in MOST areas."""
    },
    {
        "instruction": "Why would a veteran with daily panic attacks NOT qualify for 100% PTSD?",
        "input": "",
        "output": """Daily panic attacks alone do not meet 100% PTSD criteria. Under 38 CFR 4.130, 100% requires TOTAL occupational and social impairment with:
- Gross impairment in thought/communication
- Persistent delusions or hallucinations
- Persistent danger of hurting self/others
- Inability to perform daily living activities
- Disorientation to time/place
- Memory loss for own name

A veteran who can maintain any relationships, work at all, or care for themselves does NOT meet 100%. This is a common denial reason."""
    }
]

# Writer v2 samples (framed as drafting assistance)
writer_samples = [
    {
        "instruction": "Draft a nexus letter template for sleep apnea secondary to PTSD using the at least as likely as not standard.",
        "input": "",
        "output": """[LETTERHEAD]

To Whom It May Concern:

I have reviewed [Patient Name] medical records. It is my medical opinion that the patient's current Obstructive Sleep Apnea (OSA) is at least as likely as not (50% or greater probability) caused or aggravated by service-connected PTSD.

MEDICAL RATIONALE:
1. PTSD causes chronic sympathetic nervous system activation
2. Heightened arousal increases upper airway resistance during sleep
3. Weight gain from PTSD medications (SSRIs) contributes to OSA
4. Medical literature supports PTSD-OSA connection

I base this opinion on review of records, clinical examination, and current medical literature.

Respectfully,
[Provider Name, Credentials]"""
    },
    {
        "instruction": "Help me write a personal statement for my tinnitus claim. I was an artilleryman.",
        "input": "",
        "output": """STATEMENT IN SUPPORT OF CLAIM
VA Form 21-4138

I, [Your Name], was an artilleryman in the U.S. Army from [dates] at [unit/location].

During my service, I was exposed to hazardous noise levels from:
- Howitzer fire during training and combat operations
- Small arms fire at ranges and in combat
- Vehicle and equipment noise

Hearing protection was not consistently available or practical in combat situations.

Since service, I experience constant high-pitched ringing in both ears that:
- Keeps me awake at night
- Affects my concentration at work
- Makes it difficult to hear conversations in noisy environments

This condition has been continuous since my discharge and significantly impacts my daily life.

[Signature]
[Date]"""
    }
]

# Rater v2 samples (output code, NOT math)
rater_samples = [
    {
        "instruction": "Calculate the combined VA rating for: 70% PTSD, 30% migraines, 10% tinnitus",
        "input": "",
        "output": """I will use the VA calculator tool to compute this accurately:

```python
from vaCalculatorTool import calculate_combined_rating

result = calculate_combined_rating([70, 30, 10])
print(result["formatted_response"])
```

The correct combined rating is **80%** using VA math (not simple addition)."""
    },
    {
        "instruction": "What is the combined rating for 40% left knee and 30% right knee?",
        "input": "",
        "output": """Since both knees are affected, the bilateral factor applies under 38 CFR 4.26:

```python
from vaCalculatorTool import calculate_combined_rating

result = calculate_combined_rating(
    ratings=[],
    bilateral_pairs={"knees": [40, 30]}
)
print(result["formatted_response"])
```

The bilateral factor adds approximately 10% of the combined bilateral value to account for the increased impairment of having both extremities affected."""
    }
]

# Write files
with open('/home/antho/vet-rate-swarm/data/train_auditor_v2_template.jsonl', 'w') as f:
    for s in auditor_samples:
        f.write(json.dumps(s) + '\n')

with open('/home/antho/vet-rate-swarm/data/train_writer_v2_template.jsonl', 'w') as f:
    for s in writer_samples:
        f.write(json.dumps(s) + '\n')

with open('/home/antho/vet-rate-swarm/data/train_rater_v2_template.jsonl', 'w') as f:
    for s in rater_samples:
        f.write(json.dumps(s) + '\n')

print('Created training templates:')
print(f'  - Auditor: {len(auditor_samples)} samples')
print(f'  - Writer: {len(writer_samples)} samples')
print(f'  - Rater: {len(rater_samples)} samples (code output!)')
