import pg from 'pg';
import { CRDB_SECURE_DATABASE, withDatabase } from './dbConfig.js';

const { Pool } = pg;

const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

const connectionString = withDatabase(baseUrl, CRDB_SECURE_DATABASE);

/** Pool for the SecureData database — credentials only, never mixed with app data */
export const securePool = new Pool({
  connectionString,
  max: 5,
});

export async function secureQuery<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await securePool.query<T>(text, params);
  return result.rows;
}

export async function secureQueryOne<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await secureQuery<T>(text, params);
  return rows[0] ?? null;
}

export async function ensureSecureDatabase(adminClient: pg.PoolClient): Promise<void> {
  const exists = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [CRDB_SECURE_DATABASE],
  );

  if (exists.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${CRDB_SECURE_DATABASE}"`);
    console.log(`Created secure database "${CRDB_SECURE_DATABASE}".`);
  }
}
