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

const RETRYABLE = new Set(['40001']);

function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return Boolean(code && RETRYABLE.has(code));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      lastError = err;
      if (isRetryable(err) && attempt < maxRetries - 1) {
        await sleep(50 * 2 ** attempt);
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Transaction failed');
}

export async function queryWithClient<T extends pg.QueryResultRow>(
  client: pg.PoolClient,
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await client.query<T>(text, params);
  return result.rows;
}
