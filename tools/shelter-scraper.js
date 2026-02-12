/**
 * Shelter Contact Scraper
 * Scrapes publicly available shelter/rescue contact info from Petfinder
 * Usage: node shelter-scraper.js [state] [pages]
 * Example: node shelter-scraper.js TX 5
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// State codes to scrape (can override with CLI arg)
const DEFAULT_STATE = 'TX';
const DEFAULT_PAGES = 10;

// Rate limiting - be respectful
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

class ShelterScraper {
    constructor(state, maxPages) {
        this.state = state.toUpperCase();
        this.maxPages = maxPages;
        this.shelters = [];
        this.outputDir = path.join(__dirname, 'output');
    }

    // Simple HTTPS GET request
    fetch(url) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    // Parse shelter listing page
    parseShelterList(html) {
        const shelters = [];

        // Match shelter cards - Petfinder uses specific patterns
        const shelterPattern = /<a[^>]*href="(\/shelters\/[^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;
        const locationPattern = /<span[^>]*class="[^"]*cityState[^"]*"[^>]*>([^<]+)<\/span>/gi;

        let match;
        while ((match = shelterPattern.exec(html)) !== null) {
            shelters.push({
                url: 'https://www.petfinder.com' + match[1],
                name: match[2].trim()
            });
        }

        return shelters;
    }

    // Parse individual shelter page for contact details
    parseShelterDetails(html, shelterUrl) {
        const details = {
            url: shelterUrl,
            name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            website: ''
        };

        // Extract name
        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (nameMatch) details.name = nameMatch[1].trim();

        // Extract email - look for mailto links or email patterns
        const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch) details.email = emailMatch[1];

        // Fallback email pattern
        if (!details.email) {
            const emailPattern = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailPattern) details.email = emailPattern[0];
        }

        // Extract phone
        const phoneMatch = html.match(/tel:([0-9-+() ]+)/i);
        if (phoneMatch) details.phone = phoneMatch[1].replace(/\D/g, '');

        // Fallback phone pattern
        if (!details.phone) {
            const phonePattern = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phonePattern) details.phone = phonePattern[0];
        }

        // Extract address components
        const addressMatch = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
        if (addressMatch) {
            const addrText = addressMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            details.address = addrText;

            // Try to parse city, state, zip
            const cityStateZip = addrText.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})?/i);
            if (cityStateZip) {
                details.city = cityStateZip[1].trim();
                details.state = cityStateZip[2].toUpperCase();
                details.zip = cityStateZip[3] || '';
            }
        }

        // Extract website
        const websiteMatch = html.match(/href="(https?:\/\/(?!www\.petfinder)[^"]+)"[^>]*>.*?(?:website|visit|site)/i);
        if (websiteMatch) details.website = websiteMatch[1];

        return details;
    }

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Main scraping function
    async scrape() {
        console.log(`\n🐾 Starting shelter scraper for state: ${this.state}`);
        console.log(`   Scraping up to ${this.maxPages} pages...\n`);

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Step 1: Get shelter listing URLs
        const shelterUrls = [];

        for (let page = 1; page <= this.maxPages; page++) {
            const listUrl = `https://www.petfinder.com/animal-shelters-and-rescues/search/?page=${page}&state=${this.state}`;
            console.log(`📄 Fetching page ${page}...`);

            try {
                const html = await this.fetch(listUrl);
                const pageShelters = this.parseShelterList(html);

                if (pageShelters.length === 0) {
                    console.log(`   No more shelters found. Stopping.`);
                    break;
                }

                shelterUrls.push(...pageShelters);
                console.log(`   Found ${pageShelters.length} shelters`);

                await this.delay(DELAY_BETWEEN_REQUESTS);
            } catch (err) {
                console.error(`   Error on page ${page}: ${err.message}`);
            }
        }

        console.log(`\n📋 Found ${shelterUrls.length} total shelters. Fetching details...\n`);

        // Step 2: Get details for each shelter
        for (let i = 0; i < shelterUrls.length; i++) {
            const shelter = shelterUrls[i];
            console.log(`🔍 [${i + 1}/${shelterUrls.length}] ${shelter.name || shelter.url}`);

            try {
                const html = await this.fetch(shelter.url);
                const details = this.parseShelterDetails(html, shelter.url);

                // Only add if we got meaningful data
                if (details.name || details.email || details.phone) {
                    this.shelters.push(details);

                    if (details.email) {
                        console.log(`   ✅ Email: ${details.email}`);
                    } else {
                        console.log(`   ⚠️  No email found`);
                    }
                }

                await this.delay(DELAY_BETWEEN_REQUESTS);
            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
            }
        }

        // Step 3: Save results
        this.saveResults();
    }

    // Save to CSV and JSON
    saveResults() {
        const timestamp = new Date().toISOString().slice(0, 10);
        const baseFilename = `shelters_${this.state}_${timestamp}`;

        // Save as CSV
        const csvPath = path.join(this.outputDir, `${baseFilename}.csv`);
        const csvHeaders = ['Name', 'Email', 'Phone', 'City', 'State', 'Zip', 'Website', 'Petfinder URL'];
        const csvRows = this.shelters.map(s => [
            `"${(s.name || '').replace(/"/g, '""')}"`,
            s.email || '',
            s.phone || '',
            `"${(s.city || '').replace(/"/g, '""')}"`,
            s.state || '',
            s.zip || '',
            s.website || '',
            s.url || ''
        ].join(','));

        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
        fs.writeFileSync(csvPath, csvContent);

        // Save as JSON
        const jsonPath = path.join(this.outputDir, `${baseFilename}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(this.shelters, null, 2));

        // Summary
        const withEmail = this.shelters.filter(s => s.email).length;
        const withPhone = this.shelters.filter(s => s.phone).length;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ SCRAPING COMPLETE`);
        console.log(`${'='.repeat(50)}`);
        console.log(`   Total shelters: ${this.shelters.length}`);
        console.log(`   With email:     ${withEmail}`);
        console.log(`   With phone:     ${withPhone}`);
        console.log(`\n   CSV saved:  ${csvPath}`);
        console.log(`   JSON saved: ${jsonPath}`);
        console.log('');
    }
}

// Alternative: Use Adopt-a-Pet API (if Petfinder doesn't work well)
class AdoptAPetScraper {
    constructor(state, maxPages) {
        this.state = state.toUpperCase();
        this.maxPages = maxPages;
        this.shelters = [];
        this.outputDir = path.join(__dirname, 'output');
    }

    fetch(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : require('http');
            protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json,text/html'
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async scrape() {
        console.log(`\n🐾 Starting Adopt-a-Pet scraper for state: ${this.state}\n`);

        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Adopt-a-Pet shelter search
        const url = `https://www.adoptapet.com/shelter-search?location=${this.state}&shelter_type=all`;

        try {
            console.log(`📄 Fetching shelter list...`);
            const html = await this.fetch(url);

            // Parse shelter links
            const shelterPattern = /href="(\/adoption_rescue\/\d+-[^"]+)"/gi;
            const urls = new Set();
            let match;

            while ((match = shelterPattern.exec(html)) !== null) {
                urls.add('https://www.adoptapet.com' + match[1]);
            }

            console.log(`   Found ${urls.size} shelter pages\n`);

            // Fetch each shelter
            let count = 0;
            for (const shelterUrl of urls) {
                if (count >= this.maxPages * 20) break; // Limit total
                count++;

                console.log(`🔍 [${count}/${Math.min(urls.size, this.maxPages * 20)}] Fetching...`);

                try {
                    const shelterHtml = await this.fetch(shelterUrl);
                    const details = this.parseDetails(shelterHtml, shelterUrl);

                    if (details.name) {
                        this.shelters.push(details);
                        console.log(`   ✅ ${details.name} ${details.email ? '(has email)' : ''}`);
                    }

                    await this.delay(2000);
                } catch (err) {
                    console.error(`   ❌ Error: ${err.message}`);
                }
            }

            this.saveResults();
        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }

    parseDetails(html, url) {
        const details = { url, name: '', email: '', phone: '', city: '', state: '', website: '' };

        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (nameMatch) details.name = nameMatch[1].trim();

        const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch) details.email = emailMatch[1];

        const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) details.phone = phoneMatch[0];

        return details;
    }

    saveResults() {
        const timestamp = new Date().toISOString().slice(0, 10);
        const baseFilename = `shelters_adoptapet_${this.state}_${timestamp}`;

        const csvPath = path.join(this.outputDir, `${baseFilename}.csv`);
        const csvHeaders = ['Name', 'Email', 'Phone', 'City', 'State', 'Website', 'Source URL'];
        const csvRows = this.shelters.map(s => [
            `"${(s.name || '').replace(/"/g, '""')}"`,
            s.email || '',
            s.phone || '',
            `"${(s.city || '').replace(/"/g, '""')}"`,
            s.state || '',
            s.website || '',
            s.url || ''
        ].join(','));

        fs.writeFileSync(csvPath, [csvHeaders.join(','), ...csvRows].join('\n'));
        fs.writeFileSync(
            path.join(this.outputDir, `${baseFilename}.json`),
            JSON.stringify(this.shelters, null, 2)
        );

        console.log(`\n✅ Saved ${this.shelters.length} shelters to ${csvPath}\n`);
    }
}

// CLI Entry point
async function main() {
    const args = process.argv.slice(2);
    const state = args[0] || DEFAULT_STATE;
    const pages = parseInt(args[1]) || DEFAULT_PAGES;
    const source = args[2] || 'petfinder'; // 'petfinder' or 'adoptapet'

    console.log(`
╔═══════════════════════════════════════════════════════╗
║           🐕 Shelter Contact Scraper 🐈              ║
╠═══════════════════════════════════════════════════════╣
║  Usage: node shelter-scraper.js [STATE] [PAGES]       ║
║  Example: node shelter-scraper.js CA 10               ║
║                                                       ║
║  Options:                                             ║
║    STATE  - Two-letter state code (default: TX)       ║
║    PAGES  - Number of pages to scrape (default: 10)   ║
╚═══════════════════════════════════════════════════════╝
`);

    if (source === 'adoptapet') {
        const scraper = new AdoptAPetScraper(state, pages);
        await scraper.scrape();
    } else {
        const scraper = new ShelterScraper(state, pages);
        await scraper.scrape();
    }
}

main().catch(console.error);
