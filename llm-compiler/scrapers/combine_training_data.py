#!/usr/bin/env python3
"""
Combine existing Vet-Rate knowledge base with scraped data
Creates a high-quality training dataset for fine-tuning
"""

import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def load_json(path):
    """Load JSON file"""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_disability_training_data(disability_data):
    """Generate training examples from disability data"""
    examples = []
    
    for disability in disability_data.get('disabilities', []):
        dc = disability.get('diagnosticCode', 'Unknown')
        name = disability.get('conditionName', 'Unknown')
        
        # Q&A about the condition
        examples.append({
            "instruction": f"What is Diagnostic Code {dc}?",
            "input": "",
            "output": f"Diagnostic Code {dc} is {name}. {disability.get('documentationRequirements', '')}",
            "metadata": {"source": "38CFR", "type": "diagnostic_code", "dc": dc}
        })
        
        # Rating criteria
        if 'ratingCriteria' in disability:
            criteria = disability['ratingCriteria']
            ratings = criteria.get('ratings', {})
            if ratings:
                rating_text = "\n".join([f"- {pct}%: {desc}" for pct, desc in ratings.items()])
                examples.append({
                    "instruction": f"What are the VA rating criteria for {name} (DC {dc})?",
                    "input": "",
                    "output": f"The rating criteria for {name} under Diagnostic Code {dc} are:\n\n{rating_text}",
                    "metadata": {"source": "38CFR", "type": "rating_criteria", "dc": dc}
                })
        
        # Secondary conditions
        secondaries = disability.get('relatedSecondaryConditions', [])
        if secondaries:
            # Handle both dict and string formats
            sec_names = []
            for s in secondaries:
                if isinstance(s, dict):
                    sec_names.append(s.get('name', ''))
                elif isinstance(s, str):
                    sec_names.append(s)
            sec_text = ", ".join([n for n in sec_names if n])
            examples.append({
                "instruction": f"What secondary conditions are related to {name}?",
                "input": "",
                "output": f"Secondary conditions commonly associated with {name} (DC {dc}) under 38 CFR § 3.310 include: {sec_text}",
                "metadata": {"source": "38CFR_3.310", "type": "secondary", "dc": dc}
            })
    
    return examples

def generate_secondary_training_data(secondary_db):
    """Generate training examples from secondary conditions database"""
    examples = []
    
    for primary_key, primary_data in secondary_db.items():
        if primary_key.startswith('_'):  # Skip metadata
            continue
            
        primary_name = primary_data.get('name', primary_key)
        primary_dc = primary_data.get('ecfr_diagnostic_code', '')
        
        for secondary in primary_data.get('potential_secondaries', []):
            sec_name = secondary.get('condition', '')
            sec_dc = secondary.get('ecfr_diagnostic_code', '')
            nexus = secondary.get('nexus_theory', '')
            probability = secondary.get('probability', '')
            evidence = secondary.get('medical_evidence', [])
            
            if nexus:
                # Full nexus explanation
                examples.append({
                    "instruction": f"Can {sec_name} be claimed as secondary to {primary_name}?",
                    "input": "",
                    "output": f"Yes. Under 38 CFR § 3.310, {sec_name} ({sec_dc}) can potentially be claimed as secondary to service-connected {primary_name} ({primary_dc}).\n\n**Nexus Theory:**\n{nexus}\n\n**Probability:** {probability}\n\n**Supporting Medical Evidence:**\n" + "\n".join([f"- {e}" for e in evidence]),
                    "metadata": {"source": "38CFR_3.310", "type": "secondary_nexus", "primary": primary_dc, "secondary": sec_dc}
                })
                
                # Short answer
                examples.append({
                    "instruction": f"What is the nexus between {primary_name} and {sec_name}?",
                    "input": "",
                    "output": nexus,
                    "metadata": {"source": "38CFR_3.310", "type": "nexus_theory", "primary": primary_dc, "secondary": sec_dc}
                })
    
    return examples

def generate_cfr_training_data(cfr_data):
    """Generate training examples from CFR regulations"""
    examples = []
    
    for reg in cfr_data.get('regulations', []):
        citation = reg.get('citation', '')
        title = reg.get('title', '')
        content = reg.get('content', '')
        
        if content:
            examples.append({
                "instruction": f"Explain {citation}: {title}",
                "input": "",
                "output": content,
                "metadata": {"source": "38CFR", "type": "regulation", "citation": citation}
            })
    
    return examples

def generate_pact_training_data(pact_data):
    """Generate training examples from PACT Act data"""
    examples = []
    
    # Extract info from pactActInfo
    info = pact_data.get('pactActInfo', {})
    if info:
        examples.append({
            "instruction": "What is the PACT Act?",
            "input": "",
            "output": f"{info.get('fullName', 'PACT Act')}: {info.get('description', '')}",
            "metadata": {"source": "PACT_ACT", "type": "overview"}
        })
    
    # Extract exposure categories
    for cat_key, cat_data in pact_data.get('exposureCategories', {}).items():
        if isinstance(cat_data, dict):
            name = cat_data.get('name', cat_key)
            desc = cat_data.get('description', '')
            conditions = cat_data.get('presumptiveConditions', [])
            
            # Handle string list of conditions
            if conditions:
                cond_names = []
                for c in conditions:
                    if isinstance(c, str):
                        cond_names.append(c)
                    elif isinstance(c, dict):
                        cond_names.append(c.get('name', ''))
                
                examples.append({
                    "instruction": f"What conditions are presumptive under {name}?",
                    "input": "",
                    "output": f"Under the PACT Act, the following conditions are presumptive for {name}: {', '.join(cond_names[:10])}{'...' if len(cond_names) > 10 else ''}",
                    "metadata": {"source": "PACT_ACT", "type": "presumptive", "category": cat_key}
                })
    
    return examples

def main():
    data_dir = Path(__file__).parent.parent.parent / "src" / "data"
    output_dir = Path(__file__).parent.parent / "knowledge-base"
    
    all_examples = []
    
    # Load and process disability data
    logger.info("Processing disabilityData.json...")
    disability_path = data_dir / "disabilityData.json"
    if disability_path.exists():
        disability_data = load_json(disability_path)
        examples = generate_disability_training_data(disability_data)
        all_examples.extend(examples)
        logger.info(f"  Generated {len(examples)} disability examples")
    
    # Load and process secondary conditions
    logger.info("Processing secondary_conditions_db.json...")
    secondary_path = data_dir / "secondary_conditions_db.json"
    if secondary_path.exists():
        secondary_data = load_json(secondary_path)
        examples = generate_secondary_training_data(secondary_data)
        all_examples.extend(examples)
        logger.info(f"  Generated {len(examples)} secondary condition examples")
    
    # Load and process CFR data
    for cfr_file in ["cfr3Regulations.json", "title38Regulations.json"]:
        cfr_path = data_dir / cfr_file
        if cfr_path.exists():
            logger.info(f"Processing {cfr_file}...")
            cfr_data = load_json(cfr_path)
            examples = generate_cfr_training_data(cfr_data)
            all_examples.extend(examples)
            logger.info(f"  Generated {len(examples)} CFR examples")
    
    # Load and process PACT Act data
    logger.info("Processing pactActData.json...")
    pact_path = data_dir / "pactActData.json"
    if pact_path.exists():
        pact_data = load_json(pact_path)
        examples = generate_pact_training_data(pact_data)
        all_examples.extend(examples)
        logger.info(f"  Generated {len(examples)} PACT Act examples")
    
    # Load existing scraped data
    logger.info("Loading scraped data...")
    scraped_path = output_dir / "va_training_dataset.jsonl"
    if scraped_path.exists():
        with open(scraped_path, 'r', encoding='utf-8') as f:
            scraped_count = 0
            for line in f:
                if line.strip():
                    all_examples.append(json.loads(line))
                    scraped_count += 1
            logger.info(f"  Added {scraped_count} scraped examples")
    
    # Save combined dataset
    logger.info(f"\nSaving combined dataset with {len(all_examples)} total examples...")
    
    combined_path = output_dir / "vet_rate_combined_training.jsonl"
    with open(combined_path, 'w', encoding='utf-8') as f:
        for example in all_examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')
    
    logger.info(f"Saved to: {combined_path}")
    logger.info(f"File size: {combined_path.stat().st_size / 1024:.1f} KB")
    
    # Summary by source
    sources = {}
    for ex in all_examples:
        src = ex.get('metadata', {}).get('source', 'Unknown')
        sources[src] = sources.get(src, 0) + 1
    
    logger.info("\nBreakdown by source:")
    for src, count in sorted(sources.items(), key=lambda x: -x[1]):
        logger.info(f"  {src}: {count}")

if __name__ == "__main__":
    main()
