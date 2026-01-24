#!/usr/bin/env python3
"""
Convert Python snake_case JSON to JavaScript camelCase
For integration with VetRate app
"""

import json
import sys
from pathlib import Path


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
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Convert to camelCase
    camel_data = convert_dict_keys(data)
    
    # Output file
    if not output_file:
        output_file = input_file.replace('.json', '_camel.json')
    
    with open(output_file, 'w', encoding='utf-8') as f:
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
        convert_file(str(filepath), output_file)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert JSON to camelCase for JavaScript')
    parser.add_argument('path', help='JSON file or directory')
    parser.add_argument('--output', help='Output file (for single file conversion)')
    args = parser.parse_args()
    
    path = Path(args.path)
    
    if path.is_file():
        convert_file(str(path), args.output)
    elif path.is_dir():
        convert_directory(str(path))
    else:
        print(f"Error: {args.path} not found")
        sys.exit(1)
