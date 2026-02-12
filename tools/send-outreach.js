/**
 * Rescue Partner Outreach Emailer
 * Sends personalized emails to shelters via SendGrid
 *
 * Setup:
 * 1. Create free SendGrid account: https://signup.sendgrid.com/
 * 2. Create API key: Settings > API Keys > Create API Key
 * 3. Verify sender email: Settings > Sender Authentication
 * 4. Add to .env.local: SENDGRID_API_KEY=SG.xxxxx
 *
 * Usage:
 *   node tools/send-outreach.js              # Preview mode (no emails sent)
 *   node tools/send-outreach.js --send       # Actually send emails
 *   node tools/send-outreach.js --send --limit 5   # Send to first 5 only
 */

require('dotenv').config({ path: '.env.local' });
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION - EDIT THESE
// ============================================

const CONFIG = {
    // Your verified sender email (must be verified in SendGrid)
    fromEmail: 'support@whitecoat-md.com',
    fromName: 'WhiteCoat DVM',

    // Reply-to address
    replyTo: 'mitch@whitecoat-md.com',

    // Email subject line
    subject: 'Partnership opportunity for {{name}} adopters',

    // Delay between emails (ms) - helps avoid rate limits
    delayBetweenEmails: 2000,

    // CSV file to read from
    csvFile: path.join(__dirname, 'output', 'CLEAN_shelters_2026-02-04.csv')
};

// ============================================
// EMAIL TEMPLATE
// ============================================

function getEmailTemplate(shelter) {
    const firstName = shelter.name.split(' ')[0]; // First word of org name

    return {
        subject: CONFIG.subject.replace('{{name}}', shelter.name),

        text: `Hi ${shelter.name} Team,

I'm reaching out from WhiteCoat DVM, a 24/7 virtual vet care service available in all 50 states.

We'd like to partner with ${shelter.name} to offer your adopters, social media followers, and supporters access to unlimited virtual veterinary consultations for just $20/month — and you earn $10/month for every subscriber you refer.

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

        <p>Hi ${shelter.name} Team,</p>

        <p>I'm reaching out from <strong>WhiteCoat DVM</strong>, a 24/7 virtual vet care service available in <strong>all 50 states</strong>.</p>

        <p>We'd like to partner with <strong>${shelter.name}</strong> to offer your adopters, social media followers, and supporters access to unlimited virtual veterinary consultations for just <strong>$20/month</strong> — and you earn <strong>$10/month</strong> for every subscriber you refer.</p>

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
}

// ============================================
// CSV PARSER
// ============================================

function parseCSV(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
        });

        // Only include rows with valid email
        if (row.email && row.email.includes('@')) {
            rows.push(row);
        }
    }

    return rows;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

// ============================================
// EMAIL SENDER
// ============================================

async function sendEmail(shelter) {
    const template = getEmailTemplate(shelter);

    const msg = {
        to: shelter.email,
        from: {
            email: CONFIG.fromEmail,
            name: CONFIG.fromName
        },
        replyTo: CONFIG.replyTo,
        subject: template.subject,
        text: template.text,
        html: template.html,
        trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
        }
    };

    await sgMail.send(msg);
    return msg;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// MAIN
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const shouldSend = args.includes('--send');
    const limitIndex = args.indexOf('--limit');
    const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : Infinity;

    console.log(`
╔═══════════════════════════════════════════════════════╗
║       📧 Rescue Partner Outreach Emailer 📧          ║
╚═══════════════════════════════════════════════════════╝
`);

    // Check API key
    if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ Error: SENDGRID_API_KEY not found in .env.local');
        console.log('\nSetup instructions:');
        console.log('1. Create free SendGrid account: https://signup.sendgrid.com/');
        console.log('2. Create API key: Settings > API Keys > Create API Key');
        console.log('3. Add to .env.local: SENDGRID_API_KEY=SG.xxxxx');
        process.exit(1);
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Load shelters
    console.log(`📂 Loading shelters from: ${CONFIG.csvFile}\n`);

    if (!fs.existsSync(CONFIG.csvFile)) {
        console.error(`❌ File not found: ${CONFIG.csvFile}`);
        process.exit(1);
    }

    const shelters = parseCSV(CONFIG.csvFile);
    const toSend = shelters.slice(0, limit);

    console.log(`📋 Found ${shelters.length} shelters with email addresses`);
    console.log(`📨 Will process ${toSend.length} emails\n`);

    if (!shouldSend) {
        console.log('⚠️  PREVIEW MODE - No emails will be sent');
        console.log('   Run with --send flag to actually send emails\n');
        console.log('─'.repeat(50));
        console.log('Preview of emails to send:\n');

        for (const shelter of toSend) {
            console.log(`  → ${shelter.name}`);
            console.log(`    ${shelter.email}`);
        }

        console.log('\n─'.repeat(50));
        console.log(`\nTo send emails, run:`);
        console.log(`  node tools/send-outreach.js --send`);
        console.log(`  node tools/send-outreach.js --send --limit 5  # test with 5 first`);
        return;
    }

    // Confirm before sending
    console.log('🚀 SEND MODE - Emails will be sent!\n');
    console.log(`From: ${CONFIG.fromName} <${CONFIG.fromEmail}>`);
    console.log(`Reply-To: ${CONFIG.replyTo}`);
    console.log(`Subject: ${CONFIG.subject}\n`);

    // Send emails
    let sent = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < toSend.length; i++) {
        const shelter = toSend[i];
        console.log(`[${i + 1}/${toSend.length}] Sending to ${shelter.name} (${shelter.email})...`);

        try {
            await sendEmail(shelter);
            console.log(`   ✅ Sent!`);
            sent++;
            results.push({ ...shelter, status: 'sent', timestamp: new Date().toISOString() });
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
            failed++;
            results.push({ ...shelter, status: 'failed', error: err.message });
        }

        // Delay between emails
        if (i < toSend.length - 1) {
            await delay(CONFIG.delayBetweenEmails);
        }
    }

    // Save results log
    const logFile = path.join(__dirname, 'output', `outreach_log_${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(logFile, JSON.stringify(results, null, 2));

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ COMPLETE`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Log saved: ${logFile}`);
}

main().catch(console.error);
