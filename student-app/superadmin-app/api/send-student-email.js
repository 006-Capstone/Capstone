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
    const { email, studentId, password, studentName } = req.body;

    // Validate input
    if (!email || !studentId || !password || !studentName) {
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
            background: linear-gradient(135deg, #1a6b0f 0%, #105E06 100%);
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
            border: 2px solid #105E06;
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
            color: #105E06;
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
          <h1>Welcome to Academia De San Jose!</h1>
        </div>
        
        <div class="content">
          <p>Dear <strong>${studentName}</strong>,</p>
          
          <p>Your student account has been successfully created. You can now access the Academia De San Jose Student Portal using the credentials below:</p>
          
          <div class="credentials-box">
            <div class="credential-row">
              <div class="credential-label">Student ID</div>
              <div class="credential-value">${studentId}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Temporary Password</div>
              <div class="credential-value">${password}</div>
            </div>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Important Security Notice:</strong>
            <ul style="margin: 10px 0;">
              <li>Please change your password immediately after your first login</li>
              <li>Do not share your credentials with anyone</li>
              <li>Keep this email in a secure location</li>
            </ul>
          </div>
          
          <p>If you have any questions or need assistance, please contact the admissions office.</p>
          
          <p>Best regards,<br>
          <strong>Academia De San Jose Administration Team</strong></p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>&copy; 2025 Academia De San Jose. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Academia De San Jose - Student Account Created

Dear ${studentName},

Your student account has been successfully created. You can now access the Academia De San Jose Student Portal using the credentials below:

STUDENT CREDENTIALS
Student ID: ${studentId}
Temporary Password: ${password}

IMPORTANT SECURITY NOTICE
- Please change your password after your first login
- Do not share your credentials with anyone
- Keep this email in a secure location

If you have any questions or need assistance, please contact the admissions office.

Best regards,
Academia De San Jose Administration Team

This is an automated email. Please do not reply to this message.
© 2025 Academia De San Jose. All rights reserved.
    `.trim();

    // Send email via Gmail SMTP
    const info = await transporter.sendMail({
      from: '"Academia De San Jose" <' + process.env.GMAIL_USER + '>',
      to: email,
      subject: 'Your Academia De San Jose Student Account',
      text: textContent,
      html: htmlContent
    });

    console.log('✅ Student email sent successfully:', info.messageId);
    
    return res.status(200).json({
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('❌ Error sending student email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
};
