/**
 * Outreach Stats Dashboard
 * Shows overview of shelter outreach progress
 *
 * Usage: node tools/stats.js
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'output');

function findLatestCleanCsv() {
    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('CLEAN_') && f.endsWith('.csv'))
        .sort()
        .reverse();
    return files.length > 0 ? path.join(outputDir, files[0]) : null;
}

function parseCSV(filepath) {
    if (!fs.existsSync(filepath)) return [];
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.toLowerCase().replace(/"/g, '').trim());
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

function loadSentEmails() {
    const sentFile = path.join(outputDir, 'sent_emails.json');
    if (fs.existsSync(sentFile)) {
        return JSON.parse(fs.readFileSync(sentFile, 'utf-8'));
    }
    return { emails: [], lastRun: null };
}

function loadOutreachLogs() {
    const logs = [];
    const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith('outreach_log_') && f.endsWith('.json'))
        .sort()
        .reverse();

    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf-8'));
            logs.push(...data);
        } catch (e) {}
    }
    return logs;
}

function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              📊 SHELTER OUTREACH DASHBOARD 📊                 ║
╚═══════════════════════════════════════════════════════════════╝
`);

    // Load data
    const csvFile = findLatestCleanCsv();
    const allShelters = csvFile ? parseCSV(csvFile) : [];
    const sentData = loadSentEmails();
    const sentSet = new Set(sentData.emails.map(e => e.toLowerCase()));
    const logs = loadOutreachLogs();

    const contacted = allShelters.filter(s => sentSet.has(s.email.toLowerCase()));
    const remaining = allShelters.filter(s => !sentSet.has(s.email.toLowerCase()));

    // Stats
    console.log(`📁 Database: ${csvFile ? path.basename(csvFile) : 'None'}`);
    console.log(`📅 Last run: ${sentData.lastRun ? new Date(sentData.lastRun).toLocaleString() : 'Never'}`);
    console.log('');

    console.log('┌─────────────────────────────────────┐');
    console.log('│           SUMMARY                   │');
    console.log('├─────────────────────────────────────┤');
    console.log(`│  Total shelters found:    ${String(allShelters.length).padStart(6)}   │`);
    console.log(`│  ✅ Contacted:            ${String(sentData.emails.length).padStart(6)}   │`);
    console.log(`│  📨 Remaining:            ${String(remaining.length).padStart(6)}   │`);
    console.log('└─────────────────────────────────────┘');
    console.log('');

    // States breakdown
    const stateCount = {};
    allShelters.forEach(s => {
        const state = s.state || 'Unknown';
        stateCount[state] = (stateCount[state] || 0) + 1;
    });

    const sortedStates = Object.entries(stateCount).sort((a, b) => b[1] - a[1]);

    console.log('┌─────────────────────────────────────┐');
    console.log('│        SHELTERS BY STATE            │');
    console.log('├─────────────────────────────────────┤');
    for (const [state, count] of sortedStates.slice(0, 10)) {
        const bar = '█'.repeat(Math.min(20, Math.round(count / 2)));
        console.log(`│  ${state.padEnd(12)} ${String(count).padStart(3)}  ${bar.padEnd(20)} │`);
    }
    if (sortedStates.length > 10) {
        console.log(`│  ... and ${sortedStates.length - 10} more states            │`);
    }
    console.log('└─────────────────────────────────────┘');
    console.log('');

    // Recent activity
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    RECENTLY CONTACTED                       │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    const recentLogs = logs
        .filter(l => l.status === 'sent')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    if (recentLogs.length === 0) {
        console.log('│  No outreach logs found yet.                                │');
    } else {
        for (const log of recentLogs) {
            const date = new Date(log.timestamp).toLocaleDateString();
            const name = log.name.substring(0, 30).padEnd(30);
            console.log(`│  ${date}  ${name}                 │`);
        }
    }
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    // Remaining shelters
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    NEXT UP (Queue)                          │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    if (remaining.length === 0) {
        console.log('│  🎉 All shelters have been contacted!                       │');
    } else {
        for (const shelter of remaining.slice(0, 10)) {
            const name = shelter.name.substring(0, 35).padEnd(35);
            const state = (shelter.state || '??').padEnd(2);
            console.log(`│  ${state}  ${name}                    │`);
        }
        if (remaining.length > 10) {
            console.log(`│  ... and ${remaining.length - 10} more in queue                               │`);
        }
    }
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    // Full contacted list
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                 ALL CONTACTED SHELTERS                      │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    if (contacted.length === 0) {
        console.log('│  No shelters contacted yet.                                 │');
    } else {
        for (const shelter of contacted) {
            const name = shelter.name.substring(0, 35).padEnd(35);
            const state = (shelter.state || '??').padEnd(2);
            console.log(`│  ${state}  ${name}                    │`);
        }
    }
    console.log('└─────────────────────────────────────────────────────────────┘');
}

main();
