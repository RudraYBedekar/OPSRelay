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

/** 10 industry examples: 5 open, 2 closed (resolved), 2 investigating, 1 mitigated */
const INDUSTRY_INCIDENTS: IndustryIncidentSeed[] = [
  {
    id: 'INC-IND-001',
    title: 'PostgreSQL connection pool exhaustion under peak traffic',
    service: 'postgres-replica',
    severity: 'SEV-1',
    status: 'OPEN',
    summary: 'Checkout traffic spike exhausted the app-side HikariCP pool (max 20). Wait queues exceeded 30s and APIs returning 503.',
    rawNotes: 'PgBouncer bypassed by one microservice. Pool at 100% utilization — active war room.',
    fixesApplied: [],
    decisions: [{ title: 'Evaluate PgBouncer routing for all JVM services' }],
    tasks: [{ title: 'Audit direct JDBC URLs' }, { title: 'Scale read replicas' }],
  },
  {
    id: 'INC-IND-002',
    title: 'Checkout API database pool timeout cascade',
    service: 'checkout-api',
    severity: 'SEV-1',
    status: 'OPEN',
    summary: 'checkout-api cannot acquire DB connections within 5s. Error rate at 12% and climbing during peak.',
    rawNotes: 'Long-running analytics query suspected. Similar pattern to past pool exhaustion incidents.',
    fixesApplied: [],
    decisions: [{ title: 'Separate OLTP and reporting pools' }],
    tasks: [{ title: 'Identify blocking queries' }],
  },
  {
    id: 'INC-IND-003',
    title: 'Payment service connection pool saturation',
    service: 'payment-api',
    severity: 'SEV-2',
    status: 'OPEN',
    summary: 'Payment-api connection pool near limit after deploy; webhook retries may be leaking connections.',
    rawNotes: 'Investigating retry handler from v2.14.0 deploy. Stripe webhooks backing up.',
    fixesApplied: [],
    decisions: [],
    tasks: [{ title: 'Review webhook retry code path' }],
  },
  {
    id: 'INC-IND-004',
    title: 'API gateway elevated 5xx on database-backed routes',
    service: 'api-gateway',
    severity: 'SEV-2',
    status: 'OPEN',
    summary: 'Gateway returning 503 for billing and inventory routes. Downstream DB latency elevated.',
    rawNotes: 'Correlates with postgres-replica lag. Circuit breaker not yet tripped.',
    fixesApplied: [],
    decisions: [{ title: 'Enable bulkhead limits if lag persists' }],
    tasks: [{ title: 'Check replica lag dashboard' }],
  },
  {
    id: 'INC-IND-005',
    title: 'Inventory read replica lag with pool wait spikes',
    service: 'inventory-api',
    severity: 'SEV-2',
    status: 'OPEN',
    summary: 'Inventory reads hitting lagging replica; retry storms amplifying connection pool pressure.',
    rawNotes: 'Replica lag 45s during bulk sync. Pool wait p99 at 8s.',
    fixesApplied: [],
    decisions: [{ title: 'Route reads to dedicated replica pool' }],
    tasks: [{ title: 'Pause bulk sync during peak' }],
  },
  {
    id: 'INC-IND-006',
    title: 'Billing slow queries blocking connection pool',
    service: 'billing-service',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Missing index on invoices table caused full table scans holding connections 40+ seconds during month-end billing.',
    rawNotes: 'Connection pool wait correlated with slow query on invoices(owner_id, period).',
    fixesApplied: [
      'Added composite index on invoices(owner_id, billing_period)',
      'Set statement_timeout to 15s for billing-service role',
    ],
    decisions: [{ title: 'Require EXPLAIN review for billing schema changes' }],
    tasks: [{ title: 'Backfill index on staging' }],
    mttrMinutes: 28,
  },
  {
    id: 'INC-IND-007',
    title: 'Cache stampede overloading primary database',
    service: 'redis-cache',
    severity: 'SEV-1',
    status: 'RESOLVED',
    summary: 'Redis failover triggered cache miss storm; pods opened max DB connections to rebuild cache simultaneously.',
    rawNotes: '120 pods × 30 connections exceeded Postgres max_connections. Incident closed after warm-up fix.',
    fixesApplied: [
      'Implemented staggered cache warm-up with jitter',
      'Limited concurrent DB rebuild workers to 10 cluster-wide',
    ],
    decisions: [{ title: 'Cache warm-up must use shared semaphore' }],
    tasks: [{ title: 'Chaos test Redis failover in staging' }],
    mttrMinutes: 55,
  },
  {
    id: 'INC-IND-008',
    title: 'Auth service JWT validation DB pool saturation',
    service: 'auth-service',
    severity: 'SEV-2',
    status: 'INVESTIGATING',
    summary: 'Token introspection may open a new DB connection per request instead of reusing the pool during traffic spike.',
    rawNotes: 'Regression suspected in auth middleware refactor. Pool metrics flat at max while CPU is low.',
    fixesApplied: [],
    decisions: [{ title: 'Compare middleware deploy diff' }],
    tasks: [{ title: 'Profile connection acquisition path' }],
  },
  {
    id: 'INC-IND-009',
    title: 'Mobile BFF ORM connection leak',
    service: 'mobile-bff',
    severity: 'SEV-3',
    status: 'INVESTIGATING',
    summary: 'TypeORM sessions may not release in error path — gradual pool drain observed over 6 hours.',
    rawNotes: 'Pool active count stair-step pattern. Mobile login failures intermittent.',
    fixesApplied: [],
    decisions: [{ title: 'Enable ORM query runner lint rule' }],
    tasks: [{ title: 'Add pool leak canary in staging' }],
  },
  {
    id: 'INC-IND-010',
    title: 'PgBouncer misconfiguration causing pool errors',
    service: 'notification-service',
    severity: 'SEV-2',
    status: 'MITIGATED',
    summary: 'notification-service used session pooling against PgBouncer with prepared statements; pool slots exhausted.',
    rawNotes: 'Temporary fix: switched to transaction pooling. Monitoring for recurrence.',
    fixesApplied: [
      'Changed PgBouncer pool mode to transaction for notification-service',
      'Disabled prepared statements in Sequelize config',
    ],
    decisions: [{ title: 'Centralize PgBouncer config in platform repo' }],
    tasks: [{ title: 'Validate all Sequelize services use transaction mode' }],
  },
];

const EXTRA_TITLES = [
  'Elevated 5xx errors after deploy',
  'Memory leak causing pod restarts',
  'Kafka consumer lag growing',
  'Webhook delivery failures',
  'SSL certificate expiry warning',
  'Cross-region latency degradation',
  'Search index corruption detected',
  'Rate limit misconfiguration',
];

const EXTRA_SERVICES = [
  'billing-service', 'auth-service', 'api-gateway', 'payment-api', 'cdn-edge',
  'inventory-api', 'notification-service', 'search-index', 'checkout-api', 'mobile-bff',
];

const PER_USER_EXTRA = Number(process.env.SEED_INCIDENTS_PER_USER ?? 4);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function memberSuffix(memberId: string): string {
  return memberId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
}

async function fetchAllUsers(secureUrl: string): Promise<SeedUser[]> {
  const pool = new pg.Pool({ connectionString: secureUrl });
  try {
    const { rows } = await pool.query<{ member_id: string; name: string }>(
      'SELECT member_id, name FROM users ORDER BY created_at ASC',
    );
    if (rows.length === 0) throw new Error('No users in SecureData. Register accounts or run db:seed-secure first.');
    return rows.map((r) => ({ memberId: r.member_id, name: r.name }));
  } finally {
    await pool.end();
  }
}

function buildIndustryIncident(
  seed: IndustryIncidentSeed,
  owner: SeedUser,
): IncidentWithTasks & Record<string, unknown> {
  const daysAgo = seed.status === 'RESOLVED' ? 14 : seed.status === 'OPEN' ? 1 : 5;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const approved = seed.status === 'RESOLVED' || seed.status === 'MITIGATED';

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
    analysisStatus: approved ? 'approved' : 'draft',
    aiConfidence: approved ? 92 : 78,
    rawNotes: seed.rawNotes,
    timeline: [
      {
        id: `tl-${seed.id}`,
        timestamp: createdAt.slice(11, 19),
        title: seed.status === 'RESOLVED' ? 'Incident resolved' : 'Incident detected',
        description: seed.title,
        actor: seed.status === 'RESOLVED' ? owner.name : 'OpsRelay Monitor',
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

function buildRandomIncident(
  index: number,
  owner: SeedUser,
): IncidentWithTasks & Record<string, unknown> {
  const service = pick(EXTRA_SERVICES);
  const title = `${pick(EXTRA_TITLES)} — ${service}`;
  const status = pick(['OPEN', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'] as const);
  const createdAt = new Date(Date.now() - Math.floor(Math.random() * 21 + 1) * 24 * 60 * 60 * 1000).toISOString();
  const id = `INC-EX-${memberSuffix(owner.memberId)}-${String(index).padStart(2, '0')}`;

  const base = {
    id,
    title,
    service,
    component: `${service}-core`,
    severity: pick(['SEV-1', 'SEV-2', 'SEV-2', 'SEV-3'] as const),
    status,
    summary: `Example incident for ${owner.name}. ${title}. Assigned for demo and on-call practice.`,
    createdAt,
    updatedAt: createdAt,
    leadSRE: owner.name,
    shiftId: 'SHIFT-EXAMPLE',
    ownerMemberId: owner.memberId,
    ownerName: owner.name,
    analysisStatus: status === 'RESOLVED' ? 'approved' : 'draft',
    aiConfidence: 80,
    rawNotes: `[example-seed] Random incident for ${owner.memberId}`,
    timeline: [
      {
        id: `tl-${id}`,
        timestamp: createdAt.slice(11, 19),
        title: 'Alert fired',
        description: title,
        actor: 'System Monitor',
        type: 'alert' as const,
      },
    ],
    decisions: [],
    fixesApplied: status === 'RESOLVED' ? ['Applied standard runbook mitigation'] : [],
    tasks: status === 'OPEN' ? [{ title: 'Triage and assign owner' }] : [],
    similarIncidents: [],
    ...(status === 'RESOLVED'
      ? {
          resolvedAt: new Date(new Date(createdAt).getTime() + 3600000).toISOString(),
          mttrMinutes: Math.floor(Math.random() * 90 + 20),
        }
      : {}),
  };

  return normalizeIncidentForSave(base) as IncidentWithTasks & Record<string, unknown>;
}

async function upsertIncident(
  client: pg.PoolClient,
  incident: IncidentWithTasks & Record<string, unknown>,
): Promise<{ indexed: boolean; projected: boolean }> {
  await client.query(
    `INSERT INTO incidents (id, data, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3::timestamptz, now())
     ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = now()`,
    [incident.id, JSON.stringify(incident), incident.createdAt],
  );

  let indexed = false;
  let projected = false;

  try {
    await indexIncident(incident as import('../services/vectorService.js').IncidentRecord);
    indexed = true;
  } catch {
    // optional when Bedrock unavailable
  }

  if (incident.analysisStatus === 'approved' && incident.summary) {
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
      ownerScope: incident.ownerMemberId,
    });
    projected = true;
  }

  return { indexed, projected };
}

async function main() {
  const baseUrl =
    process.env.DATABASE_URL ??
    'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

  const secureUrl = withDatabase(baseUrl, CRDB_SECURE_DATABASE);
  const rudraUrl = withDatabase(baseUrl, CRDB_DATABASE);
  const users = await fetchAllUsers(secureUrl);
  const assignees = shuffle(users);

  console.log(`Seeding into ${CRDB_DATABASE} for ${users.length} account(s):`);
  for (const u of users) {
    console.log(`  • ${u.name} (${u.memberId})`);
  }

  const pool = new pg.Pool({ connectionString: rudraUrl });
  const client = await pool.connect();

  let totalInserted = 0;
  let indexed = 0;
  let projected = 0;

  const statusCounts: Record<string, number> = {};

  try {
    console.log(`\n--- 10 industry examples (5 open, 2 closed, 2 investigating, 1 mitigated) ---`);
    for (let i = 0; i < INDUSTRY_INCIDENTS.length; i++) {
      const seed = INDUSTRY_INCIDENTS[i];
      const owner = assignees[i % assignees.length];
      const incident = buildIndustryIncident(seed, owner);
      const result = await upsertIncident(client, incident);
      if (result.indexed) indexed++;
      if (result.projected) projected++;
      totalInserted++;
      statusCounts[incident.status] = (statusCounts[incident.status] ?? 0) + 1;
      console.log(`  ✓ ${incident.id} → ${owner.name} (${incident.status})`);
    }

    console.log(`\n--- ${PER_USER_EXTRA} random example incidents per account ---`);
    for (const user of users) {
      for (let j = 1; j <= PER_USER_EXTRA; j++) {
        const incident = buildRandomIncident(j, user);
        const result = await upsertIncident(client, incident);
        if (result.indexed) indexed++;
        if (result.projected) projected++;
        totalInserted++;
        statusCounts[incident.status] = (statusCounts[incident.status] ?? 0) + 1;
        console.log(`  ✓ ${incident.id} → ${user.name} (${incident.status})`);
      }
    }

    const perUser = await client.query<{ owner: string; n: number }>(
      `SELECT data->>'ownerMemberId' AS owner, count(*)::int AS n
       FROM incidents
       WHERE id LIKE 'INC-IND-%' OR id LIKE 'INC-EX-%'
       GROUP BY data->>'ownerMemberId'
       ORDER BY n DESC`,
    );

    console.log(`\n✅ Seed complete — ${totalInserted} incidents upserted`);
    console.log(`   Status mix: ${JSON.stringify(statusCounts)}`);
    console.log(`   Vector indexed: ${indexed} | Evidence projected: ${projected}`);
    console.log('   Per account:');
    for (const row of perUser.rows) {
      console.log(`     ${row.owner}: ${row.n} example incident(s)`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
