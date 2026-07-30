import 'dotenv/config';
import pg from 'pg';
import { CRDB_DATABASE, CRDB_SECURE_DATABASE, withDatabase } from '../dbConfig.js';
import { normalizeIncidentForSave, type IncidentWithTasks } from '../utils/incidentTasks.js';
import { indexIncident } from '../services/vectorService.js';

const TOTAL_INCIDENTS = Number(process.env.SEED_INCIDENT_COUNT ?? 100);
const PER_USER = Number(process.env.SEED_INCIDENTS_PER_USER ?? 10);
const TARGET_USERS = Math.ceil(TOTAL_INCIDENTS / PER_USER);

const SERVICES = [
  'billing-service', 'auth-service', 'api-gateway', 'payment-api', 'cdn-edge',
  'inventory-api', 'notification-service', 'search-index', 'user-profile', 'checkout-api',
  'kafka-consumer', 'redis-cache', 'postgres-replica', 'k8s-ingress', 'mobile-bff',
];

const TITLES = [
  'Connection pool exhaustion under peak load',
  'Elevated 5xx errors after deploy',
  'Memory leak causing pod restarts',
  'Rate limit misconfiguration on API gateway',
  'Stale cache invalidation in CDN',
  'Database replica lag spike',
  'JWT rotation failure cascade',
  'Kafka consumer lag growing',
  'Timeout storm on checkout path',
  'OOMKilled pods in production cluster',
  'SSL certificate expiry warning',
  'Cross-region latency degradation',
  'Feature flag rollback needed',
  'Webhook delivery failures',
  'Search index corruption detected',
];

const STATUSES = ['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'] as const;
const SEVERITIES = ['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinDays(days: number): string {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toISOString();
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface SeedUser {
  memberId: string;
  name: string;
}

async function fetchUsers(secureUrl: string): Promise<SeedUser[]> {
  const pool = new pg.Pool({ connectionString: secureUrl });
  try {
    const { rows } = await pool.query<{ member_id: string; name: string }>(
      'SELECT member_id, name FROM users ORDER BY created_at ASC',
    );
    return rows.map((r) => ({ memberId: r.member_id, name: r.name }));
  } finally {
    await pool.end();
  }
}

function buildIncident(index: number, owner: SeedUser) {
  const service = pick(SERVICES);
  const severity = pick(SEVERITIES);
  const status = pick(STATUSES);
  const title = `${pick(TITLES)} — ${service}`;
  const createdAt = randomDateWithinDays(30);
  const id = `INC-BULK-${String(index).padStart(4, '0')}`;

  const base = {
    id,
    title,
    service,
    component: `${service}-core`,
    severity,
    status,
    summary: `Auto-generated incident #${index} for ${owner.name}. ${title}.`,
    createdAt,
    updatedAt: createdAt,
    leadSRE: owner.name,
    shiftId: 'SHIFT-BULK-SEED',
    ownerMemberId: owner.memberId,
    ownerName: owner.name,
    aiConfidence: Math.floor(Math.random() * 20 + 75),
    rawNotes: `[auto-seed] Synthetic incident assigned to ${owner.memberId}`,
    timeline: [
      {
        id: `tl-${id}`,
        timestamp: createdAt.slice(11, 19),
        title: 'Auto-detected anomaly',
        description: title,
        actor: 'System Monitor',
        type: 'alert' as const,
      },
    ],
    decisions: [],
    fixesApplied: status === 'RESOLVED' ? ['Applied mitigation from runbook'] : [],
    tasks: [],
    similarIncidents: [],
    ...(status === 'RESOLVED'
      ? {
          resolvedAt: new Date(new Date(createdAt).getTime() + 3600000).toISOString(),
          mttrMinutes: Math.floor(Math.random() * 120 + 15),
        }
      : {}),
  } as IncidentWithTasks & Record<string, unknown>;

  return normalizeIncidentForSave(base);
}

async function main() {
  const baseUrl =
    process.env.DATABASE_URL ??
    'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

  const secureUrl = withDatabase(baseUrl, CRDB_SECURE_DATABASE);
  const rudraUrl = withDatabase(baseUrl, CRDB_DATABASE);

  const users = await fetchUsers(secureUrl);
  if (users.length === 0) {
    throw new Error('No users found in SecureData. Register accounts first.');
  }

  const assignees = shuffle(users).slice(0, Math.min(TARGET_USERS, users.length));
  console.log(`Assigning ${TOTAL_INCIDENTS} incidents (${PER_USER} each) across ${assignees.length} user(s):`);
  for (const u of assignees) {
    console.log(`  • ${u.name} (${u.memberId})`);
  }

  const pool = new pg.Pool({ connectionString: rudraUrl });
  const client = await pool.connect();

  let inserted = 0;
  let indexed = 0;

  try {
    for (let i = 1; i <= TOTAL_INCIDENTS; i++) {
      const owner = assignees[(Math.floor((i - 1) / PER_USER)) % assignees.length];
      const incident = buildIncident(i, owner);

      await client.query(
        `INSERT INTO incidents (id, data, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3::timestamptz, now())
         ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = now()`,
        [incident.id, JSON.stringify(incident), incident.createdAt],
      );
      inserted++;

      try {
        await indexIncident(incident as import('../services/vectorService.js').IncidentRecord);
        indexed++;
      } catch {
        // vector index optional during bulk seed
      }
    }

    const count = await client.query<{ n: string }>('SELECT count(*)::int AS n FROM incidents');
    console.log(`\n✅ Inserted/updated ${inserted} random incidents (${indexed} indexed for Ask AI).`);
    console.log(`   Total incidents in ${CRDB_DATABASE}: ${count.rows[0]?.n ?? '?'}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
