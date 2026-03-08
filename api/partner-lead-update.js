const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEADS_FILE = path.join(process.cwd(), 'tools', 'output', 'partner_leads.json');

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (process.env.ADMIN_PASSWORD && !verifyAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { id, status } = req.body;

        if (!id || !status) {
            return res.status(400).json({ error: 'id and status are required' });
        }

        const validStatuses = ['new', 'contacted', 'partnered', 'declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        if (!fs.existsSync(LEADS_FILE)) {
            return res.status(404).json({ error: 'No leads found' });
        }

        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
        const lead = leads.find(l => l.id === id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        lead.status = status;
        lead.updatedAt = new Date().toISOString();

        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

        console.log('Lead status updated:', id, '->', status);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Lead update error:', error);
        return res.status(500).json({ error: 'Failed to update lead' });
    }
};
