import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  INITIAL_METRICS,
  INITIAL_HANDOFF,
  SAMPLE_INCIDENTS,
  INITIAL_MEMORY_CHATS,
  RAW_LOG_SAMPLE_TEMPLATES,
} from '../../src/data/mockData.js';
import { CRDB_DATABASE, withDatabase } from '../dbConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

async function ensureRudraDatabase(adminClient: pg.PoolClient) {
  const exists = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [CRDB_DATABASE],
  );

  if (exists.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${CRDB_DATABASE}"`);
    console.log(`Created database "${CRDB_DATABASE}".`);
  } else {
    console.log(`Database "${CRDB_DATABASE}" already exists.`);
  }
}

async function main() {
  // Step 1: connect to defaultdb and create Rudra if needed
  const adminPool = new pg.Pool({ connectionString: withDatabase(baseUrl, 'defaultdb') });
  const adminClient = await adminPool.connect();
  try {
    await ensureRudraDatabase(adminClient);
  } finally {
    adminClient.release();
    await adminPool.end();
  }

  // Step 2: connect to Rudra and seed
  const rudraUrl = withDatabase(baseUrl, CRDB_DATABASE);
  console.log(`Seeding database "${CRDB_DATABASE}"...`);

  const pool = new pg.Pool({ connectionString: rudraUrl });
  const client = await pool.connect();

  try {
    await client.query(`
      DROP TABLE IF EXISTS memory_chats CASCADE;
      DROP TABLE IF EXISTS sample_logs CASCADE;
      DROP TABLE IF EXISTS incident_embeddings CASCADE;
      DROP TABLE IF EXISTS incident_events CASCADE;
      DROP TABLE IF EXISTS incidents CASCADE;
      DROP TABLE IF EXISTS shift_handoffs CASCADE;
      DROP TABLE IF EXISTS dashboard_metrics CASCADE;
    `);

    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    for (const incident of SAMPLE_INCIDENTS) {
      await client.query(
        `INSERT INTO incidents (id, data, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz, $4::timestamptz)`,
        [incident.id, JSON.stringify(incident), incident.createdAt, incident.createdAt],
      );
    }

    await client.query(
      `INSERT INTO dashboard_metrics (id, data) VALUES ('current', $1::jsonb)`,
      [JSON.stringify(INITIAL_METRICS)],
    );

    await client.query(
      `INSERT INTO shift_handoffs (id, data) VALUES ('current', $1::jsonb)`,
      [JSON.stringify(INITIAL_HANDOFF)],
    );

    for (const chat of INITIAL_MEMORY_CHATS) {
      await client.query(
        'INSERT INTO memory_chats (id, data) VALUES ($1, $2::jsonb)',
        [chat.id, JSON.stringify(chat)],
      );
    }

    for (const log of RAW_LOG_SAMPLE_TEMPLATES) {
      await client.query(
        'INSERT INTO sample_logs (id, data) VALUES ($1, $2::jsonb)',
        [log.id, JSON.stringify({ title: log.title, content: log.content, category: log.category })],
      );
    }

    const counts = await client.query(`
      SELECT 'incidents' AS table_name, count(*)::int AS rows FROM incidents
      UNION ALL SELECT 'memory_chats', count(*)::int FROM memory_chats
      UNION ALL SELECT 'sample_logs', count(*)::int FROM sample_logs
      UNION ALL SELECT 'dashboard_metrics', count(*)::int FROM dashboard_metrics
      UNION ALL SELECT 'shift_handoffs', count(*)::int FROM shift_handoffs
    `);

    console.log('\n--- Data loaded in CockroachDB ---');
    console.log(`Database: ${CRDB_DATABASE}`);
    console.table(counts.rows);

    console.log('\nBuilding vector index...');
    const { embedAllIncidentsFromDb, getEmbeddingCount } = await import('../services/vectorService.js');
    const { getEmbedMode } = await import('../services/embedService.js');
    const chunks = await embedAllIncidentsFromDb();
    const embedTotal = await getEmbeddingCount();
    console.log(`Vector index: ${chunks} chunks (${embedTotal} rows) via ${getEmbedMode()} mode.`);

    console.log('\nCheck in CockroachDB Cloud Console → SQL Shell:');
    console.log(`  USE "${CRDB_DATABASE}";`);
    console.log('  SELECT id, data->>\'title\' AS title FROM incidents;');
    console.log('\nDone. Run: npm run dev:all');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
