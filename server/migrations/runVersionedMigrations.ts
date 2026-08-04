import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CRDB_DATABASE, withDatabase } from '../dbConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function splitStatements(sql: string): string[] {
  return stripComments(sql)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function getMigrationPool(): pg.Pool {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL?.trim();
  if (!migrationUrl) {
    throw new Error(
      'MIGRATION_DATABASE_URL is required for schema migrations. ' +
        'Do not use the runtime DATABASE_URL for DDL.',
    );
  }
  return new Pool({
    connectionString: withDatabase(migrationUrl, CRDB_DATABASE),
    max: 2,
  });
}

async function ensureLedger(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version STRING PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(client: pg.PoolClient): Promise<Set<string>> {
  const result = await client.query<{ version: string }>(
    'SELECT version FROM schema_migrations',
  );
  return new Set(result.rows.map((r) => r.version));
}

export async function runVersionedMigrations(): Promise<string[]> {
  const pool = getMigrationPool();
  const newlyApplied: string[] = [];

  try {
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const bootstrap = await pool.connect();
    try {
      await ensureLedger(bootstrap);
    } finally {
      bootstrap.release();
    }

    const appliedClient = await pool.connect();
    let applied: Set<string>;
    try {
      applied = await appliedVersions(appliedClient);
    } finally {
      appliedClient.release();
    }

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) continue;

      const raw = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const statements = splitStatements(raw);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version],
        );
        await client.query('COMMIT');
        newlyApplied.push(version);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const message = error instanceof Error ? error.message : 'migration_failed';
        throw new Error(`Migration ${version} failed: ${message.slice(0, 200)}`);
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }

  return newlyApplied;
}
