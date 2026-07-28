import pg from 'pg';
import { CRDB_DATABASE, withDatabase } from './dbConfig.js';

const { Pool } = pg;

const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

const connectionString = withDatabase(baseUrl, CRDB_DATABASE);

export const pool = new Pool({
  connectionString,
  max: 10,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
