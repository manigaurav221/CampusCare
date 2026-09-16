require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function syncLocalToCloud() {
  console.log('🔄 Starting data sync from Local MySQL -> Aiven Cloud MySQL...\n');

  // Local MySQL connection
  const localConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'mango',
    database: 'campus_care'
  };

  // Cloud MySQL connection (Aiven)
  const cloudConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '13022', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };

  let localConn, cloudConn;

  try {
    console.log('📡 Connecting to Local MySQL (localhost:3306)...');
    localConn = await mysql.createConnection(localConfig);
    console.log('✅ Connected to Local MySQL.\n');

    console.log('📡 Connecting to Cloud MySQL (Aiven)...');
    cloudConn = await mysql.createConnection(cloudConfig);
    console.log('✅ Connected to Cloud MySQL.\n');

    // Add missing columns to cloud places table if they do not exist
    console.log('🔧 Ensuring cloud table schemas match local...');
    const alterStatements = [
      "ALTER TABLE places ADD COLUMN lat decimal(9,6) DEFAULT NULL",
      "ALTER TABLE places ADD COLUMN lng decimal(9,6) DEFAULT NULL",
      "ALTER TABLE places ADD COLUMN price_range varchar(50) DEFAULT '₹₹'",
      "ALTER TABLE places ADD COLUMN tags varchar(255) DEFAULT NULL",
      "ALTER TABLE places ADD COLUMN submitted_by int DEFAULT NULL"
    ];

    for (const stmt of alterStatements) {
      try {
        await cloudConn.query(stmt);
      } catch (e) {
        // Ignore if column already exists
      }
    }
    console.log('✅ Schema aligned.\n');

    // Disable foreign key checks during sync to preserve exact IDs
    await cloudConn.query('SET FOREIGN_KEY_CHECKS = 0;');

    const tablesToSync = [
      'colleges',
      'user_profiles',
      'places',
      'place_rating',
      'blog',
      'blog_comments',
      'blog_likes',
      'fares'
    ];

    for (const table of tablesToSync) {
      const [rows] = await localConn.query(`SELECT * FROM \`${table}\``);
      if (rows.length === 0) {
        console.log(`ℹ️  [${table}] No rows to copy.`);
        continue;
      }

      console.log(`📦 [${table}] Copying ${rows.length} rows...`);

      // Construct INSERT IGNORE query
      const columns = Object.keys(rows[0]);
      const columnList = columns.map(c => `\`${c}\``).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT IGNORE INTO \`${table}\` (${columnList}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await cloudConn.query(sql, values);
      }

      const [[{ count }]] = await cloudConn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      console.log(`✅ [${table}] Cloud now has ${count} records.\n`);
    }

    // Re-enable foreign key checks
    await cloudConn.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('🎉 Data sync completed successfully! All accounts and data are now in Aiven Cloud MySQL.');
  } catch (error) {
    console.error('❌ Data sync failed:', error.message);
    if (cloudConn) {
      await cloudConn.query('SET FOREIGN_KEY_CHECKS = 1;').catch(() => {});
    }
  } finally {
    if (localConn) await localConn.end();
    if (cloudConn) await cloudConn.end();
  }
}

syncLocalToCloud();
