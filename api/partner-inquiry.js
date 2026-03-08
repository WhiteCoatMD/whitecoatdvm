const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(process.cwd(), 'tools', 'output', 'partner_leads.json');

function loadLeads() {
    if (fs.existsSync(LEADS_FILE)) {
        return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    }
    return [];
}

function saveLeads(leads) {
    const dir = path.dirname(LEADS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET: return all leads (admin only)
    if (req.method === 'GET') {
        const crypto = require('crypto');
        const token = req.headers['x-admin-token'];
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminPassword) {
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            try {
                const decoded = Buffer.from(token, 'base64').toString('utf-8');
                const parts = decoded.split(':');
                if (parts.length !== 3) return res.status(401).json({ error: 'Unauthorized' });
                const [email, expiry, hmac] = parts;
                if (Date.now() > parseInt(expiry)) return res.status(401).json({ error: 'Unauthorized' });
                const expectedHmac = crypto.createHmac('sha256', adminPassword).update(`${email}:${expiry}`).digest('hex');
                if (hmac !== expectedHmac) return res.status(401).json({ error: 'Unauthorized' });
            } catch { return res.status(401).json({ error: 'Unauthorized' }); }
        }
        const leads = loadLeads();
        return res.status(200).json({ success: true, leads });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { orgName, contactName, email, phone, state, orgType, website, message } = req.body;

        if (!orgName || !contactName || !email) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        // Save to JSON file
        const leads = loadLeads();
        const lead = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            orgName,
            contactName,
            email,
            phone: phone || '',
            state: state || '',
            orgType: orgType || '',
            website: website || '',
            message: message || '',
            submittedAt: new Date().toISOString(),
            status: 'new'
        };
        leads.unshift(lead);
        saveLeads(leads);

        // Send email notification to admin
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.send({
            to: 'mitch@whitecoat-md.com',
            from: { email: 'support@whitecoat-md.com', name: 'WhiteCoat DVM' },
            replyTo: email,
            subject: `New Partner Application: ${orgName}`,
            html: `
                <h2>New Shelter/Rescue Partner Application</h2>
                <table style="border-collapse:collapse;width:100%;max-width:500px;">
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Organization</td><td style="padding:8px;border-bottom:1px solid #eee;">${orgName}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Contact Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${contactName}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">State</td><td style="padding:8px;border-bottom:1px solid #eee;">${state}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Type</td><td style="padding:8px;border-bottom:1px solid #eee;">${orgType || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Website</td><td style="padding:8px;border-bottom:1px solid #eee;">${website ? '<a href="' + website + '">' + website + '</a>' : 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message || 'N/A'}</td></tr>
                </table>
                <p style="margin-top:20px;color:#666;">Submitted from the Partner landing page.</p>
            `
        });

        console.log('Partner inquiry saved and emailed:', orgName, email);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Partner inquiry error:', error);
        return res.status(500).json({ error: 'Failed to submit inquiry' });
    }
};
