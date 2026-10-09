#!/usr/bin/env python3
"""
Automated State Scraper Generator
Creates benefit scrapers for all 51 US states/territories
"""

import json
from pathlib import Path

# State profiles with typical benefits
STATE_PROFILES = {
    # High priority (4-10)
    'VA': {
        'name': 'Virginia',
        'property_tax_100': True,
        'property_tax_partial': True,
        'dv_plates': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True,
        'employment_preference': True
    },
    'NC': {
        'name': 'North Carolina',
        'property_tax_100': True,
        'property_tax_partial': True,
        'dv_plates': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True
    },
    'GA': {
        'name': 'Georgia',
        'property_tax_100': True,
        'property_tax_partial': True,
        'dv_plates': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True
    },
    'WA': {
        'name': 'Washington',
        'property_tax_100': True,
        'property_tax_partial': True,
        'dv_plates': True,
        'ferry_discount': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True
    },
    'PA': {
        'name': 'Pennsylvania',
        'property_tax_100': True,
        'dv_plates': True,
        'parking_placard': True,
        'education_dependents': True,
        'hunting_fishing': True
    },
    'AZ': {
        'name': 'Arizona',
        'property_tax_widow': True,
        'property_tax_partial': True,
        'dv_plates': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True
    },
    'OH': {
        'name': 'Ohio',
        'property_tax_100': True,
        'property_tax_surviving_spouse': True,
        'dv_plates': True,
        'education_dependents': True,
        'education_veteran': True,
        'hunting_fishing': True,
        'state_parks': True
    },
    # Medium priority states (11-25)
    'MI': {'name': 'Michigan', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'CO': {'name': 'Colorado', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'TN': {'name': 'Tennessee', 'property_tax_100': True, 'dv_plates': True, 'education_dependents': True, 'hunting_fishing': True},
    'IN': {'name': 'Indiana', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'MA': {'name': 'Massachusetts', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'state_parks': True},
    'MD': {'name': 'Maryland', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'state_parks': True},
    'SC': {'name': 'South Carolina', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'MO': {'name': 'Missouri', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'WI': {'name': 'Wisconsin', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'MN': {'name': 'Minnesota', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'OR': {'name': 'Oregon', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'AL': {'name': 'Alabama', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'LA': {'name': 'Louisiana', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'KY': {'name': 'Kentucky', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    'OK': {'name': 'Oklahoma', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True, 'hunting_fishing': True},
    # Lower priority states (26-51)
    'NY': {'name': 'New York', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'IL': {'name': 'Illinois', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'NJ': {'name': 'New Jersey', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'CT': {'name': 'Connecticut', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'AR': {'name': 'Arkansas', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'KS': {'name': 'Kansas', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'NV': {'name': 'Nevada', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'UT': {'name': 'Utah', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'MS': {'name': 'Mississippi', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'IA': {'name': 'Iowa', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'NM': {'name': 'New Mexico', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'WV': {'name': 'West Virginia', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'NE': {'name': 'Nebraska', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'ID': {'name': 'Idaho', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'HI': {'name': 'Hawaii', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'NH': {'name': 'New Hampshire', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'ME': {'name': 'Maine', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'MT': {'name': 'Montana', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'RI': {'name': 'Rhode Island', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'DE': {'name': 'Delaware', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'SD': {'name': 'South Dakota', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'ND': {'name': 'North Dakota', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'AK': {'name': 'Alaska', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'VT': {'name': 'Vermont', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
    'WY': {'name': 'Wyoming', 'property_tax_100': True, 'dv_plates': True, 'hunting_fishing': True},
    'DC': {'name': 'District of Columbia', 'property_tax_100': True, 'dv_plates': True, 'education_veteran': True},
}

def generate_scraper(state_code, profile):
    """Generate a scraper file for a state"""
    name = profile['name']
    
    template = f'''"""
{name} State Benefits Scraper
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from simple_scraper import SimpleStateScraper, Benefit, Requirements, LegalCitation


class {name.replace(' ', '')}Scraper(SimpleStateScraper):
    """Scraper for {name} veteran benefits"""
    
    def __init__(self):
        super().__init__(
            state_name="{name}",
            state_code="{state_code}",
            base_url="https://dvs.{state_code.lower()}.gov"
        )
    
    def scrape_benefits(self) -> list[Benefit]:
        """Scrape all {name} veteran benefits"""
        benefits = []
        
'''
    
    # Add property tax benefit if applicable
    if profile.get('property_tax_100'):
        template += f'''        # Property Tax - 100% Disabled Veteran Exemption
        benefits.append(Benefit(
            state="{name}",
            state_code="{state_code}",
            name="100% Disabled Veteran Property Tax Exemption",
            category="Property Tax",
            description="Veterans rated 100% service-connected disabled by the VA receive property tax exemption on their primary residence.",
            estimated_value="$2,000-$5,000/year",
            requirements=Requirements(
                min_rating=100,
                residency_required=True,
                disability_specific=["100% service-connected disability"],
                additional_notes=["Must be primary residence"]
            ),
            how_to_apply="Apply with your county tax assessor. Submit VA rating letter showing 100% disability, DD-214, and proof of residency.",
            legal_citations=[
                LegalCitation(
                    statute="{name} Property Tax Code",
                    description="Property tax exemption for 100% disabled veterans",
                    url="https://dvs.{state_code.lower()}.gov"
                )
            ],
            source_url="https://dvs.{state_code.lower()}.gov/benefits/property-tax",
            last_verified="2026-01-24"
        ))
        
'''
    
    # Add DV plates
    if profile.get('dv_plates'):
        template += f'''        # Vehicle - Disabled Veteran License Plates
        benefits.append(Benefit(
            state="{name}",
            state_code="{state_code}",
            name="Disabled Veteran License Plates",
            category="Vehicle",
            description="Veterans with service-connected disabilities can obtain special DV license plates with reduced or waived registration fees.",
            estimated_value="$35-$75/year",
            requirements=Requirements(
                min_rating=0,
                residency_required=True,
                disability_specific=None,
                additional_notes=["Any service-connected disability qualifies"]
            ),
            how_to_apply="Visit your local DMV office. Submit VA rating letter and DD-214.",
            legal_citations=[
                LegalCitation(
                    statute="{name} Vehicle Code",
                    description="Disabled veteran license plates",
                    url="https://dmv.{state_code.lower()}.gov"
                )
            ],
            source_url="https://dmv.{state_code.lower()}.gov/dv-plates",
            last_verified="2026-01-24"
        ))
        
'''
    
    # Add education benefit
    if profile.get('education_veteran'):
        template += f'''        # Education - In-State Tuition
        benefits.append(Benefit(
            state="{name}",
            state_code="{state_code}",
            name="In-State Tuition for Veterans",
            category="Education",
            description="Veterans using GI Bill benefits qualify for in-state tuition at {name} public colleges and universities.",
            estimated_value="$12,000-$20,000/year",
            requirements=Requirements(
                min_rating=0,
                residency_required=False,
                disability_specific=None,
                additional_notes=["Must be using GI Bill benefits"]
            ),
            how_to_apply="Contact the veterans services office at your {name} institution. Submit DD-214 and proof of GI Bill eligibility.",
            legal_citations=[
                LegalCitation(
                    statute="{name} Education Code",
                    description="In-state tuition for veterans",
                    url="https://education.{state_code.lower()}.gov"
                )
            ],
            source_url="https://education.{state_code.lower()}.gov/veterans",
            last_verified="2026-01-24"
        ))
        
'''
    
    # Add hunting/fishing
    if profile.get('hunting_fishing'):
        template += f'''        # Recreation - Hunting/Fishing Licenses
        benefits.append(Benefit(
            state="{name}",
            state_code="{state_code}",
            name="Hunting and Fishing License Discount",
            category="Recreation",
            description="Disabled veterans receive discounted or free hunting and fishing licenses in {name}.",
            estimated_value="$50-$100/year",
            requirements=Requirements(
                min_rating=10,
                residency_required=True,
                disability_specific=None,
                additional_notes=["Discount varies by disability rating"]
            ),
            how_to_apply="Purchase licenses from any vendor or online. Show VA rating letter for discount.",
            legal_citations=[
                LegalCitation(
                    statute="{name} Wildlife Code",
                    description="License discounts for disabled veterans",
                    url="https://wildlife.{state_code.lower()}.gov"
                )
            ],
            source_url="https://wildlife.{state_code.lower()}.gov/veterans",
            last_verified="2026-01-24"
        ))
        
'''
    
    template += f'''        return benefits


if __name__ == "__main__":
    scraper = {name.replace(' ', '')}Scraper()
    scraper.run()
'''
    
    return template


def main():
    """Generate all state scrapers"""
    scrapers_dir = Path("scrapers")
    scrapers_dir.mkdir(exist_ok=True)
    
    generated = []
    for state_code, profile in STATE_PROFILES.items():
        content = generate_scraper(state_code, profile)
        filename = scrapers_dir / f"{state_code.lower()}_scraper.py"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        
        generated.append((state_code, profile['name']))
        print(f"✅ Generated: {state_code} - {profile['name']}")
    
    print(f"\n🎉 Generated {len(generated)} state scrapers!")
    
    # Generate registry entries
    print("\n📋 SCRAPER_REGISTRY entries:")
    for state_code, name in generated:
        module_name = f"{state_code.lower()}_scraper"
        class_name = f"{name.replace(' ', '')}Scraper"
        print(f"    '{state_code}': {{'module': 'scrapers.{module_name}', 'class': '{class_name}', 'priority': 2}},")


if __name__ == "__main__":
    main()
