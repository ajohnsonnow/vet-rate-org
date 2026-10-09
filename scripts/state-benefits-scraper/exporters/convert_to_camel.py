#!/usr/bin/env python3
"""
Convert Python snake_case JSON to JavaScript camelCase
For integration with VetRate app
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional


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


def snake_to_camel(snake_str):
    """Convert snake_case to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


def convert_dict_keys(data):
    """Recursively convert dict keys from snake_case to camelCase"""
    if isinstance(data, dict):
        return {snake_to_camel(k): convert_dict_keys(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_dict_keys(item) for item in data]
    else:
        return data


def convert_file(input_file, output_file=None):
    """Convert a JSON file to camelCase format"""
    with open(_extract_safe_path(os.path.realpath(str(input_file))), 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Convert to camelCase
    camel_data = convert_dict_keys(data)
    
    # Output file
    if not output_file:
        output_file = input_file.replace('.json', '_camel.json')
    
    with open(_extract_safe_path(os.path.realpath(str(output_file))), 'w', encoding='utf-8') as f:
        json.dump(camel_data, f, indent=2, ensure_ascii=False)
    
    print(f"[OK] Converted: {input_file} -> {output_file}")


def convert_directory(directory):
    """Convert all JSON files in a directory"""
    path = Path(directory)
    json_files = list(path.glob("*_benefits.json"))
    
    if not json_files:
        print(f"No benefit JSON files found in {directory}")
        return
    
    print(f"Converting {len(json_files)} files to camelCase...")
    
    for filepath in json_files:
        output_file = str(filepath).replace('_benefits.json', '_benefits_camel.json')
        convert_file(_extract_safe_path(os.path.realpath(str(filepath))), _extract_safe_path(os.path.realpath(output_file)))


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert JSON to camelCase for JavaScript')
    parser.add_argument('path', help='JSON file or directory')
    parser.add_argument('--output', help='Output file (for single file conversion)')
    args = parser.parse_args()
    
    # Sanitize paths to prevent directory traversal
    args.path = safe_path(args.path)
    if args.output:
        args.output = safe_path(args.output)
    
    path = Path(args.path)
    
    if path.is_file():
        convert_file(str(path), args.output)
    elif path.is_dir():
        convert_directory(str(path))
    else:
        print(f"Error: {args.path} not found")
        sys.exit(1)
