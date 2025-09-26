// Vercel serverless function to validate Stripe coupons
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
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
        const { couponCode } = req.body;

        if (!couponCode) {
            return res.status(400).json({
                success: false,
                error: 'Coupon code is required'
            });
        }

        console.log('Validating coupon:', couponCode);

        // Retrieve coupon from Stripe
        const coupon = await stripe.coupons.retrieve(couponCode);

        // Check if coupon is valid
        if (!coupon.valid) {
            return res.status(400).json({
                success: false,
                error: 'This discount code is no longer valid'
            });
        }

        // Calculate discount information
        let discountInfo = {
            id: coupon.id,
            valid: true,
            name: coupon.name || coupon.id,
            duration: coupon.duration,
            duration_in_months: coupon.duration_in_months
        };

        if (coupon.percent_off) {
            discountInfo.type = 'percent';
            discountInfo.value = coupon.percent_off;
            discountInfo.description = `${coupon.percent_off}% off`;
        } else if (coupon.amount_off) {
            discountInfo.type = 'amount';
            discountInfo.value = coupon.amount_off;
            discountInfo.description = `$${(coupon.amount_off / 100).toFixed(2)} off`;
        }

        // Add duration description
        if (coupon.duration === 'forever') {
            discountInfo.durationDescription = 'Forever';
        } else if (coupon.duration === 'once') {
            discountInfo.durationDescription = 'First payment only';
        } else if (coupon.duration === 'repeating') {
            discountInfo.durationDescription = `For ${coupon.duration_in_months} months`;
        }

        console.log('Coupon validated successfully:', discountInfo);

        return res.status(200).json({
            success: true,
            coupon: discountInfo
        });

    } catch (error) {
        console.error('Coupon validation error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid discount code'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to validate discount code'
        });
    }
}