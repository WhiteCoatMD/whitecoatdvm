const crypto = require('crypto');

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('ADMIN_EMAIL or ADMIN_PASSWORD not configured');
            return res.status(500).json({ success: false, error: 'Admin auth not configured' });
        }

        if (email.toLowerCase().trim() !== adminEmail.toLowerCase().trim() || password !== adminPassword) {
            console.log('Admin login failed for:', email);
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Generate a session token
        const token = crypto.randomBytes(32).toString('hex');

        // Store token with expiry (24 hours) using a simple approach
        // In production you'd use a database or Redis, but for a single admin
        // we store in env-based HMAC so any server instance can verify
        const expiry = Date.now() + (24 * 60 * 60 * 1000);
        const payload = `${email}:${expiry}`;
        const hmac = crypto.createHmac('sha256', adminPassword).update(payload).digest('hex');
        const sessionToken = Buffer.from(`${payload}:${hmac}`).toString('base64');

        console.log('Admin login successful for:', email);

        return res.status(200).json({
            success: true,
            token: sessionToken
        });

    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(500).json({ success: false, error: 'Authentication error' });
    }
};
