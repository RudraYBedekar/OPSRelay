import { pool } from '../db.js';

const REQUIRED_TABLES = [
  'incidents',
  'alert_embeddings',
  'agent_runs',
  'incident_jobs',
  'incident_evidence',
  'schema_migrations',
] as const;

export interface SchemaReadiness {
  ready: boolean;
  code?: 'SCHEMA_UPGRADE_REQUIRED' | 'DATABASE_UNAVAILABLE';
  missing?: string[];
  currentVersion?: string | null;
}

export async function checkSchemaReadiness(): Promise<SchemaReadiness> {
  try {
    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const result = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table],
      );
      if (!result.rows[0]?.exists) missing.push(table);
    }

    if (missing.length > 0) {
      return { ready: false, code: 'SCHEMA_UPGRADE_REQUIRED', missing };
    }

    const version = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
    );

    const leaseCol = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'incident_jobs' AND column_name = 'lease_owner'
       ) AS exists`,
    );
    if (!leaseCol.rows[0]?.exists) {
      return {
        ready: false,
        code: 'SCHEMA_UPGRADE_REQUIRED',
        missing: ['incident_jobs.lease_owner'],
        currentVersion: version.rows[0]?.version ?? null,
      };
    }

    return {
      ready: true,
      currentVersion: version.rows[0]?.version ?? null,
    };
  } catch {
    return { ready: false, code: 'DATABASE_UNAVAILABLE' };
  }
}
