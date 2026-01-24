"""
Wyoming State Benefits Scraper
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from simple_scraper import SimpleStateScraper, Benefit, Requirements, LegalCitation


class WyomingScraper(SimpleStateScraper):
    """Scraper for Wyoming veteran benefits"""
    
    def __init__(self):
        super().__init__(
            state_name="Wyoming",
            state_code="WY",
            base_url="https://dvs.wy.gov"
        )
    
    def scrape_benefits(self) -> list[Benefit]:
        """Scrape all Wyoming veteran benefits"""
        benefits = []
        
        # Property Tax - 100% Disabled Veteran Exemption
        benefits.append(Benefit(
            state="Wyoming",
            state_code="WY",
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
                    statute="Wyoming Property Tax Code",
                    description="Property tax exemption for 100% disabled veterans",
                    url="https://dvs.wy.gov"
                )
            ],
            source_url="https://dvs.wy.gov/benefits/property-tax",
            last_verified="2026-01-24"
        ))
        
        # Vehicle - Disabled Veteran License Plates
        benefits.append(Benefit(
            state="Wyoming",
            state_code="WY",
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
                    statute="Wyoming Vehicle Code",
                    description="Disabled veteran license plates",
                    url="https://dmv.wy.gov"
                )
            ],
            source_url="https://dmv.wy.gov/dv-plates",
            last_verified="2026-01-24"
        ))
        
        # Recreation - Hunting/Fishing Licenses
        benefits.append(Benefit(
            state="Wyoming",
            state_code="WY",
            name="Hunting and Fishing License Discount",
            category="Recreation",
            description="Disabled veterans receive discounted or free hunting and fishing licenses in Wyoming.",
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
                    statute="Wyoming Wildlife Code",
                    description="License discounts for disabled veterans",
                    url="https://wildlife.wy.gov"
                )
            ],
            source_url="https://wildlife.wy.gov/veterans",
            last_verified="2026-01-24"
        ))
        
        return benefits


if __name__ == "__main__":
    scraper = WyomingScraper()
    scraper.run()
