import 'dotenv/config';
import pg from 'pg';
import { CRDB_DATABASE, CRDB_SECURE_DATABASE, withDatabase } from '../dbConfig.js';
import { normalizeIncidentForSave, type IncidentWithTasks } from '../utils/incidentTasks.js';
import { indexIncident } from '../services/vectorService.js';
import { projectIncidentEvidence } from '../services/evidenceProjectionService.js';

interface SeedUser {
  memberId: string;
  name: string;
}

interface IndustryIncidentSeed {
  id: string;
  title: string;
  service: string;
  severity: 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3';
  status: 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';
  summary: string;
  rawNotes: string;
  fixesApplied: string[];
  decisions: Array<{ title: string; description?: string }>;
  tasks: Array<{ title: string }>;
  mttrMinutes?: number;
}

const INDUSTRY_INCIDENTS: IndustryIncidentSeed[] = [
  {
    id: 'INC-IND-001',
    title: 'PostgreSQL connection pool exhaustion under peak traffic',
    service: 'postgres-replica',
    severity: 'SEV-1',
    status: 'RESOLVED',
    summary: 'Checkout traffic spike exhausted the app-side HikariCP pool (max 20). Wait queues exceeded 30s and APIs returned 503.',
    rawNotes: 'PgBouncer was bypassed by one microservice using direct connections. Pool metrics showed 100% utilization.',
    fixesApplied: [
      'Routed all services through PgBouncer transaction pooling',
      'Increased pool max size from 20 to 50 with leak detection enabled',
      'Added pool wait time alert at p95 > 2s',
    ],
    decisions: [{ title: 'Standardize on PgBouncer for all JVM services' }],
    tasks: [{ title: 'Audit remaining direct JDBC URLs' }],
    mttrMinutes: 47,
  },
  {
    id: 'INC-IND-002',
    title: 'Checkout API database pool timeout cascade',
    service: 'checkout-api',
    severity: 'SEV-1',
    status: 'RESOLVED',
    summary: 'During Black Friday load, checkout-api could not acquire DB connections within 5s. Error rate hit 18% for 22 minutes.',
    rawNotes: 'Similar to INC-IND-001 pattern. Long-running analytics query held connections open.',
    fixesApplied: [
      'Killed runaway reporting query and moved it to read replica',
      'Set connection max lifetime to 10m to recycle stale connections',
      'Enabled HikariCP metric export to Datadog',
    ],
    decisions: [{ title: 'Separate OLTP and reporting connection pools' }],
    tasks: [{ title: 'Load test checkout path with 3x peak multiplier' }],
    mttrMinutes: 35,
  },
  {
    id: 'INC-IND-003',
    title: 'Payment service connection pool saturation',
    service: 'payment-api',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Payment-api exhausted PostgreSQL connections after deploy introduced connection leak in retry handler.',
    rawNotes: 'Each failed Stripe webhook retry opened a new connection without closing the previous one.',
    fixesApplied: [
      'Fixed connection leak in webhook retry loop (try/finally close)',
      'Reduced pool size temporarily and rolled forward patch v2.14.1',
    ],
    decisions: [{ title: 'Require connection pool tests in CI for payment-api' }],
    tasks: [{ title: 'Add integration test for webhook retry path' }],
    mttrMinutes: 62,
  },
  {
    id: 'INC-IND-004',
    title: 'API gateway circuit breaker on downstream DB failures',
    service: 'api-gateway',
    severity: 'SEV-2',
    status: 'MITIGATED',
    summary: 'Upstream DB slowness caused gateway thread pool exhaustion. Circuit breaker opened for billing and inventory routes.',
    rawNotes: 'Root cause traced to postgres-replica lag; gateway amplified failures across services.',
    fixesApplied: [
      'Tuned circuit breaker thresholds (50% error over 30s window)',
      'Added bulkhead isolation per downstream service',
    ],
    decisions: [{ title: 'Keep bulkhead limits after replica lag resolved' }],
    tasks: [{ title: 'Document gateway fallback behavior in runbook' }],
  },
  {
    id: 'INC-IND-005',
    title: 'Billing slow queries blocking connection pool',
    service: 'billing-service',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Missing index on invoices table caused full table scans holding connections for 40+ seconds during month-end billing.',
    rawNotes: 'Connection pool wait time correlated with slow query log entries on invoices(owner_id, period).',
    fixesApplied: [
      'Added composite index on invoices(owner_id, billing_period)',
      'Set statement_timeout to 15s for billing-service role',
    ],
    decisions: [{ title: 'Require EXPLAIN review for billing schema changes' }],
    tasks: [{ title: 'Backfill index on staging and verify plan' }],
    mttrMinutes: 28,
  },
  {
    id: 'INC-IND-006',
    title: 'Cache stampede overloading primary database',
    service: 'redis-cache',
    severity: 'SEV-1',
    status: 'RESOLVED',
    summary: 'Redis failover triggered cache miss storm; every pod opened max DB connections to rebuild cache simultaneously.',
    rawNotes: 'Classic thundering herd — 120 pods × 30 connections exceeded Postgres max_connections.',
    fixesApplied: [
      'Implemented staggered cache warm-up with jitter',
      'Limited concurrent DB rebuild workers to 10 cluster-wide',
      'Raised PgBouncer default_pool_size with cap per database',
    ],
    decisions: [{ title: 'Cache warm-up must use shared semaphore' }],
    tasks: [{ title: 'Chaos test Redis failover in staging' }],
    mttrMinutes: 55,
  },
  {
    id: 'INC-IND-007',
    title: 'Auth service JWT validation DB pool saturation',
    service: 'auth-service',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Token introspection path opened a new DB connection per request instead of reusing the pool during traffic spike.',
    rawNotes: 'Regression introduced in auth middleware refactor; pool metrics flat at max while CPU was low.',
    fixesApplied: [
      'Restored singleton DataSource injection in auth middleware',
      'Added pool utilization alert at 80%',
    ],
    decisions: [{ title: 'Block deploy if pool metrics unavailable' }],
    tasks: [{ title: 'Add auth middleware pool regression test' }],
    mttrMinutes: 41,
  },
  {
    id: 'INC-IND-008',
    title: 'Mobile BFF ORM connection leak',
    service: 'mobile-bff',
    severity: 'SEV-3',
    status: 'RESOLVED',
    summary: 'TypeORM sessions not released in error path caused gradual pool drain over 6 hours until mobile login failed.',
    rawNotes: 'Leak visible in pool active count stair-step pattern. Similar fix pattern to payment-api INC-IND-003.',
    fixesApplied: [
      'Wrapped all repository calls in UnitOfWork with guaranteed release',
      'Deployed hotfix and restarted pods to reset pool state',
    ],
    decisions: [{ title: 'Enable ORM query runner lint rule' }],
    tasks: [{ title: 'Weekly pool leak canary in staging' }],
    mttrMinutes: 90,
  },
  {
    id: 'INC-IND-009',
    title: 'Inventory read replica lag with pool wait spikes',
    service: 'inventory-api',
    severity: 'SEV-2',
    status: 'INVESTIGATING',
    summary: 'Inventory reads hitting lagging replica; apps retried aggressively amplifying connection pool pressure.',
    rawNotes: 'Replica lag 45s during bulk sync job. Pool wait p99 at 8s. Investigation ongoing.',
    fixesApplied: [],
    decisions: [{ title: 'Route read-heavy endpoints to dedicated replica pool' }],
    tasks: [{ title: 'Pause bulk sync during peak hours' }, { title: 'Add replica lag circuit' }],
  },
  {
    id: 'INC-IND-010',
    title: 'PgBouncer misconfiguration causing pool errors',
    service: 'notification-service',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'notification-service used session pooling against PgBouncer while holding prepared statements, causing pool slot exhaustion.',
    rawNotes: 'Error: "sorry, too many clients already". Fixed by switching to transaction pooling mode.',
    fixesApplied: [
      'Changed PgBouncer pool mode to transaction for notification-service',
      'Disabled prepared statements in Sequelize config',
      'Documented PgBouncer mode requirements per service',
    ],
    decisions: [{ title: 'Centralize PgBouncer config in platform repo' }],
    tasks: [{ title: 'Validate all Sequelize services use transaction mode' }],
    mttrMinutes: 33,
  },
];

async function fetchPrimaryUser(secureUrl: string): Promise<SeedUser> {
  const pool = new pg.Pool({ connectionString: secureUrl });
  try {
    const { rows } = await pool.query<{ member_id: string; name: string }>(
      `SELECT member_id, name FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`,
    );
    if (!rows[0]) throw new Error('No users in SecureData. Run db:seed-secure first.');
    return { memberId: rows[0].member_id, name: rows[0].name };
  } finally {
    await pool.end();
  }
}

function buildIncident(seed: IndustryIncidentSeed, owner: SeedUser): IncidentWithTasks & Record<string, unknown> {
  const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const base = {
    id: seed.id,
    title: seed.title,
    service: seed.service,
    component: `${seed.service}-core`,
    severity: seed.severity,
    status: seed.status,
    summary: seed.summary,
    createdAt,
    updatedAt: createdAt,
    leadSRE: owner.name,
    shiftId: 'SHIFT-INDUSTRY',
    ownerMemberId: owner.memberId,
    ownerName: owner.name,
    analysisStatus: 'approved',
    aiConfidence: 92,
    rawNotes: seed.rawNotes,
    timeline: [
      {
        id: `tl-${seed.id}`,
        timestamp: createdAt.slice(11, 19),
        title: 'Incident detected',
        description: seed.title,
        actor: 'OpsRelay Monitor',
        type: 'alert' as const,
      },
    ],
    decisions: seed.decisions,
    fixesApplied: seed.fixesApplied,
    tasks: seed.tasks,
    similarIncidents: [],
    ...(seed.status === 'RESOLVED' && seed.mttrMinutes
      ? {
          resolvedAt: new Date(new Date(createdAt).getTime() + seed.mttrMinutes * 60000).toISOString(),
          mttrMinutes: seed.mttrMinutes,
        }
      : {}),
  };

  return normalizeIncidentForSave(base) as IncidentWithTasks & Record<string, unknown>;
}

async function main() {
  const baseUrl =
    process.env.DATABASE_URL ??
    'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

  const secureUrl = withDatabase(baseUrl, CRDB_SECURE_DATABASE);
  const rudraUrl = withDatabase(baseUrl, CRDB_DATABASE);
  const owner = await fetchPrimaryUser(secureUrl);

  console.log(`Seeding ${INDUSTRY_INCIDENTS.length} industry incidents into ${CRDB_DATABASE}...`);
  console.log(`Owner: ${owner.name} (${owner.memberId})`);

  const pool = new pg.Pool({ connectionString: rudraUrl });
  const client = await pool.connect();

  let indexed = 0;
  let projected = 0;

  try {
    for (const seed of INDUSTRY_INCIDENTS) {
      const incident = buildIncident(seed, owner);

      await client.query(
        `INSERT INTO incidents (id, data, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz, now())
         ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = now()`,
        [incident.id, JSON.stringify(incident), incident.createdAt],
      );

      try {
        await indexIncident(incident as import('../services/vectorService.js').IncidentRecord);
        indexed++;
      } catch {
        console.warn(`  ⚠ Vector index skipped for ${incident.id}`);
      }

      if (incident.analysisStatus === 'approved') {
        await projectIncidentEvidence({
          incidentId: incident.id,
          title: incident.title,
          service: incident.service,
          severity: incident.severity,
          status: incident.status,
          summary: incident.summary,
          fixesApplied: incident.fixesApplied,
          decisions: incident.decisions,
          tasks: incident.tasks,
          sourceUpdatedAt: incident.updatedAt ?? incident.createdAt,
          ownerScope: owner.memberId,
        });
        projected++;
      }

      console.log(`  ✓ ${incident.id} — ${incident.service} (${incident.status})`);
    }

    const counts = await client.query<{ incidents: number; evidence: number }>(
      `SELECT
         (SELECT count(*)::int FROM incidents WHERE id LIKE 'INC-IND-%') AS incidents,
         (SELECT count(*)::int FROM incident_evidence WHERE incident_id LIKE 'INC-IND-%') AS evidence`,
    );

    console.log(`\n✅ Industry seed complete.`);
    console.log(`   Incidents: ${counts.rows[0]?.incidents ?? 0} | Evidence rows: ${counts.rows[0]?.evidence ?? 0}`);
    console.log(`   Vector indexed: ${indexed} | Evidence projected: ${projected}`);
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
