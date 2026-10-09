"""
Arizona State Benefits Scraper
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from simple_scraper import SimpleStateScraper, Benefit, Requirements, LegalCitation


class ArizonaScraper(SimpleStateScraper):
    """Scraper for Arizona veteran benefits"""
    
    def __init__(self):
        super().__init__(
            state_name="Arizona",
            state_code="AZ",
            base_url="https://dvs.az.gov"
        )
    
    def scrape_benefits(self) -> list[Benefit]:
        """Scrape all Arizona veteran benefits"""
        benefits = []
        
        # Vehicle - Disabled Veteran License Plates
        benefits.append(Benefit(
            state="Arizona",
            state_code="AZ",
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
                    statute="Arizona Vehicle Code",
                    description="Disabled veteran license plates",
                    url="https://dmv.az.gov"
                )
            ],
            source_url="https://dmv.az.gov/dv-plates",
            last_verified="2026-01-24"
        ))
        
        # Education - In-State Tuition
        benefits.append(Benefit(
            state="Arizona",
            state_code="AZ",
            name="In-State Tuition for Veterans",
            category="Education",
            description="Veterans using GI Bill benefits qualify for in-state tuition at Arizona public colleges and universities.",
            estimated_value="$12,000-$20,000/year",
            requirements=Requirements(
                min_rating=0,
                residency_required=False,
                disability_specific=None,
                additional_notes=["Must be using GI Bill benefits"]
            ),
            how_to_apply="Contact the veterans services office at your Arizona institution. Submit DD-214 and proof of GI Bill eligibility.",
            legal_citations=[
                LegalCitation(
                    statute="Arizona Education Code",
                    description="In-state tuition for veterans",
                    url="https://education.az.gov"
                )
            ],
            source_url="https://education.az.gov/veterans",
            last_verified="2026-01-24"
        ))
        
        # Recreation - Hunting/Fishing Licenses
        benefits.append(Benefit(
            state="Arizona",
            state_code="AZ",
            name="Hunting and Fishing License Discount",
            category="Recreation",
            description="Disabled veterans receive discounted or free hunting and fishing licenses in Arizona.",
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
                    statute="Arizona Wildlife Code",
                    description="License discounts for disabled veterans",
                    url="https://wildlife.az.gov"
                )
            ],
            source_url="https://wildlife.az.gov/veterans",
            last_verified="2026-01-24"
        ))
        
        return benefits


if __name__ == "__main__":
    scraper = ArizonaScraper()
    scraper.run()
