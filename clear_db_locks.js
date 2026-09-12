const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clearLocks() {
    try {
        console.log('Clearing DB locks...');
        await pool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
      AND datname = current_database();
    `);
        console.log('Locks cleared.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

clearLocks();
