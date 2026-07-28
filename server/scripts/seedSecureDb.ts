import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { CRDB_SECURE_DATABASE, withDatabase } from '../dbConfig.js';
import { ensureSecureDatabase } from '../secureDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

async function main() {
  const adminPool = new pg.Pool({ connectionString: withDatabase(baseUrl, 'defaultdb') });
  const adminClient = await adminPool.connect();
  try {
    await ensureSecureDatabase(adminClient);
  } finally {
    adminClient.release();
    await adminPool.end();
  }

  const secureUrl = withDatabase(baseUrl, CRDB_SECURE_DATABASE);
  console.log(`Seeding secure database "${CRDB_SECURE_DATABASE}"...`);

  const pool = new pg.Pool({ connectionString: secureUrl });
  const client = await pool.connect();

  try {
    await client.query('DROP TABLE IF EXISTS auth_audit_log CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    const schema = fs.readFileSync(path.join(__dirname, '../schemaSecure.sql'), 'utf8');
    await client.query(schema);
    console.log('Secure schema applied.');

    const { hashPassword } = await import('../services/authService.js');
    const { getSeedDefaultPassword } = await import('../config/auth.js');
    const defaultPassword = getSeedDefaultPassword();

    const seedUsers = [
      { userId: 'rudra', email: 'rudra@opsrelay.io', name: 'Rudra', role: 'admin' },
      { userId: 'yash', email: 'yash@opsrelay.io', name: 'Yash', role: 'operator' },
    ];

    for (const u of seedUsers) {
      const passwordHash = await hashPassword(defaultPassword);
      await client.query(
        `INSERT INTO users (user_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.userId, u.email, passwordHash, u.name, u.role],
      );
    }

    console.log(`Seeded ${seedUsers.length} users into SecureData.`);
    console.log(`Default password: ${defaultPassword} (from SEED_DEFAULT_PASSWORD)`);

    const counts = await client.query(`
      SELECT 'users' AS table_name, count(*)::int AS rows FROM users
      UNION ALL SELECT 'auth_audit_log', count(*)::int FROM auth_audit_log
    `);
    console.table(counts.rows);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\nDone. Credentials are stored only in SecureData database.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
