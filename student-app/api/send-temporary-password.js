const nodemailer = require('nodemailer');

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
    const { email, userName, temporaryPassword, role } = req.body;

    if (!email || !userName || !temporaryPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, name, and temporary password are required' 
      });
    }

    // Configure Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const roleText = role === 'student' ? 'Student' : 
                     role === 'admin' ? 'Office Staff' : 
                     'Administrator';

    // Send email with temporary password
    await transporter.sendMail({
      from: `"Academia De San Jose" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Academia De San Jose Account Has Been Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2d5016; margin: 0;">Academia De San Jose</h1>
            <p style="color: #666; margin: 5px 0 0 0;">Student Portal System</p>
          </div>

          <h2 style="color: #2d5016;">Welcome to the Portal!</h2>
          
          <p>Hello <strong>${userName}</strong>,</p>
          
          <p>Your ${roleText} account has been created successfully. Here are your login credentials:</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #2d5016; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> 
              <span style="background-color: #fff; padding: 5px 10px; border-radius: 3px; font-family: monospace; font-size: 16px;">${temporaryPassword}</span>
            </p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Important Security Notice:</strong><br>
              You will be required to change this password when you first log in. Please choose a strong, unique password.
            </p>
          </div>

          <h3 style="color: #2d5016; margin-top: 30px;">Getting Started:</h3>
          <ol style="line-height: 1.8;">
            <li>Visit the portal login page</li>
            <li>Enter your email and temporary password</li>
            <li>You will be prompted to create a new password</li>
            <li>Complete your profile setup</li>
          </ol>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px; margin: 5px 0;">
              If you did not request this account or have any questions, please contact the school administration immediately.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Academia De San Jose. All rights reserved.
            </p>
          </div>
        </div>
      `
    });

    console.log(`[Success] Temporary password email sent to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Temporary password email sent successfully'
    });

  } catch (error) {
    console.error('[Error] Failed to send temporary password email:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email. Please ensure the email address is valid.'
    });
  }
}
