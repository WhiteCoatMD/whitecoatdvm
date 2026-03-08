const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function verifyAdminToken(req) {
    const token = req.headers['x-admin-token'];
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!token || !adminPassword) return false;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split(':');
        if (parts.length !== 3) return false;
        const [email, expiry, hmac] = parts;
        if (Date.now() > parseInt(expiry)) return false;
        const expectedHmac = crypto.createHmac('sha256', adminPassword).update(`${email}:${expiry}`).digest('hex');
        return hmac === expectedHmac;
    } catch { return false; }
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Admin auth check
    if (process.env.ADMIN_PASSWORD && !verifyAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // --- Fetch users from Google Sheets ---
        const SHEET_ID = '1ClY3AWIrUZlW4E8KoZd_bayMXr_NYu0afGOoDh25Yhc';
        const SHEET_GID = '1887508718';
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

        let users = [];
        try {
            console.log('Admin: Fetching users from Google Sheets...');
            const sheetsResponse = await fetch(csvUrl);

            if (sheetsResponse.ok) {
                const csvText = await sheetsResponse.text();
                const rows = parseCSV(csvText);

                if (rows.length > 1) {
                    const headers = rows[0].map(h => h.toLowerCase().trim());
                    console.log('Admin: Sheet headers:', headers);

                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (row.length < 2 || !row[0]) continue;

                        const user = {};
                        headers.forEach((h, idx) => {
                            user[h] = (row[idx] || '').trim();
                        });
                        users.push(user);
                    }
                }
            } else {
                console.error('Admin: Failed to fetch Google Sheets CSV:', sheetsResponse.status);
            }
        } catch (sheetErr) {
            console.error('Admin: Error fetching users:', sheetErr.message);
        }

        // --- Shelter stats ---
        let shelterStats = { total: 0, contacted: 0, remaining: 0, states: 0 };
        let lastOutreachRun = null;

        try {
            const outputDir = path.join(process.cwd(), 'tools', 'output');

            // Find latest CLEAN_*.csv
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
                    const stateSet = new Set();
                    let total = 0;

                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCSVLine(lines[i]);
                        const emailIdx = headers.indexOf('email');
                        const stateIdx = headers.indexOf('state');

                        if (emailIdx !== -1 && values[emailIdx] && values[emailIdx].includes('@')) {
                            total++;
                            if (stateIdx !== -1 && values[stateIdx] && values[stateIdx] !== '??') {
                                stateSet.add(values[stateIdx].replace(/"/g, '').trim());
                            }
                        }
                    }

                    shelterStats.total = total;
                    shelterStats.states = stateSet.size;
                }
            }

            // Read sent emails
            const sentPath = path.join(outputDir, 'sent_emails.json');
            if (fs.existsSync(sentPath)) {
                const sentData = JSON.parse(fs.readFileSync(sentPath, 'utf-8'));
                const sent = sentData.emails || [];
                shelterStats.contacted = sent.length;
                shelterStats.remaining = shelterStats.total - sent.length;
                lastOutreachRun = sentData.lastRun || null;
            }
        } catch (shelterErr) {
            console.error('Admin: Error reading shelter stats:', shelterErr.message);
        }

        console.log('Admin: Returning', users.length, 'users,', shelterStats.total, 'shelters');

        return res.status(200).json({
            users,
            shelterStats,
            lastOutreachRun
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        return res.status(500).json({ error: 'Failed to load admin stats', message: error.message });
    }
};

function parseCSV(text) {
    return text.split('\n').map(row => {
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());
        return cells;
    }).filter(row => row.length > 1 && row[0]);
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
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}
