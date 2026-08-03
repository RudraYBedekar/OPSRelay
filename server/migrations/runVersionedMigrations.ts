import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function appliedVersions(): Promise<Set<string>> {
  try {
    const result = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations',
    );
    return new Set(result.rows.map((r) => r.version));
  } catch {
    return new Set();
  }
}

export async function runVersionedMigrations(): Promise<string[]> {
  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await appliedVersions();
  const newlyApplied: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const raw = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const statements = splitStatements(raw);

    for (const statement of statements) {
      await pool.query(statement);
    }

    try {
      await pool.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [version],
      );
    } catch {
      // schema_migrations table may not exist until 003 runs
    }
    newlyApplied.push(version);
  }

  return newlyApplied;
}
