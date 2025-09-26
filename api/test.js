// Simple test endpoint to verify Vercel functions work
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    console.log('Test API called successfully');
    console.log('Environment variables available:', Object.keys(process.env).filter(key => key.includes('STRIPE')));

    return res.status(200).json({
        success: true,
        message: 'Test endpoint working',
        method: req.method,
        timestamp: new Date().toISOString(),
        envVarsFound: Object.keys(process.env).filter(key => key.includes('STRIPE')),
        hasStripeSecret: !!process.env.STRIPE_SECRET_API
    });
};