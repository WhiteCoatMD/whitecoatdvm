# Shelter Outreach Tools

## Quick Start

```bash
# Scrape shelters from one state (e.g., Texas, 10 pages)
npm run scrape TX 10

# Scrape multiple states (runs through top 30 states)
npm run scrape:all
```

## Files

- `shelter-scraper.js` - Main scraper for Petfinder shelter directory
- `scrape-all-states.js` - Batch runner for multiple states
- `starter-list.csv` - Manual starter list of 25+ major shelters
- `output/` - Generated CSV and JSON files go here

## Output Format

CSV columns:
- Name
- Email
- Phone
- City
- State
- Zip
- Website
- Petfinder URL

## Usage Tips

1. **Start small**: Test with one state first
   ```bash
   node tools/shelter-scraper.js CA 3
   ```

2. **Rate limiting**: The scraper waits 2 seconds between requests to be respectful

3. **Combine results**: After running multiple states, use the combined CSV in `output/ALL_SHELTERS_*.csv`

4. **Manual enrichment**: Many shelters don't list email publicly - you may need to visit websites to find contact forms

## Email Template (Updated)

**Subject:** Partnership opportunity for [Shelter Name] adopters

```
Hi [Name],

I'm reaching out from WhiteCoat DVM, a 24/7 televet service.

We'd like to partner with [Shelter Name] to offer your adopters
discounted access to unlimited vet consultations — and pay you
$10/month for every adopter who subscribes.

Why this works for shelters:
• Adopters get immediate vet access for those "is this normal?" questions
• Reduces returns due to unexpected health concerns
• Creates recurring revenue for your organization ($10/mo per subscriber)

Would you have 15 minutes this week to discuss? I can send over
materials you can include in your adoption packets.

Best,
[Your name]
WhiteCoat DVM
```

## Alternative Data Sources

If Petfinder scraping is slow or blocked:

1. **Adopt-a-Pet**: Change source in scraper
2. **Rescue Groups API**: https://rescuegroups.org/services/adoptable-pet-data-api/
3. **Petfinder API**: https://www.petfinder.com/developers/ (requires registration)
4. **Manual Google Search**: "animal shelter" + [city] + "contact"
