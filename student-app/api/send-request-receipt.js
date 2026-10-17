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
    const {
      email,
      recipientName,
      requestId,
      officeName,
      subject,
      description,
      isAlumni,
      batchYear,
      dateSubmitted
    } = req.body || {};

    if (!email || !requestId) {
      return res.status(400).json({
        success: false,
        error: 'Email and request ID are required'
      });
    }

    const normEmail = email.toLowerCase().trim();
    const cleanRequestId = String(requestId || '').replace(/[#\s]/g, '').toUpperCase();
    const formattedRequestId = `#${cleanRequestId}`;
    const trackingPortalUrl = process.env.STUDENT_APP_URL || 'https://student-portal-one-delta.vercel.app';
    const fromEmail = process.env.GMAIL_USER || 'academiadesanjose3@gmail.com';
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!gmailPass) {
      console.error('[Error] GMAIL_APP_PASSWORD is not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'GMAIL_APP_PASSWORD is not configured in Vercel environment variables. Please add GMAIL_APP_PASSWORD to your Vercel Project Settings.'
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: fromEmail,
        pass: gmailPass
      }
    });

    const isAlumniType = Boolean(isAlumni);
    const requesterLabel = isAlumniType ? 'Alumni' : 'Guest Requester';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
          .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #105e06, #166534); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 32px 28px; }
          .badge-box { background: #f0fdf4; border: 2px dashed #86efac; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
          .badge-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #166534; margin-bottom: 6px; }
          .tracking-id { font-size: 28px; font-weight: 800; color: #105e06; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px; }
          .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          .info-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
          .info-label { font-weight: 600; color: #64748b; width: 38%; }
          .info-value { color: #0f172a; font-weight: 500; }
          .instructions-box { background: #f8fafc; border-left: 4px solid #105e06; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 13.5px; line-height: 1.6; color: #334155; }
          .instructions-box strong { color: #0f172a; }
          .btn-track { display: inline-block; background-color: #105e06; color: #ffffff !important; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; margin-top: 12px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Academia De San Jose</h1>
            <p>Official Request Submission Receipt</p>
          </div>

          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">Hello <strong>${recipientName || 'Requester'}</strong>,</p>
            <p style="font-size: 14.5px; line-height: 1.6; color: #475569;">
              Thank you for reaching out to Academia De San Jose. Your ${isAlumniType ? 'alumni record request' : 'inquiry'} has been successfully recorded and queued for review by the <strong>${officeName || 'Office'}</strong>.
            </p>

            <div class="badge-box">
              <div class="badge-label">Your Tracking Request ID</div>
              <div class="tracking-id">${formattedRequestId}</div>
              <div style="font-size: 12px; color: #15803d; margin-top: 6px;">Save this Request ID to track your status at any time</div>
            </div>

            <table class="info-table">
              <tr>
                <td class="info-label">Requester Type</td>
                <td class="info-value">${requesterLabel}${batchYear ? ` (Batch ${batchYear})` : ''}</td>
              </tr>
              <tr>
                <td class="info-label">Target Office</td>
                <td class="info-value">${officeName || 'Administration'}</td>
              </tr>
              <tr>
                <td class="info-label">Subject</td>
                <td class="info-value"><strong>${subject || 'General Inquiry'}</strong></td>
              </tr>
              <tr>
                <td class="info-label">Date Submitted</td>
                <td class="info-value">${dateSubmitted || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
              </tr>
              ${description ? `
              <tr>
                <td class="info-label">Request Details</td>
                <td class="info-value" style="color: #475569; font-style: italic;">"${description.length > 250 ? description.substring(0, 250) + '...' : description}"</td>
              </tr>` : ''}
            </table>

            <div class="instructions-box">
              <strong>How to track your request:</strong><br>
              Visit the Academia De San Jose Guest Portal, click on <strong>"Check Request Status"</strong>, and enter your Request ID: <strong>${formattedRequestId}</strong>.
              <div style="text-align: center; margin-top: 14px;">
                <a href="${trackingPortalUrl}" class="btn-track" target="_blank">Open Guest Portal to Track</a>
              </div>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
              Our office staff will review and process your submission promptly. If additional documentation is required, you will be contacted directly.
            </p>
          </div>

          <div class="footer">
            <p style="margin: 0 0 4px 0;">This is an automated notification from Academia De San Jose Institutional System.</p>
            <p style="margin: 0;">© ${new Date().getFullYear()} Academia De San Jose. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `Academia De San Jose <${fromEmail}>`,
      to: normEmail,
      subject: `[Receipt] Request Confirmation ${formattedRequestId} - Academia De San Jose`,
      text: `Hello ${recipientName || 'Requester'},\n\nYour request has been received by Academia De San Jose.\n\nRequest ID: ${formattedRequestId}\nOffice: ${officeName}\nSubject: ${subject}\n\nTrack your request status in the Guest Portal using your Request ID.\n\nAcademia De San Jose`,
      html: htmlContent
    });

    console.log('[Success] Request receipt email sent:', info.messageId);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('[Error] Error sending request receipt email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send request receipt email'
    });
  }
};
