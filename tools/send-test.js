/**
 * Send a test email to yourself
 */

require('dotenv').config({ path: '.env.local' });
const sgMail = require('@sendgrid/mail');

const TEST_EMAIL = 'mitch@graysonseoguy.com';

const CONFIG = {
    fromEmail: 'support@whitecoat-md.com',
    fromName: 'WhiteCoat DVM',
    replyTo: 'support@whitecoat-md.com'
};

// Fake shelter for testing
const testShelter = {
    name: 'Austin Pets Alive',
    email: TEST_EMAIL
};

async function main() {
    if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ SENDGRID_API_KEY not found in .env.local');
        process.exit(1);
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    console.log(`\n📧 Sending test email to: ${TEST_EMAIL}\n`);

    const msg = {
        to: TEST_EMAIL,
        from: {
            email: CONFIG.fromEmail,
            name: CONFIG.fromName
        },
        replyTo: CONFIG.replyTo,
        subject: `Partnership opportunity for ${testShelter.name} adopters`,
        text: `Hi ${testShelter.name} Team,

I'm reaching out from WhiteCoat DVM, a 24/7 virtual vet care service available in all 50 states.

We'd like to partner with ${testShelter.name} to offer your adopters, social media followers, and supporters access to unlimited virtual veterinary consultations for just $20/month — and you earn $10/month for every subscriber you refer.

Here's how it works:
• Subscribers pay $20/month for unlimited 24/7 virtual vet consultations
• You earn $10/month per active subscriber (we keep $10)
• Promote to your adopters, social followers, email list — anyone!
• Available nationwide in all 50 states

Why this works for shelters:
• New adopters get immediate vet access for those "is this normal?" questions
• Reduces returns due to unexpected health concerns
• Creates sustainable recurring revenue for your organization

We're already partnering with rescues across the country and seeing strong results.

Would you have 15 minutes this week to discuss? I can also send over materials you can share with your community.

Best,
Mitch Bratton
WhiteCoat DVM
https://whitecoatdvm.com`,

        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .how-it-works { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .how-it-works li { margin: 8px 0; }
        .benefits { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .benefits li { margin: 8px 0; }
        .cta { color: #2563eb; }
        .signature { margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/t9F7dAa.png" alt="WhiteCoat DVM" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${testShelter.name} Team,</p>

        <p>I'm reaching out from <strong>WhiteCoat DVM</strong>, a 24/7 virtual vet care service available in <strong>all 50 states</strong>.</p>

        <p>We'd like to partner with <strong>${testShelter.name}</strong> to offer your adopters, social media followers, and supporters access to unlimited virtual veterinary consultations for just <strong>$20/month</strong> — and you earn <strong>$10/month</strong> for every subscriber you refer.</p>

        <div class="how-it-works">
            <p><strong>Here's how it works:</strong></p>
            <ul>
                <li>Subscribers pay $20/month for unlimited 24/7 virtual vet consultations</li>
                <li>You earn $10/month per active subscriber (we keep $10)</li>
                <li>Promote to your adopters, social followers, email list — anyone!</li>
                <li>Available nationwide in all 50 states</li>
            </ul>
        </div>

        <div class="benefits">
            <p><strong>Why this works for shelters:</strong></p>
            <ul>
                <li>New adopters get immediate vet access for those "is this normal?" questions</li>
                <li>Reduces returns due to unexpected health concerns</li>
                <li>Creates sustainable recurring revenue for your organization</li>
            </ul>
        </div>

        <p>We're already partnering with rescues across the country and seeing strong results.</p>

        <p class="cta"><strong>Would you have 15 minutes this week to discuss?</strong> I can also send over materials you can share with your community.</p>

        <div class="signature">
            <p>Best,<br>
            <strong>Mitch Bratton</strong><br>
            WhiteCoat DVM<br>
            <a href="https://whitecoatdvm.com">whitecoatdvm.com</a></p>
        </div>
    </div>
</body>
</html>`
    };

    try {
        await sgMail.send(msg);
        console.log('✅ Test email sent successfully!');
        console.log(`   Check your inbox at: ${TEST_EMAIL}`);
    } catch (err) {
        console.error('❌ Failed to send:', err.message);
        if (err.response) {
            console.error('   Details:', err.response.body);
        }
    }
}

main();
