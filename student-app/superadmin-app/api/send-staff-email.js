const nodemailer = require('nodemailer');

// Configure Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, staffName, username, password, office } = req.body;

    // Validate input
    if (!email || !staffName || !username || !password || !office) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .credentials-box {
            background-color: white;
            border: 2px solid #2c3e50;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .credential-row {
            margin: 15px 0;
          }
          .credential-label {
            font-weight: 600;
            color: #666;
            font-size: 14px;
          }
          .credential-value {
            font-size: 18px;
            color: #2c3e50;
            font-weight: bold;
            font-family: 'Courier New', monospace;
          }
          .warning-box {
            background-color: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Academia De San Jose Staff Portal!</h1>
        </div>
        
        <div class="content">
          <p>Dear <strong>${staffName}</strong>,</p>
          
          <p>Your staff account for the <strong>${office}</strong> office has been created.</p>
          
          <div class="credentials-box">
            <div class="credential-row">
              <div class="credential-label">Username</div>
              <div class="credential-value">${username}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Temporary Password</div>
              <div class="credential-value">${password}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Office</div>
              <div class="credential-value">${office}</div>
            </div>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Important Security Notice:</strong>
            <ul style="margin: 10px 0;">
              <li>Change your password immediately after first login</li>
              <li>Do not share your credentials</li>
              <li>Keep this email secure</li>
            </ul>
          </div>
          
          <p>Best regards,<br>
          <strong>Academia De San Jose Administration</strong></p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply.</p>
          <p>&copy; 2025 Academia De San Jose. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Academia De San Jose - Staff Account Created

Dear ${staffName},

Your staff account for the ${office} office has been created.

STAFF CREDENTIALS
Username: ${username}
Temporary Password: ${password}
Office: ${office}

IMPORTANT SECURITY NOTICE
- Change your password immediately after first login
- Do not share your credentials
- Keep this email secure

Best regards,
Academia De San Jose Administration

This is an automated email. Please do not reply.
© 2025 Academia De San Jose. All rights reserved.
    `.trim();

    // Send email via Gmail SMTP
    const info = await transporter.sendMail({
      from: '"Academia De San Jose" <' + process.env.GMAIL_USER + '>',
      to: email,
      subject: `Your ${office} Office Admin Account`,
      text: textContent,
      html: htmlContent
    });

    console.log('✅ Staff email sent successfully:', info.messageId);
    
    return res.status(200).json({
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('❌ Error sending staff email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
};
