import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { RAW_LOG_SAMPLE_TEMPLATES } from '../../src/data/mockData.js';
import { CRDB_DATABASE, withDatabase } from '../dbConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Upsert sample logs only — does not wipe incidents or vectors */
async function main() {
  const baseUrl =
    process.env.DATABASE_URL ??
    'postgresql://root@localhost:26257/defaultdb?sslmode=disable';
  const rudraUrl = withDatabase(baseUrl, CRDB_DATABASE);

  const pool = new pg.Pool({ connectionString: rudraUrl });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sample_logs (
        id         STRING PRIMARY KEY,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const log of RAW_LOG_SAMPLE_TEMPLATES) {
      await client.query(
        `INSERT INTO sample_logs (id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = $2::jsonb`,
        [log.id, JSON.stringify({ title: log.title, content: log.content, category: log.category })],
      );
    }

    const count = await client.query('SELECT count(*)::int AS n FROM sample_logs');
    console.log(`Sample logs in "${CRDB_DATABASE}": ${count.rows[0].n} rows`);
    console.log('\nExamples loaded:');
    for (const log of RAW_LOG_SAMPLE_TEMPLATES) {
      console.log(`  ${log.id}  ${log.title} (${log.category})`);
    }
    console.log('\nUse in UI: New Incident tab → click a sample chip');
    console.log('Query DB: SELECT id, data->>\'title\' FROM sample_logs;');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
