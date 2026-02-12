const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    try {
        const outputDir = path.join(process.cwd(), 'tools', 'output');

        // Find latest CLEAN_*.csv
        let shelters = [];
        const files = fs.readdirSync(outputDir)
            .filter(f => f.startsWith('CLEAN_') && f.endsWith('.csv'))
            .sort()
            .reverse();

        if (files.length > 0) {
            const csvPath = path.join(outputDir, files[0]);
            const content = fs.readFileSync(csvPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());

            if (lines.length > 1) {
                const headers = lines[0].split(',').map(h => h.toLowerCase().replace(/"/g, '').trim());

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const row = {};
                    headers.forEach((h, idx) => {
                        row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
                    });
                    if (row.email && row.email.includes('@')) {
                        shelters.push({
                            name: row.name || '',
                            email: row.email || '',
                            state: row.state || '',
                            city: row.city || '',
                            website: row.website || ''
                        });
                    }
                }
            }
        }

        // Load sent emails
        let sent = [];
        let lastRun = null;
        const sentPath = path.join(outputDir, 'sent_emails.json');
        if (fs.existsSync(sentPath)) {
            const sentData = JSON.parse(fs.readFileSync(sentPath, 'utf-8'));
            sent = sentData.emails || [];
            lastRun = sentData.lastRun || null;
        }

        res.status(200).json({
            shelters,
            sent,
            lastRun,
            total: shelters.length,
            contacted: sent.length,
            remaining: shelters.length - sent.length
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to load stats', message: error.message });
    }
};

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}
