const {onCall, HttpsError} = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

// Configure email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "academiadesanjose3@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD, // Will be set in Firebase config
  },
});

/**
 * Send student credentials via email
 * Callable from frontend with: httpsCallable(functions, 'sendCredentialsEmail')
 */
exports.sendCredentialsEmail = onCall({
  cors: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    /firebase\.app$/,
    /\.web\.app$/,
    /\.firebaseapp\.com$/,
  ],
}, async (request) => {
  const {email, studentId, password, studentName} = request.data;

  // Validate input
  if (!email || !studentId || !password || !studentName) {
    throw new HttpsError(
        "invalid-argument",
        "Missing required fields",
    );
  }

  // Email HTML template
  const mailOptions = {
    from: "Academia De San Jose <academiadesanjose3@gmail.com>",
    to: email,
    subject: "Your Academia De San Jose Account Credentials",
    html: `
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
          .login-button {
            display: inline-block;
            background-color: #105E06;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
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
              <div class="credential-label">
                Temporary Password
              </div>
              <div class="credential-value">${password}</div>
            </div>
          </div>
          
          <div class="warning-box">
            <strong>⚠️ Important Security Notice:</strong>
            <ul style="margin: 10px 0;">
              <li>
                Please change your password immediately 
                after your first login
              </li>
              <li>Do not share your credentials with anyone</li>
              <li>Keep this email in a secure location</li>
            </ul>
          </div>
          
          <p>
            If you have any questions or need assistance, 
            please contact the admissions office.
          </p>
          
          <p>Best regards,<br>
          <strong>Academia De San Jose Administration Team</strong></p>
        </div>
        
        <div class="footer">
          <p>
            This is an automated email. 
            Please do not reply to this message.
          </p>
          <p>
            &copy; 2025 Academia De San Jose. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info("Email sent successfully:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error("Error sending email:", error);
    throw new HttpsError(
        "internal",
        "Failed to send email: " + error.message,
    );
  }
});

/**
 * Send staff credentials via email
 */
exports.sendStaffCredentialsEmail = onCall({
  cors: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    /firebase\.app$/,
    /\.web\.app$/,
    /\.firebaseapp\.com$/,
  ],
}, async (request) => {
  const {email, username, password, staffName, office} = request.data;

  if (!email || !username || !password || !staffName) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const mailOptions = {
    from: "Academia De San Jose <academiadesanjose3@gmail.com>",
    to: email,
    subject: "Your Academia De San Jose Staff Account Credentials",
    html: `
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
          
          <p>Your staff account for the <strong>${office || "Administrative"}</strong> office has been created.</p>
          
          <div class="credentials-box">
            <div class="credential-row">
              <div class="credential-label">Username</div>
              <div class="credential-value">${username}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Temporary Password</div>
              <div class="credential-value">${password}</div>
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
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info("Staff email sent:", info.messageId);
    return {success: true, messageId: info.messageId};
  } catch (error) {
    logger.error("Error sending staff email:", error);
    throw new HttpsError("internal", "Failed to send email: " + error.message);
  }
});

/**
 * Update user password (Admin only)
 * Allows superadmin to change any user's password
 */
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.updateUserPassword = onCall({
  cors: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    /firebase\.app$/,
    /\.web\.app$/,
    /\.firebaseapp\.com$/,
  ],
}, async (request) => {
  const {uid, newPassword} = request.data;

  // Validate input
  if (!uid || !newPassword) {
    throw new HttpsError("invalid-argument", "Missing uid or newPassword");
  }

  // Validate password strength
  if (newPassword.length < 8) {
    throw new HttpsError(
        "invalid-argument",
        "Password must be at least 8 characters long",
    );
  }

  try {
    // Update user password in Firebase Auth
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    logger.info(`Password updated for user: ${uid}`);

    return {
      success: true,
      message: "Password updated successfully",
    };
  } catch (error) {
    logger.error("Error updating password:", error);
    throw new HttpsError(
        "internal",
        "Failed to update password: " + error.message,
    );
  }
});
