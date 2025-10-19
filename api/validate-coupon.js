// Vercel serverless function to validate Stripe coupons
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
        console.log('API called with method:', req.method);
        console.log('Request body:', req.body);
        console.log('Stripe secret key exists:', !!process.env.STRIPE_SECRET_API);
        console.log('Stripe key starts with:', process.env.STRIPE_SECRET_API?.substring(0, 8) + '...');

        // Initialize Stripe inside the function to avoid import issues
        const Stripe = require('stripe');
        const stripe = Stripe(process.env.STRIPE_SECRET_API);

        const { couponCode } = req.body;

        if (!couponCode) {
            return res.status(400).json({
                success: false,
                error: 'Coupon code is required'
            });
        }

        console.log('Validating coupon:', couponCode);

        let coupon;
        let couponId = couponCode;

        // Try to retrieve as promotion code first (for customer-facing codes like HAPPYPET)
        try {
            console.log('Attempting to retrieve as promotion code...');
            const promotionCodes = await stripe.promotionCodes.list({
                code: couponCode,
                limit: 1
            });

            if (promotionCodes.data.length > 0) {
                const promoCode = promotionCodes.data[0];
                console.log('Found promotion code:', promoCode.id);

                // Check if promotion code is active
                if (!promoCode.active) {
                    return res.status(400).json({
                        success: false,
                        error: 'This discount code is no longer active'
                    });
                }

                // Get the associated coupon
                coupon = promoCode.coupon;
                couponId = coupon.id;
                console.log('Associated coupon:', couponId);
            } else {
                // Not a promotion code, try as direct coupon ID
                console.log('Not found as promotion code, trying as coupon ID...');
                coupon = await stripe.coupons.retrieve(couponCode);
            }
        } catch (promoError) {
            // If promotion code lookup fails, try as direct coupon
            console.log('Promotion code lookup failed, trying as coupon:', promoError.message);
            coupon = await stripe.coupons.retrieve(couponCode);
        }

        // Check if coupon is valid
        if (!coupon.valid) {
            return res.status(400).json({
                success: false,
                error: 'This discount code is no longer valid'
            });
        }

        // Calculate discount information
        let discountInfo = {
            id: couponId,
            valid: true,
            name: coupon.name || couponId,
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
        console.error('Error type:', error.type);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid discount code'
            });
        }

        if (!process.env.STRIPE_SECRET_API) {
            return res.status(500).json({
                success: false,
                error: 'Stripe configuration error'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to validate discount code',
            debug: error.message
        });
    }
}