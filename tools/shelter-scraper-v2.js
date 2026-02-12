/**
 * Shelter Contact Scraper v2
 * Uses Google search results and direct shelter website scraping
 * Usage: node shelter-scraper-v2.js [state] [city]
 * Example: node shelter-scraper-v2.js TX Houston
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DELAY_BETWEEN_REQUESTS = 3000;

class ShelterScraperV2 {
    constructor(state, city = null) {
        this.state = state.toUpperCase();
        this.city = city;
        this.shelters = [];
        this.outputDir = path.join(__dirname, 'output');
    }

    fetch(url, followRedirects = true) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const req = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                },
                timeout: 15000
            }, (res) => {
                if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let redirectUrl = res.headers.location;
                    if (redirectUrl.startsWith('/')) {
                        const urlObj = new URL(url);
                        redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                    }
                    return this.fetch(redirectUrl, true).then(resolve).catch(reject);
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Extract contact info from any webpage
    extractContactInfo(html, url, name = '') {
        const info = {
            name: name,
            url: url,
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            facebook: '',
            instagram: ''
        };

        // Clean HTML for text extraction
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ');

        // Extract name from title if not provided
        if (!info.name) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                info.name = titleMatch[1]
                    .replace(/\s*[-|–]\s*.*/g, '')
                    .replace(/Home\s*/i, '')
                    .trim();
            }
        }

        // Extract emails (multiple patterns)
        const emailPatterns = [
            /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:org|com|net|edu)/gi
        ];

        for (const pattern of emailPatterns) {
            const matches = html.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const email = match.replace('mailto:', '').toLowerCase();
                    // Filter out common non-contact emails
                    if (!email.includes('example.') &&
                        !email.includes('sentry') &&
                        !email.includes('wixpress') &&
                        !email.includes('google') &&
                        !email.includes('facebook')) {
                        info.email = email;
                        break;
                    }
                }
                if (info.email) break;
            }
        }

        // Extract phone numbers
        const phonePatterns = [
            /tel:([0-9+\-() .]+)/i,
            /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
        ];

        for (const pattern of phonePatterns) {
            const match = html.match(pattern);
            if (match) {
                info.phone = match[1] || match[0];
                info.phone = info.phone.replace(/[^\d]/g, '');
                if (info.phone.length === 10) {
                    info.phone = `(${info.phone.slice(0,3)}) ${info.phone.slice(3,6)}-${info.phone.slice(6)}`;
                    break;
                }
            }
        }

        // Extract social media
        const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9.]+)/i);
        if (fbMatch) info.facebook = `https://facebook.com/${fbMatch[1]}`;

        const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
        if (igMatch) info.instagram = `https://instagram.com/${igMatch[1]}`;

        // Extract address patterns
        const addressMatch = textContent.match(/\d+[^,]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5}/i);
        if (addressMatch) {
            info.address = addressMatch[0].trim();
            const cityStateZip = info.address.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})/i);
            if (cityStateZip) {
                info.city = cityStateZip[1].trim();
                info.state = cityStateZip[2].toUpperCase();
            }
        }

        return info;
    }

    // Scrape a list of known shelter directories
    async scrapeDirectory(directoryUrl, parser) {
        try {
            console.log(`📡 Fetching directory: ${directoryUrl}`);
            const html = await this.fetch(directoryUrl);
            return parser(html);
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
            return [];
        }
    }

    // Main scraping function
    async scrape() {
        console.log(`\n🐾 Shelter Scraper v2`);
        console.log(`   State: ${this.state}${this.city ? ', City: ' + this.city : ''}\n`);

        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // List of shelter URLs to try for this state
        // These are common shelter website patterns
        const shelterPatterns = this.generateShelterUrls();

        console.log(`🔍 Checking ${shelterPatterns.length} potential shelter websites...\n`);

        for (let i = 0; i < shelterPatterns.length; i++) {
            const { url, name } = shelterPatterns[i];
            console.log(`[${i + 1}/${shelterPatterns.length}] ${name || url}`);

            try {
                const html = await this.fetch(url);
                const info = this.extractContactInfo(html, url, name);

                if (info.email || info.phone) {
                    this.shelters.push(info);
                    console.log(`   ✅ Found: ${info.email || info.phone}`);
                } else {
                    console.log(`   ⚠️  No contact info found`);
                }

                await this.delay(DELAY_BETWEEN_REQUESTS);
            } catch (err) {
                console.log(`   ❌ ${err.message}`);
            }
        }

        this.saveResults();
    }

    // Generate list of shelter URLs based on state
    generateShelterUrls() {
        const stateNames = {
            'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas',
            'CA': 'california', 'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware',
            'FL': 'florida', 'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho',
            'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa', 'KS': 'kansas',
            'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
            'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi',
            'MO': 'missouri', 'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada',
            'NH': 'newhampshire', 'NJ': 'newjersey', 'NM': 'newmexico', 'NY': 'newyork',
            'NC': 'northcarolina', 'ND': 'northdakota', 'OH': 'ohio', 'OK': 'oklahoma',
            'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhodeisland', 'SC': 'southcarolina',
            'SD': 'southdakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah',
            'VT': 'vermont', 'VA': 'virginia', 'WA': 'washington', 'WV': 'westvirginia',
            'WI': 'wisconsin', 'WY': 'wyoming'
        };

        const stateName = stateNames[this.state] || this.state.toLowerCase();
        const urls = [];

        // Major cities by state for targeted searching
        const majorCities = {
            'TX': ['houston', 'dallas', 'austin', 'sanantonio', 'fortworth', 'elpaso', 'arlington', 'plano'],
            'CA': ['losangeles', 'sandiego', 'sanjose', 'sanfrancisco', 'fresno', 'sacramento', 'oakland', 'longbeach'],
            'FL': ['miami', 'jacksonville', 'tampa', 'orlando', 'stpetersburg', 'fortlauderdale', 'tallahassee'],
            'NY': ['newyork', 'buffalo', 'rochester', 'albany', 'syracuse', 'longisland'],
            'PA': ['philadelphia', 'pittsburgh', 'allentown', 'erie', 'reading', 'scranton'],
            'IL': ['chicago', 'aurora', 'naperville', 'rockford', 'joliet', 'springfield'],
            'OH': ['columbus', 'cleveland', 'cincinnati', 'toledo', 'akron', 'dayton'],
            'GA': ['atlanta', 'savannah', 'augusta', 'macon', 'athens'],
            'NC': ['charlotte', 'raleigh', 'greensboro', 'durham', 'wilmington'],
            'MI': ['detroit', 'grandrapids', 'warren', 'annarbor', 'lansing']
        };

        const cities = this.city ? [this.city.toLowerCase().replace(/\s+/g, '')] : (majorCities[this.state] || []);

        // Common shelter naming patterns
        for (const city of cities) {
            const patterns = [
                { url: `https://${city}spca.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} SPCA` },
                { url: `https://www.${city}spca.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} SPCA` },
                { url: `https://${city}humane.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Humane Society` },
                { url: `https://www.${city}humane.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Humane Society` },
                { url: `https://${city}humanesociety.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Humane Society` },
                { url: `https://www.${city}humanesociety.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Humane Society` },
                { url: `https://${city}animalshelter.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Animal Shelter` },
                { url: `https://${city}petrescue.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Pet Rescue` },
                { url: `https://${city}animalrescue.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Animal Rescue` },
                { url: `https://www.${city}petsalive.org`, name: `${city.charAt(0).toUpperCase() + city.slice(1)} Pets Alive` },
            ];
            urls.push(...patterns);
        }

        // State-level organizations
        urls.push(
            { url: `https://${stateName}spca.org`, name: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} SPCA` },
            { url: `https://www.${stateName}humane.org`, name: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} Humane Society` },
            { url: `https://${stateName}humanesociety.org`, name: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} Humane Society` }
        );

        return urls;
    }

    saveResults() {
        const timestamp = new Date().toISOString().slice(0, 10);
        const suffix = this.city ? `_${this.city}` : '';
        const baseFilename = `shelters_v2_${this.state}${suffix}_${timestamp}`;

        // CSV
        const csvPath = path.join(this.outputDir, `${baseFilename}.csv`);
        const csvHeaders = ['Name', 'Email', 'Phone', 'City', 'State', 'Address', 'Website', 'Facebook', 'Instagram'];
        const csvRows = this.shelters.map(s => [
            `"${(s.name || '').replace(/"/g, '""')}"`,
            s.email || '',
            s.phone || '',
            `"${(s.city || '').replace(/"/g, '""')}"`,
            s.state || '',
            `"${(s.address || '').replace(/"/g, '""')}"`,
            s.url || '',
            s.facebook || '',
            s.instagram || ''
        ].join(','));

        fs.writeFileSync(csvPath, [csvHeaders.join(','), ...csvRows].join('\n'));

        // JSON
        const jsonPath = path.join(this.outputDir, `${baseFilename}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(this.shelters, null, 2));

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ COMPLETE`);
        console.log(`${'='.repeat(50)}`);
        console.log(`   Shelters found: ${this.shelters.length}`);
        console.log(`   With email:     ${this.shelters.filter(s => s.email).length}`);
        console.log(`   With phone:     ${this.shelters.filter(s => s.phone).length}`);
        console.log(`\n   CSV: ${csvPath}`);
        console.log(`   JSON: ${jsonPath}\n`);
    }
}

// CLI
async function main() {
    const args = process.argv.slice(2);
    const state = args[0] || 'TX';
    const city = args[1] || null;

    console.log(`
╔═══════════════════════════════════════════════════════╗
║         🐕 Shelter Scraper v2 🐈                     ║
╠═══════════════════════════════════════════════════════╣
║  Usage: node shelter-scraper-v2.js [STATE] [CITY]     ║
║  Example: node shelter-scraper-v2.js TX Houston       ║
╚═══════════════════════════════════════════════════════╝
`);

    const scraper = new ShelterScraperV2(state, city);
    await scraper.scrape();
}

main().catch(console.error);
