/**
 * Daily Outreach Bot
 * Automatically scrapes for new shelters and sends 20 emails/day
 * Only runs Mon-Fri between 7am-4pm
 *
 * Usage:
 *   node tools/daily-outreach-bot.js          # Run once (for scheduler)
 *   node tools/daily-outreach-bot.js --force  # Ignore time restrictions
 */

require('dotenv').config({ path: '.env.local' });
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    fromEmail: 'support@whitecoat-md.com',
    fromName: 'WhiteCoat DVM',
    replyTo: 'mitch@whitecoat-md.com',

    // Daily limits
    maxEmailsPerDay: 20,

    // Time restrictions (24-hour format)
    startHour: 7,   // 7 AM
    endHour: 16,    // 4 PM

    // Working days (0 = Sunday, 1 = Monday, etc.)
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri

    // Files
    outputDir: path.join(__dirname, 'output'),
    sentLogFile: path.join(__dirname, 'output', 'sent_emails.json'),
    dailyLogDir: path.join(__dirname, 'output', 'daily_logs'),

    // Delay between emails (ms)
    delayBetweenEmails: 3000
};

// ============================================
// EMAIL TEMPLATE
// ============================================

function getEmailTemplate(shelter) {
    return {
        subject: `Partnership opportunity for ${shelter.name}`,

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
// HELPERS
// ============================================

function findLatestCleanCsv() {
    const files = fs.readdirSync(CONFIG.outputDir)
        .filter(f => f.startsWith('CLEAN_') && f.endsWith('.csv'))
        .sort()
        .reverse();

    if (files.length === 0) return null;
    return path.join(CONFIG.outputDir, files[0]);
}

function isWithinWorkingHours() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    const isWorkingDay = CONFIG.workingDays.includes(day);
    const isWorkingHour = hour >= CONFIG.startHour && hour < CONFIG.endHour;

    return isWorkingDay && isWorkingHour;
}

function loadSentEmails() {
    if (fs.existsSync(CONFIG.sentLogFile)) {
        return JSON.parse(fs.readFileSync(CONFIG.sentLogFile, 'utf-8'));
    }
    return { emails: [], lastRun: null };
}

function saveSentEmails(data) {
    fs.writeFileSync(CONFIG.sentLogFile, JSON.stringify(data, null, 2));
}

function parseCSV(filepath) {
    if (!fs.existsSync(filepath)) return [];

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.toLowerCase().trim().replace(/"/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
        });

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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
        html: template.html
    };

    await sgMail.send(msg);
    return msg;
}

// ============================================
// MAIN
// ============================================

async function main() {
    const args = process.argv.slice(2);
    const forceRun = args.includes('--force');

    console.log(`
╔═══════════════════════════════════════════════════════╗
║       🤖 Daily Outreach Bot 🤖                       ║
╚═══════════════════════════════════════════════════════╝
`);

    // Check time restrictions
    if (!forceRun && !isWithinWorkingHours()) {
        const now = new Date();
        console.log(`⏰ Current time: ${now.toLocaleString()}`);
        console.log(`❌ Outside working hours (Mon-Fri ${CONFIG.startHour}:00-${CONFIG.endHour}:00)`);
        console.log(`   Use --force to run anyway.`);
        return;
    }

    // Check API key
    if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ SENDGRID_API_KEY not found in .env.local');
        return;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Ensure directories exist
    if (!fs.existsSync(CONFIG.dailyLogDir)) {
        fs.mkdirSync(CONFIG.dailyLogDir, { recursive: true });
    }

    // Load sent emails history
    const sentData = loadSentEmails();
    const sentEmails = new Set(sentData.emails.map(e => e.toLowerCase()));

    console.log(`📊 Previously sent: ${sentEmails.size} emails`);

    // Find and load latest shelter CSV
    const sheltersCsv = findLatestCleanCsv();
    if (!sheltersCsv) {
        console.log(`❌ No CLEAN_*.csv file found. Run the scraper first.`);
        return;
    }
    console.log(`📂 Loading: ${path.basename(sheltersCsv)}`);

    const allShelters = parseCSV(sheltersCsv);
    console.log(`📋 Total shelters in database: ${allShelters.length}`);

    // Filter out already-sent emails
    const newShelters = allShelters.filter(s => !sentEmails.has(s.email.toLowerCase()));
    console.log(`🆕 New shelters to contact: ${newShelters.length}`);

    if (newShelters.length === 0) {
        console.log(`\n✅ All shelters have been contacted!`);
        console.log(`   Add more shelters to the CSV or run the scraper.`);
        return;
    }

    // Take only up to maxEmailsPerDay
    const toSend = newShelters.slice(0, CONFIG.maxEmailsPerDay);
    console.log(`📨 Sending ${toSend.length} emails today\n`);

    // Send emails
    let sent = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < toSend.length; i++) {
        const shelter = toSend[i];
        console.log(`[${i + 1}/${toSend.length}] ${shelter.name} (${shelter.email})...`);

        try {
            await sendEmail(shelter);
            console.log(`   ✅ Sent!`);
            sent++;

            // Add to sent list
            sentData.emails.push(shelter.email.toLowerCase());

            results.push({
                name: shelter.name,
                email: shelter.email,
                status: 'sent',
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
            failed++;
            results.push({
                name: shelter.name,
                email: shelter.email,
                status: 'failed',
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }

        // Delay between emails
        if (i < toSend.length - 1) {
            await delay(CONFIG.delayBetweenEmails);
        }
    }

    // Update sent log
    sentData.lastRun = new Date().toISOString();
    saveSentEmails(sentData);

    // Save daily log
    const dailyLogFile = path.join(CONFIG.dailyLogDir, `${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(dailyLogFile, JSON.stringify(results, null, 2));

    // Summary
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ DAILY RUN COMPLETE`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total sent all-time: ${sentData.emails.length}`);
    console.log(`   Remaining: ${newShelters.length - toSend.length}`);
    console.log(`   Log: ${dailyLogFile}`);
}

main().catch(console.error);
