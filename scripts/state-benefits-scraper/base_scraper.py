#!/usr/bin/env python3
"""
State Benefits Scraper - Base Template
======================================

This is a template for scraping veteran benefits from official state websites.
Each state will need its own scraper inheriting from this base class.

⚠️ IMPORTANT: Always respect robots.txt and use appropriate rate limiting.

Usage:
    python base_scraper.py --state TX --output data/texas_benefits.json

Requirements:
    pip install requests beautifulsoup4 lxml selenium pydantic
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import time
import logging
from abc import ABC, abstractmethod

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class BenefitRequirements:
    """Eligibility requirements for a benefit"""
    min_rating: int
    max_rating: Optional[int] = None
    is_permanent_total: bool = False
    other_reqs: List[str] = None
    
    def __post_init__(self):
        if self.other_reqs is None:
            self.other_reqs = []


@dataclass
class ApplicationProcess:
    """How to apply for a benefit"""
    agency: str
    form: Optional[str] = None
    deadline: Optional[str] = None
    renewal_required: bool = False
    documentation: List[str] = None
    online_application_available: bool = False
    application_url: Optional[str] = None
    
    def __post_init__(self):
        if self.documentation is None:
            self.documentation = []


@dataclass
class LegalCitation:
    """Legal reference for a benefit"""
    statute: str
    effective_date: Optional[str] = None
    last_amended: Optional[str] = None


@dataclass
class SourceInfo:
    """Track where data came from"""
    url: str
    scraped_date: str
    is_official: bool = True


@dataclass
class Benefit:
    """Represents a single veteran benefit"""
    category: str  # Property Tax, Vehicle, Education, Recreation, Employment, Healthcare, Housing, Other
    benefit_name: str
    description: str
    value: str
    estimated_annual_value: Optional[int] = None
    requirements: Optional[BenefitRequirements] = None
    application_process: Optional[ApplicationProcess] = None
    legal_citation: Optional[LegalCitation] = None
    sources: List[SourceInfo] = None
    
    def __post_init__(self):
        if self.sources is None:
            self.sources = []
    
    def to_dict(self):
        """Convert to dictionary for JSON export"""
        data = asdict(self)
        return data


@dataclass
class StateData:
    """Complete data for a state"""
    state: str
    state_code: str
    last_updated: str
    official_source: str
    data_status: str  # not_started, in_progress, needs_validation, validated, live
    validator: Optional[str] = None
    benefits: List[Benefit] = None
    
    def __post_init__(self):
        if self.benefits is None:
            self.benefits = []
        self.last_updated = datetime.now().strftime("%Y-%m-%d")
    
    def to_dict(self):
        """Convert to dictionary for JSON export"""
        return {
            'state': self.state,
            'stateCode': self.state_code,
            'lastUpdated': self.last_updated,
            'officialSource': self.official_source,
            'dataStatus': self.data_status,
            'validator': self.validator,
            'benefits': [b.to_dict() for b in self.benefits]
        }


class BaseStateScraper(ABC):
    """
    Abstract base class for state benefit scrapers.
    Each state should inherit from this and implement the scraping methods.
    """
    
    def __init__(self, state_name: str, state_code: str, official_url: str):
        self.state_name = state_name
        self.state_code = state_code
        self.official_url = official_url
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'VetRate State Benefits Research Bot (contact@vetrate.org)'
        })
        self.benefits = []
        
    def fetch_page(self, url: str, wait_time: float = 1.0) -> Optional[BeautifulSoup]:
        """
        Fetch a page with rate limiting
        
        Args:
            url: The URL to fetch
            wait_time: Seconds to wait between requests (respect the server)
        
        Returns:
            BeautifulSoup object or None if failed
        """
        try:
            logger.info(f"Fetching: {url}")
            time.sleep(wait_time)  # Be respectful - don't hammer servers
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            return BeautifulSoup(response.content, 'lxml')
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None
    
    @abstractmethod
    def scrape_property_tax_benefits(self) -> List[Benefit]:
        """Scrape property tax exemption benefits"""
        pass
    
    @abstractmethod
    def scrape_vehicle_benefits(self) -> List[Benefit]:
        """Scrape vehicle registration benefits"""
        pass
    
    @abstractmethod
    def scrape_education_benefits(self) -> List[Benefit]:
        """Scrape education/tuition benefits"""
        pass
    
    def scrape_recreation_benefits(self) -> List[Benefit]:
        """Scrape hunting/fishing license benefits (optional)"""
        logger.info("Recreation benefits not implemented for this state")
        return []
    
    def scrape_all(self) -> StateData:
        """
        Run all scrapers and compile results
        
        Returns:
            StateData object with all benefits
        """
        logger.info(f"Starting scrape for {self.state_name}")
        
        # Run all scraping methods
        self.benefits = []
        self.benefits.extend(self.scrape_property_tax_benefits())
        self.benefits.extend(self.scrape_vehicle_benefits())
        self.benefits.extend(self.scrape_education_benefits())
        self.benefits.extend(self.scrape_recreation_benefits())
        
        # Create state data object
        state_data = StateData(
            state=self.state_name,
            state_code=self.state_code,
            last_updated=datetime.now().strftime("%Y-%m-%d"),
            official_source=self.official_url,
            data_status="needs_validation",
            benefits=self.benefits
        )
        
        logger.info(f"Scraping complete: {len(self.benefits)} benefits found")
        return state_data
    
    def export_json(self, state_data: StateData, output_file: str):
        """Export to JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(state_data.to_dict(), f, indent=2, ensure_ascii=False)
        logger.info(f"Exported to {output_file}")


# =============================================================================
# EXAMPLE IMPLEMENTATION: Texas Scraper
# =============================================================================

class TexasScraper(BaseStateScraper):
    """
    Texas-specific benefit scraper
    
    Sources:
    - Texas Veterans Commission: https://www.tvc.texas.gov/
    - TX Comptroller (tax): https://comptroller.texas.gov/
    """
    
    def __init__(self):
        super().__init__(
            state_name="Texas",
            state_code="TX",
            official_url="https://www.tvc.texas.gov/"
        )
    
    def scrape_property_tax_benefits(self) -> List[Benefit]:
        """
        Scrape Texas property tax exemptions
        Source: https://comptroller.texas.gov/taxes/property-tax/exemptions/
        """
        benefits = []
        
        # Note: In real implementation, you'd parse the actual HTML
        # This is a manual example showing the data structure
        
        # 100% Disabled Veteran Exemption
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="100% Disabled Veteran Property Tax Exemption",
            description="Full exemption on residence homestead for veterans with 100% disability rating",
            value="Full exemption on residence homestead",
            estimated_annual_value=4000,
            requirements=BenefitRequirements(
                min_rating=100,
                is_permanent_total=False,
                other_reqs=[
                    "Texas resident",
                    "Primary residence",
                    "Home must be owned by veteran or spouse"
                ]
            ),
            application_process=ApplicationProcess(
                agency="County Appraisal District",
                form="Form 50-135",
                deadline="April 30 annually",
                renewal_required=False,
                documentation=[
                    "DD-214 (discharge papers)",
                    "VA disability rating letter",
                    "Proof of Texas residency",
                    "Property deed"
                ],
                online_application_available=True,
                application_url="https://comptroller.texas.gov/taxes/property-tax/exemptions/"
            ),
            legal_citation=LegalCitation(
                statute="Texas Tax Code §11.131",
                effective_date="1997-01-01",
                last_amended="2021-09-01"
            ),
            sources=[
                SourceInfo(
                    url="https://comptroller.texas.gov/taxes/property-tax/exemptions/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d"),
                    is_official=True
                )
            ]
        ))
        
        # 10-90% Partial Exemption
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Partial Property Tax Exemption (10-90% Disabled)",
            description="Partial exemption based on disability rating percentage",
            value="$5,000 to $12,000 exemption based on rating",
            estimated_annual_value=250,  # Average
            requirements=BenefitRequirements(
                min_rating=10,
                max_rating=90,
                is_permanent_total=False,
                other_reqs=["Texas resident", "Primary residence"]
            ),
            application_process=ApplicationProcess(
                agency="County Appraisal District",
                form="Form 50-114",
                deadline="April 30 annually",
                documentation=["DD-214", "VA rating letter"]
            ),
            legal_citation=LegalCitation(
                statute="Texas Tax Code §11.22",
                last_amended="2009-01-01"
            ),
            sources=[
                SourceInfo(
                    url="https://comptroller.texas.gov/taxes/property-tax/exemptions/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_vehicle_benefits(self) -> List[Benefit]:
        """Scrape Texas vehicle registration benefits"""
        benefits = []
        
        benefits.append(Benefit(
            category="Vehicle",
            benefit_name="Disabled Veteran License Plates",
            description="Free specialty license plates for disabled veterans",
            value="Waived registration fees",
            estimated_annual_value=60,
            requirements=BenefitRequirements(
                min_rating=10,
                other_reqs=["Texas resident", "Valid driver's license"]
            ),
            application_process=ApplicationProcess(
                agency="Texas Department of Motor Vehicles",
                form="Form VTR-615",
                deadline="None",
                documentation=["DD-214", "VA rating letter", "Vehicle title"]
            ),
            legal_citation=LegalCitation(
                statute="Texas Transportation Code §502.453"
            ),
            sources=[
                SourceInfo(
                    url="https://www.txdmv.gov/motorists/license-plates",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits
    
    def scrape_education_benefits(self) -> List[Benefit]:
        """Scrape Texas education benefits (Hazlewood Act)"""
        benefits = []
        
        benefits.append(Benefit(
            category="Education",
            benefit_name="Hazlewood Act Tuition Waiver",
            description="Free tuition at Texas public universities for veterans and dependents",
            value="Up to 150 credit hours of tuition exemption",
            estimated_annual_value=12000,
            requirements=BenefitRequirements(
                min_rating=0,  # Available to all veterans
                other_reqs=[
                    "Texas resident for at least 1 year",
                    "Honorable discharge",
                    "Designated Texas as home of record OR entered service in Texas"
                ]
            ),
            application_process=ApplicationProcess(
                agency="Texas Veterans Commission",
                form="Hazlewood Letter",
                deadline="Before each semester",
                renewal_required=True,
                documentation=[
                    "DD-214",
                    "Proof of Texas residency (1 year)",
                    "College admission letter"
                ],
                online_application_available=True,
                application_url="https://www.tvc.texas.gov/education/hazlewood-act/"
            ),
            legal_citation=LegalCitation(
                statute="Texas Education Code §54.341",
                effective_date="1923-01-01",
                last_amended="2023-06-01"
            ),
            sources=[
                SourceInfo(
                    url="https://www.tvc.texas.gov/education/hazlewood-act/",
                    scraped_date=datetime.now().strftime("%Y-%m-%d")
                )
            ]
        ))
        
        return benefits


# =============================================================================
# MAIN EXECUTION
# =============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape state veteran benefits')
    parser.add_argument('--state', default='TX', help='State code (e.g., TX, CA)')
    parser.add_argument('--output', default='output/state_benefits.json', help='Output JSON file')
    args = parser.parse_args()
    
    # Map state codes to scrapers
    scrapers = {
        'TX': TexasScraper,
        # 'CA': CaliforniaScraper,  # To be implemented
        # 'FL': FloridaScraper,     # To be implemented
        # ... add more states
    }
    
    if args.state not in scrapers:
        logger.error(f"No scraper implemented for state: {args.state}")
        logger.info(f"Available states: {', '.join(scrapers.keys())}")
        exit(1)
    
    # Run scraper
    scraper_class = scrapers[args.state]
    scraper = scraper_class()
    
    state_data = scraper.scrape_all()
    scraper.export_json(state_data, args.output)
    
    logger.info("=" * 60)
    logger.info(f"✅ Scraping complete for {state_data.state}")
    logger.info(f"📊 Benefits found: {len(state_data.benefits)}")
    logger.info(f"💾 Saved to: {args.output}")
    logger.info("=" * 60)
    
    # Print summary
    categories = {}
    for benefit in state_data.benefits:
        categories[benefit.category] = categories.get(benefit.category, 0) + 1
    
    print("\nBenefits by category:")
    for category, count in sorted(categories.items()):
        print(f"  {category}: {count}")
