module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { orgName, contactName, email, phone, state, orgType, website, message } = req.body;

        if (!orgName || !contactName || !email) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        // Send notification to admin
        await sgMail.send({
            to: 'mitch@whitecoat-md.com',
            from: { email: 'support@whitecoat-md.com', name: 'WhiteCoat DVM' },
            replyTo: email,
            subject: `New Partner Application: ${orgName}`,
            html: `
                <h2>New Shelter/Rescue Partner Application</h2>
                <table style="border-collapse:collapse;width:100%;max-width:500px;">
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Organization</td><td style="padding:8px;border-bottom:1px solid #eee;">${orgName}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Contact Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${contactName}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">State</td><td style="padding:8px;border-bottom:1px solid #eee;">${state}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Type</td><td style="padding:8px;border-bottom:1px solid #eee;">${orgType || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Website</td><td style="padding:8px;border-bottom:1px solid #eee;">${website ? '<a href="' + website + '">' + website + '</a>' : 'N/A'}</td></tr>
                    <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Message</td><td style="padding:8px;border-bottom:1px solid #eee;">${message || 'N/A'}</td></tr>
                </table>
                <p style="margin-top:20px;color:#666;">Submitted from the Partner landing page.</p>
            `
        });

        console.log('Partner inquiry received from:', orgName, email);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Partner inquiry error:', error);
        return res.status(500).json({ error: 'Failed to submit inquiry' });
    }
};
