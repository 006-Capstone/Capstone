const nodemailer = require('nodemailer');
const { saveVerificationCode } = require('./_firebase.js');

module.exports = async function handler(req, res) {
  // Explicitly return JSON headers and enable CORS
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
    const { email, studentName, studentId, username, expiryMinutes } = req.body || {};

    if (!email || !studentName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and recipient name are required' 
      });
    }

    const normEmail = email.toLowerCase().trim();
    const effectiveId = (studentId || username || '').toString().trim();
    // Expiration set to 2 minutes
    const effectiveExpiryMinutes = Math.max(Number(expiryMinutes) || 2, 1);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Persist to Firestore (required across serverless invocations)
    await saveVerificationCode({
      email: normEmail,
      studentId: effectiveId,
      studentName,
      code: verificationCode,
      expiryMinutes: effectiveExpiryMinutes
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'academiadesanjose3@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';

    // Send email with Gmail SMTP
    const info = await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: normEmail,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2d5016; margin: 0;">Academia De San Jose</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Hello, ${studentName}!</h2>
            <p style="color: #666; line-height: 1.6;">
              We received a request to reset your password. Use the verification code below to proceed:
            </p>
          </div>

          <div style="background: #fff; border: 2px solid #2d5016; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Your Verification Code</p>
            <div style="font-size: 36px; font-weight: bold; color: #2d5016; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${verificationCode}
            </div>
            <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">Valid for ${effectiveExpiryMinutes} minutes</p>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Security Notice:</p>
            <ul style="color: #856404; margin: 10px 0 0 0; padding-left: 20px;">
              <li>This code expires in ${effectiveExpiryMinutes} minutes</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Never share this code with anyone</li>
              <li>Contact support if you notice suspicious activity</li>
            </ul>
          </div>

          <p style="color: #666; line-height: 1.6; text-align: center;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>

          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>© 2025 Academia De San Jose. All rights reserved.</p>
          </div>
        </div>
      `
    });

    console.log('[Success] Reset code sent:', info.messageId);
    return res.status(200).json({ 
      success: true, 
      message: 'Verification code sent to email',
      messageId: info.messageId,
      expiresInMinutes: effectiveExpiryMinutes
    });

  } catch (error) {
    console.error('[Error] Send reset code error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send verification code' 
    });
  }
};
module.exports.default = module.exports;
