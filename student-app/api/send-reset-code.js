const nodemailer = require('nodemailer');

// In-memory store for verification codes (for development)
// In production, use Redis or a database
const verificationCodes = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, studentName, studentId, expiryMinutes = 1 } = req.body;

    if (!email || !studentName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and student name are required' 
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with expiry
    const expiryTime = Date.now() + (expiryMinutes * 60 * 1000);
    verificationCodes.set(email, {
      code: verificationCode,
      expiry: expiryTime,
      studentId
    });

    // Configure Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Send email
    await transporter.sendMail({
      from: `"Academia De San Jose" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d5016;">Password Reset Request</h2>
          <p>Hello <strong>${studentName}</strong>,</p>
          <p>You requested to reset your password. Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2d5016;">
            ${verificationCode}
          </div>
          <p><strong>This code will expire in ${expiryMinutes} minute(s).</strong></p>
          <p>If you did not request this password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Academia De San Jose - Student Portal</p>
        </div>
      `
    });

    console.log(`[Success] Verification code sent to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error) {
    console.error('[Error] Failed to send verification code:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
}

// Export the codes Map for other functions to access
export { verificationCodes };
