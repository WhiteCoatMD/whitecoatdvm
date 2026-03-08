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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Admin auth check
    if (process.env.ADMIN_PASSWORD && !verifyAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const Stripe = require('stripe');
        const stripe = Stripe(process.env.STRIPE_SECRET_API);
        const { action } = req.body;

        console.log('Admin Stripe action:', action);

        switch (action) {
            case 'listSubscriptions': {
                const subscriptions = await stripe.subscriptions.list({
                    limit: 100,
                    expand: ['data.customer']
                });
                return res.status(200).json({ success: true, data: subscriptions.data });
            }

            case 'cancelSubscription': {
                const { subscriptionId } = req.body;
                if (!subscriptionId) {
                    return res.status(400).json({ error: 'subscriptionId is required' });
                }
                console.log('Canceling subscription:', subscriptionId);
                const canceled = await stripe.subscriptions.cancel(subscriptionId);
                return res.status(200).json({ success: true, data: canceled });
            }

            case 'listCoupons': {
                const coupons = await stripe.coupons.list({ limit: 100 });
                return res.status(200).json({ success: true, data: coupons.data });
            }

            case 'createCoupon': {
                const { couponParams } = req.body;
                if (!couponParams) {
                    return res.status(400).json({ error: 'couponParams is required' });
                }

                const createData = {
                    id: couponParams.id,
                    duration: couponParams.duration
                };

                if (couponParams.name) createData.name = couponParams.name;

                if (couponParams.discountType === 'percent') {
                    createData.percent_off = parseFloat(couponParams.value);
                } else {
                    createData.amount_off = parseInt(couponParams.value);
                    createData.currency = couponParams.currency || 'usd';
                }

                if (couponParams.duration === 'repeating' && couponParams.durationMonths) {
                    createData.duration_in_months = parseInt(couponParams.durationMonths);
                }

                console.log('Creating coupon:', createData);
                const coupon = await stripe.coupons.create(createData);
                return res.status(200).json({ success: true, data: coupon });
            }

            case 'deleteCoupon': {
                const { couponId } = req.body;
                if (!couponId) {
                    return res.status(400).json({ error: 'couponId is required' });
                }
                console.log('Deleting coupon:', couponId);
                const deleted = await stripe.coupons.del(couponId);
                return res.status(200).json({ success: true, data: deleted });
            }

            default:
                return res.status(400).json({ error: 'Unknown action: ' + action });
        }

    } catch (error) {
        console.error('Admin Stripe error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            type: error.type || 'api_error'
        });
    }
};
