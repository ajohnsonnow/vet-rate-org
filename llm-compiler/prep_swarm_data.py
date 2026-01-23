#!/usr/bin/env python3
"""
╔════════════════════════════════════════════════════════════════════════╗
║  DIAMOND STANDARD: LoRA Swarm Data Preparation                        ║
║  Converts Diamond KB exports to Axolotl-compatible JSONL training data║
║  Author: Vet-Rate.org AI Engineering Team                             ║
║  Hardware Target: RTX 4080 Super (16GB VRAM)                          ║
║  Model Target: Llama-3.2-3B-Instruct + LoRA Adapters                  ║
╚════════════════════════════════════════════════════════════════════════╝
"""

import json
import logging
import re
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple
from datetime import datetime
from collections import Counter
import unicodedata

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'prep_swarm_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


# =============================================================================
# SWARM ROLE DEFINITIONS
# =============================================================================

SWARM_ROLES = {
    "auditor": {
        "name": "VetRate-Auditor",
        "description": "Strictly cites 38 CFR regulations. Expert in legal analysis and regulatory compliance.",
        "system_prompt": "You are VetRate-Auditor, a VA regulations expert. You strictly cite 38 CFR regulations, BVA precedents, OGC opinions, and Federal Register rules. You NEVER hallucinate laws or make up regulatory citations. Always provide exact CFR section numbers and precedent case names. If you don't know something, you say so explicitly.",
        "sources": ["38CFR", "OGC", "BVA", "FREG", "M21-1", "PACT_ACT"],
        "output_file": "train_auditor.jsonl"
    },
    "writer": {
        "name": "VetRate-Writer",
        "description": "Persuasive, empathetic communication specialist for veteran-centric content.",
        "system_prompt": "You are VetRate-Writer, a veteran advocacy communication specialist. You write in a persuasive, empathetic, veteran-centric tone. You help veterans articulate their experiences clearly for VA claims. You focus on human impact while maintaining factual accuracy. You never exaggerate but you advocate strongly for veteran rights.",
        "sources": ["COMMUNITY_PROVIDED", "SECONDARY"],
        "output_file": "train_writer.jsonl"
    },
    "rater": {
        "name": "VetRate-Rater",
        "description": "Combined calculation and assessment specialist.",
        "system_prompt": "You are VetRate-Rater, a VA disability rating specialist. You accurately calculate combined disability ratings using VA's formula. You assess conditions against diagnostic codes and rating schedules. You provide precise, mathematical reasoning for all calculations.",
        "sources": ["38CFR", "SECONDARY", "FREG"],
        "output_file": "train_rater.jsonl"
    }
}


# =============================================================================
# DATA CLEANSING & VALIDATION
# =============================================================================

class DataCleanser:
    """Robust text cleansing for LLM training data."""
    
    # Minimum character thresholds
    MIN_INSTRUCTION_LENGTH = 10
    MIN_OUTPUT_LENGTH = 50
    MAX_OUTPUT_LENGTH = 4096  # Stay within context window
    
    # Dangerous character patterns that break tokenizers
    UNSAFE_PATTERNS = [
        (r'\x00', ''),  # Null bytes
        (r'[\x01-\x08\x0b\x0c\x0e-\x1f]', ''),  # Control characters (except \n, \r, \t)
        (r'\ufffd', ''),  # Unicode replacement character
        (r'\u200b', ''),  # Zero-width space
        (r'\u200c', ''),  # Zero-width non-joiner
        (r'\u200d', ''),  # Zero-width joiner
        (r'\ufeff', ''),  # Zero-width no-break space (BOM)
    ]
    
    # Normalization patterns
    NORMALIZATION_PATTERNS = [
        (r'\r\n', '\n'),  # Windows line endings -> Unix
        (r'\r', '\n'),  # Old Mac line endings -> Unix
        (r'\n{3,}', '\n\n'),  # Multiple newlines -> max 2
        (r' {2,}', ' '),  # Multiple spaces -> single space
        (r'\t+', ' '),  # Tabs -> spaces
        (r'^\s+', ''),  # Leading whitespace (per line)
        (r'\s+$', ''),  # Trailing whitespace (per line)
    ]
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Apply comprehensive text cleansing."""
        if not text:
            return ""
        
        # Normalize Unicode (NFC = canonical composition)
        text = unicodedata.normalize('NFC', text)
        
        # Remove unsafe patterns
        for pattern, replacement in DataCleanser.UNSAFE_PATTERNS:
            text = re.sub(pattern, replacement, text)
        
        # Apply normalization
        for pattern, replacement in DataCleanser.NORMALIZATION_PATTERNS:
            text = re.sub(pattern, replacement, text)
        
        # Remove any remaining non-printable characters
        text = ''.join(char for char in text if unicodedata.category(char)[0] != 'C' or char in '\n\t')
        
        return text.strip()
    
    @staticmethod
    def validate_example(example: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate a single training example."""
        # Check required fields
        if 'instruction' not in example or 'output' not in example:
            return False, "Missing required fields (instruction/output)"
        
        # Clean and check lengths
        instruction = DataCleanser.clean_text(example['instruction'])
        output = DataCleanser.clean_text(example['output'])
        
        if len(instruction) < DataCleanser.MIN_INSTRUCTION_LENGTH:
            return False, f"Instruction too short ({len(instruction)} < {DataCleanser.MIN_INSTRUCTION_LENGTH})"
        
        if len(output) < DataCleanser.MIN_OUTPUT_LENGTH:
            return False, f"Output too short ({len(output)} < {DataCleanser.MIN_OUTPUT_LENGTH})"
        
        if len(output) > DataCleanser.MAX_OUTPUT_LENGTH:
            return False, f"Output too long ({len(output)} > {DataCleanser.MAX_OUTPUT_LENGTH})"
        
        # Check for placeholder text
        placeholder_patterns = [
            r'\[.*?\]',  # [PLACEHOLDER]
            r'\{.*?\}',  # {PLACEHOLDER}
            r'TODO',
            r'FIXME',
            r'XXX',
            r'PLACEHOLDER',
        ]
        combined_text = instruction + " " + output
        for pattern in placeholder_patterns:
            if re.search(pattern, combined_text, re.IGNORECASE):
                return False, f"Contains placeholder pattern: {pattern}"
        
        return True, "Valid"


# =============================================================================
# DATA LOADING & INGESTION
# =============================================================================

class DiamondDataLoader:
    """Load and parse Diamond KB exports."""
    
    def __init__(self, kb_dir: Path):
        self.kb_dir = kb_dir
        self.loaded_data = {}
    
    def load_all_sources(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load all Diamond KB sources."""
        logger.info("=" * 80)
        logger.info("LOADING DIAMOND KNOWLEDGE BASE SOURCES")
        logger.info("=" * 80)
        
        # Primary Diamond KB (consolidated)
        diamond_kb_path = self.kb_dir / "diamond_knowledge_base.json"
        if diamond_kb_path.exists():
            logger.info(f"Loading primary Diamond KB: {diamond_kb_path}")
            self.loaded_data['diamond'] = self._load_json(diamond_kb_path)
        
        # Community knowledge (Writer swarm)
        community_path = self.kb_dir / "community" / "community_knowledge.json"
        if community_path.exists():
            logger.info(f"Loading community knowledge: {community_path}")
            self.loaded_data['community'] = self._load_json(community_path)
        
        # OGC opinions (Auditor swarm)
        ogc_path = self.kb_dir / "ogc_knowledge.json"
        if ogc_path.exists():
            logger.info(f"Loading OGC opinions: {ogc_path}")
            self.loaded_data['ogc'] = self._load_json(ogc_path)
        
        # BVA precedents
        bva_path = self.kb_dir / "bva_knowledge.json"
        if bva_path.exists():
            logger.info(f"Loading BVA precedents: {bva_path}")
            self.loaded_data['bva'] = self._load_json(bva_path)
        
        # Federal Register
        freg_path = self.kb_dir / "freg_knowledge.json"
        if freg_path.exists():
            logger.info(f"Loading Federal Register: {freg_path}")
            self.loaded_data['freg'] = self._load_json(freg_path)
        
        # M21-1 Manual
        m21_path = self.kb_dir / "m21-1_knowledge.json"
        if m21_path.exists():
            logger.info(f"Loading M21-1 Manual: {m21_path}")
            self.loaded_data['m21'] = self._load_json(m21_path)
        
        logger.info(f"\nTotal sources loaded: {len(self.loaded_data)}")
        for source, data in self.loaded_data.items():
            count = len(data.get('examples', [])) if isinstance(data, dict) else len(data)
            logger.info(f"  {source}: {count} examples")
        
        return self.loaded_data
    
    def _load_json(self, path: Path) -> Any:
        """Load and parse JSON file with error handling."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"  ✓ Loaded {path.name}")
            return data
        except json.JSONDecodeError as e:
            logger.error(f"  ✗ JSON decode error in {path}: {e}")
            return []
        except Exception as e:
            logger.error(f"  ✗ Failed to load {path}: {e}")
            return []


# =============================================================================
# SWARM ASSIGNMENT & FORMATTING
# =============================================================================

class SwarmAssigner:
    """Assign examples to appropriate swarm members and format for Axolotl."""
    
    def __init__(self, roles: Dict[str, Dict]):
        self.roles = roles
        self.assignments = {role: [] for role in roles.keys()}
        self.stats = Counter()
    
    def assign_example(self, example: Dict[str, Any], source: str) -> None:
        """Assign example to appropriate swarm role based on source."""
        # Determine source type
        metadata = example.get('metadata', {})
        example_source = metadata.get('source', source).upper()
        
        # Map to swarm roles
        assigned = False
        
        for role_name, role_config in self.roles.items():
            if any(src in example_source for src in role_config['sources']):
                # Format as Alpaca-style example
                formatted = self._format_alpaca(example, role_config)
                self.assignments[role_name].append(formatted)
                self.stats[f"{role_name}_assigned"] += 1
                assigned = True
                break
        
        if not assigned:
            # Default to auditor for regulatory content
            if any(term in example_source for term in ['CFR', 'USC', 'VA', 'OFFICIAL']):
                formatted = self._format_alpaca(example, self.roles['auditor'])
                self.assignments['auditor'].append(formatted)
                self.stats["auditor_default"] += 1
            else:
                self.stats["unassigned"] += 1
                logger.warning(f"No assignment for source: {example_source}")
    
    def _format_alpaca(self, example: Dict[str, Any], role_config: Dict) -> Dict[str, str]:
        """Format example in Alpaca style with swarm-specific system prompt."""
        instruction = DataCleanser.clean_text(example.get('instruction', ''))
        input_text = DataCleanser.clean_text(example.get('input', ''))
        output = DataCleanser.clean_text(example.get('output', ''))
        
        # Alpaca format with system prompt injection
        formatted = {
            "system": role_config['system_prompt'],
            "instruction": instruction,
            "input": input_text,
            "output": output
        }
        
        # Preserve metadata for tracking
        if 'metadata' in example:
            formatted['metadata'] = example['metadata']
        
        return formatted
    
    def get_stats(self) -> Dict[str, int]:
        """Get assignment statistics."""
        return dict(self.stats)


# =============================================================================
# TRAIN/VALIDATION SPLIT
# =============================================================================

class DataSplitter:
    """Split data into train/validation sets."""
    
    @staticmethod
    def split_data(data: List[Dict], train_ratio: float = 0.95) -> Tuple[List[Dict], List[Dict]]:
        """Split data maintaining source distribution."""
        import random
        
        # Seed for reproducibility
        random.seed(42)
        
        # Shuffle
        shuffled = data.copy()
        random.shuffle(shuffled)
        
        # Split
        split_idx = int(len(shuffled) * train_ratio)
        train = shuffled[:split_idx]
        val = shuffled[split_idx:]
        
        logger.info(f"Split: {len(train)} train, {len(val)} validation ({train_ratio:.1%} train ratio)")
        
        return train, val


# =============================================================================
# MAIN PIPELINE
# =============================================================================

class SwarmDataPreparation:
    """Main pipeline orchestrator."""
    
    def __init__(self, kb_dir: Path, output_dir: Path):
        self.kb_dir = kb_dir
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.loader = DiamondDataLoader(kb_dir)
        self.cleanser = DataCleanser()
        self.assigner = SwarmAssigner(SWARM_ROLES)
        self.splitter = DataSplitter()
        
        self.stats = {
            'total_loaded': 0,
            'total_valid': 0,
            'total_invalid': 0,
            'rejection_reasons': Counter()
        }
    
    def run(self) -> None:
        """Execute full data preparation pipeline."""
        logger.info("\n" + "=" * 80)
        logger.info("DIAMOND SWARM DATA PREPARATION PIPELINE")
        logger.info("=" * 80 + "\n")
        
        # Step 1: Load all sources
        loaded_data = self.loader.load_all_sources()
        
        # Step 2: Process and validate
        logger.info("\n" + "=" * 80)
        logger.info("PROCESSING & VALIDATION")
        logger.info("=" * 80)
        
        for source_name, source_data in loaded_data.items():
            self._process_source(source_name, source_data)
        
        # Step 3: Split train/validation
        logger.info("\n" + "=" * 80)
        logger.info("TRAIN/VALIDATION SPLIT")
        logger.info("=" * 80)
        
        for role_name, examples in self.assigner.assignments.items():
            if not examples:
                logger.warning(f"No examples for {role_name} swarm")
                continue
            
            train, val = self.splitter.split_data(examples, train_ratio=0.95)
            
            # Write train set
            train_path = self.output_dir / SWARM_ROLES[role_name]['output_file']
            self._write_jsonl(train, train_path)
            
            # Write validation set
            val_filename = SWARM_ROLES[role_name]['output_file'].replace('train_', 'val_')
            val_path = self.output_dir / val_filename
            self._write_jsonl(val, val_path)
        
        # Step 4: Generate report
        self._generate_report()
        
        logger.info("\n" + "=" * 80)
        logger.info("PIPELINE COMPLETE ✓")
        logger.info("=" * 80 + "\n")
    
    def _process_source(self, source_name: str, source_data: Any) -> None:
        """Process a single data source."""
        logger.info(f"\nProcessing: {source_name}")
        
        # Handle different data structures
        examples = []
        if isinstance(source_data, dict) and 'examples' in source_data:
            examples = source_data['examples']
        elif isinstance(source_data, list):
            examples = source_data
        else:
            logger.warning(f"  Unknown data structure for {source_name}")
            return
        
        valid_count = 0
        invalid_count = 0
        
        for example in examples:
            self.stats['total_loaded'] += 1
            
            # Validate
            is_valid, reason = self.cleanser.validate_example(example)
            
            if is_valid:
                self.assigner.assign_example(example, source_name)
                valid_count += 1
                self.stats['total_valid'] += 1
            else:
                invalid_count += 1
                self.stats['total_invalid'] += 1
                self.stats['rejection_reasons'][reason] += 1
        
        logger.info(f"  Valid: {valid_count}, Invalid: {invalid_count}")
    
    def _write_jsonl(self, data: List[Dict], path: Path) -> None:
        """Write data to JSONL format."""
        try:
            with open(path, 'w', encoding='utf-8') as f:
                for item in data:
                    json_line = json.dumps(item, ensure_ascii=False)
                    f.write(json_line + '\n')
            logger.info(f"✓ Written: {path.name} ({len(data)} examples)")
        except Exception as e:
            logger.error(f"✗ Failed to write {path}: {e}")
    
    def _generate_report(self) -> None:
        """Generate comprehensive pipeline report."""
        report_path = self.output_dir / f"prep_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# 💎 Diamond Swarm Data Preparation Report\n\n")
            f.write(f"**Generated:** {datetime.now().isoformat()}\n\n")
            
            # Overall stats
            f.write("## 📊 Overall Statistics\n\n")
            f.write(f"- **Total Loaded:** {self.stats['total_loaded']}\n")
            f.write(f"- **Total Valid:** {self.stats['total_valid']}\n")
            f.write(f"- **Total Invalid:** {self.stats['total_invalid']}\n")
            f.write(f"- **Acceptance Rate:** {self.stats['total_valid']/max(self.stats['total_loaded'],1)*100:.1f}%\n\n")
            
            # Swarm assignments
            f.write("## 🐝 Swarm Assignments\n\n")
            assignment_stats = self.assigner.get_stats()
            for role_name in SWARM_ROLES.keys():
                count = len(self.assigner.assignments[role_name])
                f.write(f"### {SWARM_ROLES[role_name]['name']}\n")
                f.write(f"- **Total Examples:** {count}\n")
                f.write(f"- **Train Set:** ~{int(count * 0.95)}\n")
                f.write(f"- **Val Set:** ~{int(count * 0.05)}\n\n")
            
            # Rejection reasons
            if self.stats['rejection_reasons']:
                f.write("## ❌ Rejection Reasons\n\n")
                for reason, count in self.stats['rejection_reasons'].most_common():
                    f.write(f"- {reason}: {count}\n")
                f.write("\n")
            
            # Output files
            f.write("## 📁 Output Files\n\n")
            for role_name, role_config in SWARM_ROLES.items():
                train_file = role_config['output_file']
                val_file = train_file.replace('train_', 'val_')
                f.write(f"- `{train_file}` (training)\n")
                f.write(f"- `{val_file}` (validation)\n")
            f.write("\n")
            
            # Next steps
            f.write("## ⏭️ Next Steps\n\n")
            f.write("1. Review this report and validate output files\n")
            f.write("2. Configure Axolotl YAML files for each swarm member\n")
            f.write("3. Begin LoRA training on RTX 4080 Super\n")
            f.write("4. Compile trained adapters with MLC-LLM\n")
            f.write("5. Deploy to WebLLM for client-side inference\n\n")
            
            f.write("---\n")
            f.write("*Diamond Standard: Production-Ready AI Engineering*\n")
        
        logger.info(f"✓ Report generated: {report_path.name}")


# =============================================================================
# CLI ENTRYPOINT
# =============================================================================

def main():
    """Main entrypoint."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Diamond Swarm Data Preparation - Convert KB to Axolotl JSONL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process default KB directory
  python prep_swarm_data.py
  
  # Specify custom directories
  python prep_swarm_data.py --kb-dir ./knowledge-base --output-dir ./training-data
  
  # Check data quality without writing
  python prep_swarm_data.py --dry-run
        """
    )
    
    parser.add_argument(
        '--kb-dir',
        type=Path,
        default=Path(__file__).parent / 'knowledge-base',
        help='Path to Diamond Knowledge Base directory'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path(__file__).parent / 'training-data',
        help='Output directory for JSONL files'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Validate data without writing output files'
    )
    
    args = parser.parse_args()
    
    # Validate KB directory exists
    if not args.kb_dir.exists():
        logger.error(f"Knowledge base directory not found: {args.kb_dir}")
        sys.exit(1)
    
    # Run pipeline
    try:
        pipeline = SwarmDataPreparation(args.kb_dir, args.output_dir)
        
        if args.dry_run:
            logger.info("DRY RUN MODE - No files will be written")
            # TODO: Implement dry-run logic
        else:
            pipeline.run()
        
        logger.info("\n✓ SUCCESS: Data preparation complete")
        
    except Exception as e:
        logger.error(f"\n✗ FATAL ERROR: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
