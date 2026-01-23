#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  💎 DIAMOND STANDARD: LoRA Swarm Data Preparation v2.0                      ║
║══════════════════════════════════════════════════════════════════════════════║
║  Converts Diamond KB exports (CSV/JSON) to Axolotl-compatible JSONL         ║
║                                                                              ║
║  FEATURES:                                                                   ║
║  • Multi-format ingestion (JSON, JSONL, CSV)                                ║
║  • Dynamic system prompts per swarm role                                     ║
║  • Robust data cleansing & tokenizer-safe sanitization                       ║
║  • 95/5 train/validation split with stratification                          ║
║  • Comprehensive validation & rejection tracking                             ║
║  • Diamond-tier error handling (no silent failures)                         ║
║                                                                              ║
║  HARDWARE TARGET: RTX 4080 Super (16GB VRAM)                                ║
║  MODEL TARGET: Llama-3.2-3B-Instruct + LoRA Adapters                        ║
║  RUNTIME TARGET: WebLLM / MLC-LLM (Client-side browser)                     ║
║                                                                              ║
║  Author: Vet-Rate.org AI Engineering Team                                    ║
║  License: MIT                                                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import csv
import hashlib
import json
import logging
import os
import random
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Generator, Iterator, List, Optional, Set, Tuple, Union

# =============================================================================
# CONFIGURATION
# =============================================================================

# Logging configuration
LOG_FORMAT = '%(asctime)s │ %(levelname)-8s │ %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Random seed for reproducibility
RANDOM_SEED = 42

# Data quality thresholds
MIN_INSTRUCTION_LENGTH = 10      # Minimum chars for instruction field
MIN_OUTPUT_LENGTH = 50           # Minimum chars for output field  
MAX_OUTPUT_LENGTH = 8192         # Maximum chars (stay within 4096 token context)
MAX_TOTAL_LENGTH = 12000         # Max instruction + input + output combined

# Train/validation split ratio
TRAIN_RATIO = 0.95  # 95% train, 5% validation (maximize training with limited data)


# =============================================================================
# SWARM ROLE DEFINITIONS - Dynamic System Prompts
# =============================================================================

@dataclass
class SwarmRole:
    """Configuration for a LoRA swarm member."""
    name: str
    codename: str
    system_prompt: str
    sources: List[str]
    description: str
    output_prefix: str = "train"
    
    @property
    def train_file(self) -> str:
        return f"{self.output_prefix}_{self.codename}.jsonl"
    
    @property
    def val_file(self) -> str:
        return f"val_{self.codename}.jsonl"


# Define the three swarm roles with specialized system prompts
SWARM_ROLES: Dict[str, SwarmRole] = {
    "auditor": SwarmRole(
        name="VetRate-Auditor",
        codename="auditor",
        system_prompt=(
            "You are VetRate-Auditor. You strictly cite 38 CFR regulations. "
            "Do not hallucinate laws. You are an expert in VA disability law, "
            "38 CFR regulations, BVA precedent decisions, and OGC opinions. "
            "Always provide exact CFR section numbers (e.g., 38 CFR Section 4.71a). "
            "Cite specific BVA case names and docket numbers when relevant. "
            "If you are uncertain about a regulation, say so explicitly. "
            "Never fabricate legal citations or regulatory language."
        ),
        sources=["38CFR", "CFR", "OGC", "BVA", "FREG", "M21-1", "M21_1", "PACT_ACT", 
                 "CAVC", "FEDERAL_REGISTER", "USC", "OFFICIAL"],
        description="Legal/regulatory expert - cites 38 CFR, BVA, OGC"
    ),
    "writer": SwarmRole(
        name="VetRate-Writer",
        codename="writer",
        system_prompt=(
            "You are VetRate-Writer. Write in a persuasive, empathetic, "
            "veteran-centric tone. You help veterans articulate their service-connected "
            "disabilities clearly and compellingly for VA claims. Focus on the human "
            "impact of conditions while maintaining factual accuracy. Use clear, "
            "accessible language. Never exaggerate symptoms, but advocate strongly "
            "for veteran rights and fair ratings. Help veterans tell their story effectively."
        ),
        sources=["COMMUNITY", "COMMUNITY_PROVIDED", "COMMUNITY_LETTERS", "SECONDARY", 
                 "NEXUS", "PERSONAL_STATEMENT", "LAY_STATEMENT", "BUDDY_LETTER"],
        description="Empathetic advocate - veteran-centric persuasive writing"
    ),
    "rater": SwarmRole(
        name="VetRate-Rater",
        codename="rater",
        system_prompt=(
            "You are VetRate-Rater. You are an expert in VA disability rating calculations "
            "and assessment criteria. You accurately calculate combined disability ratings "
            "using VA's bilateral factor and whole-person formula. You assess conditions "
            "against specific diagnostic codes and rating schedules in 38 CFR Part 4. "
            "Provide step-by-step mathematical reasoning for all calculations. "
            "Explain which diagnostic codes apply and why."
        ),
        sources=["RATING", "CALCULATOR", "DIAGNOSTIC_CODE", "DC_", "COMBINED"],
        description="Rating specialist - calculations and diagnostic codes"
    )
}


# =============================================================================
# DATA CLEANSING & VALIDATION
# =============================================================================

class DataCleanser:
    """
    Robust text cleansing for LLM training data.
    Ensures tokenizer compatibility and data quality.
    """
    
    # Characters that can break tokenizers or cause training issues
    UNSAFE_PATTERNS: List[Tuple[str, str]] = [
        (r'\x00', ''),                    # Null bytes (critical)
        (r'[\x01-\x08\x0b\x0c\x0e-\x1f]', ''),  # Control chars (keep \n\r\t)
        (r'\x7f', ''),                    # DEL character
        (r'\ufffd', ''),                  # Unicode replacement character
        (r'\ufffe', ''),                  # Non-character
        (r'\uffff', ''),                  # Non-character
        (r'[\u200b-\u200f]', ''),         # Zero-width characters
        (r'[\u202a-\u202e]', ''),         # Bidirectional control
        (r'[\u2060-\u206f]', ''),         # Word joiner, invisible separator
        (r'\ufeff', ''),                  # BOM / ZWNBSP
    ]
    
    # Text normalization patterns
    NORMALIZATION_PATTERNS: List[Tuple[str, str]] = [
        (r'\r\n', '\n'),           # Windows -> Unix line endings
        (r'\r', '\n'),             # Old Mac -> Unix line endings
        (r'\n{4,}', '\n\n\n'),     # Limit consecutive newlines to 3
        (r'[ \t]{3,}', '  '),      # Limit consecutive spaces to 2
        (r'^\s+', '', re.MULTILINE),  # Leading whitespace per line
        (r'\s+$', '', re.MULTILINE),  # Trailing whitespace per line
    ]
    
    # Patterns indicating placeholder/incomplete content
    PLACEHOLDER_PATTERNS: List[str] = [
        r'\[TODO\]',
        r'\[FIXME\]',
        r'\[PLACEHOLDER\]',
        r'\[INSERT.*?\]',
        r'\[YOUR.*?\]',
        r'\[EXAMPLE\]',
        r'XXX+',
        r'PLACEHOLDER',
        r'Lorem ipsum',
    ]
    
    @classmethod
    def clean_text(cls, text: str) -> str:
        """
        Apply comprehensive text cleansing.
        
        Args:
            text: Raw input text
            
        Returns:
            Cleaned, tokenizer-safe text
        """
        if not text:
            return ""
        
        # Ensure string type
        text = str(text)
        
        # Normalize Unicode to NFC (canonical composition)
        text = unicodedata.normalize('NFC', text)
        
        # Remove unsafe patterns
        for pattern, replacement in cls.UNSAFE_PATTERNS:
            text = re.sub(pattern, replacement, text)
        
        # Apply normalization patterns
        for pattern, replacement, *flags in cls.NORMALIZATION_PATTERNS:
            flag = flags[0] if flags else 0
            text = re.sub(pattern, replacement, text, flags=flag)
        
        # Remove remaining non-printable characters (except whitespace)
        text = ''.join(
            char for char in text 
            if unicodedata.category(char)[0] != 'C' or char in '\n\t '
        )
        
        return text.strip()
    
    @classmethod
    def has_placeholders(cls, text: str) -> Tuple[bool, Optional[str]]:
        """Check if text contains placeholder patterns."""
        for pattern in cls.PLACEHOLDER_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                return True, pattern
        return False, None
    
    @classmethod
    def compute_hash(cls, text: str) -> str:
        """Compute content hash for deduplication."""
        return hashlib.md5(text.encode('utf-8')).hexdigest()[:12]


@dataclass
class ValidationResult:
    """Result of validating a training example."""
    is_valid: bool
    reason: str
    cleaned_example: Optional[Dict[str, Any]] = None
    warnings: List[str] = field(default_factory=list)


class ExampleValidator:
    """Validates training examples against quality standards."""
    
    def __init__(
        self,
        min_instruction_len: int = MIN_INSTRUCTION_LENGTH,
        min_output_len: int = MIN_OUTPUT_LENGTH,
        max_output_len: int = MAX_OUTPUT_LENGTH,
        max_total_len: int = MAX_TOTAL_LENGTH
    ):
        self.min_instruction_len = min_instruction_len
        self.min_output_len = min_output_len
        self.max_output_len = max_output_len
        self.max_total_len = max_total_len
        self.seen_hashes: Set[str] = set()
    
    def validate(self, example: Dict[str, Any]) -> ValidationResult:
        """
        Validate a single training example.
        
        Args:
            example: Dictionary with instruction, input, output fields
            
        Returns:
            ValidationResult with status, reason, and cleaned example
        """
        warnings = []
        
        # Check required fields exist
        if 'instruction' not in example:
            return ValidationResult(False, "Missing 'instruction' field")
        if 'output' not in example:
            return ValidationResult(False, "Missing 'output' field")
        
        # Clean text fields
        instruction = DataCleanser.clean_text(example.get('instruction', ''))
        input_text = DataCleanser.clean_text(example.get('input', ''))
        output = DataCleanser.clean_text(example.get('output', ''))
        
        # Length validations
        if len(instruction) < self.min_instruction_len:
            return ValidationResult(
                False, 
                f"Instruction too short: {len(instruction)} < {self.min_instruction_len}"
            )
        
        if len(output) < self.min_output_len:
            return ValidationResult(
                False,
                f"Output too short: {len(output)} < {self.min_output_len}"
            )
        
        if len(output) > self.max_output_len:
            # Truncate with warning instead of rejecting
            output = output[:self.max_output_len - 3] + "..."
            warnings.append(f"Output truncated from {len(example['output'])} chars")
        
        # Total length check
        total_len = len(instruction) + len(input_text) + len(output)
        if total_len > self.max_total_len:
            return ValidationResult(
                False,
                f"Total length too long: {total_len} > {self.max_total_len}"
            )
        
        # Placeholder check
        combined = instruction + " " + output
        has_placeholder, pattern = DataCleanser.has_placeholders(combined)
        if has_placeholder:
            return ValidationResult(False, f"Contains placeholder: {pattern}")
        
        # Deduplication
        content_hash = DataCleanser.compute_hash(instruction + output)
        if content_hash in self.seen_hashes:
            return ValidationResult(False, "Duplicate content")
        self.seen_hashes.add(content_hash)
        
        # Build cleaned example
        cleaned = {
            'instruction': instruction,
            'input': input_text,
            'output': output
        }
        
        # Preserve metadata if present
        if 'metadata' in example:
            cleaned['metadata'] = example['metadata']
        
        return ValidationResult(
            is_valid=True,
            reason="Valid",
            cleaned_example=cleaned,
            warnings=warnings
        )


# =============================================================================
# DATA LOADING - Multi-Format Support
# =============================================================================

class MultiFormatLoader:
    """Load training data from JSON, JSONL, and CSV files."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.stats = Counter()
    
    def load_file(self, path: Path) -> List[Dict[str, Any]]:
        """
        Load data from a file, auto-detecting format.
        
        Args:
            path: Path to data file
            
        Returns:
            List of example dictionaries
        """
        if not path.exists():
            self.logger.warning(f"File not found: {path}")
            return []
        
        suffix = path.suffix.lower()
        
        try:
            if suffix == '.json':
                return self._load_json(path)
            elif suffix == '.jsonl':
                return self._load_jsonl(path)
            elif suffix == '.csv':
                return self._load_csv(path)
            else:
                self.logger.warning(f"Unknown file format: {suffix} for {path}")
                return []
        except Exception as e:
            self.logger.error(f"Failed to load {path}: {e}")
            self.stats['load_errors'] += 1
            return []
    
    def _load_json(self, path: Path) -> List[Dict[str, Any]]:
        """Load JSON file (single object or array)."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(data, list):
            examples = data
        elif isinstance(data, dict):
            # Check for 'examples' key (common in KB exports)
            if 'examples' in data:
                examples = data['examples']
            else:
                # Single example as dict
                examples = [data]
        else:
            self.logger.warning(f"Unexpected JSON structure in {path}")
            return []
        
        self.logger.info(f"  ✓ Loaded JSON: {path.name} ({len(examples)} examples)")
        self.stats['json_loaded'] += len(examples)
        return examples
    
    def _load_jsonl(self, path: Path) -> List[Dict[str, Any]]:
        """Load JSONL file (one JSON object per line)."""
        examples = []
        line_num = 0
        
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line_num += 1
                line = line.strip()
                if not line:
                    continue
                try:
                    examples.append(json.loads(line))
                except json.JSONDecodeError as e:
                    self.logger.warning(f"Invalid JSON at {path}:{line_num}: {e}")
                    self.stats['jsonl_parse_errors'] += 1
        
        self.logger.info(f"  ✓ Loaded JSONL: {path.name} ({len(examples)} examples)")
        self.stats['jsonl_loaded'] += len(examples)
        return examples
    
    def _load_csv(self, path: Path) -> List[Dict[str, Any]]:
        """
        Load CSV file with automatic column mapping.
        
        Expected columns (flexible naming):
        - instruction/question/prompt -> instruction
        - input/context -> input
        - output/answer/response -> output
        - source/type -> metadata.source
        """
        examples = []
        
        # Column name mappings (flexible)
        INSTRUCTION_COLS = ['instruction', 'question', 'prompt', 'query', 'task']
        INPUT_COLS = ['input', 'context', 'additional_context', 'extra']
        OUTPUT_COLS = ['output', 'answer', 'response', 'completion', 'text']
        SOURCE_COLS = ['source', 'type', 'category', 'origin']
        
        def find_column(headers: List[str], candidates: List[str]) -> Optional[str]:
            """Find first matching column name."""
            headers_lower = [h.lower().strip() for h in headers]
            for candidate in candidates:
                if candidate.lower() in headers_lower:
                    idx = headers_lower.index(candidate.lower())
                    return headers[idx]
            return None
        
        with open(path, 'r', encoding='utf-8', newline='') as f:
            # Detect delimiter
            sample = f.read(4096)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',\t|;')
            except csv.Error:
                dialect = csv.excel
            
            reader = csv.DictReader(f, dialect=dialect)
            headers = reader.fieldnames or []
            
            # Map columns
            instruction_col = find_column(headers, INSTRUCTION_COLS)
            input_col = find_column(headers, INPUT_COLS)
            output_col = find_column(headers, OUTPUT_COLS)
            source_col = find_column(headers, SOURCE_COLS)
            
            if not instruction_col or not output_col:
                self.logger.error(
                    f"CSV {path} missing required columns. "
                    f"Found: {headers}. Need instruction + output columns."
                )
                return []
            
            for row in reader:
                example = {
                    'instruction': row.get(instruction_col, ''),
                    'input': row.get(input_col, '') if input_col else '',
                    'output': row.get(output_col, '')
                }
                
                # Add source to metadata if present
                if source_col and row.get(source_col):
                    example['metadata'] = {'source': row[source_col]}
                
                examples.append(example)
        
        self.logger.info(f"  ✓ Loaded CSV: {path.name} ({len(examples)} examples)")
        self.stats['csv_loaded'] += len(examples)
        return examples
    
    def load_directory(self, dir_path: Path, recursive: bool = True) -> List[Dict[str, Any]]:
        """
        Load all data files from a directory.
        
        Args:
            dir_path: Directory to scan
            recursive: Whether to scan subdirectories
            
        Returns:
            Combined list of all examples
        """
        all_examples = []
        patterns = ['*.json', '*.jsonl', '*.csv']
        
        for pattern in patterns:
            if recursive:
                files = list(dir_path.rglob(pattern))
            else:
                files = list(dir_path.glob(pattern))
            
            for file_path in sorted(files):
                # Skip backup/archive files
                if any(skip in str(file_path) for skip in ['backup', 'archive', 'old', '.bak']):
                    continue
                examples = self.load_file(file_path)
                all_examples.extend(examples)
        
        return all_examples


# =============================================================================
# SWARM ASSIGNMENT
# =============================================================================

class SwarmAssigner:
    """Assigns examples to appropriate swarm roles based on source metadata."""
    
    def __init__(self, roles: Dict[str, SwarmRole], logger: logging.Logger):
        self.roles = roles
        self.logger = logger
        self.assignments: Dict[str, List[Dict[str, Any]]] = {
            role_name: [] for role_name in roles
        }
        self.stats = Counter()
    
    def determine_role(self, example: Dict[str, Any]) -> Optional[str]:
        """
        Determine which swarm role an example belongs to.
        
        Args:
            example: Training example with optional metadata
            
        Returns:
            Role name ('auditor', 'writer', 'rater') or None
        """
        # Extract source from metadata
        metadata = example.get('metadata', {})
        source = metadata.get('source', '').upper()
        source_type = metadata.get('type', '').upper()
        
        # Combine for matching
        combined_source = f"{source}_{source_type}"
        
        # Check each role's source patterns
        for role_name, role in self.roles.items():
            for source_pattern in role.sources:
                if source_pattern.upper() in combined_source:
                    return role_name
        
        # Fallback heuristics based on content
        instruction = example.get('instruction', '').lower()
        output = example.get('output', '').lower()
        
        # Regulatory content -> Auditor
        if any(term in instruction + output for term in ['38 cfr', '§', 'regulation', 'bva', 'ogc']):
            return 'auditor'
        
        # Personal/letter content -> Writer
        if any(term in instruction + output for term in ['statement', 'letter', 'personal', 'buddy']):
            return 'writer'
        
        # Rating/calculation content -> Rater
        if any(term in instruction + output for term in ['rating', 'calculate', 'combined', 'diagnostic code']):
            return 'rater'
        
        # Default to auditor for unclassified
        return 'auditor'
    
    def assign(self, example: Dict[str, Any], role_name: str) -> Dict[str, Any]:
        """
        Format example with role-specific system prompt and assign.
        
        Args:
            example: Validated, cleaned example
            role_name: Target swarm role
            
        Returns:
            Formatted example with system prompt
        """
        role = self.roles[role_name]
        
        # Build Alpaca-format example with system prompt
        formatted = {
            'system': role.system_prompt,
            'instruction': example['instruction'],
            'input': example.get('input', ''),
            'output': example['output']
        }
        
        # Preserve metadata for debugging/tracking
        if 'metadata' in example:
            formatted['metadata'] = example['metadata']
        
        self.assignments[role_name].append(formatted)
        self.stats[f'{role_name}_assigned'] += 1
        
        return formatted
    
    def process_example(self, example: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Determine role and assign example.
        
        Returns:
            Formatted example or None if assignment failed
        """
        role_name = self.determine_role(example)
        if role_name:
            return self.assign(example, role_name)
        
        self.stats['unassigned'] += 1
        return None


# =============================================================================
# TRAIN/VALIDATION SPLIT
# =============================================================================

class StratifiedSplitter:
    """Split data into train/validation with optional stratification."""
    
    def __init__(self, train_ratio: float = TRAIN_RATIO, seed: int = RANDOM_SEED):
        self.train_ratio = train_ratio
        self.seed = seed
    
    def split(
        self, 
        data: List[Dict[str, Any]], 
        stratify_key: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Split data into train and validation sets.
        
        Args:
            data: List of examples to split
            stratify_key: Optional metadata key for stratified split
            
        Returns:
            (train_data, val_data) tuple
        """
        random.seed(self.seed)
        
        if not data:
            return [], []
        
        if stratify_key:
            return self._stratified_split(data, stratify_key)
        else:
            return self._random_split(data)
    
    def _random_split(
        self, 
        data: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Simple random split."""
        shuffled = data.copy()
        random.shuffle(shuffled)
        
        split_idx = int(len(shuffled) * self.train_ratio)
        return shuffled[:split_idx], shuffled[split_idx:]
    
    def _stratified_split(
        self, 
        data: List[Dict[str, Any]], 
        stratify_key: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Split maintaining distribution of stratify_key."""
        # Group by stratify key
        groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for example in data:
            key = example.get('metadata', {}).get(stratify_key, 'unknown')
            groups[key].append(example)
        
        train_data = []
        val_data = []
        
        # Split each group proportionally
        for group_examples in groups.values():
            random.shuffle(group_examples)
            split_idx = max(1, int(len(group_examples) * self.train_ratio))
            train_data.extend(group_examples[:split_idx])
            val_data.extend(group_examples[split_idx:])
        
        # Final shuffle
        random.shuffle(train_data)
        random.shuffle(val_data)
        
        return train_data, val_data


# =============================================================================
# OUTPUT WRITER
# =============================================================================

class JSONLWriter:
    """Write training data to JSONL format."""
    
    @staticmethod
    def write(data: List[Dict[str, Any]], path: Path, include_metadata: bool = False) -> int:
        """
        Write examples to JSONL file.
        
        Args:
            data: List of examples
            path: Output file path
            include_metadata: Whether to include metadata in output
            
        Returns:
            Number of examples written
        """
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            for example in data:
                # Optionally strip metadata for training
                if not include_metadata and 'metadata' in example:
                    output_example = {k: v for k, v in example.items() if k != 'metadata'}
                else:
                    output_example = example
                
                f.write(json.dumps(output_example, ensure_ascii=False) + '\n')
        
        return len(data)


# =============================================================================
# MAIN PIPELINE
# =============================================================================

class SwarmDataPipeline:
    """
    Main orchestrator for the Diamond data preparation pipeline.
    """
    
    def __init__(
        self,
        kb_dir: Path,
        output_dir: Path,
        roles: Dict[str, SwarmRole] = SWARM_ROLES,
        train_ratio: float = TRAIN_RATIO,
        include_metadata: bool = True,
        verbose: bool = True
    ):
        self.kb_dir = kb_dir
        self.output_dir = output_dir
        self.roles = roles
        self.train_ratio = train_ratio
        self.include_metadata = include_metadata
        
        # Setup logging
        self._setup_logging(verbose)
        
        # Initialize components
        self.loader = MultiFormatLoader(self.logger)
        self.validator = ExampleValidator()
        self.assigner = SwarmAssigner(roles, self.logger)
        self.splitter = StratifiedSplitter(train_ratio)
        
        # Statistics
        self.stats = {
            'total_loaded': 0,
            'total_valid': 0,
            'total_invalid': 0,
            'rejection_reasons': Counter(),
            'role_counts': Counter(),
            'source_counts': Counter(),
            'warnings': []
        }
    
    def _setup_logging(self, verbose: bool) -> None:
        """Configure logging to file and console."""
        self.logger = logging.getLogger('SwarmDataPipeline')
        self.logger.setLevel(logging.DEBUG if verbose else logging.INFO)
        
        # Clear existing handlers
        self.logger.handlers = []
        
        # Console handler
        console = logging.StreamHandler(sys.stdout)
        console.setLevel(logging.INFO)
        console.setFormatter(logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT))
        self.logger.addHandler(console)
        
        # File handler
        log_file = Path(__file__).parent / f'prep_swarm_data_{datetime.now():%Y%m%d_%H%M%S}.log'
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT, LOG_DATE_FORMAT))
        self.logger.addHandler(file_handler)
    
    def run(self) -> Dict[str, Any]:
        """
        Execute the full data preparation pipeline.
        
        Returns:
            Dictionary of statistics and results
        """
        self.logger.info("=" * 80)
        self.logger.info("💎 DIAMOND SWARM DATA PREPARATION PIPELINE v2.0")
        self.logger.info("=" * 80)
        self.logger.info(f"Knowledge Base: {self.kb_dir}")
        self.logger.info(f"Output Dir: {self.output_dir}")
        self.logger.info(f"Train/Val Split: {self.train_ratio:.0%}/{1-self.train_ratio:.0%}")
        self.logger.info("")
        
        # Step 1: Load all data
        self.logger.info("─" * 40)
        self.logger.info("STEP 1: Loading Data Sources")
        self.logger.info("─" * 40)
        
        all_examples = self._load_all_sources()
        self.stats['total_loaded'] = len(all_examples)
        self.logger.info(f"\n✓ Total examples loaded: {len(all_examples)}")
        
        # Step 2: Validate and clean
        self.logger.info("")
        self.logger.info("─" * 40)
        self.logger.info("STEP 2: Validation & Cleansing")
        self.logger.info("─" * 40)
        
        valid_examples = self._validate_all(all_examples)
        self.logger.info(f"\n✓ Valid examples: {len(valid_examples)} / {len(all_examples)}")
        
        # Step 3: Assign to swarm roles
        self.logger.info("")
        self.logger.info("─" * 40)
        self.logger.info("STEP 3: Swarm Role Assignment")
        self.logger.info("─" * 40)
        
        self._assign_all(valid_examples)
        
        for role_name, examples in self.assigner.assignments.items():
            self.logger.info(f"  {self.roles[role_name].name}: {len(examples)} examples")
            self.stats['role_counts'][role_name] = len(examples)
        
        # Step 4: Split train/validation
        self.logger.info("")
        self.logger.info("─" * 40)
        self.logger.info("STEP 4: Train/Validation Split")
        self.logger.info("─" * 40)
        
        output_files = self._split_and_write()
        
        # Step 5: Generate report
        self.logger.info("")
        self.logger.info("─" * 40)
        self.logger.info("STEP 5: Generate Report")
        self.logger.info("─" * 40)
        
        report_path = self._generate_report(output_files)
        
        # Summary
        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("✅ PIPELINE COMPLETE")
        self.logger.info("=" * 80)
        self.logger.info(f"Report: {report_path}")
        self.logger.info(f"Output files in: {self.output_dir}")
        
        return {
            'stats': self.stats,
            'output_files': output_files,
            'report_path': report_path
        }
    
    def _load_all_sources(self) -> List[Dict[str, Any]]:
        """Load data from all configured sources."""
        all_examples = []
        
        # Load from knowledge-base directory
        if self.kb_dir.exists():
            examples = self.loader.load_directory(self.kb_dir)
            all_examples.extend(examples)
        
        return all_examples
    
    def _validate_all(self, examples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate all examples and track rejection reasons."""
        valid = []
        
        for example in examples:
            result = self.validator.validate(example)
            
            if result.is_valid:
                valid.append(result.cleaned_example)
                self.stats['total_valid'] += 1
                
                # Track source distribution
                source = example.get('metadata', {}).get('source', 'unknown')
                self.stats['source_counts'][source] += 1
                
                # Track warnings
                self.stats['warnings'].extend(result.warnings)
            else:
                self.stats['total_invalid'] += 1
                self.stats['rejection_reasons'][result.reason] += 1
        
        return valid
    
    def _assign_all(self, examples: List[Dict[str, Any]]) -> None:
        """Assign all validated examples to swarm roles."""
        for example in examples:
            self.assigner.process_example(example)
    
    def _split_and_write(self) -> Dict[str, Path]:
        """Split each role's data and write to files."""
        output_files = {}
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        for role_name, role in self.roles.items():
            examples = self.assigner.assignments[role_name]
            
            if not examples:
                self.logger.warning(f"  ⚠ No examples for {role.name}")
                continue
            
            # Split
            train_data, val_data = self.splitter.split(examples)
            
            # Write train file
            train_path = self.output_dir / role.train_file
            train_count = JSONLWriter.write(train_data, train_path, self.include_metadata)
            output_files[f'{role_name}_train'] = train_path
            self.logger.info(f"  ✓ {role.name} train: {train_count} → {train_path.name}")
            
            # Write validation file
            val_path = self.output_dir / role.val_file
            val_count = JSONLWriter.write(val_data, val_path, self.include_metadata)
            output_files[f'{role_name}_val'] = val_path
            self.logger.info(f"  ✓ {role.name} val: {val_count} → {val_path.name}")
        
        return output_files
    
    def _generate_report(self, output_files: Dict[str, Path]) -> Path:
        """Generate comprehensive pipeline report."""
        report_path = self.output_dir / f'prep_report_{datetime.now():%Y%m%d_%H%M%S}.md'
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# 💎 Diamond Swarm Data Preparation Report\n\n")
            f.write(f"**Generated:** {datetime.now().isoformat()}\n")
            f.write(f"**Pipeline Version:** 2.0\n\n")
            
            # Summary stats
            f.write("## 📊 Summary Statistics\n\n")
            f.write("| Metric | Value |\n")
            f.write("|--------|-------|\n")
            f.write(f"| Total Loaded | {self.stats['total_loaded']:,} |\n")
            f.write(f"| Total Valid | {self.stats['total_valid']:,} |\n")
            f.write(f"| Total Invalid | {self.stats['total_invalid']:,} |\n")
            acceptance = self.stats['total_valid'] / max(self.stats['total_loaded'], 1) * 100
            f.write(f"| Acceptance Rate | {acceptance:.1f}% |\n")
            f.write(f"| Train Ratio | {self.train_ratio:.0%} |\n\n")
            
            # Swarm assignments
            f.write("## 🐝 Swarm Role Assignments\n\n")
            for role_name, role in self.roles.items():
                count = self.stats['role_counts'].get(role_name, 0)
                train_count = int(count * self.train_ratio)
                val_count = count - train_count
                f.write(f"### {role.name}\n")
                f.write(f"- **Description:** {role.description}\n")
                f.write(f"- **Total Examples:** {count:,}\n")
                f.write(f"- **Train Set:** {train_count:,}\n")
                f.write(f"- **Validation Set:** {val_count:,}\n\n")
                f.write("**System Prompt:**\n")
                f.write(f"```\n{role.system_prompt}\n```\n\n")
            
            # Source distribution
            f.write("## 📁 Source Distribution\n\n")
            f.write("| Source | Count |\n")
            f.write("|--------|-------|\n")
            for source, count in self.stats['source_counts'].most_common():
                f.write(f"| {source} | {count:,} |\n")
            f.write("\n")
            
            # Rejection reasons
            if self.stats['rejection_reasons']:
                f.write("## ❌ Rejection Reasons\n\n")
                f.write("| Reason | Count |\n")
                f.write("|--------|-------|\n")
                for reason, count in self.stats['rejection_reasons'].most_common():
                    f.write(f"| {reason} | {count:,} |\n")
                f.write("\n")
            
            # Output files
            f.write("## 📦 Output Files\n\n")
            for name, path in output_files.items():
                size_kb = path.stat().st_size / 1024
                f.write(f"- `{path.name}` ({size_kb:.1f} KB)\n")
            f.write("\n")
            
            # Next steps
            f.write("## ⏭️ Next Steps\n\n")
            f.write("1. **Review** this report and validate data quality\n")
            f.write("2. **Configure** Axolotl YAML for each swarm role\n")
            f.write("3. **Train** LoRA adapters on RTX 4080 Super (16GB)\n")
            f.write("4. **Merge** trained adapters with base model\n")
            f.write("5. **Compile** with MLC-LLM for WebLLM deployment\n\n")
            
            f.write("---\n")
            f.write("*💎 Diamond Standard: Production-Ready AI Engineering*\n")
        
        self.logger.info(f"  ✓ Report: {report_path.name}")
        return report_path


# =============================================================================
# CLI ENTRYPOINT
# =============================================================================

def main():
    """Command-line interface for the data preparation pipeline."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="💎 Diamond Swarm Data Preparation - Convert KB to Axolotl JSONL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Default: process knowledge-base/ → training-data/
  python prep_swarm_data_v2.py
  
  # Custom directories
  python prep_swarm_data_v2.py --kb-dir ./my-kb --output-dir ./my-training
  
  # Custom train/val ratio
  python prep_swarm_data_v2.py --train-ratio 0.90
  
  # Strip metadata from output (smaller files)
  python prep_swarm_data_v2.py --no-metadata

Swarm Roles:
  • VetRate-Auditor: Legal/regulatory citations (38 CFR, BVA, OGC)
  • VetRate-Writer:  Empathetic veteran advocacy writing
  • VetRate-Rater:   Rating calculations and diagnostic codes
        """
    )
    
    parser.add_argument(
        '--kb-dir',
        type=Path,
        default=Path(__file__).parent / 'knowledge-base',
        help='Path to Diamond Knowledge Base directory (default: ./knowledge-base)'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path(__file__).parent / 'training-data',
        help='Output directory for JSONL files (default: ./training-data)'
    )
    
    parser.add_argument(
        '--train-ratio',
        type=float,
        default=TRAIN_RATIO,
        help=f'Train/validation split ratio (default: {TRAIN_RATIO})'
    )
    
    parser.add_argument(
        '--no-metadata',
        action='store_true',
        help='Exclude metadata from output JSONL files'
    )
    
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Reduce output verbosity'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    if not args.kb_dir.exists():
        print(f"❌ ERROR: Knowledge base directory not found: {args.kb_dir}")
        sys.exit(1)
    
    if not 0.5 <= args.train_ratio <= 0.99:
        print(f"❌ ERROR: Train ratio must be between 0.5 and 0.99")
        sys.exit(1)
    
    # Run pipeline
    try:
        pipeline = SwarmDataPipeline(
            kb_dir=args.kb_dir,
            output_dir=args.output_dir,
            train_ratio=args.train_ratio,
            include_metadata=not args.no_metadata,
            verbose=not args.quiet
        )
        
        results = pipeline.run()
        
        # Exit code based on success
        if results['stats']['total_valid'] > 0:
            sys.exit(0)
        else:
            print("⚠️ WARNING: No valid examples produced")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
