require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true
  };

  const dbName = process.env.DB_NAME || 'campus_care';
  let connection;

  try {
    console.log('📡 Connecting to MySQL server...');
    try {
      connection = await mysql.createConnection(config);
      console.log('✅ Connected to MySQL server\n');

      // Attempt to create database if permitted (e.g. local MySQL)
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      console.log(`✅ Database '${dbName}' ready\n`);
      await connection.end();
    } catch (createErr) {
      console.log(`ℹ️  Note on database creation: ${createErr.message}`);
      console.log(`Connecting directly to database '${dbName}'...\n`);
      if (connection) await connection.end().catch(() => {});
    }

    // Reconnect directly with database
    connection = await mysql.createConnection({
      ...config,
      database: dbName
    });

    // ---------- SCHEMA ----------
    let schemaSQL = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'schema.sql'),
      'utf8'
    );

    // Strip hardcoded CREATE DATABASE / USE so it works with any DB name (e.g. cloud defaultdb)
    schemaSQL = schemaSQL
      .replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/gi, '')
      .replace(/USE [^;]+;/gi, '');

    console.log('🔨 Executing schema.sql...');
    await connection.query(schemaSQL); // ✅ SINGLE CALL
    console.log('✅ Schema executed successfully\n');

    // ---------- INIT DATA ----------
    const initDataPath = path.join(__dirname, '..', 'db', 'init_data.sql');

    if (fs.existsSync(initDataPath)) {
      const initDataSQL = fs.readFileSync(initDataPath, 'utf8');
      console.log('📊 Executing init_data.sql...');
      await connection.query(initDataSQL); // ✅ SINGLE CALL
      console.log('✅ Master data inserted\n');
    }

    // ---------- SEED DATA ----------
    const seedDataPath = path.join(__dirname, '..', 'db', 'seed_data.sql');

    if (fs.existsSync(seedDataPath)) {
      const seedDataSQL = fs.readFileSync(seedDataPath, 'utf8');
      console.log('🌱 Executing seed_data.sql...');
      await connection.query(seedDataSQL); // ✅ SINGLE CALL
      console.log('✅ Seed data inserted\n');
    }

    // ---------- VERIFICATION ----------
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables`);

    const [[states]] = await connection.query('SELECT COUNT(*) count FROM states');
    console.log(`   States: ${states.count}`);

    const [[courses]] = await connection.query('SELECT COUNT(*) count FROM courses');
    console.log(`   Courses: ${courses.count}`);

    const [[resources]] = await connection.query('SELECT COUNT(*) count FROM academic_resources');
    console.log(`   Academic Resources: ${resources.count}`);

    const [[avatars]] = await connection.query('SELECT COUNT(*) count FROM avatars');
    console.log(`   Avatars: ${avatars.count}`);

    console.log('\n🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('\n❌ Database initialization failed!');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initializeDatabase();
