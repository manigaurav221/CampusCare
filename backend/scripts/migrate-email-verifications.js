const pool = require('../config/database');

async function migrate() {
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
    console.log('✅ email_verifications table is ready');
    process.exit(0);
  } catch (error) {
    console.error('Migration notice:', error.message);
    process.exit(0);
  }
}

migrate();

