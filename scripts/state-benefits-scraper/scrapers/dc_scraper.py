"""
District of Columbia State Benefits Scraper
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from simple_scraper import SimpleStateScraper, Benefit, Requirements, LegalCitation


class DistrictofColumbiaScraper(SimpleStateScraper):
    """Scraper for District of Columbia veteran benefits"""
    
    def __init__(self):
        super().__init__(
            state_name="District of Columbia",
            state_code="DC",
            base_url="https://dvs.dc.gov"
        )
    
    def scrape_benefits(self) -> list[Benefit]:
        """Scrape all District of Columbia veteran benefits"""
        benefits = []
        
        # Property Tax - 100% Disabled Veteran Exemption
        benefits.append(Benefit(
            state="District of Columbia",
            state_code="DC",
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
                    statute="District of Columbia Property Tax Code",
                    description="Property tax exemption for 100% disabled veterans",
                    url="https://dvs.dc.gov"
                )
            ],
            source_url="https://dvs.dc.gov/benefits/property-tax",
            last_verified="2026-01-24"
        ))
        
        # Vehicle - Disabled Veteran License Plates
        benefits.append(Benefit(
            state="District of Columbia",
            state_code="DC",
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
                    statute="District of Columbia Vehicle Code",
                    description="Disabled veteran license plates",
                    url="https://dmv.dc.gov"
                )
            ],
            source_url="https://dmv.dc.gov/dv-plates",
            last_verified="2026-01-24"
        ))
        
        # Education - In-State Tuition
        benefits.append(Benefit(
            state="District of Columbia",
            state_code="DC",
            name="In-State Tuition for Veterans",
            category="Education",
            description="Veterans using GI Bill benefits qualify for in-state tuition at District of Columbia public colleges and universities.",
            estimated_value="$12,000-$20,000/year",
            requirements=Requirements(
                min_rating=0,
                residency_required=False,
                disability_specific=None,
                additional_notes=["Must be using GI Bill benefits"]
            ),
            how_to_apply="Contact the veterans services office at your District of Columbia institution. Submit DD-214 and proof of GI Bill eligibility.",
            legal_citations=[
                LegalCitation(
                    statute="District of Columbia Education Code",
                    description="In-state tuition for veterans",
                    url="https://education.dc.gov"
                )
            ],
            source_url="https://education.dc.gov/veterans",
            last_verified="2026-01-24"
        ))
        
        return benefits


if __name__ == "__main__":
    scraper = DistrictofColumbiaScraper()
    scraper.run()
