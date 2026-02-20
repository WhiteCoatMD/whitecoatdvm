/**
 * Shelter Contact Scraper
 * Pulls shelter contact info from the master database by state
 * and merges with existing data via combine-and-clean.js
 *
 * Usage: node shelter-scraper.js [state] [limit]
 * Example: node shelter-scraper.js TX 100
 *
 * Data source: shelter-database.csv (9,500+ US shelters from Petfinder)
 * If RESCUEGROUPS_API_KEY is set, also fetches from RescueGroups API
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = 'TX';
const DEFAULT_LIMIT = 200;

const STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

// ============================================
// CSV HELPERS
// ============================================

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function loadDatabase(filepath) {
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').trim();
        });
        rows.push(row);
    }

    return rows;
}

// ============================================
// DATABASE SCRAPER (local CSV)
// ============================================

function scrapeFromDatabase(state, limit) {
    const dbPath = path.join(__dirname, 'shelter-database.csv');

    if (!fs.existsSync(dbPath)) {
        console.log('   shelter-database.csv not found');
        return [];
    }

    console.log('Loading shelter database...');
    const all = loadDatabase(dbPath);
    console.log(`   Total in database: ${all.length}`);

    // Filter by state
    const stateFiltered = all.filter(s =>
        (s.state || '').toUpperCase() === state.toUpperCase()
    );
    console.log(`   Shelters in ${state}: ${stateFiltered.length}`);

    // Only keep those with email
    const withEmail = stateFiltered.filter(s => s.email && s.email.includes('@'));
    console.log(`   With email: ${withEmail.length}`);

    // Limit results
    const results = withEmail.slice(0, limit);
    console.log(`   Returning: ${results.length}\n`);

    return results.map(s => ({
        name: s.name || '',
        email: (s.email || '').toLowerCase(),
        phone: s.phone || '',
        city: s.city || '',
        state: (s.state || '').toUpperCase(),
        zip: s.zip || '',
        website: s.website || ''
    }));
}

// ============================================
// RESCUEGROUPS API SCRAPER (optional)
// ============================================

async function scrapeFromRescueGroups(state, maxPages) {
    const apiKey = process.env.RESCUEGROUPS_API_KEY;
    if (!apiKey) {
        console.log('   RESCUEGROUPS_API_KEY not set, skipping API scrape\n');
        return [];
    }

    console.log('Fetching from RescueGroups API...');
    const stateName = STATE_NAMES[state] || state;
    const shelters = [];

    for (let page = 1; page <= maxPages; page++) {
        try {
            const url = `https://api.rescuegroups.org/v5/public/orgs/search/shelter/?limit=250&page=${page}&sort=orgs.name`;
            const body = JSON.stringify({
                data: {
                    filters: [{
                        fieldName: 'orgs.state',
                        operation: 'equal',
                        criteria: stateName
                    }]
                }
            });

            const data = await apiRequest(url, apiKey, body);
            const orgs = data.data || [];

            if (orgs.length === 0) break;

            for (const org of orgs) {
                const attrs = org.attributes || {};
                if (attrs.name && attrs.email) {
                    const phone = (attrs.phone || '').replace(/\D/g, '');
                    shelters.push({
                        name: attrs.name,
                        email: (attrs.email || '').toLowerCase().trim(),
                        phone: phone.length === 10
                            ? `(${phone.slice(0,3)}) ${phone.slice(3,6)}-${phone.slice(6)}`
                            : '',
                        city: attrs.city || '',
                        state: (attrs.state || '').toUpperCase().slice(0, 2),
                        zip: attrs.postalcode || '',
                        website: attrs.url || ''
                    });
                }
            }

            console.log(`   Page ${page}: ${orgs.length} orgs found`);
            const totalPages = data.meta?.pages || maxPages;
            if (page >= totalPages) break;

            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.error(`   API error on page ${page}: ${err.message}`);
            break;
        }
    }

    console.log(`   Total from API: ${shelters.length}\n`);
    return shelters;
}

function apiRequest(url, apiKey, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': apiKey
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                } else {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('Invalid JSON')); }
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

// ============================================
// MAIN
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const state = (args[0] || DEFAULT_STATE).toUpperCase();
    const limit = parseInt(args[1]) || DEFAULT_LIMIT;

    console.log(`
================================================
     Shelter Contact Scraper
================================================
  State: ${state} (${STATE_NAMES[state] || state})
  Limit: ${limit}
================================================
`);

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Source 1: Local database (always available)
    const dbShelters = scrapeFromDatabase(state, limit);

    // Source 2: RescueGroups API (if key available)
    const apiShelters = await scrapeFromRescueGroups(state, 3);

    // Merge and deduplicate
    const allShelters = [...dbShelters, ...apiShelters];
    const seen = new Set();
    const shelters = [];

    for (const s of allShelters) {
        const key = s.email.toLowerCase();
        if (key && !seen.has(key)) {
            seen.add(key);
            shelters.push(s);
        }
    }

    console.log(`Combined unique shelters: ${shelters.length}`);

    // Save results
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseFilename = `shelters_${state}_${timestamp}`;

    // CSV
    const csvPath = path.join(outputDir, `${baseFilename}.csv`);
    const csvHeaders = ['Name', 'Email', 'Phone', 'City', 'State', 'Zip', 'Website'];
    const csvRows = shelters.map(s => [
        `"${(s.name || '').replace(/"/g, '""')}"`,
        s.email || '',
        s.phone || '',
        `"${(s.city || '').replace(/"/g, '""')}"`,
        s.state || '',
        s.zip || '',
        s.website || ''
    ].join(','));

    fs.writeFileSync(csvPath, [csvHeaders.join(','), ...csvRows].join('\n'));

    // JSON
    const jsonPath = path.join(outputDir, `${baseFilename}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(shelters, null, 2));

    const withEmail = shelters.filter(s => s.email).length;
    const withPhone = shelters.filter(s => s.phone).length;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`SCRAPING COMPLETE`);
    console.log(`${'='.repeat(50)}`);
    console.log(`   Total shelters: ${shelters.length}`);
    console.log(`   With email:     ${withEmail}`);
    console.log(`   With phone:     ${withPhone}`);
    console.log(`\n   CSV:  ${csvPath}`);
    console.log(`   JSON: ${jsonPath}\n`);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
