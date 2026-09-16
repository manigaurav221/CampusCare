const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

// Initialize transporter based on environment variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  // If using Gmail, 'service: gmail' is the most reliable preset in Nodemailer
  if ((host && host.includes('gmail.com')) || (user && user.endsWith('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, '') // remove spaces from Gmail app passwords
      }
    });
  }

  // Brevo / generic SMTP:
  // Port 465 (SSL) is preferred on cloud hosting (Render/AWS) because port 587 STARTTLS
  // is frequently blocked by cloud provider firewalls to prevent spam abuse.
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: host || 'smtp-relay.brevo.com',
    port,
    secure,
    auth: {
      user: user.trim(),
      pass: pass.trim()
    },
    connectionTimeout: 10000,  // 10s — fail fast instead of hanging
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

/**
 * Verify SMTP connection
 */
const verifyEmailConnection = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('⚠️  [EmailService] Mail service inactive: Please set SMTP_USER and SMTP_PASS in backend/.env to send real emails.');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ [EmailService] SMTP mail server authenticated and ready to send emails.');
    return true;
  } catch (err) {
    console.error('⚠️  [EmailService] SMTP connection check failed:', err.message);
    return false;
  }
};

/**
 * Send a 6-digit verification code to the user's email
 * @param {string} toEmail - Recipient email address
 * @param {string} code - 6-digit OTP code
 */
const sendVerificationEmail = async (toEmail, code) => {
  const transporter = createTransporter();
  const cleanEmail = toEmail.trim().toLowerCase();

  if (!transporter) {
    console.error(`⚠️  [EmailService] Cannot send email to ${cleanEmail}: SMTP credentials are not configured in backend/.env`);
    return {
      sent: false,
      error: 'Email service is not configured on the server. Please configure SMTP_USER and SMTP_PASS in backend/.env.'
    };
  }

  const fromAddress = process.env.EMAIL_FROM || `"CampusCare" <${process.env.SMTP_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>CampusCare Email Verification</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 520px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 12px; }
        .desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 16px 0; }
        .code-box { background: rgba(56, 189, 248, 0.1); border: 2px dashed #38bdf8; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
        .footer { font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CampusCare</div>
          <div class="title">Verify Your College Email</div>
        </div>
        <p class="desc">Hello,</p>
        <p class="desc">Please use the verification code below to complete your student registration on CampusCare. This code will expire in <strong>10 minutes</strong>.</p>
        <div class="code-box">
          <div class="code">${code}</div>
        </div>
        <p class="desc">If you did not request this code, you can safely ignore this email.</p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} CampusCare. Student & Campus Life Portal.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanEmail,
      subject: `CampusCare Verification Code: ${code}`,
      text: `Your CampusCare verification code is: ${code}. It expires in 10 minutes.`,
      html: htmlContent
    });

    console.log(`✅ [EmailService] Verification email successfully sent to ${cleanEmail} (Message ID: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ [EmailService] Failed to send email to ${cleanEmail}:`, error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  verifyEmailConnection
};
