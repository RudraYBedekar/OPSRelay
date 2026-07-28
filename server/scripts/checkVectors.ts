import 'dotenv/config';
import pg from 'pg';
import { CRDB_DATABASE, withDatabase } from '../dbConfig.js';

const c = new pg.Client({
  connectionString: withDatabase(process.env.DATABASE_URL ?? '', CRDB_DATABASE),
});

await c.connect();

const total = await c.query('SELECT count(*)::int AS n FROM incident_embeddings');
const byIncident = await c.query(`
  SELECT incident_id, count(*)::int AS chunks
  FROM incident_embeddings
  GROUP BY incident_id
  ORDER BY chunks DESC
  LIMIT 10
`);
const byType = await c.query(`
  SELECT chunk_type, count(*)::int AS n
  FROM incident_embeddings
  GROUP BY chunk_type
  ORDER BY n DESC
`);
const sample = await c.query(`
  SELECT incident_id, chunk_type, service,
         left(content, 100) AS preview, created_at
  FROM incident_embeddings
  ORDER BY created_at DESC
  LIMIT 8
`);
const dims = await c.query(`
  SELECT array_length(embedding::float[], 1) AS dimensions
  FROM incident_embeddings LIMIT 1
`);

console.log('\n=== OpsRelay Vector Check ===');
console.log(`Database: ${CRDB_DATABASE}`);
console.log(`Total embeddings: ${total.rows[0].n}`);
console.log(`Dimensions: ${dims.rows[0]?.dimensions ?? 'N/A (no rows)'}`);

console.log('\n--- By chunk type ---');
console.table(byType.rows);

console.log('\n--- Chunks per incident (top 10) ---');
console.table(byIncident.rows);

console.log('\n--- Latest chunks (preview) ---');
console.table(sample.rows);

await c.end();
