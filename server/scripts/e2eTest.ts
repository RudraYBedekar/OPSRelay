/**
 * End-to-end API + database verification tests.
 * Run: npm run test:e2e
 */
import 'dotenv/config';
import pg from 'pg';
import { CRDB_DATABASE, withDatabase } from '../dbConfig.js';

const API = `http://localhost:${process.env.PORT ?? 3001}/api`;
const DB_URL = withDatabase(process.env.DATABASE_URL ?? '', CRDB_DATABASE);
const E2E_EMAIL = process.env.E2E_LOGIN_EMAIL ?? 'yash@opsrelay.io';
const E2E_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? process.env.SEED_DEFAULT_PASSWORD ?? 'OpsRelay2026!';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];
let authToken: string | null = null;

function pass(name: string, detail: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ✅ ${name} — ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ❌ ${name} — ${detail}`);
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (authToken && path !== '/auth/login') {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API}${path}`, {
    headers,
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

async function queryDb<T extends pg.QueryResultRow>(sql: string, params?: unknown[]) {
  const pool = new pg.Pool({ connectionString: DB_URL });
  try {
    return (await pool.query<T>(sql, params)).rows;
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('\n=== OpsRelay E2E Tests ===\n');

  // 1. Health
  try {
    const health = await api<{ status: string; bedrock: { enabled: boolean }; auth?: { enabled: boolean } }>('/health');
    if (health.status === 'ok') {
      pass('Health check', `DB ok, Bedrock ${health.bedrock?.enabled ? 'on' : 'off'}, auth ${health.auth?.enabled ? 'on' : 'off'}`);
    } else fail('Health check', `status=${health.status}`);
  } catch (e) {
    fail('Health check', e instanceof Error ? e.message : 'failed');
    console.log('\n⚠️  Start the API first: npm run dev:all\n');
    process.exit(1);
  }

  // 1b. Auth login
  try {
    const login = await api<{ token: string; user: { email: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
    });
    authToken = login.token;
    pass('Auth login', `${login.user.name} (${login.user.email})`);
  } catch (e) {
    fail('Auth login', e instanceof Error ? e.message : 'failed — run npm run db:seed-secure to create users');
    console.log('\n⚠️  Seed secure users first: npm run db:seed-secure\n');
    process.exit(1);
  }

  // 1c. Reject unauthenticated API access
  try {
    const res = await fetch(`${API}/incidents`);
    if (res.status === 401) pass('Auth protection', 'Unauthenticated /incidents returns 401');
    else fail('Auth protection', `Expected 401, got ${res.status}`);
  } catch (e) {
    fail('Auth protection', e instanceof Error ? e.message : 'failed');
  }

  // 2. Sample logs in DB
  try {
    const logs = await api<Array<{ id: string; title: string }>>('/sample-logs');
    const dbCount = await queryDb<{ n: number }>('SELECT count(*)::int AS n FROM sample_logs');
    if (logs.length >= 12 && Number(dbCount[0].n) === logs.length) {
      pass('Sample logs', `${logs.length} in API = ${dbCount[0].n} in DB`);
    } else {
      fail('Sample logs', `API=${logs.length}, DB=${dbCount[0]?.n}`);
    }
  } catch (e) {
    fail('Sample logs', e instanceof Error ? e.message : 'failed');
  }

  // 3. Dashboard data
  try {
    const [metrics, incidents, tasks] = await Promise.all([
      api<{ activeSev0Sev1: number }>('/metrics'),
      api<unknown[]>('/incidents'),
      api<unknown[]>('/tasks'),
    ]);
    const dbIncidents = await queryDb<{ n: number }>('SELECT count(*)::int AS n FROM incidents');
    if (Number(dbIncidents[0].n) === incidents.length) {
      pass('Incidents list', `${incidents.length} incidents (API matches DB)`);
    } else {
      fail('Incidents list', `API=${incidents.length}, DB=${dbIncidents[0]?.n}`);
    }
    pass('Metrics', `SEV-0/1 count=${metrics.activeSev0Sev1}`);
    pass('Tasks', `${tasks.length} tasks loaded`);
  } catch (e) {
    fail('Dashboard data', e instanceof Error ? e.message : 'failed');
  }

  // 4. AI Extract (error log sample)
  let extractedService = '';
  try {
    const sample = await api<{ id: string; content: string; title: string }>('/sample-logs/log-013');
    const extracted = await api<{ severity: string; service: string; source?: string }>('/extract', {
      method: 'POST',
      body: JSON.stringify({ rawNotes: sample.content }),
    });
    extractedService = extracted.service;
    const hasSeverity = ['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3'].includes(extracted.severity);
    if (hasSeverity && extracted.service) {
      pass('AI Extract (log-013 CRDB error)', `${extracted.severity} / ${extracted.service}`);
    } else {
      fail('AI Extract', JSON.stringify(extracted));
    }
  } catch (e) {
    fail('AI Extract', e instanceof Error ? e.message : 'failed');
  }

  // 5. Save incident to DB
  const testId = `INC-E2E-${Date.now().toString().slice(-6)}`;
  try {
    const incident = {
      id: testId,
      title: 'E2E Test — CRDB Replica Lag',
      service: extractedService || 'billing-service',
      component: 'crdb-replica',
      severity: 'SEV-0',
      status: 'INVESTIGATING',
      summary: 'Automated e2e test incident saved from log-013 extraction flow.',
      createdAt: new Date().toISOString(),
      leadSRE: 'E2E Test Runner',
      shiftId: 'SHIFT-E2E',
      aiConfidence: 95,
      timeline: [],
      decisions: [],
      fixesApplied: ['Split hot range on billing_events'],
      tasks: [],
      similarIncidents: [],
    };
    await api('/incidents', { method: 'POST', body: JSON.stringify(incident) });

    const rows = await queryDb<{ id: string; title: string }>(
      'SELECT id, data->>\'title\' AS title FROM incidents WHERE id = $1',
      [testId],
    );
    if (rows[0]?.id === testId) {
      pass('Save incident to DB', `${testId} persisted in incidents table`);
    } else {
      fail('Save incident to DB', 'Row not found after POST');
    }
  } catch (e) {
    fail('Save incident to DB', e instanceof Error ? e.message : 'failed');
  }

  // 6. Agent / Ask AI
  try {
    const agent = await api<{ answer: string; mode: string; similarIncidents: unknown[] }>('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ query: 'What caused CockroachDB connection pool errors?' }),
    });
    if (agent.answer?.length > 50) {
      pass('Ask AI agent', `${agent.mode} mode, ${agent.similarIncidents?.length ?? 0} matches, ${agent.answer.length} chars`);
    } else {
      fail('Ask AI agent', 'Empty or short answer');
    }
  } catch (e) {
    fail('Ask AI agent', e instanceof Error ? e.message : 'failed');
  }

  // 7. Task status update
  try {
    const tasks = await api<Array<{ id: string; status: string }>>('/tasks');
    const open = tasks.find((t) => t.status === 'TODO');
    if (open) {
      const updated = await api<{ status: string }>(`/tasks/${open.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      pass('Task update', `${open.id} → ${updated.status}`);
      // revert
      await api(`/tasks/${open.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'TODO' }),
      });
    } else {
      pass('Task update', 'skipped (no TODO tasks)');
    }
  } catch (e) {
    fail('Task update', e instanceof Error ? e.message : 'failed');
  }

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  const tables = await queryDb<{ table_name: string; rows: number }>(`
    SELECT 'incidents' AS table_name, count(*)::int AS rows FROM incidents
    UNION ALL SELECT 'sample_logs', count(*)::int FROM sample_logs
    UNION ALL SELECT 'incident_embeddings', count(*)::int FROM incident_embeddings
    UNION ALL SELECT 'memory_chats', count(*)::int FROM memory_chats
  `);
  console.log('Database row counts:');
  console.table(tables);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
