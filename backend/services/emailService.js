const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

/**
 * EmailService — Brevo Port 2525 & REST API Support
 *
 * Cloud providers (Render, AWS, GCP) block outbound SMTP ports 25, 465, and 587
 * to prevent spam. Port 2525 is Brevo's official alternative port for cloud hosts.
 */

// ─── Brevo REST API sender (used when an xkeysib- API key is configured) ────
const sendViaBrevoAPI = async (toEmail, subject, htmlContent, textContent) => {
  const apiKey = process.env.BREVO_API_KEY || (process.env.SMTP_PASS?.startsWith('xkeysib-') ? process.env.SMTP_PASS : null);
  if (!apiKey) return null;

  const fromEmail = (process.env.EMAIL_FROM || 'campuscare404@gmail.com')
    .replace(/^"[^"]*"\s*<|>$/g, '').trim();
  const fromName = (process.env.EMAIL_FROM || '"CampusCare"')
    .match(/^"([^"]+)"/)?.[1] || 'CampusCare';

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail }],
    subject,
    htmlContent,
    textContent,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Brevo API error ${res.status}: ${err.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  return { messageId: data.messageId };
};

// ─── SMTP Transporter (Port 2525 primary for cloud hosting) ────────────────
const createSmtpTransporter = (targetPort = null) => {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  // Gmail shortcut
  if (host.includes('gmail.com') || user.endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: user.trim(), pass: pass.trim().replace(/\s+/g, '') },
    });
  }

  // Render/AWS firewalls drop ports 25, 465, and 587 on cloud instances.
  // For Brevo, default to port 2525 to reliably bypass cloud port blocking.
  let port = targetPort || parseInt(process.env.SMTP_PORT || '2525', 10);
  if (!targetPort && host.includes('brevo.com') && (port === 587 || port === 465)) {
    port = 2525;
  }
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: user.trim(), pass: pass.trim() },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
};

// ─── HTML template ─────────────────────────────────────────────────────────
const buildEmailHtml = (code) => `
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
        &copy; ${new Date().getFullYear()} CampusCare. Student &amp; Campus Life Portal.
      </div>
    </div>
  </body>
  </html>
`;

// ─── Public API ────────────────────────────────────────────────────────────

const verifyEmailConnection = async () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log('⚠️  [EmailService] Mail service inactive: SMTP_USER / SMTP_PASS not set.');
    return false;
  }

  const transporter = createSmtpTransporter(2525);
  if (!transporter) return false;

  try {
    await transporter.verify();
    console.log('✅ [EmailService] Mail server authenticated on port 2525.');
    return true;
  } catch (err) {
    console.warn('⚠️  [EmailService] Port 2525 check failed, trying default port...', err.message);
    try {
      const fallback = createSmtpTransporter();
      await fallback.verify();
      console.log('✅ [EmailService] Mail server authenticated on fallback port.');
      return true;
    } catch (fbErr) {
      console.error('❌ [EmailService] SMTP verification failed:', fbErr.message);
      return false;
    }
  }
};

const sendVerificationEmail = async (toEmail, code) => {
  const cleanEmail = toEmail.trim().toLowerCase();
  const subject    = `CampusCare Verification Code: ${code}`;
  const html       = buildEmailHtml(code);
  const text       = `Your CampusCare verification code is: ${code}. It expires in 10 minutes.`;

  // 1. Try Brevo REST API first (if API key available)
  try {
    const apiResult = await sendViaBrevoAPI(cleanEmail, subject, html, text);
    if (apiResult?.messageId) {
      console.log(`✅ [EmailService] Sent via Brevo REST API to ${cleanEmail} (ID: ${apiResult.messageId})`);
      return { sent: true, messageId: apiResult.messageId };
    }
  } catch (apiErr) {
    console.warn(`⚠️  [EmailService] Brevo API skipped/failed: ${apiErr.message}`);
  }

  // 2. Primary SMTP delivery via port 2525 (unblocked on cloud hosts)
  const fromAddress = process.env.EMAIL_FROM || `"CampusCare" <${process.env.SMTP_USER}>`;
  const primaryTransporter = createSmtpTransporter(2525);

  if (primaryTransporter) {
    try {
      const info = await primaryTransporter.sendMail({ from: fromAddress, to: cleanEmail, subject, text, html });
      console.log(`✅ [EmailService] Sent via SMTP port 2525 to ${cleanEmail} (ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (primaryErr) {
      console.warn(`⚠️  [EmailService] Port 2525 attempt failed (${primaryErr.message}). Trying fallback port...`);
    }
  }

  // 3. Fallback SMTP port
  const fallbackTransporter = createSmtpTransporter(465);
  if (fallbackTransporter) {
    try {
      const info = await fallbackTransporter.sendMail({ from: fromAddress, to: cleanEmail, subject, text, html });
      console.log(`✅ [EmailService] Sent via fallback SMTP to ${cleanEmail} (ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (fallbackErr) {
      console.error(`❌ [EmailService] All email delivery methods failed for ${cleanEmail}:`, fallbackErr.message);
      return { sent: false, error: fallbackErr.message };
    }
  }

  return { sent: false, error: 'Email service not configured.' };
};

module.exports = { sendVerificationEmail, verifyEmailConnection };
