import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const DB_NAME = process.env.CRDB_DATABASE ?? "Rudra";

function withDatabase(url, database) {
  return url.replace(/(postgresql:\/\/[^/]+\/)([^?]*)/, `$1${database}`);
}

async function testConnection() {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    console.error("❌ DATABASE_URL not set in .env");
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: withDatabase(baseUrl, DB_NAME),
  });

  try {
    await client.connect();

    const info = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS user,
        now() AS connected_at
    `);

    console.log("✅ CockroachDB connected successfully");
    console.table(info.rows);

    const counts = await client.query(`
      SELECT 'incidents' AS table_name, count(*)::int AS rows FROM incidents
      UNION ALL SELECT 'memory_chats', count(*)::int FROM memory_chats
      UNION ALL SELECT 'sample_logs', count(*)::int FROM sample_logs
      UNION ALL SELECT 'incident_embeddings', count(*)::int FROM incident_embeddings
      UNION ALL SELECT 'dashboard_metrics', count(*)::int FROM dashboard_metrics
      UNION ALL SELECT 'shift_handoffs', count(*)::int FROM shift_handoffs
    `);

    console.log(`\n📊 Tables in "${DB_NAME}" database:`);
    console.table(counts.rows);

    const sample = await client.query(`
      SELECT id, data->>'title' AS title, data->>'severity' AS severity
      FROM incidents LIMIT 3
    `);
    console.log("\n📋 Sample incidents:");
    console.table(sample.rows);
  } catch (error) {
    console.error("❌ Connection or query failed");
    console.error(error.message);
    if (error.message.includes("does not exist")) {
      console.error(`\nRun: npm run db:seed   (creates "${DB_NAME}" and loads data)`);
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

testConnection();
