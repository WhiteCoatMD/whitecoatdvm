/**
 * Multi-State Shelter Scraper
 * Runs the shelter scraper across multiple states
 * Usage: node scrape-all-states.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Top states by shelter count - adjust priority as needed
const STATES = [
    // High priority - large states with many shelters
    'CA', 'TX', 'FL', 'NY', 'PA',
    // Medium priority
    'OH', 'IL', 'GA', 'NC', 'MI',
    'NJ', 'VA', 'WA', 'AZ', 'MA',
    'TN', 'IN', 'MO', 'MD', 'WI',
    // Add more as needed
    'CO', 'MN', 'SC', 'AL', 'LA',
    'KY', 'OR', 'OK', 'CT', 'UT'
];

const PAGES_PER_STATE = 5; // Adjust based on needs

async function runAllStates() {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║        🐕 Multi-State Shelter Scraper 🐈             ║
╠═══════════════════════════════════════════════════════╣
║  Scraping ${STATES.length} states, ${PAGES_PER_STATE} pages each                     ║
╚═══════════════════════════════════════════════════════╝
`);

    const results = [];

    for (let i = 0; i < STATES.length; i++) {
        const state = STATES[i];
        console.log(`\n[${ i + 1}/${STATES.length}] Scraping ${state}...`);

        try {
            execSync(`node shelter-scraper.js ${state} ${PAGES_PER_STATE}`, {
                cwd: __dirname,
                stdio: 'inherit'
            });
            results.push({ state, status: 'success' });
        } catch (err) {
            console.error(`Error scraping ${state}: ${err.message}`);
            results.push({ state, status: 'error', error: err.message });
        }

        // Longer delay between states
        console.log(`Waiting 10 seconds before next state...`);
        await new Promise(r => setTimeout(r, 10000));
    }

    // Combine all CSVs into master file
    combineResults();

    console.log(`\n✅ Complete! Scraped ${results.filter(r => r.status === 'success').length}/${STATES.length} states`);
}

function combineResults() {
    const outputDir = path.join(__dirname, 'output');
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.csv'));

    if (files.length === 0) return;

    const allRows = [];
    let headers = '';

    for (const file of files) {
        const content = fs.readFileSync(path.join(outputDir, file), 'utf-8');
        const lines = content.split('\n');

        if (!headers && lines[0]) {
            headers = lines[0];
        }

        // Skip header row for subsequent files
        allRows.push(...lines.slice(1).filter(line => line.trim()));
    }

    const masterFile = path.join(outputDir, `ALL_SHELTERS_${new Date().toISOString().slice(0, 10)}.csv`);
    fs.writeFileSync(masterFile, [headers, ...allRows].join('\n'));

    console.log(`\n📊 Combined ${allRows.length} shelters into: ${masterFile}`);
}

runAllStates().catch(console.error);
