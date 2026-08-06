import { query, queryOne } from '../db.js';
import { normalizeIncidentForSave, type IncidentWithTasks } from '../utils/incidentTasks.js';
import { indexIncident } from './vectorService.js';
import type { AuthUser } from './authService.js';

const WELCOME_COUNT = 5;

const TITLES = [
  'Elevated 5xx errors after deploy',
  'Memory leak causing pod restarts',
  'Kafka consumer lag growing',
  'Webhook delivery failures',
  'SSL certificate expiry warning',
  'Cross-region latency degradation',
  'Search index corruption detected',
  'Rate limit misconfiguration',
  'Database connection pool saturation',
  'Auth token validation latency spike',
];

const SERVICES = [
  'billing-service', 'auth-service', 'api-gateway', 'payment-api', 'cdn-edge',
  'inventory-api', 'notification-service', 'search-index', 'checkout-api', 'mobile-bff',
];

const STATUSES = ['OPEN', 'OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'] as const;
const SEVERITIES = ['SEV-1', 'SEV-2', 'SEV-2', 'SEV-3'] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function memberSuffix(memberId: string): string {
  return memberId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
}

function welcomeId(memberId: string, index: number): string {
  return `INC-WEL-${memberSuffix(memberId)}-${String(index).padStart(2, '0')}`;
}

function buildWelcomeIncident(
  index: number,
  owner: Pick<AuthUser, 'memberId' | 'name'>,
): IncidentWithTasks & Record<string, unknown> {
  const service = pick(SERVICES);
  const title = `${pick(TITLES)} — ${service}`;
  const status = pick(STATUSES);
  const daysAgo = Math.floor(Math.random() * 14 + 1);
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const id = welcomeId(owner.memberId, index);

  const base = {
    id,
    title,
    service,
    component: `${service}-core`,
    severity: pick(SEVERITIES),
    status,
    summary: `Welcome demo incident for ${owner.name}. ${title}. Use this to explore OpsRelay dashboards, Ask AI, and incident workflows.`,
    createdAt,
    updatedAt: createdAt,
    leadSRE: owner.name,
    shiftId: 'SHIFT-WELCOME',
    ownerMemberId: owner.memberId,
    ownerName: owner.name,
    analysisStatus: status === 'RESOLVED' ? 'approved' : 'draft',
    aiConfidence: 82,
    rawNotes: `[welcome-seed] Starter incident for ${owner.memberId}`,
    timeline: [
      {
        id: `tl-${id}`,
        timestamp: createdAt.slice(11, 19),
        title: status === 'RESOLVED' ? 'Incident resolved' : 'Alert fired',
        description: title,
        actor: status === 'RESOLVED' ? owner.name : 'OpsRelay Monitor',
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

  return normalizeIncidentForSave(base as unknown as IncidentWithTasks) as IncidentWithTasks & Record<string, unknown>;
}

async function hasWelcomeIncidents(memberId: string): Promise<boolean> {
  const prefix = `INC-WEL-${memberSuffix(memberId)}-`;
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM incidents WHERE id LIKE $1`,
    [`${prefix}%`],
  );
  return (row?.n ?? 0) > 0;
}

/** Seed five starter incidents for a new account (idempotent). */
export async function seedWelcomeIncidentsIfNeeded(user: AuthUser): Promise<number> {
  if (await hasWelcomeIncidents(user.memberId)) return 0;

  let inserted = 0;
  for (let i = 1; i <= WELCOME_COUNT; i++) {
    const incident = buildWelcomeIncident(i, user);
    await query(
      `INSERT INTO incidents (id, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3::timestamptz, now())
       ON CONFLICT (id) DO NOTHING`,
      [incident.id, JSON.stringify(incident), incident.createdAt],
    );
    inserted++;
    try {
      await indexIncident(incident as import('./vectorService.js').IncidentRecord);
    } catch {
      // optional when Bedrock unavailable
    }
  }

  return inserted;
}
