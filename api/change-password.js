// Vercel serverless function to change user password in Google Sheets
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
        const { email, currentPassword, newPassword } = req.body;

        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Email, current password, and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 8 characters long'
            });
        }

        console.log('Password change attempt for:', email);

        const SHEET_ID = '1ClY3AWIrUZlW4E8KoZd_bayMXr_NYu0afGOoDh25Yhc';
        const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;

        if (!API_KEY) {
            console.error('Google Sheets API key not configured');
            return res.status(500).json({
                success: false,
                error: 'Password change service not configured'
            });
        }

        // Define both sheets to update
        const sheetsToUpdate = [
            { name: 'Sign Up Info', gid: '1887508718' },
            { name: 'Additions', gid: '0' }
        ];

        let userFound = false;
        let passwordVerified = false;
        const updateResults = [];

        // Process each sheet
        for (const sheetInfo of sheetsToUpdate) {
            const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetInfo.name}?key=${API_KEY}`;

            const sheetsResponse = await fetch(sheetsUrl);

            if (!sheetsResponse.ok) {
                console.error(`Error accessing ${sheetInfo.name}:`, sheetsResponse.status);
                continue;
            }

            const sheetsData = await sheetsResponse.json();
            const rows = sheetsData.values || [];

            if (rows.length === 0) {
                continue;
            }

            // Find header row to locate email and password columns
            const headers = rows[0] || [];
            console.log(`${sheetInfo.name} headers:`, headers);

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
                console.error(`Email column not found in ${sheetInfo.name}`);
                continue;
            }

            if (passwordIndex === -1) {
                console.error(`Password column not found in ${sheetInfo.name}`);
                continue;
            }

            // Search for user and verify current password
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const sheetEmail = row[emailIndex]?.toLowerCase().trim();
                const sheetPassword = row[passwordIndex]?.trim();

                if (sheetEmail === email.toLowerCase().trim()) {
                    userFound = true;

                    // Verify current password
                    if (sheetPassword === currentPassword) {
                        passwordVerified = true;

                        // Update password in this row
                        const rowNumber = i + 1; // Sheets API uses 1-based indexing
                        const columnLetter = String.fromCharCode(65 + passwordIndex); // Convert to A, B, C, etc.
                        const range = `${sheetInfo.name}!${columnLetter}${rowNumber}`;

                        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;

                        const updateResponse = await fetch(updateUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                values: [[newPassword]]
                            })
                        });

                        if (updateResponse.ok) {
                            console.log(`Password updated successfully in ${sheetInfo.name}`);
                            updateResults.push({ sheet: sheetInfo.name, success: true });
                        } else {
                            const errorText = await updateResponse.text();
                            console.error(`Failed to update password in ${sheetInfo.name}:`, errorText);
                            updateResults.push({ sheet: sheetInfo.name, success: false, error: errorText });
                        }
                    } else {
                        console.log(`Current password mismatch in ${sheetInfo.name} for user:`, email);
                    }
                    break;
                }
            }
        }

        if (!userFound) {
            console.log('User not found:', email);
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        if (!passwordVerified) {
            console.log('Current password incorrect for:', email);
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        // Check if at least one update was successful
        const successfulUpdates = updateResults.filter(r => r.success);

        if (successfulUpdates.length > 0) {
            console.log('Password change successful for:', email);
            return res.status(200).json({
                success: true,
                message: 'Password updated successfully',
                updatedSheets: successfulUpdates.map(r => r.sheet)
            });
        } else {
            console.error('All password updates failed');
            return res.status(500).json({
                success: false,
                error: 'Failed to update password in sheets'
            });
        }

    } catch (error) {
        console.error('Password change error:', error);
        return res.status(500).json({
            success: false,
            error: 'Password change service error'
        });
    }
};
