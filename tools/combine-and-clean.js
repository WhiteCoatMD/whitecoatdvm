/**
 * Combine and Clean Shelter Data
 * Deduplicates, validates, and merges all scraped shelter data
 * Usage: node combine-and-clean.js
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');

function loadCSV(filepath) {
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row);
    }

    return rows;
}

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

function validateEmail(email) {
    if (!email) return '';
    email = email.toLowerCase().trim();
    // Basic validation
    if (!email.includes('@') || !email.includes('.')) return '';
    // Filter out junk
    if (email.includes('example') || email.includes('test@')) return '';
    return email;
}

function validatePhone(phone) {
    if (!phone) return '';
    // Extract just digits
    const digits = phone.replace(/\D/g, '');
    // Must be 10 digits (US)
    if (digits.length !== 10) return '';
    // Filter out obvious fakes
    if (digits === '6666666666' || digits === '0000000000') return '';
    if (digits.startsWith('176') || digits.startsWith('155') || digits.startsWith('204')) return ''; // Invalid area codes
    // Format nicely
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}

function cleanName(name) {
    if (!name) return '';
    return name
        .replace(/"/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100); // Limit length
}

function main() {
    console.log('🧹 Combining and cleaning shelter data...\n');

    // Find all CSV files
    const files = fs.readdirSync(outputDir).filter(f =>
        f.endsWith('.csv') &&
        !f.startsWith('ALL_') &&
        !f.startsWith('CLEAN_')
    );

    console.log(`Found ${files.length} CSV files to process\n`);

    // Load all data
    const allShelters = [];

    for (const file of files) {
        const filepath = path.join(outputDir, file);
        const rows = loadCSV(filepath);
        console.log(`  ${file}: ${rows.length} rows`);
        allShelters.push(...rows);
    }

    // Also load starter list
    const starterPath = path.join(__dirname, 'starter-list.csv');
    if (fs.existsSync(starterPath)) {
        const starterRows = loadCSV(starterPath);
        console.log(`  starter-list.csv: ${starterRows.length} rows`);
        allShelters.push(...starterRows);
    }

    console.log(`\nTotal raw records: ${allShelters.length}`);

    // Clean and deduplicate
    const seen = new Set();
    const cleaned = [];

    for (const shelter of allShelters) {
        const name = cleanName(shelter.name);
        const email = validateEmail(shelter.email);
        const phone = validatePhone(shelter.phone);

        // Skip if no contact info
        if (!email && !phone) continue;

        // Skip if no name
        if (!name) continue;

        // Create dedup key
        const key = (name + email + phone).toLowerCase().replace(/\s+/g, '');
        if (seen.has(key)) continue;
        seen.add(key);

        cleaned.push({
            name,
            email,
            phone,
            city: (shelter.city || '').replace(/"/g, '').trim().slice(0, 50),
            state: (shelter.state || '').toUpperCase().slice(0, 2),
            website: shelter.website || shelter.url || '',
            facebook: shelter.facebook || '',
            type: shelter.type || 'Shelter',
            notes: shelter.notes || ''
        });
    }

    console.log(`After cleaning: ${cleaned.length} unique shelters`);
    console.log(`  With email: ${cleaned.filter(s => s.email).length}`);
    console.log(`  With phone: ${cleaned.filter(s => s.phone).length}`);

    // Sort by state, then name
    cleaned.sort((a, b) => {
        if (a.state !== b.state) return a.state.localeCompare(b.state);
        return a.name.localeCompare(b.name);
    });

    // Save cleaned data
    const timestamp = new Date().toISOString().slice(0, 10);
    const cleanedPath = path.join(outputDir, `CLEAN_shelters_${timestamp}.csv`);

    const headers = ['Name', 'Email', 'Phone', 'City', 'State', 'Website', 'Facebook', 'Type', 'Notes'];
    const csvRows = cleaned.map(s => [
        `"${s.name}"`,
        s.email,
        s.phone,
        `"${s.city}"`,
        s.state,
        s.website,
        s.facebook,
        s.type,
        `"${s.notes}"`
    ].join(','));

    fs.writeFileSync(cleanedPath, [headers.join(','), ...csvRows].join('\n'));

    // Also save JSON
    const jsonPath = path.join(outputDir, `CLEAN_shelters_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(cleaned, null, 2));

    console.log(`\n✅ Saved to:`);
    console.log(`   ${cleanedPath}`);
    console.log(`   ${jsonPath}\n`);

    // Print sample
    console.log('Sample records:');
    console.log('─'.repeat(60));
    for (const s of cleaned.slice(0, 5)) {
        console.log(`${s.name}`);
        console.log(`  📧 ${s.email || '(no email)'}`);
        console.log(`  📞 ${s.phone || '(no phone)'}`);
        console.log(`  📍 ${s.city}, ${s.state}`);
        console.log('');
    }
}

main();
