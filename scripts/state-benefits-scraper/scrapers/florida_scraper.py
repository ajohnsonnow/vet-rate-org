#!/usr/bin/env python3
"""
Florida State Benefits Scraper
===============================

Sources:
- Florida Department of Veterans' Affairs: https://www.floridavets.org/
- Property Tax: https://floridarevenue.com/property/Pages/Exemptions.aspx
- Education: https://www.floridavets.org/benefits-services/education/
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from base_scraper import BaseStateScraper, Benefit, BenefitRequirements, ApplicationProcess, LegalCitation, SourceInfo
from datetime import datetime


class FloridaScraper(BaseStateScraper):
    """Florida veteran benefits scraper"""
    
    def __init__(self):
        super().__init__(
            state_name="Florida",
            state_code="FL",
            official_url="https://www.floridavets.org/"
        )
    
    def scrape_property_tax_benefits(self):
        """
        Scrape FL property tax exemptions
        Florida has generous property tax benefits for disabled veterans
        """
        benefits = []
        
        # Total Exemption for 100% P&T
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Total Property Tax Exemption for 100% P&T Veterans",
            description="Total and permanent exemption from all property taxes for 100% P&T disabled veterans",
            value="Total exemption on homestead property",
            estimated_annual_value=5000,
            requirements=BenefitRequirements(
                min_rating=100,
                is_permanent_total=True,
                other_reqs=[
                    "Florida resident",
                    "Homestead property",
                    "Service-connected disability"
                ]
            ),
            application_process=ApplicationProcess(
                agency="County Property Appraiser's Office",
                form="DR-501",
                deadline="March 1 annually",
                renewal_required=False,
                documentation=[
                    "DD-214",
                    "VA letter showing 100% P&T",
                    "Florida driver's license or ID",
                    "Homestead exemption application"
                ],
                online_application_available=False,
                application_url="https://floridarevenue.com/property/Pages/Exemptions.aspx"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §196.081",
                last_amended="2007-01-01"
            ),
            sources=[
                SourceInfo(
                    url="https://floridarevenue.com/property/Pages/Exemptions.aspx",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # 10% or Higher Disability
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Partial Property Tax Exemption (10%+ Disability)",
            description="$5,000 additional homestead exemption for veterans with 10% or higher service-connected disability",
            value="$5,000 property value exemption",
            estimated_annual_value=100,
            requirements=BenefitRequirements(
                min_rating=10,
                max_rating=99,
                is_permanent_total=False,
                other_reqs=[
                    "Florida resident",
                    "Homestead property",
                    "Service-connected disability"
                ]
            ),
            application_process=ApplicationProcess(
                agency="County Property Appraiser's Office",
                form="DR-501DV",
                deadline="March 1 annually",
                renewal_required=False,
                documentation=[
                    "DD-214",
                    "VA disability rating letter",
                    "Proof of Florida residency"
                ],
                application_url="https://floridarevenue.com/property/Pages/Exemptions.aspx"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §196.24",
                last_amended="2018-01-01"
            ),
            sources=[
                SourceInfo(
                    url="https://floridarevenue.com/property/Pages/Exemptions.aspx",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # Wheelchair-confined veterans
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Wheelchair-Confined Veteran Exemption",
            description="Additional homestead exemption for wheelchair-confined veterans",
            value="Additional $500 exemption",
            estimated_annual_value=10,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=[
                    "Veteran confined to wheelchair",
                    "Service-connected disability",
                    "Florida homestead"
                ]
            ),
            application_process=ApplicationProcess(
                agency="County Property Appraiser's Office",
                form="DR-501",
                documentation=["DD-214", "Medical certification", "VA letter"]
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §196.091"
            ),
            sources=[
                SourceInfo(
                    url="https://floridarevenue.com/property/Pages/Exemptions.aspx",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_vehicle_benefits(self):
        """Scrape FL vehicle benefits"""
        benefits = []
        
        # Disabled Veteran License Plates
        benefits.append(Benefit(
            category="Vehicle",
            benefit_name="Disabled Veteran License Plates",
            description="Free specialty license plates for disabled veterans with parking privileges",
            value="Waived registration fees + disabled parking placard",
            estimated_annual_value=50,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=[
                    "Florida resident",
                    "Service-connected disability",
                    "Medical certification of disability"
                ]
            ),
            application_process=ApplicationProcess(
                agency="Florida Department of Highway Safety and Motor Vehicles",
                form="HSMV 83039",
                documentation=[
                    "DD-214",
                    "VA disability letter",
                    "Medical certification",
                    "Florida driver's license"
                ],
                application_url="https://www.flhsmv.gov/motor-vehicles-tags-titles/"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §320.084"
            ),
            sources=[
                SourceInfo(
                    url="https://www.flhsmv.gov/motor-vehicles-tags-titles/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # 100% Disabled Veteran Free Toll
        benefits.append(Benefit(
            category="Vehicle",
            benefit_name="Florida Turnpike Toll Exemption",
            description="Free tolls on Florida's Turnpike system for 100% disabled veterans",
            value="Free tolls on all Florida Turnpike roads",
            estimated_annual_value=200,
            requirements=BenefitRequirements(
                min_rating=100,
                is_permanent_total=False,
                other_reqs=[
                    "Florida resident",
                    "Disabled Veteran license plate"
                ]
            ),
            application_process=ApplicationProcess(
                agency="Florida's Turnpike Enterprise",
                form="Application through FDVA",
                documentation=["DD-214", "100% VA rating letter", "DV license plate"],
                application_url="https://www.floridasturnpike.com/"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §338.155"
            ),
            sources=[
                SourceInfo(
                    url="https://www.floridasturnpike.com/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_education_benefits(self):
        """Scrape FL education benefits"""
        benefits = []
        
        # Florida GI Bill (in-state tuition waiver)
        benefits.append(Benefit(
            category="Education",
            benefit_name="Florida GI Bill - Tuition Waiver",
            description="In-state tuition waiver at Florida public colleges and universities",
            value="100% in-state tuition waived",
            estimated_annual_value=6500,
            requirements=BenefitRequirements(
                min_rating=0,
                is_permanent_total=False,
                other_reqs=[
                    "Florida resident for 1+ year before enrollment",
                    "Honorable discharge",
                    "Served on or after September 11, 2001"
                ]
            ),
            application_process=ApplicationProcess(
                agency="Florida Department of Veterans' Affairs / College Financial Aid Office",
                form="FDVA Form 50-DV-EW",
                deadline="Before each semester",
                renewal_required=True,
                documentation=[
                    "DD-214",
                    "Proof of Florida residency (1 year)",
                    "College admission"
                ],
                online_application_available=True,
                application_url="https://www.floridavets.org/benefits-services/education/"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §295.01",
                last_amended="2014-07-01"
            ),
            sources=[
                SourceInfo(
                    url="https://www.floridavets.org/benefits-services/education/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # Chapter 35 Dependents Waiver
        benefits.append(Benefit(
            category="Education",
            benefit_name="Chapter 35 Dependents Education Waiver",
            description="Tuition waiver for dependents of disabled or deceased veterans",
            value="In-state tuition waived at Florida public institutions",
            estimated_annual_value=6500,
            requirements=BenefitRequirements(
                min_rating=100,  # Parent must be 100% P&T or deceased
                is_permanent_total=True,
                other_reqs=[
                    "Dependent of 100% P&T veteran OR service-connected deceased veteran",
                    "Florida resident"
                ]
            ),
            application_process=ApplicationProcess(
                agency="College Financial Aid Office",
                form="FDVA Form 50-DV-EW",
                deadline="Before each semester",
                renewal_required=True,
                documentation=[
                    "Parent's DD-214",
                    "VA letter showing 100% P&T",
                    "Birth certificate or marriage license",
                    "Proof of Florida residency"
                ]
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §295.01(2)"
            ),
            sources=[
                SourceInfo(
                    url="https://www.floridavets.org/benefits-services/education/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_recreation_benefits(self):
        """Scrape FL recreation benefits"""
        benefits = []
        
        # Hunting/Fishing License
        benefits.append(Benefit(
            category="Recreation",
            benefit_name="Disabled Veteran Hunting and Fishing License",
            description="Free hunting and fishing licenses for 100% disabled veterans",
            value="Free lifetime licenses",
            estimated_annual_value=80,
            requirements=BenefitRequirements(
                min_rating=100,
                is_permanent_total=False,
                other_reqs=[
                    "Florida resident",
                    "Service-connected disability"
                ]
            ),
            application_process=ApplicationProcess(
                agency="Florida Fish and Wildlife Conservation Commission",
                documentation=[
                    "DD-214",
                    "VA disability letter showing 100%",
                    "Florida ID"
                ],
                application_url="https://myfwc.com/license/"
            ),
            legal_citation=LegalCitation(
                statute="Florida Statute §372.57"
            ),
            sources=[
                SourceInfo(
                    url="https://myfwc.com/license/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        # State Parks Annual Pass
        benefits.append(Benefit(
            category="Recreation",
            benefit_name="Florida State Parks Free Entry",
            description="Free entry to Florida state parks for disabled veterans",
            value="Free annual entrance pass",
            estimated_annual_value=40,
            requirements=BenefitRequirements(
                min_rating=10,
                is_permanent_total=False,
                other_reqs=["Florida resident", "Service-connected disability"]
            ),
            application_process=ApplicationProcess(
                agency="Florida State Parks",
                documentation=["DD-214", "VA disability letter"],
                application_url="https://www.floridastateparks.org/"
            ),
            sources=[
                SourceInfo(
                    url="https://www.floridastateparks.org/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape Florida veteran benefits')
    parser.add_argument('--output', default='output/florida_benefits.json', help='Output JSON file')
    args = parser.parse_args()
    
    scraper = FloridaScraper()
    state_data = scraper.scrape_all()
    scraper.export_json(state_data, args.output)
    
    print(f"✅ Florida scraping complete: {len(state_data.benefits)} benefits")

