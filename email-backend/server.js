const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Initialize Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('[Error] Gmail SMTP connection failed:', error);
  } else {
    console.log('[Success] Gmail SMTP ready to send emails');
  }
});

// Initialize Firebase Admin SDK
if (!admin.apps || admin.apps.length === 0) {
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    const { initializeApp, cert } = require('firebase-admin/app');
    
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('[Success] Firebase Admin initialized');
  } catch (error) {
    console.warn('[Warning] Firebase Admin not initialized - delete user from Auth will not work');
    console.warn('Download service account key from Firebase Console to enable this feature');
    console.warn('Error details:', error.message);
  }
} else {
  console.log('[Success] Firebase Admin already initialized');
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Email backend is running with Gmail SMTP!' });
});

// Send credentials email endpoint
app.post('/api/send-credentials', async (req, res) => {
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
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
          }
          .header {
            background-color: #105E06;
            color: white;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
          }
          .content {
            padding: 20px;
            background-color: #ffffff;
          }
          .credentials {
            background-color: #f5f5f5;
            border-left: 3px solid #105E06;
            padding: 15px;
            margin: 20px 0;
            font-family: monospace;
          }
          .notice {
            background-color: #fffbf0;
            border-left: 3px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            color: #777;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }
          a {
            color: #105E06;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Academia De San Jose</h2>
        </div>
        
        <div class="content">
          <p>Dear ${studentName},</p>
          
          <p>Your student account has been successfully created. You can now access the Student Portal using the credentials below:</p>
          
          <div class="credentials">
            <strong>Student ID:</strong> ${studentId}<br>
            <strong>Temporary Password:</strong> ${password}
          </div>
          
          <p>Login at: <a href="http://localhost:3000">http://localhost:3000</a></p>
          
          <div class="notice">
            <strong>Important Security Notice:</strong><br>
            • Please change your password after your first login<br>
            • Do not share your credentials with anyone<br>
            • Keep this email in a secure location
          </div>
          
          <p>If you have any questions, please contact the admissions office.</p>
          
          <p>Best regards,<br>
          Academia De San Jose Administration Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>© 2025 Academia De San Jose. All rights reserved.</p>
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

Login at: http://localhost:3000

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

    console.log('[Success] Email sent successfully via Gmail:', info.messageId);
    res.json({
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('[Error] Error sending email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

// Send staff credentials email endpoint
app.post('/api/send-staff-credentials', async (req, res) => {
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
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
          }
          .header {
            background-color: #105E06;
            color: white;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
          }
          .content {
            padding: 20px;
            background-color: #ffffff;
          }
          .credentials {
            background-color: #f5f5f5;
            border-left: 3px solid #105E06;
            padding: 15px;
            margin: 20px 0;
            font-family: monospace;
          }
          .notice {
            background-color: #fffbf0;
            border-left: 3px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            color: #777;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }
          a {
            color: #105E06;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Academia De San Jose</h2>
        </div>
        
        <div class="content">
          <p>Dear ${staffName},</p>
          
          <p>Your staff account has been successfully created for the ${office} Office. You can now access the Admin Portal using the credentials below:</p>
          
          <div class="credentials">
            <strong>Username:</strong> ${username}<br>
            <strong>Temporary Password:</strong> ${password}<br>
            <strong>Department:</strong> ${office}
          </div>
          
          <p>Login at: <a href="http://localhost:3001">http://localhost:3001</a></p>
          
          <div class="notice">
            <strong>Important Security Notice:</strong><br>
            • Please change your password after your first login<br>
            • Do not share your credentials with anyone<br>
            • Keep this email in a secure location
          </div>
          
          <p>If you have any questions, please contact the IT support team.</p>
          
          <p>Best regards,<br>
          Academia De San Jose Administration Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>© 2025 Academia De San Jose. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Academia De San Jose - Admin Account Created

Dear ${staffName},

Your staff account has been successfully created for the ${office} Office. You can now access the Academia De San Jose Admin Portal using the credentials below:

STAFF CREDENTIALS
Username: ${username}
Temporary Password: ${password}
Department: ${office}

Login at: http://localhost:3001

IMPORTANT SECURITY NOTICE
- Please change your password after your first login
- Do not share your credentials with anyone
- Keep this email in a secure location

If you have any questions or need assistance, please contact the IT support team.

Best regards,
Academia De San Jose Administration Team

This is an automated email. Please do not reply to this message.
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

    console.log('[Success] Staff email sent successfully via Gmail:', info.messageId);
    res.json({
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('[Error] Error sending staff email:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send email'
    });
  }
});

// Delete user from Firebase Authentication
app.post('/api/delete-user', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'Missing user UID'
      });
    }

    // Check if Firebase Admin is initialized
    if (!admin.apps || admin.apps.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin not initialized. Service account key required.'
      });
    }

    // Delete user from Firebase Authentication
    await admin.auth().deleteUser(uid);
    
    console.log('[Success] User deleted from Firebase Auth:', uid);

    res.json({
      success: true,
      message: 'User deleted from Firebase Authentication'
    });

  } catch (error) {
    console.error('[Error] Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
});

// Store verification codes temporarily (in production, use Redis or database)
const verificationCodes = new Map();

// Send password reset verification code
app.post('/api/send-reset-code', async (req, res) => {
  try {
    const { email, studentName, studentId, expiryMinutes = 1 } = req.body;

    if (!email || !studentName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with configurable expiration (default 1 minute)
    const expiryMs = expiryMinutes * 60 * 1000;
    verificationCodes.set(email, {
      code: verificationCode,
      expires: Date.now() + expiryMs,
      studentId: studentId
    });

    // Auto-delete expired codes
    setTimeout(() => {
      verificationCodes.delete(email);
    }, expiryMs);

    // HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
          }
          .header {
            background-color: #105E06;
            color: white;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
          }
          .content {
            padding: 20px;
            background-color: #ffffff;
          }
          .code-box {
            background-color: #f5f5f5;
            border: 2px solid #105E06;
            padding: 25px;
            margin: 20px 0;
            text-align: center;
            border-radius: 8px;
          }
          .code {
            font-size: 36px;
            font-weight: bold;
            color: #105E06;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          }
          .notice {
            background-color: #fffbf0;
            border-left: 3px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            text-align: center;
            color: #777;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Password Reset Request</h2>
        </div>
        
        <div class="content">
          <p>Dear ${studentName},</p>
          
          <p>We received a request to reset your Academia De San Jose account password. Use the verification code below to proceed:</p>
          
          <div class="code-box">
            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Your Verification Code</div>
            <div class="code">${verificationCode}</div>
            <div style="font-size: 12px; color: #999; margin-top: 10px;">Valid for ${expiryMinutes} minute${expiryMinutes > 1 ? 's' : ''}</div>
          </div>
          
          <div class="notice">
            <strong>Security Notice:</strong><br>
            • This code expires in ${expiryMinutes} minute${expiryMinutes > 1 ? 's' : ''}<br>
            • If you didn't request this, please ignore this email<br>
            • Never share this code with anyone<br>
            • Contact support if you notice suspicious activity
          </div>
          
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          
          <p>Best regards,<br>
          Academia De San Jose Support Team</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>© 2025 Academia De San Jose. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Plain text version
    const textContent = `
Academia De San Jose - Password Reset

Dear ${studentName},

We received a request to reset your Academia De San Jose account password.

YOUR VERIFICATION CODE: ${verificationCode}

This code is valid for ${expiryMinutes} minute${expiryMinutes > 1 ? 's' : ''}.

SECURITY NOTICE:
- This code expires in ${expiryMinutes} minute${expiryMinutes > 1 ? 's' : ''}
- If you didn't request this, please ignore this email
- Never share this code with anyone
- Contact support if you notice suspicious activity

If you didn't request a password reset, you can safely ignore this email.

Best regards,
Academia De San Jose Support Team

This is an automated email. Please do not reply to this message.
© 2025 Academia De San Jose. All rights reserved.
    `.trim();

    // Send email
    const info = await transporter.sendMail({
      from: '"Academia De San Jose" <' + process.env.GMAIL_USER + '>',
      to: email,
      subject: 'Password Reset Verification Code',
      text: textContent,
      html: htmlContent
    });

    console.log('[Success] Reset code sent successfully:', info.messageId);
    res.json({
      success: true,
      message: 'Verification code sent to email',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('[Error] Error sending reset code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send verification code'
    });
  }
});

// Verify reset code
app.post('/api/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing email or code'
      });
    }

    const stored = verificationCodes.get(email);

    if (!stored) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found. Please request a new one.'
      });
    }

    if (Date.now() > stored.expires) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    if (stored.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Code is valid
    console.log('[Success] Verification code validated for:', email);
    res.json({
      success: true,
      message: 'Code verified successfully',
      studentId: stored.studentId
    });

    // Keep the code for password reset (don't delete yet)

  } catch (error) {
    console.error('[Error] Error verifying code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify code'
    });
  }
});

// Clear verification code after password reset
app.post('/api/clear-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (email && verificationCodes.has(email)) {
      verificationCodes.delete(email);
      console.log('[Success] Verification code cleared for:', email);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Error] Error clearing code:', error);
    res.json({ success: false });
  }
});

// Reset password using Firebase Admin SDK
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, newPassword, verificationCode } = req.body;

    if (!email || !newPassword || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify the code first
    const stored = verificationCodes.get(email);
    if (!stored) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found'
      });
    }

    if (Date.now() > stored.expires) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    if (stored.code !== verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Check if Firebase Admin is initialized
    if (!admin.apps || admin.apps.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin not initialized. Service account key required.'
      });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });

    // Clear the verification code
    verificationCodes.delete(email);

    console.log('[Success] Password reset successfully for:', email);
    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('[Error] Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Email backend running on http://localhost:${PORT}`);
  console.log(`📧 Ready to send emails via Gmail SMTP`);
});
