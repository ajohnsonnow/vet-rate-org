"""
Simple State Scraper Base - No Abstract Methods
For quick state scraper implementation
"""

import sys
import json
import time
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from abc import ABC

# Reuse data models from base_scraper
sys.path.append(str(Path(__file__).parent))
from base_scraper import logger


@dataclass
class Requirements:
    """Eligibility requirements"""
    min_rating: int
    residency_required: bool = True
    disability_specific: Optional[List[str]] = None
    additional_notes: Optional[List[str]] = None


@dataclass
class LegalCitation:
    """Legal statute reference"""
    statute: str
    description: str
    url: str


@dataclass
class Benefit:
    """A veteran benefit"""
    state: str
    state_code: str
    name: str
    category: str
    description: str
    estimated_value: str
    requirements: Requirements
    how_to_apply: str
    legal_citations: List[LegalCitation]
    source_url: str
    last_verified: str
    
    def to_dict(self):
        """Convert to JSON-serializable dict"""
        return {
            'state': self.state,
            'state_code': self.state_code,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'estimated_value': self.estimated_value,
            'requirements': {
                'min_rating': self.requirements.min_rating,
                'residency_required': self.requirements.residency_required,
                'disability_specific': self.requirements.disability_specific,
                'additional_notes': self.requirements.additional_notes
            },
            'how_to_apply': self.how_to_apply,
            'legal_citations': [
                {
                    'statute': lc.statute,
                    'description': lc.description,
                    'url': lc.url
                } for lc in self.legal_citations
            ],
            'source_url': self.source_url,
            'last_verified': self.last_verified
        }


class SimpleStateScraper(ABC):
    """Simple base class for state scrapers"""
    
    def __init__(self, state_name: str, state_code: str, base_url: str):
        self.state_name = state_name
        self.state_code = state_code
        self.base_url = base_url
    
    def scrape_benefits(self) -> List[Benefit]:
        """Override this method in subclass"""
        return []
    
    def run(self, output_dir: str = "output"):
        """Run scraper and save output"""
        logger.info(f"Scraping {self.state_name}...")
        time.sleep(1)  # Rate limiting
        
        benefits = self.scrape_benefits()
        
        # Create output structure
        output = {
            'state': self.state_name,
            'state_code': self.state_code,
            'last_updated': datetime.now().strftime("%Y-%m-%d"),
            'official_source': self.base_url,
            'data_status': 'needs_validation',
            'benefits': [b.to_dict() for b in benefits]
        }
        
        # Save to file
        Path(output_dir).mkdir(exist_ok=True)
        output_file = Path(output_dir) / f"{self.state_code.lower()}_benefits.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ {self.state_code} complete: {len(benefits)} benefits")
        return output
