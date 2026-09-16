const pool = require('../config/database');

class EmailVerification {
  // Ensure the table exists
  static async ensureTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verifications (
          verification_id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(254) NOT NULL,
          otp_code VARCHAR(10) NOT NULL,
          expires_at DATETIME NOT NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_email_otp (email, otp_code),
          INDEX idx_email_verified (email, is_verified)
        )
      `);
    } catch (err) {
      console.warn('⚠️  Could not verify email_verifications table structure:', err.message);
    }
  }

  /**
   * Save a new OTP code for an email (valid for 10 minutes)
   */
  static async createVerification(email, otpCode) {
    await this.ensureTable();
    const cleanEmail = email.trim().toLowerCase();
    
    // Invalidate previous unverified OTPs for this email
    await pool.execute(
      'DELETE FROM email_verifications WHERE email = ? AND is_verified = FALSE',
      [cleanEmail]
    );

    // Expiry: 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [result] = await pool.execute(
      'INSERT INTO email_verifications (email, otp_code, expires_at, is_verified) VALUES (?, ?, ?, FALSE)',
      [cleanEmail, otpCode, expiresAt]
    );

    return result.insertId;
  }

  /**
   * Check if provided OTP matches an unexpired code
   * Supports '123456' as universal test bypass code in non-production environments
   */
  static async verifyCode(email, code) {
    await this.ensureTable();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    // Dev/Testing master bypass code: if NODE_ENV !== 'production' and code === '123456'
    if (process.env.NODE_ENV !== 'production' && cleanCode === '123456') {
      console.log(`🧪 [Dev Bypass] Accepting master test code 123456 for ${cleanEmail}`);
      // Record verification in DB
      await pool.execute(
        'DELETE FROM email_verifications WHERE email = ?',
        [cleanEmail]
      );
      await pool.execute(
        'INSERT INTO email_verifications (email, otp_code, expires_at, is_verified) VALUES (?, ?, ?, TRUE)',
        [cleanEmail, '123456', new Date(Date.now() + 60 * 60 * 1000)]
      );
      return { success: true, message: 'Email verified successfully (dev bypass)' };
    }

    const [rows] = await pool.execute(
      `SELECT verification_id, otp_code, expires_at, is_verified 
       FROM email_verifications 
       WHERE email = ? AND otp_code = ? AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail, cleanCode]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Invalid or expired verification code.' };
    }

    // Mark as verified and extend expiry to allow registration completion within 1 hour
    const record = rows[0];
    const extendedExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await pool.execute(
      'UPDATE email_verifications SET is_verified = TRUE, expires_at = ? WHERE verification_id = ?',
      [extendedExpiry, record.verification_id]
    );

    return { success: true, message: 'Email verified successfully.' };
  }

  /**
   * Check if this email has an active verified status
   */
  static async isEmailVerified(email) {
    await this.ensureTable();
    const cleanEmail = email.trim().toLowerCase();

    // Allow dummy testing bypass in development if needed
    if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      return true;
    }

    const [rows] = await pool.execute(
      `SELECT verification_id FROM email_verifications 
       WHERE email = ? AND is_verified = TRUE AND expires_at > NOW()
       LIMIT 1`,
      [cleanEmail]
    );

    return rows.length > 0;
  }

  /**
   * Clean up verification record after user registration is complete
   */
  static async consumeVerification(email) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      await pool.execute(
        'DELETE FROM email_verifications WHERE email = ?',
        [cleanEmail]
      );
    } catch (e) {
      console.warn('Could not cleanup verification record:', e.message);
    }
  }
}

module.exports = EmailVerification;

