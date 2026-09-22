const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // Explicitly return JSON headers and enable CORS
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, userName, temporaryPassword, role, office } = req.body || {};

    if (!email || !userName || !temporaryPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, name, and temporary password are required' 
      });
    }

    const isStudent = role === 'student';
    const roleText = isStudent ? 'Student' : 
                     (role === 'admin' || role === 'staff') ? 'Office Staff' : 
                     'Staff Member';

    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';

    if (!process.env.GMAIL_APP_PASSWORD) {
      console.warn('[Warning] GMAIL_APP_PASSWORD is not set in environment variables');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: fromEmail,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const loginUrl = isStudent 
      ? (process.env.STUDENT_APP_URL || process.env.REACT_APP_STUDENT_APP_URL || 'http://localhost:3000')
      : (process.env.ADMIN_APP_URL || process.env.REACT_APP_ADMIN_APP_URL || 'http://localhost:3001');

    const info = await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: email,
      subject: 'Your Academia De San Jose Account Has Been Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #1a6b0f 0%, #105E06 100%); padding: 30px; border-radius: 8px 8px 0 0; color: white;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Academia De San Jose</h1>
            <p style="color: #d6f4cf; margin: 6px 0 0 0; font-size: 14px;">${isStudent ? 'Student Portal' : 'Admin & Staff Portal'}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; margin-bottom: 20px;">
            <h2 style="color: #171d18; margin-top: 0; font-size: 20px;">Welcome, ${userName}!</h2>
            <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">
              Your <strong>${roleText}</strong> account has been successfully created. Below are your temporary login credentials:
            </p>
          </div>

          <div style="background: #ffffff; border: 2px solid #105E06; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold; width: 40%;">Email:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${email}</td>
              </tr>
              ${office ? `
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">Assigned Office:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${office}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">Temporary Password:</td>
                <td style="padding: 10px; color: #105E06; font-family: monospace; font-size: 18px; font-weight: bold;">${temporaryPassword}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Important Security Notice:</p>
            <ul style="color: #856404; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
              <li>Please change your password immediately after your first login.</li>
              <li>Do not share your temporary credentials with anyone.</li>
              <li>Keep this email in a secure location.</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="display: inline-block; background-color: #105E06; color: #ffffff; padding: 14px 34px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
              Access Portal & Log In
            </a>
          </div>

          <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 4px 0;">This is an automated notification from Academia De San Jose Administration.</p>
            <p style="margin: 0;">© 2026 Academia De San Jose. All rights reserved.</p>
          </div>
        </div>
      `
    });

    console.log('[Success] Temporary password email sent:', info.messageId);
    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId
    });

  } catch (error) {
    console.error('[Error] Send temporary password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send email' 
    });
  }
};

module.exports.default = module.exports;
