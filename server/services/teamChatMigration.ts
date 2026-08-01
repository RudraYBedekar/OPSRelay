import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrateTeamChatSchema(): Promise<void> {
  const sqlPath = path.join(__dirname, '..', 'schemaTeamChat.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const sql = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      const preview = statement.slice(0, 80).replace(/\s+/g, ' ');
      throw new Error(`${err instanceof Error ? err.message : err} [SQL: ${preview}...]`);
    }
  }
}
