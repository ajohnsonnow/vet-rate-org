# State Benefits Scraper

## Overview

This directory contains Python scripts for scraping veteran benefits from official state websites. The scraped data will replace the current AI-generated content in the State Benefit Hunter feature.

## Current Status

⚠️ **NOT YET IMPLEMENTED** - This is the planned infrastructure.

Currently, State Benefit Hunter uses AI to generate benefit information. This directory provides the framework to migrate to scraped, verified data.

## Structure

```
state-benefits-scraper/
├── base_scraper.py          # Base class for all scrapers ✅ CREATED
├── scrapers/                # State-specific implementations
│   ├── texas_scraper.py     # Example in base_scraper.py
│   ├── california_scraper.py
│   └── ... (50 states + DC)
├── validators/
│   ├── validate_benefits.py # Validate scraped data structure
│   └── check_sources.py     # Verify URLs are still active
├── exporters/
│   └── generate_json.py     # Convert to VetRate JSON format
├── monitors/
│   └── update_checker.py    # Monitor for changes
└── output/                  # Generated JSON files
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### requirements.txt

```
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
selenium>=4.15.0
pydantic>=2.5.0
python-dateutil>=2.8.0
```

## Usage

### Running the Texas Example

```bash
python base_scraper.py --state TX --output output/texas_benefits.json
```

### Creating a New State Scraper

1. Copy the `TexasScraper` class from `base_scraper.py`
2. Create a new file: `scrapers/california_scraper.py`
3. Update the scraping logic for California's websites
4. Register it in the `scrapers` dict in `base_scraper.py`

Example:

```python
class CaliforniaScraper(BaseStateScraper):
    def __init__(self):
        super().__init__(
            state_name="California",
            state_code="CA",
            official_url="https://www.calvet.ca.gov/"
        )
    
    def scrape_property_tax_benefits(self) -> List[Benefit]:
        """Scrape CA property tax exemptions"""
        benefits = []
        
        # Fetch the official CA page
        soup = self.fetch_page(
            "https://www.calvet.ca.gov/veteran-services-benefits/property-tax"
        )
        
        if not soup:
            return benefits
        
        # Parse the HTML (implementation varies by state)
        # Look for benefit information in tables, lists, etc.
        
        benefits.append(Benefit(
            category="Property Tax",
            benefit_name="Disabled Veterans Property Tax Exemption",
            description="$161,083 exemption for 100% disabled veterans",
            value="$161,083 exemption (2026)",
            # ... etc
        ))
        
        return benefits
```

## Data Validation

After scraping, validate the data:

```python
from validators.validate_benefits import validate_state_data

state_data = scraper.scrape_all()

# Check for required fields, proper formatting, etc.
validation_result = validate_state_data(state_data)

if validation_result.is_valid:
    scraper.export_json(state_data, output_file)
else:
    print("Validation errors:", validation_result.errors)
```

## Integration with VetRate

Once data is scraped and validated:

1. **Export to JSON**: Run scraper and save to `output/`
2. **Copy to app**: Move JSON to `src/data/stateBenefits.js`
3. **Update search function**: Replace AI call with local query
4. **Test**: Verify benefits show correctly in UI

See: `docs/STATE_BENEFIT_HUNTER_IMPLEMENTATION.md` for full migration guide.

## Rate Limiting & Ethics

**IMPORTANT**: Respect the servers you're scraping!

- Wait 1-2 seconds between requests
- Check `robots.txt` before scraping
- Identify your bot in User-Agent header
- Don't scrape during peak hours
- Cache results to minimize requests

Example from base_scraper.py:

```python
self.session.headers.update({
    'User-Agent': 'VetRate State Benefits Research Bot (contact@vetrate.org)'
})
time.sleep(1.0)  # Wait between requests
```

## Monitoring for Updates

Run the update checker to detect when state websites change:

```bash
python monitors/update_checker.py
```

This should run:
- **Daily**: Check for page changes
- **Monthly**: Alert on state law changes
- **Quarterly**: Trigger full re-scrape

## State-by-State Implementation Checklist

Track progress for all 50 states + DC:

### High Priority (Most Veterans)

- [ ] Texas - Example in `base_scraper.py`
- [ ] California
- [ ] Florida
- [ ] Virginia
- [ ] North Carolina
- [ ] Georgia
- [ ] Washington
- [ ] Pennsylvania
- [ ] Arizona
- [ ] Ohio

### Medium Priority

- [ ] Colorado
- [ ] Maryland
- [ ] Tennessee
- [ ] Indiana
- [ ] South Carolina
- [ ] Michigan
- [ ] Missouri
- [ ] New York
- [ ] Oregon
- [ ] Kentucky

### Lower Priority

- [ ] (Remaining states + DC)

## Common Data Sources by State

Most states have similar structure:

### Property Tax
- State Comptroller website
- County Assessor guidelines
- State Tax Code

### Vehicle Registration
- State DMV/Motor Vehicle Department
- Special license plate programs

### Education
- State Veterans Commission
- Higher Education Coordinating Board
- Tuition waiver programs

### Recreation
- Wildlife/Game & Fish Department
- State Parks Department

## Output Format

Scraped data should match this JSON structure:

```json
{
  "state": "Texas",
  "stateCode": "TX",
  "lastUpdated": "2026-01-24",
  "officialSource": "https://www.tvc.texas.gov/",
  "dataStatus": "validated",
  "benefits": [
    {
      "category": "Property Tax",
      "benefitName": "100% Disabled Veteran Property Tax Exemption",
      "value": "Full exemption",
      "estimatedAnnualValue": 4000,
      "requirements": {
        "minRating": 100,
        "isPermanentTotal": false,
        "otherReqs": ["Texas resident"]
      },
      "legalCitation": {
        "statute": "Texas Tax Code §11.131"
      }
    }
  ]
}
```

## Troubleshooting

### Scraper fails to fetch page

- Check if URL is correct
- Verify website is online
- Some sites require JavaScript (use Selenium)
- Check if IP is blocked (rate limiting)

### Parsing fails

- Inspect HTML structure with browser DevTools
- Website may have changed layout
- Try different CSS selectors
- Consider using Selenium for dynamic content

### Data validation errors

- Check all required fields are present
- Verify data types (numbers, strings)
- Ensure categories match allowed values
- Check URLs are valid

## Contributing

When adding a new state scraper:

1. Create implementation following `BaseStateScraper`
2. Add comprehensive documentation
3. Test with actual state websites
4. Validate output structure
5. Submit with example output JSON

## Legal Disclaimer

This scraper collects publicly available information from government websites for educational purposes. Always:

- Respect copyright notices
- Follow terms of service
- Attribute sources properly
- Verify data accuracy
- Include disclaimers in app

## Resources

### Scraping Libraries

- **BeautifulSoup**: HTML parsing
- **Selenium**: JavaScript-heavy sites
- **Scrapy**: Large-scale scraping
- **lxml**: Fast XML/HTML parsing

### State Resources

- State VA offices: https://www.va.gov/statedva.htm
- Property tax info: Each state comptroller
- Legal citations: Justia, FindLaw

## Next Steps

1. **Start with MVP**: Implement 10 high-priority states
2. **Validate data**: Legal review for accuracy
3. **Integrate**: Update VetRate app to use scraped data
4. **Monitor**: Set up automated update checking
5. **Expand**: Add remaining 40+ states

See full implementation plan: `docs/STATE_BENEFIT_HUNTER_IMPLEMENTATION.md`

---

**Status**: Planning/Infrastructure  
**Created**: 2026-01-24  
**Maintainer**: VetRate Development Team
