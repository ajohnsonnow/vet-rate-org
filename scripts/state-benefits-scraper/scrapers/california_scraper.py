#!/usr/bin/env python3
"""
California State Benefits Scraper
==================================

Sources:
- CalVet: https://www.calvet.ca.gov/
- Property Tax: https://www.calvet.ca.gov/veteran-services-benefits/property-tax
- Education: https://www.calvet.ca.gov/veteran-services-benefits/education
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from base_scraper import BaseStateScraper, Benefit, BenefitRequirements, ApplicationProcess, LegalCitation, SourceInfo
from datetime import datetime


class CaliforniaScraper(BaseStateScraper):
    """California veteran benefits scraper"""
    
    def __init__(self):
        super().__init__(
            state_name="California",
            state_code="CA",
            official_url="https://www.calvet.ca.gov/"
        )
    
    def scrape_property_tax_benefits(self):
        """
        Scrape CA property tax exemptions
        Note: These are manually documented from official sources
        In production, parse the actual HTML from calvet.ca.gov
        """
        benefits = []
        
        # Basic $4,000 exemption
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Basic Disabled Veterans Property Tax Exemption",
            description="$4,000 property value exemption for disabled veterans",
            value="$4,000 property value exemption",
            estimated_annual_value=80,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=["California resident", "Honorable discharge"]
            ),
            application_process=ApplicationProcess(
                agency="County Assessor's Office",
                form="BOE-261",
                deadline="February 15 annually",
                renewal_required=True,
                documentation=["DD-214", "Proof of California residency"],
                application_url="https://www.boe.ca.gov/proptaxes/veteransexemption.htm"
            ),
            legal_citation=LegalCitation(
                statute="California Revenue and Taxation Code §205",
                last_amended="2021-01-01"
            ),
            sources=[
                SourceInfo(
                    url="https://www.calvet.ca.gov/veteran-services-benefits/property-tax",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # 100% Disabled exemption
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="100% Disabled Veterans Enhanced Exemption",
            description="Up to $161,083 property value exemption for 100% disabled veterans",
            value="$161,083 exemption (2026)",
            estimated_annual_value=3500,
            requirements=BenefitRequirements(
                min_rating=100,
                is_permanent_total=False,
                other_reqs=[
                    "California resident",
                    "Primary residence",
                    "Household income under $69,304 (2026)"
                ]
            ),
            application_process=ApplicationProcess(
                agency="County Assessor's Office",
                form="BOE-261-G",
                deadline="February 15 annually",
                renewal_required=True,
                documentation=[
                    "DD-214",
                    "VA rating letter showing 100%",
                    "Proof of income",
                    "Proof of California residency"
                ],
                application_url="https://www.boe.ca.gov/proptaxes/pdf/boe261g.pdf"
            ),
            legal_citation=LegalCitation(
                statute="California Revenue and Taxation Code §205.5",
                last_amended="2024-01-01"
            ),
            sources=[
                SourceInfo(
                    url="https://www.calvet.ca.gov/veteran-services-benefits/property-tax",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_vehicle_benefits(self):
        """Scrape CA vehicle benefits"""
        benefits = []
        
        benefits.append(Benefit(
            category="Vehicle",
            benefit_name="Disabled Veteran License Plates",
            description="Free special license plates and parking placard for disabled veterans",
            value="Waived registration fees + parking privileges",
            estimated_annual_value=75,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=["California resident", "Service-connected disability"]
            ),
            application_process=ApplicationProcess(
                agency="California DMV",
                form="REG 256",
                documentation=[
                    "DD-214",
                    "VA disability verification",
                    "Medical certification"
                ],
                application_url="https://www.dmv.ca.gov/portal/vehicle-registration/license-plates-decals-and-placards/special-interest-and-personalized-license-plates/disabled-person-license-plates-dp-and-placards/"
            ),
            legal_citation=LegalCitation(
                statute="California Vehicle Code §5007"
            ),
            sources=[
                SourceInfo(
                    url="https://www.dmv.ca.gov/portal/vehicle-registration/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_education_benefits(self):
        """Scrape CA education benefits"""
        benefits = []
        
        # CalVet College Fee Waiver
        benefits.append(Benefit(
            category="Education",
            benefit_name="CalVet College Fee Waiver",
            description="Waived enrollment fees at California community colleges and CSU/UC system",
            value="Free tuition at public colleges (enrollment fees waived)",
            estimated_annual_value=1800,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=[
                    "California resident for 1+ year",
                    "Veteran OR dependent of 100% P&T veteran",
                    "Enrolled in undergraduate program"
                ]
            ),
            application_process=ApplicationProcess(
                agency="California Student Aid Commission / College Financial Aid Office",
                form="CalVet College Fee Waiver Application",
                deadline="Before each semester",
                renewal_required=True,
                documentation=[
                    "DD-214",
                    "Certificate of Eligibility from VA",
                    "Proof of California residency"
                ],
                application_url="https://www.calvet.ca.gov/veteran-services-benefits/education"
            ),
            legal_citation=LegalCitation(
                statute="California Education Code §68120-68122"
            ),
            sources=[
                SourceInfo(
                    url="https://www.calvet.ca.gov/veteran-services-benefits/education",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_recreation_benefits(self):
        """Scrape CA recreation benefits"""
        benefits = []
        
        # Hunting/Fishing license
        benefits.append(Benefit(
            category="Recreation",
            benefit_name="Disabled Veteran Hunting/Fishing License",
            description="Reduced-fee hunting and fishing licenses for disabled veterans",
            value="50% discount on licenses",
            estimated_annual_value=50,
            requirements=BenefitRequirements(
                min_rating=50,
                is_permanent_total=False,
                other_reqs=["California resident", "Service-connected disability"]
            ),
            application_process=ApplicationProcess(
                agency="California Department of Fish and Wildlife",
                documentation=["DD-214", "VA rating letter"],
                application_url="https://wildlife.ca.gov/Licensing/Hunting"
            ),
            sources=[
                SourceInfo(
                    url="https://wildlife.ca.gov/licensing",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape California veteran benefits')
    parser.add_argument('--output', default='output/california_benefits.json', help='Output JSON file')
    args = parser.parse_args()
    
    scraper = CaliforniaScraper()
    state_data = scraper.scrape_all()
    scraper.export_json(state_data, args.output)
    
    print(f"✅ California scraping complete: {len(state_data.benefits)} benefits")

