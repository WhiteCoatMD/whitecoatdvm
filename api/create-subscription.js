// Vercel serverless function to create Stripe subscriptions
const Stripe = require('stripe');

// Initialize Stripe with your secret key
const stripe = Stripe(process.env.STRIPE_SECRET_API);

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
        const { paymentMethodId, priceId, plan, customerData, couponId } = req.body;

        if (!paymentMethodId || !priceId || !customerData) {
            return res.status(400).json({
                error: 'Missing required fields: paymentMethodId, priceId, customerData'
            });
        }

        console.log('Creating subscription for:', { plan, priceId, customerData: customerData.email, couponId });

        // Create or retrieve customer
        const customer = await stripe.customers.create({
            payment_method: paymentMethodId,
            email: customerData.email,
            name: customerData.name,
            phone: customerData.phone,
            metadata: {
                plan: plan,
                petName: customerData.petName || '',
                petType: customerData.petType || ''
            },
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription with optional coupon
        const subscriptionData = {
            customer: customer.id,
            items: [{
                price: priceId,
            }],
            payment_settings: {
                payment_method_options: {
                    card: {
                        request_three_d_secure: 'if_required',
                    },
                },
                payment_method_types: ['card'],
                save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
        };

        // Add coupon if provided
        if (couponId) {
            subscriptionData.coupon = couponId;
            console.log('Applying coupon to subscription:', couponId);
        }

        const subscription = await stripe.subscriptions.create(subscriptionData);

        console.log('Subscription created:', subscription.id);

        // Return subscription details
        return res.status(200).json({
            success: true,
            subscriptionId: subscription.id,
            customerId: customer.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
            status: subscription.status
        });

    } catch (error) {
        console.error('Stripe subscription error:', error);

        return res.status(500).json({
            success: false,
            error: error.message,
            type: error.type || 'api_error'
        });
    }
}