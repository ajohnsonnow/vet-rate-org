#!/usr/bin/env python3
"""
Script to fix entries missing ratingCriteria by adding appropriate defaults
based on diagnostic code ranges and eCFR data.
"""

import json
from pathlib import Path

# Known rating criteria for specific diagnostic codes
KNOWN_RATINGS = {
    # Amputation combinations - these are special monthly compensation codes
    "5104": {"type": "special", "description": "Special monthly compensation - see 38 CFR § 3.350", "smc": True},
    "5105": {"type": "special", "description": "Special monthly compensation - see 38 CFR § 3.350", "smc": True},
    
    # Arm amputations
    "5121": {"type": "direct", "ratings": {"90": "Amputation of arm above insertion of deltoid (dominant)", "80": "Amputation of arm above insertion of deltoid (non-dominant)"}},
    "5122": {"type": "direct", "ratings": {"80": "Amputation below insertion of deltoid (dominant)", "70": "Amputation below insertion of deltoid (non-dominant)"}},
    "5123": {"type": "direct", "ratings": {"70": "Amputation above insertion of pronator teres (dominant)", "60": "Amputation above insertion of pronator teres (non-dominant)"}},
    "5124": {"type": "direct", "ratings": {"60": "Amputation below insertion of pronator teres (dominant)", "50": "Amputation below insertion of pronator teres (non-dominant)"}},
    
    # Finger amputations - Five digits
    "5126": {"type": "direct", "ratings": {"70": "Amputation of five digits of one hand (dominant)", "60": "Amputation of five digits of one hand (non-dominant)"}},
    
    # Four digit combinations
    "5127": {"type": "direct", "ratings": {"70": "Thumb, index, long and ring (dominant)", "60": "Thumb, index, long and ring (non-dominant)"}},
    "5128": {"type": "direct", "ratings": {"70": "Thumb, index, long and little (dominant)", "60": "Thumb, index, long and little (non-dominant)"}},
    "5129": {"type": "direct", "ratings": {"70": "Thumb, index, ring and little (dominant)", "60": "Thumb, index, ring and little (non-dominant)"}},
    "5130": {"type": "direct", "ratings": {"70": "Thumb, long, ring and little (dominant)", "60": "Thumb, long, ring and little (non-dominant)"}},
    "5131": {"type": "direct", "ratings": {"50": "Index, long, ring and little (dominant)", "40": "Index, long, ring and little (non-dominant)"}},
    
    # Three digit combinations
    "5132": {"type": "direct", "ratings": {"60": "Thumb, index and long (dominant)", "50": "Thumb, index and long (non-dominant)"}},
    "5133": {"type": "direct", "ratings": {"60": "Thumb, index and ring (dominant)", "50": "Thumb, index and ring (non-dominant)"}},
    "5134": {"type": "direct", "ratings": {"60": "Thumb, index and little (dominant)", "50": "Thumb, index and little (non-dominant)"}},
    "5135": {"type": "direct", "ratings": {"60": "Thumb, long and ring (dominant)", "50": "Thumb, long and ring (non-dominant)"}},
    "5136": {"type": "direct", "ratings": {"60": "Thumb, long and little (dominant)", "50": "Thumb, long and little (non-dominant)"}},
    "5137": {"type": "direct", "ratings": {"60": "Thumb, ring and little (dominant)", "50": "Thumb, ring and little (non-dominant)"}},
    "5138": {"type": "direct", "ratings": {"40": "Index, long and ring (dominant)", "30": "Index, long and ring (non-dominant)"}},
    "5139": {"type": "direct", "ratings": {"40": "Index, long and little (dominant)", "30": "Index, long and little (non-dominant)"}},
    "5140": {"type": "direct", "ratings": {"40": "Index, ring and little (dominant)", "30": "Index, ring and little (non-dominant)"}},
    "5141": {"type": "direct", "ratings": {"40": "Long, ring and little (dominant)", "30": "Long, ring and little (non-dominant)"}},
    
    # Two digit combinations
    "5142": {"type": "direct", "ratings": {"50": "Thumb and index (dominant)", "40": "Thumb and index (non-dominant)"}},
    "5143": {"type": "direct", "ratings": {"50": "Thumb and long (dominant)", "40": "Thumb and long (non-dominant)"}},
    "5144": {"type": "direct", "ratings": {"50": "Thumb and ring (dominant)", "40": "Thumb and ring (non-dominant)"}},
    "5145": {"type": "direct", "ratings": {"50": "Thumb and little (dominant)", "40": "Thumb and little (non-dominant)"}},
    "5146": {"type": "direct", "ratings": {"30": "Index and long (dominant)", "20": "Index and long (non-dominant)"}},
    "5147": {"type": "direct", "ratings": {"30": "Index and ring (dominant)", "20": "Index and ring (non-dominant)"}},
    "5148": {"type": "direct", "ratings": {"30": "Index and little (dominant)", "20": "Index and little (non-dominant)"}},
    "5149": {"type": "direct", "ratings": {"30": "Long and ring (dominant)", "20": "Long and ring (non-dominant)"}},
    "5150": {"type": "direct", "ratings": {"30": "Long and little (dominant)", "20": "Long and little (non-dominant)"}},
    "5151": {"type": "direct", "ratings": {"30": "Ring and little (dominant)", "20": "Ring and little (non-dominant)"}},
    
    # Single digit amputations
    "5152": {"type": "direct", "ratings": {"40": "With metacarpal resection (dominant)", "30": "With metacarpal resection (non-dominant)", "30": "Without metacarpal resection (dominant)", "20": "Without metacarpal resection (non-dominant)"}},
    "5153": {"type": "direct", "ratings": {"30": "With metacarpal resection (dominant)", "20": "With metacarpal resection (non-dominant)", "20": "Without metacarpal resection, at proximal interphalangeal joint or proximal thereto (dominant)", "20": "Without metacarpal resection, at proximal interphalangeal joint or proximal thereto (non-dominant)"}},
    "5154": {"type": "direct", "ratings": {"20": "With metacarpal resection (dominant)", "20": "With metacarpal resection (non-dominant)", "10": "Without metacarpal resection, at proximal interphalangeal joint or proximal thereto"}},
    "5155": {"type": "direct", "ratings": {"20": "With metacarpal resection (dominant)", "20": "With metacarpal resection (non-dominant)", "10": "Without metacarpal resection, at proximal interphalangeal joint or proximal thereto"}},
    "5156": {"type": "direct", "ratings": {"20": "With metacarpal resection (dominant)", "20": "With metacarpal resection (non-dominant)", "10": "Without metacarpal resection, at proximal interphalangeal joint or proximal thereto"}},
    
    # Lower extremity amputations
    "5160": {"type": "direct", "ratings": {"90": "Upper third of thigh, one third of distance from perineum to knee joint measured from perineum"}},
    "5161": {"type": "direct", "ratings": {"80": "At a lower level, permitting prosthesis"}},
    "5162": {"type": "direct", "ratings": {"60": "With defective stump, thigh amputation recommended"}},
    "5163": {"type": "direct", "ratings": {"60": "With defective stump, thigh amputation recommended; or, not improvable by prosthesis controlled by natural knee action"}},
    "5164": {"type": "direct", "ratings": {"40": "Amputation of leg with prosthesis not feasible at or below knee"}},
    "5165": {"type": "direct", "ratings": {"40": "Amputation of leg at a lower level, permitting prosthesis"}},
    "5166": {"type": "direct", "ratings": {"40": "Amputation of forefoot, proximal to metatarsal bones (more than one-half of metatarsal loss)"}},
    "5167": {"type": "direct", "ratings": {"30": "Amputation of all toes, without metatarsal loss"}},
    
    # Toe amputations
    "5170": {"type": "direct", "ratings": {"30": "With removal of metatarsal head", "10": "Without metatarsal involvement"}},
    "5171": {"type": "direct", "ratings": {"20": "With removal of metatarsal head", "0": "Without metatarsal involvement"}},
    "5172": {"type": "direct", "ratings": {"20": "With removal of metatarsal head", "0": "Without metatarsal involvement"}},
    "5173": {"type": "direct", "ratings": {"10": "With removal of metatarsal head", "0": "Without metatarsal involvement"}},
    "5174": {"type": "direct", "ratings": {"10": "With removal of metatarsal head", "0": "Without metatarsal involvement"}},
}

def create_default_criteria(dc, condition_name):
    """Create default ratingCriteria based on diagnostic code and condition."""
    if dc in KNOWN_RATINGS:
        return KNOWN_RATINGS[dc]
    
    # Default for amputation/loss codes (5100-5174)
    if dc.startswith('51') and len(dc) == 4:
        code_num = int(dc)
        if 5100 <= code_num <= 5109:
            return {"type": "special", "description": "Special monthly compensation - see 38 CFR § 3.350", "smc": True}
        elif 5120 <= code_num <= 5174:
            return {"type": "direct", "ratings": {"varies": "Rate based on level of amputation - see 38 CFR § 4.71a"}, "notes": ["Ratings vary by dominant vs non-dominant hand", "See specific criteria for amputation level"]}
    
    # Default for ankylosis codes
    if 'ankylosis' in condition_name.lower():
        return {"type": "direct", "ratings": {"varies": "Rate based on position and joint affected - consult 38 CFR Part 4"}}
    
    # Default for limitation of motion
    if 'limitation' in condition_name.lower() or 'range of motion' in condition_name.lower():
        return {"type": "formula", "formula": "Rate based on measured limitation of motion", "ratings": {"varies": "Consult 38 CFR Part 4 for specific joint criteria"}}
    
    # Generic default
    return {"type": "direct", "ratings": {"varies": "Consult 38 CFR Part 4 for specific rating criteria"}, "notes": ["Rating criteria pending verification"]}

def main():
    filepath = Path(r'E:\VS_Studio\vet-rate-org-official\src\data\disabilityData.json')
    
    print(f"Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    disabilities = data['disabilities']
    fixed_count = 0
    
    for entry in disabilities:
        if 'diagnosticCode' not in entry:
            continue
            
        dc = entry['diagnosticCode']
        
        if 'ratingCriteria' not in entry:
            condition = entry.get('conditionName', 'Unknown')
            entry['ratingCriteria'] = create_default_criteria(dc, condition)
            fixed_count += 1
            print(f"Fixed DC {dc}: {condition}")
    
    print(f"\nFixed {fixed_count} entries")
    
    # Write updated file
    print(f"Writing updated file...")
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("✅ Complete!")

if __name__ == '__main__':
    main()
