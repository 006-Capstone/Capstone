const nodemailer = require('nodemailer');

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
    const { email, userName, temporaryPassword, role, office, username, studentId, id, staffUsername } = req.body || {};

    if (!email || !userName || !temporaryPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, name, and temporary password are required' 
      });
    }

    const isStudent = role === 'student';
    const resolvedStudentId = studentId || id || '';
    const resolvedUsername = username || staffUsername || '';
    const roleText = isStudent ? 'Student' : 
                     (role === 'admin' || role === 'staff') ? 'Office Staff' : 
                     'Administrator';

    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'academiadesanjose3@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const loginUrl = isStudent 
      ? (process.env.STUDENT_APP_URL || 'https://student-portal-one-delta.vercel.app')
      : (process.env.ADMIN_APP_URL || 'https://admin-website-ruddy.vercel.app');

    const info = await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: email,
      subject: 'Your Academia De San Jose Account Has Been Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2d5016; margin: 0;">Academia De San Jose</h1>
            <p style="color: #666; margin: 5px 0 0 0;">${isStudent ? 'Student Portal' : 'Admin & Staff Portal'}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Welcome, ${userName}!</h2>
            <p style="color: #666; line-height: 1.6;">
              Your ${roleText} account has been successfully created. Below are your login credentials:
            </p>
          </div>

          <div style="background: #fff; border: 2px solid #2d5016; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; color: #666; font-weight: bold; width: 40%;">Email:</td>
                <td style="padding: 10px; color: #333;">${email}</td>
              </tr>
              ${isStudent ? `
              ${resolvedStudentId ? `
              <tr>
                <td style="padding: 10px; color: #666; font-weight: bold;">Student ID:</td>
                <td style="padding: 10px; color: #333;">${resolvedStudentId}</td>
              </tr>` : ''}
              ` : `
              ${resolvedUsername ? `
              <tr>
                <td style="padding: 10px; color: #666; font-weight: bold;">Username:</td>
                <td style="padding: 10px; color: #333;">${resolvedUsername}</td>
              </tr>` : ''}
              ${office ? `
              <tr>
                <td style="padding: 10px; color: #666; font-weight: bold;">Assigned Office:</td>
                <td style="padding: 10px; color: #333;">${office}</td>
              </tr>` : ''}
              `}
              <tr>
                <td style="padding: 10px; color: #666; font-weight: bold;">Temporary Password:</td>
                <td style="padding: 10px; color: #2d5016; font-family: monospace; font-size: 18px; font-weight: bold;">${temporaryPassword}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Important Security Notice:</p>
            <ul style="color: #856404; margin: 10px 0 0 0; padding-left: 20px;">
              <li>Please change your password immediately after your first login</li>
              <li>Do not share your credentials with anyone</li>
              <li>Keep this email in a secure location</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="display: inline-block; background: #2d5016; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Login Now
            </a>
          </div>

          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>© 2025 Academia De San Jose. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `
Academia De San Jose - Account Created

Welcome, ${userName}!

Your ${roleText} account has been successfully created. Below are your login credentials:

CREDENTIALS
Email: ${email}
${isStudent ? (resolvedStudentId ? `Student ID: ${resolvedStudentId}\n` : '') : `${resolvedUsername ? `Username: ${resolvedUsername}\n` : ''}${office ? `Assigned Office: ${office}\n` : ''}`}Temporary Password: ${temporaryPassword}

Login at: ${loginUrl}

IMPORTANT SECURITY NOTICE:
- Please change your password immediately after your first login
- Do not share your credentials with anyone
- Keep this email in a secure location

© 2025 Academia De San Jose. All rights reserved.
      `.trim()
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
