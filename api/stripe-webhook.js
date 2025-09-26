// Vercel serverless function to handle Stripe webhooks
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log('Received webhook event:', event.type);

    try {
        // Handle the event
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
}

async function handleSubscriptionCreated(subscription) {
    console.log('Subscription created:', subscription.id);

    // Here you could:
    // - Update your database
    // - Send welcome email
    // - Activate user account
    // - Update Google Sheets

    const customer = await stripe.customers.retrieve(subscription.customer);
    console.log('Customer email:', customer.email);
}

async function handlePaymentSucceeded(invoice) {
    console.log('Payment succeeded for invoice:', invoice.id);

    const customer = await stripe.customers.retrieve(invoice.customer);
    console.log('Payment successful for customer:', customer.email);

    // Here you could:
    // - Send receipt email
    // - Extend service access
    // - Log payment in your system
}

async function handlePaymentFailed(invoice) {
    console.log('Payment failed for invoice:', invoice.id);

    const customer = await stripe.customers.retrieve(invoice.customer);
    console.log('Payment failed for customer:', customer.email);

    // Here you could:
    // - Send payment failed email
    // - Retry payment
    // - Suspend service
}

async function handleSubscriptionDeleted(subscription) {
    console.log('Subscription deleted:', subscription.id);

    const customer = await stripe.customers.retrieve(subscription.customer);
    console.log('Subscription cancelled for customer:', customer.email);

    // Here you could:
    // - Deactivate user account
    // - Send cancellation confirmation
    // - Update database
}

// Disable body parsing for webhooks
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
}