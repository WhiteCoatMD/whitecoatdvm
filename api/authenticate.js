// Vercel serverless function to authenticate users against Google Sheets
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        console.log('Authentication attempt for:', email);

        // Google Sheets public CSV URL (requires sheet to be shared publicly)
        const SHEET_ID = '1ClY3AWIrUZlW4E8KoZd_bayMXr_NYu0afGOoDh25Yhc';
        const SHEET_GID = '0'; // Default first sheet GID

        // Try CSV export first (doesn't require API key)
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

        console.log('Fetching from Google Sheets CSV export...');
        let sheetsResponse = await fetch(csvUrl);
        let rows = [];

        if (sheetsResponse.ok) {
            console.log('Successfully accessed sheet via CSV export');
            const csvText = await sheetsResponse.text();

            // Better CSV parsing to handle quoted fields and commas
            rows = csvText.split('\n').map(row => {
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
            }).filter(row => row.length > 1 && row[0]); // Filter empty rows
        } else {
            console.log('CSV export failed, trying API method...');

            // Fallback to API method
            const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
            if (!API_KEY) {
                console.error('Google Sheets API key not configured');
                return res.status(500).json({
                    success: false,
                    error: 'Authentication service not configured'
                });
            }

            const SHEET_NAME = 'Additions';
            const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;

            sheetsResponse = await fetch(sheetsUrl);

            if (!sheetsResponse.ok) {
                const errorText = await sheetsResponse.text();
                console.error('Google Sheets API error:', sheetsResponse.status, errorText);
                return res.status(500).json({
                    success: false,
                    error: 'Unable to access user database'
                });
            }

            const sheetsData = await sheetsResponse.json();
            rows = sheetsData.values || [];
        }

        console.log('Found', rows.length, 'rows in sheet');

        // Find header row to locate email and password columns
        const headers = rows[0] || [];
        console.log('Sheet headers:', headers);

        const emailIndex = headers.findIndex(header =>
            header.toLowerCase().includes('email') ||
            header.toLowerCase().includes('user email') ||
            header.toLowerCase().includes('user emai') ||
            header.toLowerCase() === 'email' ||
            header.toLowerCase().startsWith('user emai')
        );
        const passwordIndex = headers.findIndex(header =>
            header.toLowerCase().includes('password')
        );

        if (emailIndex === -1) {
            console.error('Email column not found in sheet');
            return res.status(500).json({
                success: false,
                error: 'Sheet configuration error'
            });
        }

        console.log('Email column index:', emailIndex, 'Password column index:', passwordIndex);

        // Search for user in the sheet
        let userFound = false;
        let userData = null;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const sheetEmail = row[emailIndex]?.toLowerCase().trim();
            const sheetPassword = row[passwordIndex]?.trim();

            if (sheetEmail === email.toLowerCase().trim()) {
                userFound = true;

                // If password column exists, verify password
                if (passwordIndex !== -1 && sheetPassword) {
                    if (sheetPassword === password) {
                        userData = {
                            email: row[emailIndex],
                            firstName: row[headers.findIndex(h => h.toLowerCase().includes('first'))] || '',
                            lastName: row[headers.findIndex(h => h.toLowerCase().includes('last'))] || '',
                            phone: row[headers.findIndex(h => h.toLowerCase().includes('phone'))] || '',
                            // Add more fields as needed
                        };
                        break;
                    } else {
                        console.log('Password mismatch for user:', email);
                        return res.status(401).json({
                            success: false,
                            error: 'Invalid email or password'
                        });
                    }
                } else {
                    // If no password column, just verify email exists
                    userData = {
                        email: row[emailIndex],
                        firstName: row[headers.findIndex(h => h.toLowerCase().includes('first'))] || '',
                        lastName: row[headers.findIndex(h => h.toLowerCase().includes('last'))] || '',
                        phone: row[headers.findIndex(h => h.toLowerCase().includes('phone'))] || '',
                    };
                    break;
                }
            }
        }

        if (!userFound) {
            console.log('User not found:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        if (!userData) {
            console.log('Authentication failed for:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        console.log('Authentication successful for:', email);

        // Generate a simple session token (in production, use JWT or similar)
        const sessionToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');

        return res.status(200).json({
            success: true,
            user: userData,
            sessionToken: sessionToken
        });

    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication service error'
        });
    }
};