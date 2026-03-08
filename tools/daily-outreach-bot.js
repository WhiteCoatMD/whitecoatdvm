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
    delayBetweenEmails: 3000,

    // Follow-up sequence
    followUpDays: [7, 14],  // days after previous email
    maxWaves: 3             // initial + 2 follow-ups
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
https://whitecoatdvm.com/partners`,

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

        <p style="text-align: center; margin: 25px 0;">
            <a href="https://whitecoatdvm.com/partners" style="background: #3498db; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Learn More & Get Started</a>
        </p>

        <div class="signature">
            <p>Best,<br>
            <strong>Mitch Bratton</strong><br>
            WhiteCoat DVM<br>
            <a href="https://whitecoatdvm.com/partners">whitecoatdvm.com/partners</a></p>
        </div>
    </div>
</body>
</html>`
    };
}

// ============================================
// FOLLOW-UP TEMPLATES
// ============================================

function getFollowUpTemplate(shelter, wave) {
    if (wave === 2) {
        return {
            subject: `Re: Partnership opportunity for ${shelter.name}`,

            text: `Hi ${shelter.name} Team,

Just bumping my earlier email — wanted to make sure it didn't get buried.

Quick recap: WhiteCoat DVM offers 24/7 virtual vet consultations. You'd earn $10/month for every subscriber you refer. There's no cost to you, and your adopters get affordable vet access anytime.

Would you be open to a quick chat this week?

Best,
Mitch Bratton
WhiteCoat DVM
https://whitecoatdvm.com/partners`,

            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .highlight { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .signature { margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/t9F7dAa.png" alt="WhiteCoat DVM" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${shelter.name} Team,</p>

        <p>Just bumping my earlier email — wanted to make sure it didn't get buried.</p>

        <div class="highlight">
            <p><strong>Quick recap:</strong> WhiteCoat DVM offers 24/7 virtual vet consultations. You'd earn <strong>$10/month</strong> for every subscriber you refer. There's no cost to you, and your adopters get affordable vet access anytime.</p>
        </div>

        <p><strong>Would you be open to a quick chat this week?</strong></p>

        <p style="text-align: center; margin: 20px 0;">
            <a href="https://whitecoatdvm.com/partners" style="background: #3498db; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Learn More</a>
        </p>

        <div class="signature">
            <p>Best,<br>
            <strong>Mitch Bratton</strong><br>
            WhiteCoat DVM<br>
            <a href="https://whitecoatdvm.com/partners">whitecoatdvm.com/partners</a></p>
        </div>
    </div>
</body>
</html>`
        };
    }

    // Wave 3 — final follow-up
    return {
        subject: `Last note from WhiteCoat DVM — ${shelter.name}`,

        text: `Hi ${shelter.name} Team,

I'll keep this brief — this is my last follow-up.

One thing I didn't mention: shelters using virtual vet services see fewer post-adoption returns. When adopters can get quick answers to "is this normal?" questions, they're more confident keeping their new pet.

If the timing isn't right, no worries at all. But if you'd like to explore a partnership that earns your shelter $10/month per subscriber while helping adopters, I'm here.

Wishing you and the animals all the best,
Mitch Bratton
WhiteCoat DVM
https://whitecoatdvm.com/partners`,

        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .highlight { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .signature { margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/t9F7dAa.png" alt="WhiteCoat DVM" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${shelter.name} Team,</p>

        <p>I'll keep this brief — this is my last follow-up.</p>

        <div class="highlight">
            <p>One thing I didn't mention: shelters using virtual vet services see <strong>fewer post-adoption returns</strong>. When adopters can get quick answers to "is this normal?" questions, they're more confident keeping their new pet.</p>
        </div>

        <p>If the timing isn't right, no worries at all. But if you'd like to explore a partnership that earns your shelter <strong>$10/month per subscriber</strong> while helping adopters, I'm here.</p>

        <p style="text-align: center; margin: 20px 0;">
            <a href="https://whitecoatdvm.com/partners" style="background: #27ae60; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">See How It Works</a>
        </p>

        <div class="signature">
            <p>Wishing you and the animals all the best,<br>
            <strong>Mitch Bratton</strong><br>
            WhiteCoat DVM<br>
            <a href="https://whitecoatdvm.com/partners">whitecoatdvm.com/partners</a></p>
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
        const raw = JSON.parse(fs.readFileSync(CONFIG.sentLogFile, 'utf-8'));

        // Migrate from old flat array format to structured format
        if (raw.emails && !raw.shelters) {
            console.log('📦 Migrating sent_emails.json to structured format...');
            const shelters = {};
            const seen = new Set();
            for (const email of raw.emails) {
                const lower = email.toLowerCase();
                if (seen.has(lower)) continue;
                seen.add(lower);
                shelters[lower] = {
                    name: '',
                    wave: 1,
                    dates: [raw.lastRun || new Date().toISOString()],
                    nextFollowUp: addDays(raw.lastRun || new Date().toISOString(), CONFIG.followUpDays[0])
                };
            }
            return { shelters, lastRun: raw.lastRun };
        }

        return raw;
    }
    return { shelters: {}, lastRun: null };
}

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
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

async function sendEmail(shelter, wave) {
    const template = wave > 1
        ? getFollowUpTemplate(shelter, wave)
        : getEmailTemplate(shelter);

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

    // Load sent emails history (auto-migrates old format)
    const sentData = loadSentEmails();
    const shelters = sentData.shelters;
    const trackedCount = Object.keys(shelters).length;

    console.log(`📊 Previously contacted: ${trackedCount} shelters`);

    // Find and load latest shelter CSV
    const sheltersCsv = findLatestCleanCsv();
    if (!sheltersCsv) {
        console.log(`❌ No CLEAN_*.csv file found. Run the scraper first.`);
        return;
    }
    console.log(`📂 Loading: ${path.basename(sheltersCsv)}`);

    const allShelters = parseCSV(sheltersCsv);
    console.log(`📋 Total shelters in database: ${allShelters.length}`);

    // Build send queue: follow-ups first, then new outreach
    const today = todayStr();
    const sendQueue = [];

    // 1. Gather shelters due for follow-up
    for (const [email, record] of Object.entries(shelters)) {
        if (record.wave >= CONFIG.maxWaves) continue; // done, no more follow-ups
        if (!record.nextFollowUp || record.nextFollowUp > today) continue; // not due yet

        // Find shelter details from CSV (for name/template), fall back to record
        const csvShelter = allShelters.find(s => s.email.toLowerCase() === email);
        const name = (csvShelter && csvShelter.name) || record.name || email;
        const nextWave = record.wave + 1;

        sendQueue.push({
            email,
            name,
            wave: nextWave,
            type: 'follow-up'
        });
    }

    console.log(`🔄 Follow-ups due: ${sendQueue.length}`);

    // 2. Fill remaining slots with new outreach
    const remainingSlots = CONFIG.maxEmailsPerDay - sendQueue.length;
    if (remainingSlots > 0) {
        const newShelters = allShelters.filter(s => !shelters[s.email.toLowerCase()]);
        console.log(`🆕 New shelters available: ${newShelters.length}`);

        const newToSend = newShelters.slice(0, remainingSlots);
        for (const shelter of newToSend) {
            sendQueue.push({
                email: shelter.email,
                name: shelter.name,
                wave: 1,
                type: 'new'
            });
        }
    }

    if (sendQueue.length === 0) {
        console.log(`\n✅ No emails to send today — all shelters contacted and follow-ups not yet due.`);
        return;
    }

    console.log(`📨 Sending ${sendQueue.length} emails today (${sendQueue.filter(s => s.type === 'follow-up').length} follow-ups, ${sendQueue.filter(s => s.type === 'new').length} new)\n`);

    // Send emails
    let sent = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < sendQueue.length; i++) {
        const item = sendQueue[i];
        const waveLabel = `wave ${item.wave}/${CONFIG.maxWaves}`;
        console.log(`[${i + 1}/${sendQueue.length}] ${item.name} (${item.email}) — ${waveLabel}...`);

        try {
            await sendEmail({ name: item.name, email: item.email }, item.wave);
            console.log(`   ✅ Sent!`);
            sent++;

            // Update shelter record
            const emailKey = item.email.toLowerCase();
            const now = new Date().toISOString();

            if (!shelters[emailKey]) {
                // New shelter
                shelters[emailKey] = {
                    name: item.name,
                    wave: 1,
                    dates: [now],
                    nextFollowUp: addDays(now, CONFIG.followUpDays[0])
                };
            } else {
                // Follow-up
                shelters[emailKey].wave = item.wave;
                shelters[emailKey].dates.push(now);
                if (item.name) shelters[emailKey].name = item.name;

                if (item.wave >= CONFIG.maxWaves) {
                    // Done — no more follow-ups
                    shelters[emailKey].nextFollowUp = null;
                } else {
                    const followUpIndex = item.wave - 1; // wave 2 -> index 1
                    const daysUntilNext = CONFIG.followUpDays[followUpIndex] || CONFIG.followUpDays[CONFIG.followUpDays.length - 1];
                    shelters[emailKey].nextFollowUp = addDays(now, daysUntilNext);
                }
            }

            results.push({
                name: item.name,
                email: item.email,
                wave: item.wave,
                type: item.type,
                status: 'sent',
                timestamp: now
            });
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
            failed++;
            results.push({
                name: item.name,
                email: item.email,
                wave: item.wave,
                type: item.type,
                status: 'failed',
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }

        // Delay between emails
        if (i < sendQueue.length - 1) {
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
    const doneCount = Object.values(shelters).filter(s => s.wave >= CONFIG.maxWaves).length;
    const pendingFollowUps = Object.values(shelters).filter(s => s.wave < CONFIG.maxWaves && s.nextFollowUp).length;

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ DAILY RUN COMPLETE`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Sent: ${sent} (${results.filter(r => r.status === 'sent' && r.type === 'follow-up').length} follow-ups, ${results.filter(r => r.status === 'sent' && r.type === 'new').length} new)`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total shelters contacted: ${Object.keys(shelters).length}`);
    console.log(`   Completed sequences: ${doneCount}`);
    console.log(`   Pending follow-ups: ${pendingFollowUps}`);
    console.log(`   Log: ${dailyLogFile}`);
}

main().catch(console.error);
