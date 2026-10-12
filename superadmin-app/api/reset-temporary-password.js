const nodemailer = require('nodemailer');
const { initFirebaseAdmin } = require('./_firebase.js');

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
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    const { 
      email, 
      userName, 
      temporaryPassword, 
      role, 
      office, 
      username, 
      studentId, 
      id, 
      staffUsername,
      uid,
      docId,
      adminEmail = 'Super Admin'
    } = body;

    if (!email || !userName || !temporaryPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, userName, and temporaryPassword are required' 
      });
    }

    const isStudent = role === 'student';
    const resolvedStudentId = studentId || id || '';
    const resolvedUsername = username || staffUsername || '';
    const roleText = isStudent ? 'Student' : 
                     (role === 'admin' || role === 'staff') ? 'Office Staff' : 
                     'Staff Member';

    // 1. Initialize Firebase Admin and update password in Auth
    const adminInit = await initFirebaseAdmin();
    const { auth, db, FieldValue } = adminInit;

    let targetUid = uid;
    if (auth) {
      try {
        if (!targetUid) {
          const userRecord = await auth.getUserByEmail(email.trim());
          targetUid = userRecord.uid;
        }

        if (targetUid) {
          await auth.updateUser(targetUid, {
            password: temporaryPassword
          });
          console.log(`[API reset-temporary-password] Password updated in Firebase Auth for UID ${targetUid}`);
        }
      } catch (authErr) {
        console.error('[API reset-temporary-password] Error updating password in Firebase Auth:', authErr);
        return res.status(500).json({
          success: false,
          error: `Failed to update password in Firebase Auth: ${authErr.message}`
        });
      }
    } else {
      console.warn('[API reset-temporary-password] Firebase Admin Auth unavailable; skipping auth.updateUser');
    }

    // 2. Update user document in Firestore to enforce mustChangePassword
    if (db && FieldValue) {
      const targetCollection = isStudent ? 'students' : 'staff';
      const targetDocId = docId || targetUid;
      if (targetDocId) {
        try {
          await db.collection(targetCollection).doc(targetDocId).update({
            mustChangePassword: true,
            passwordResetAt: FieldValue.serverTimestamp(),
            lastPasswordResetAt: FieldValue.serverTimestamp(),
            passwordResetBy: adminEmail
          });
        } catch (dbErr) {
          console.warn('[API reset-temporary-password] Could not update Firestore user doc:', dbErr.message);
        }
      }

      // Log activity in activityLogs
      try {
        await db.collection('activityLogs').add({
          userId: targetUid || targetDocId || email,
          userEmail: email,
          action: 'Temporary credentials regenerated and dispatched',
          category: 'security',
          details: `New temporary login password generated and re-emailed to ${email} by ${adminEmail}`,
          status: 'Dispatched',
          timestamp: FieldValue.serverTimestamp()
        });
      } catch (actErr) {
        console.warn('[API reset-temporary-password] Could not write activity log:', actErr.message);
      }
    }

    // 3. Dispatch Email via Nodemailer
    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: fromEmail,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const loginUrl = isStudent 
      ? (process.env.STUDENT_APP_URL || process.env.REACT_APP_STUDENT_APP_URL || 'https://student-portal-one-delta.vercel.app')
      : (process.env.ADMIN_APP_URL || process.env.REACT_APP_ADMIN_APP_URL || 'https://admin-website-ruddy.vercel.app');

    const info = await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: email,
      subject: 'New Temporary Login Credentials - Academia De San Jose',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #1a6b0f 0%, #105E06 100%); padding: 30px; border-radius: 8px 8px 0 0; color: white;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Academia De San Jose</h1>
            <p style="color: #d6f4cf; margin: 6px 0 0 0; font-size: 14px;">${isStudent ? 'Student Portal' : 'Admin & Staff Portal'}</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; margin-bottom: 20px;">
            <h2 style="color: #171d18; margin-top: 0; font-size: 20px;">Hello, ${userName}!</h2>
            <p style="color: #4b5563; line-height: 1.6; font-size: 15px;">
              Your login credentials for your <strong>${roleText}</strong> account have been regenerated by the administrator. Below are your new temporary credentials:
            </p>
          </div>

          <div style="background: #ffffff; border: 2px solid #105E06; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold; width: 40%;">Email:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${email}</td>
              </tr>
              ${isStudent ? `
              ${resolvedStudentId ? `
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">Student ID:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${resolvedStudentId}</td>
              </tr>` : ''}
              ` : `
              ${resolvedUsername ? `
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">Username:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${resolvedUsername}</td>
              </tr>` : ''}
              ${office ? `
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">Assigned Office:</td>
                <td style="padding: 10px; color: #111827; font-weight: 500;">${office}</td>
              </tr>` : ''}
              `}
              <tr>
                <td style="padding: 10px; color: #6b7280; font-weight: bold;">New Temporary Password:</td>
                <td style="padding: 10px; color: #105E06; font-family: monospace; font-size: 18px; font-weight: bold;">${temporaryPassword}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Mandatory Password Change Notice:</p>
            <ul style="color: #856404; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
              <li>You are required to change your password immediately upon your next login.</li>
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
      `,
      text: `
Academia De San Jose - New Temporary Login Credentials

Hello, ${userName}!

Your login credentials for your ${roleText} account have been regenerated by the administrator. Below are your new temporary credentials:

CREDENTIALS
Email: ${email}
${isStudent ? (resolvedStudentId ? `Student ID: ${resolvedStudentId}\n` : '') : `${resolvedUsername ? `Username: ${resolvedUsername}\n` : ''}${office ? `Assigned Office: ${office}\n` : ''}`}New Temporary Password: ${temporaryPassword}

Login at: ${loginUrl}

MANDATORY PASSWORD CHANGE NOTICE:
- You are required to change your password immediately upon your next login.
- Do not share your temporary credentials with anyone.
- Keep this email in a secure location.

© 2026 Academia De San Jose. All rights reserved.
      `.trim()
    });

    console.log('[Success] New temporary password email sent:', info.messageId);
    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      temporaryPassword
    });

  } catch (error) {
    console.error('[Error] Reset temporary password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to reset and send temporary password' 
    });
  }
};

module.exports.default = module.exports;
