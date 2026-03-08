/**
 * HR / Employee Benefits Outreach Bot
 * Sends cold emails to HR companies, benefits brokers, PEOs, and wellness platforms
 * Pitches WhiteCoat DVM as an employee pet benefit
 *
 * Usage:
 *   node tools/hr-outreach-bot.js          # Run once (for scheduler)
 *   node tools/hr-outreach-bot.js --force  # Ignore time restrictions
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

    maxEmailsPerDay: 15,

    startHour: 8,
    endHour: 16,

    workingDays: [1, 2, 3, 4, 5], // Mon-Fri

    outputDir: path.join(__dirname, 'output'),
    leadsFile: path.join(__dirname, 'hr-benefits-leads.csv'),
    sentLogFile: path.join(__dirname, 'output', 'hr_sent_emails.json'),
    dailyLogDir: path.join(__dirname, 'output', 'hr_daily_logs'),

    delayBetweenEmails: 3000,

    followUpDays: [7, 14],
    maxWaves: 3
};

// ============================================
// EMAIL TEMPLATES
// ============================================

function getEmailTemplate(lead) {
    const companyName = lead.name || 'your team';

    return {
        subject: `Pet benefits for your clients' employees — easy add, zero admin`,

        text: `Hi ${companyName} Team,

I'm Mitch Bratton from WhiteCoat DVM. We offer 24/7 virtual veterinary consultations nationwide, and I think it could be a great fit as an employee benefit for the companies you work with.

Here's the quick pitch:
- Employees pay $20/month for unlimited 24/7 virtual vet consultations (up to 6 pets)
- Zero admin burden — employees sign up directly, no enrollment integration needed
- Works as a voluntary benefit, company-subsidized perk, or wellness add-on
- Licensed veterinarians available nationwide in all 50 states

Why this resonates with employees:
- 70% of US households have pets — this is a benefit people actually use
- Average vet visit costs $50-300. This pays for itself after one use
- Reduces "pet sick day" absenteeism — employees don't need to leave work for routine vet questions

We're offering partnership opportunities where you'd earn a referral fee for every employee who enrolls through your network.

Would you have 15 minutes to discuss how this could work for your clients?

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
        .pitch-box { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .pitch-box li { margin: 8px 0; }
        .why-box { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .why-box li { margin: 8px 0; }
        .cta { color: #2563eb; }
        .signature { margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/t9F7dAa.png" alt="WhiteCoat DVM" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${companyName} Team,</p>

        <p>I'm Mitch Bratton from <strong>WhiteCoat DVM</strong>. We offer 24/7 virtual veterinary consultations nationwide, and I think it could be a great fit as an <strong>employee benefit</strong> for the companies you work with.</p>

        <div class="pitch-box">
            <p><strong>Here's the quick pitch:</strong></p>
            <ul>
                <li>Employees pay <strong>$20/month</strong> for unlimited 24/7 virtual vet consultations (up to 6 pets)</li>
                <li><strong>Zero admin burden</strong> — employees sign up directly, no enrollment integration needed</li>
                <li>Works as a voluntary benefit, company-subsidized perk, or wellness add-on</li>
                <li>Licensed veterinarians available nationwide in all 50 states</li>
            </ul>
        </div>

        <div class="why-box">
            <p><strong>Why this resonates with employees:</strong></p>
            <ul>
                <li><strong>70% of US households</strong> have pets — this is a benefit people actually use</li>
                <li>Average vet visit costs $50-300. This pays for itself after one use</li>
                <li>Reduces "pet sick day" absenteeism — employees don't need to leave work for routine vet questions</li>
            </ul>
        </div>

        <p>We're offering <strong>partnership opportunities</strong> where you'd earn a referral fee for every employee who enrolls through your network.</p>

        <p class="cta"><strong>Would you have 15 minutes to discuss how this could work for your clients?</strong></p>

        <p style="text-align: center; margin: 25px 0;">
            <a href="https://whitecoatdvm.com/partners" style="background: #3498db; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Learn More About Partnering</a>
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

function getFollowUpTemplate(lead, wave) {
    const companyName = lead.name || 'your team';

    if (wave === 2) {
        return {
            subject: `Re: Pet benefits for employees — quick follow-up`,

            text: `Hi ${companyName} Team,

Just following up on my earlier email about WhiteCoat DVM.

Quick recap: We offer 24/7 virtual vet care as an employee benefit. $20/month per employee, no admin needed on your end, and it's a perk that 70% of employees would actually use (because 70% have pets).

Companies adding pet benefits are seeing measurable improvements in employee satisfaction and retention — and this one requires zero setup from HR.

Happy to send over a one-pager you could share with your clients. Would that be helpful?

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

        <p>Hi ${companyName} Team,</p>

        <p>Just following up on my earlier email about WhiteCoat DVM.</p>

        <div class="highlight">
            <p><strong>Quick recap:</strong> We offer 24/7 virtual vet care as an employee benefit. <strong>$20/month</strong> per employee, no admin needed on your end, and it's a perk that <strong>70% of employees</strong> would actually use.</p>
        </div>

        <p>Companies adding pet benefits are seeing measurable improvements in employee satisfaction and retention — and this one requires <strong>zero setup from HR</strong>.</p>

        <p><strong>Happy to send over a one-pager you could share with your clients. Would that be helpful?</strong></p>

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
        subject: `Last note — pet telehealth as an employee perk`,

        text: `Hi ${companyName} Team,

Last follow-up from me — I know inboxes are busy.

One stat I wanted to share: pet-related employee absences cost US businesses an estimated $300M annually. A $20/month virtual vet benefit eliminates most of those "I need to take my pet to the vet" half-days.

If the timing isn't right, totally understand. But if you're looking for a unique, low-cost benefit to differentiate your offerings, I'd love to chat.

Either way, wishing you all the best.

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
        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .signature { margin-top: 30px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/t9F7dAa.png" alt="WhiteCoat DVM" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${companyName} Team,</p>

        <p>Last follow-up from me — I know inboxes are busy.</p>

        <div class="highlight">
            <p>One stat I wanted to share: pet-related employee absences cost US businesses an estimated <strong>$300M annually</strong>. A <strong>$20/month virtual vet benefit</strong> eliminates most of those "I need to take my pet to the vet" half-days.</p>
        </div>

        <p>If the timing isn't right, totally understand. But if you're looking for a <strong>unique, low-cost benefit</strong> to differentiate your offerings, I'd love to chat.</p>

        <p style="text-align: center; margin: 20px 0;">
            <a href="https://whitecoatdvm.com/partners" style="background: #27ae60; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">See How It Works</a>
        </p>

        <div class="signature">
            <p>Either way, wishing you all the best.<br>
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
// HELPERS (same pattern as daily-outreach-bot)
// ============================================

function isWithinWorkingHours() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    return CONFIG.workingDays.includes(day) && hour >= CONFIG.startHour && hour < CONFIG.endHour;
}

function loadSentEmails() {
    if (fs.existsSync(CONFIG.sentLogFile)) {
        return JSON.parse(fs.readFileSync(CONFIG.sentLogFile, 'utf-8'));
    }
    return { shelters: {}, lastRun: null };
}

function saveSentEmails(data) {
    fs.writeFileSync(CONFIG.sentLogFile, JSON.stringify(data, null, 2));
}

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
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
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
        else current += char;
    }
    values.push(current);
    return values;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendEmail(lead, wave) {
    const template = wave > 1 ? getFollowUpTemplate(lead, wave) : getEmailTemplate(lead);
    const msg = {
        to: lead.email,
        from: { email: CONFIG.fromEmail, name: CONFIG.fromName },
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
║       🏢 HR Benefits Outreach Bot 🏢                  ║
╚═══════════════════════════════════════════════════════╝
`);

    if (!forceRun && !isWithinWorkingHours()) {
        const now = new Date();
        console.log(`⏰ Current time: ${now.toLocaleString()}`);
        console.log(`❌ Outside working hours (Mon-Fri ${CONFIG.startHour}:00-${CONFIG.endHour}:00)`);
        console.log(`   Use --force to run anyway.`);
        return;
    }

    if (!process.env.SENDGRID_API_KEY) {
        console.error('❌ SENDGRID_API_KEY not found in .env.local');
        return;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    if (!fs.existsSync(CONFIG.dailyLogDir)) {
        fs.mkdirSync(CONFIG.dailyLogDir, { recursive: true });
    }

    const sentData = loadSentEmails();
    const leads = sentData.shelters; // reusing "shelters" key for consistency
    const trackedCount = Object.keys(leads).length;

    console.log(`📊 Previously contacted: ${trackedCount} companies`);

    if (!fs.existsSync(CONFIG.leadsFile)) {
        console.log(`❌ No leads file found at ${CONFIG.leadsFile}`);
        console.log(`   Create a CSV with columns: name,email,city,state,website,type`);
        return;
    }

    const allLeads = parseCSV(CONFIG.leadsFile);
    console.log(`📋 Total leads in database: ${allLeads.length}`);

    const today = todayStr();
    const sendQueue = [];

    // 1. Follow-ups due
    for (const [email, record] of Object.entries(leads)) {
        if (record.wave >= CONFIG.maxWaves) continue;
        if (!record.nextFollowUp || record.nextFollowUp > today) continue;
        const csvLead = allLeads.find(l => l.email.toLowerCase() === email);
        const name = (csvLead && csvLead.name) || record.name || email;
        sendQueue.push({ email, name, wave: record.wave + 1, type: 'follow-up' });
    }

    console.log(`🔄 Follow-ups due: ${sendQueue.length}`);

    // 2. New outreach
    const remainingSlots = CONFIG.maxEmailsPerDay - sendQueue.length;
    if (remainingSlots > 0) {
        const newLeads = allLeads.filter(l => !leads[l.email.toLowerCase()]);
        console.log(`🆕 New leads available: ${newLeads.length}`);
        const newToSend = newLeads.slice(0, remainingSlots);
        for (const lead of newToSend) {
            sendQueue.push({ email: lead.email, name: lead.name, wave: 1, type: 'new' });
        }
    }

    if (sendQueue.length === 0) {
        console.log(`\n✅ No emails to send today.`);
        return;
    }

    console.log(`📨 Sending ${sendQueue.length} emails today\n`);

    let sent = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < sendQueue.length; i++) {
        const item = sendQueue[i];
        console.log(`[${i + 1}/${sendQueue.length}] ${item.name} (${item.email}) — wave ${item.wave}/${CONFIG.maxWaves}...`);

        try {
            await sendEmail({ name: item.name, email: item.email }, item.wave);
            console.log(`   ✅ Sent!`);
            sent++;

            const emailKey = item.email.toLowerCase();
            const now = new Date().toISOString();

            if (!leads[emailKey]) {
                leads[emailKey] = {
                    name: item.name,
                    wave: 1,
                    dates: [now],
                    nextFollowUp: addDays(now, CONFIG.followUpDays[0])
                };
            } else {
                leads[emailKey].wave = item.wave;
                leads[emailKey].dates.push(now);
                if (item.name) leads[emailKey].name = item.name;
                if (item.wave >= CONFIG.maxWaves) {
                    leads[emailKey].nextFollowUp = null;
                } else {
                    const followUpIndex = item.wave - 1;
                    const daysUntilNext = CONFIG.followUpDays[followUpIndex] || CONFIG.followUpDays[CONFIG.followUpDays.length - 1];
                    leads[emailKey].nextFollowUp = addDays(now, daysUntilNext);
                }
            }

            results.push({ name: item.name, email: item.email, wave: item.wave, type: item.type, status: 'sent', timestamp: now });
        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
            failed++;
            results.push({ name: item.name, email: item.email, wave: item.wave, type: item.type, status: 'failed', error: err.message, timestamp: new Date().toISOString() });
        }

        if (i < sendQueue.length - 1) await delay(CONFIG.delayBetweenEmails);
    }

    sentData.lastRun = new Date().toISOString();
    saveSentEmails(sentData);

    const dailyLogFile = path.join(CONFIG.dailyLogDir, `${todayStr()}.json`);
    fs.writeFileSync(dailyLogFile, JSON.stringify(results, null, 2));

    const doneCount = Object.values(leads).filter(l => l.wave >= CONFIG.maxWaves).length;
    const pendingFollowUps = Object.values(leads).filter(l => l.wave < CONFIG.maxWaves && l.nextFollowUp).length;

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ DAILY RUN COMPLETE`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total contacted: ${Object.keys(leads).length}`);
    console.log(`   Completed sequences: ${doneCount}`);
    console.log(`   Pending follow-ups: ${pendingFollowUps}`);
}

main().catch(console.error);
