const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGIN_LOG_FILE = path.join(process.cwd(), 'tools', 'output', 'login_history.json');

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    if (process.env.ADMIN_PASSWORD && !verifyAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        let history = [];
        if (fs.existsSync(LOGIN_LOG_FILE)) {
            history = JSON.parse(fs.readFileSync(LOGIN_LOG_FILE, 'utf-8'));
        }
        return res.status(200).json({ success: true, history });
    } catch (error) {
        console.error('Login history error:', error);
        return res.status(500).json({ error: 'Failed to load login history' });
    }
};
