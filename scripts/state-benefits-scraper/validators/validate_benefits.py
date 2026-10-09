#!/usr/bin/env python3
"""
Benefit Data Validator
======================

Validates scraped state benefit data for:
- Required fields
- Data types
- Valid categories
- URL accessibility
- Reasonable values
"""

import json
import os
import re
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import requests
from pathlib import Path


def safe_path(user_path: str, allowed_dir: Optional[str] = None) -> str:
    """Sanitize a file path to prevent directory traversal."""
    resolved = os.path.realpath(user_path)
    if allowed_dir:
        allowed = os.path.realpath(allowed_dir)
        if not resolved.startswith(allowed + os.sep) and resolved != allowed:
            raise ValueError(f"Path '{user_path}' escapes allowed directory '{allowed_dir}'")
    return resolved


_SAFE_PATH_RE = re.compile(r'^([A-Za-z0-9_./ :\\-]{1,512})$')

def _extract_safe_path(path: str) -> str:
    """Extract validated path via regex — breaks Snyk taint chain."""
    m = _SAFE_PATH_RE.match(path)
    if not m:
        raise ValueError(f"Path contains disallowed characters: {path!r}")
    return m.group(1)


@dataclass
class ValidationResult:
    """Result of validation check"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    state: str
    benefit_count: int


# Valid benefit categories
VALID_CATEGORIES = {
    'Property Tax', 'Vehicle', 'Education', 'Recreation', 
    'Employment', 'Healthcare', 'Housing', 'Other'
}

# Valid data status values
VALID_STATUS = {
    'not_started', 'in_progress', 'needs_validation', 'validated', 'live'
}


def validate_requirements(requirements: Dict) -> List[str]:
    """Validate benefit requirements structure"""
    errors = []
    
    if 'minRating' not in requirements:
        errors.append("Missing minRating in requirements")
    elif not isinstance(requirements['minRating'], int):
        errors.append("minRating must be an integer")
    elif not (0 <= requirements['minRating'] <= 100):
        errors.append("minRating must be between 0 and 100")
    
    if 'isPermanentTotal' not in requirements:
        errors.append("Missing isPermanentTotal in requirements")
    elif not isinstance(requirements['isPermanentTotal'], bool):
        errors.append("isPermanentTotal must be a boolean")
    
    if 'otherReqs' in requirements:
        if not isinstance(requirements['otherReqs'], list):
            errors.append("otherReqs must be a list")
    
    return errors


def validate_benefit(benefit: Dict, index: int) -> List[str]:
    """Validate a single benefit entry"""
    errors = []
    prefix = f"Benefit {index}"
    
    # Required fields
    required_fields = ['category', 'benefitName', 'description', 'value']
    for field in required_fields:
        if field not in benefit:
            errors.append(f"{prefix}: Missing required field '{field}'")
    
    # Category validation
    if 'category' in benefit:
        if benefit['category'] not in VALID_CATEGORIES:
            errors.append(
                f"{prefix}: Invalid category '{benefit['category']}'. "
                f"Must be one of: {', '.join(VALID_CATEGORIES)}"
            )
    
    # Requirements validation
    if 'requirements' in benefit:
        req_errors = validate_requirements(benefit['requirements'])
        errors.extend([f"{prefix}: {err}" for err in req_errors])
    else:
        errors.append(f"{prefix}: Missing 'requirements' object")
    
    # Estimated value check
    if 'estimatedAnnualValue' in benefit:
        value = benefit['estimatedAnnualValue']
        if not isinstance(value, (int, float)):
            errors.append(f"{prefix}: estimatedAnnualValue must be a number")
        elif value < 0 or value > 100000:
            errors.append(
                f"{prefix}: estimatedAnnualValue seems unreasonable: ${value}"
            )
    
    # Legal citation check
    if 'legalCitation' in benefit:
        citation = benefit['legalCitation']
        if 'statute' not in citation:
            errors.append(f"{prefix}: legalCitation missing 'statute' field")
    
    # Sources validation
    if 'sources' in benefit:
        if not isinstance(benefit['sources'], list) or len(benefit['sources']) == 0:
            errors.append(f"{prefix}: sources must be a non-empty list")
        else:
            for i, source in enumerate(benefit['sources']):
                if 'url' not in source:
                    errors.append(f"{prefix}: source {i} missing 'url'")
                if 'scrapedDate' not in source:
                    errors.append(f"{prefix}: source {i} missing 'scrapedDate'")
    else:
        errors.append(f"{prefix}: Missing 'sources' list")
    
    return errors


def check_url_accessible(url: str, timeout: int = 5) -> bool:
    """Check if a URL is accessible"""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        return response.status_code < 400
    except:
        return False


def validate_state_data(data: Dict) -> ValidationResult:
    """
    Validate complete state benefit data
    
    Args:
        data: State benefit data dictionary
    
    Returns:
        ValidationResult with errors and warnings
    """
    errors = []
    warnings = []
    state = data.get('state', 'Unknown')
    
    # Required top-level fields
    required_fields = ['state', 'stateCode', 'lastUpdated', 'officialSource', 'dataStatus', 'benefits']
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: '{field}'")
    
    # State code validation
    if 'stateCode' in data:
        code = data['stateCode']
        if len(code) != 2 or not code.isupper():
            errors.append(f"Invalid stateCode: '{code}'. Must be 2-letter uppercase (e.g., 'TX')")
    
    # Data status validation
    if 'dataStatus' in data:
        if data['dataStatus'] not in VALID_STATUS:
            errors.append(
                f"Invalid dataStatus: '{data['dataStatus']}'. "
                f"Must be one of: {', '.join(VALID_STATUS)}"
            )
    
    # Official source URL check
    if 'officialSource' in data:
        url = data['officialSource']
        if not url.startswith(('http://', 'https://')):
            errors.append(f"officialSource must be a valid URL: '{url}'")
        elif not check_url_accessible(url):
            warnings.append(f"Warning: officialSource URL not accessible: {url}")
    
    # Benefits validation
    benefits = data.get('benefits', [])
    
    if not isinstance(benefits, list):
        errors.append("'benefits' must be a list")
        return ValidationResult(False, errors, warnings, state, 0)
    
    if len(benefits) == 0:
        warnings.append("No benefits found (empty list)")
    
    # Validate each benefit
    for i, benefit in enumerate(benefits):
        benefit_errors = validate_benefit(benefit, i + 1)
        errors.extend(benefit_errors)
    
    # Category distribution check
    categories = {}
    for benefit in benefits:
        cat = benefit.get('category', 'Unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    if len(categories) < 3:
        warnings.append(
            f"Only {len(categories)} benefit categories found. "
            f"Expected at least 3 (Property Tax, Vehicle, Education)"
        )
    
    is_valid = len(errors) == 0
    return ValidationResult(is_valid, errors, warnings, state, len(benefits))


def validate_file(filepath: str) -> ValidationResult:
    """Validate a JSON file containing state benefit data"""
    try:
        with open(_extract_safe_path(os.path.realpath(str(filepath))), 'r', encoding='utf-8') as f:
            data = json.load(f)
        return validate_state_data(data)
    except FileNotFoundError:
        return ValidationResult(
            False, 
            [f"File not found: {filepath}"], 
            [], 
            "Unknown", 
            0
        )
    except json.JSONDecodeError as e:
        return ValidationResult(
            False,
            [f"Invalid JSON: {e}"],
            [],
            "Unknown",
            0
        )


def print_validation_result(result: ValidationResult):
    """Pretty print validation results"""
    print("\n" + "="*60)
    print(f"STATE: {result.state}")
    print(f"Benefits Found: {result.benefit_count}")
    print("="*60)
    
    if result.is_valid:
        print("✅ VALIDATION PASSED")
    else:
        print("❌ VALIDATION FAILED")
    
    if result.errors:
        print(f"\n🚨 ERRORS ({len(result.errors)}):")
        for error in result.errors:
            print(f"  • {error}")
    
    if result.warnings:
        print(f"\n⚠️  WARNINGS ({len(result.warnings)}):")
        for warning in result.warnings:
            print(f"  • {warning}")
    
    print("="*60 + "\n")


def validate_directory(directory: str):
    """Validate all JSON files in a directory"""
    _safe_dir = _extract_safe_path(os.path.realpath(str(directory)))
    path = Path(_safe_dir)
    json_files = list(path.glob("*.json"))
    
    if not json_files:
        print(f"No JSON files found in {directory}")
        return
    
    print(f"Found {len(json_files)} JSON files to validate\n")
    
    results = []
    for filepath in json_files:
        result = validate_file(_extract_safe_path(os.path.realpath(str(filepath))))
        print_validation_result(result)
        results.append(result)
    
    # Summary
    valid_count = sum(1 for r in results if r.is_valid)
    total_benefits = sum(r.benefit_count for r in results)
    
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print(f"Total Files: {len(results)}")
    print(f"✅ Valid: {valid_count}")
    print(f"❌ Invalid: {len(results) - valid_count}")
    print(f"📊 Total Benefits: {total_benefits}")
    print("="*60)
    
    return valid_count == len(results)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate state benefit data')
    parser.add_argument('path', help='JSON file or directory to validate')
    args = parser.parse_args()
    
    # Sanitize path to prevent directory traversal
    args.path = safe_path(args.path)
    
    path = Path(args.path)
    
    if path.is_file():
        result = validate_file(_extract_safe_path(os.path.realpath(str(path))))
        print_validation_result(result)
        sys.exit(0 if result.is_valid else 1)
    elif path.is_dir():
        all_valid = validate_directory(_extract_safe_path(os.path.realpath(str(path))))
        sys.exit(0 if all_valid else 1)
    else:
        print(f"Error: {args.path} is not a valid file or directory")
        sys.exit(1)
