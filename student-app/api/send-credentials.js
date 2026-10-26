const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, studentId, password, studentName } = req.body || {};

    if (!email || !studentId || !password || !studentName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, studentId, password, studentName'
      });
    }

    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!gmailPass) {
      return res.status(500).json({
        success: false,
        error: 'GMAIL_APP_PASSWORD is not configured in environment variables'
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: fromEmail,
        pass: gmailPass
      }
    });

    const portalUrl = process.env.STUDENT_APP_URL || 'https://student-portal-one-delta.vercel.app';

    await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: email.trim(),
      subject: 'Academia De San Jose — Student Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d4a05; margin-bottom: 8px;">Academia De San Jose</h2>
          <p style="color: #4b5563; font-size: 14px;">Academic Request Ticketing and Management System</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p>Hello <strong>${studentName}</strong>,</p>
          <p>Your official student account has been created. Use the credentials below to log in:</p>
          <div style="background-color: #f4f8f3; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Student ID:</strong> ${studentId}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <p>Access the student portal here: <a href="${portalUrl}" style="color: #105e06; font-weight: bold;">${portalUrl}</a></p>
          <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Please change your password immediately after logging in for security.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Student credentials dispatched successfully'
    });
  } catch (error) {
    console.error('[send-credentials error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch email'
    });
  }
};
