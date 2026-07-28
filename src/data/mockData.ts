import type { Incident, ShiftHandoff, DashboardMetrics, MemoryChatMessage } from '../types/incident';

export const INITIAL_METRICS: DashboardMetrics = {
  totalIncidents24h: 18,
  activeSev0Sev1: 3,
  avgMttrMinutes: 32,
  aiExtractionAccuracy: 96.4,
  openTasksCount: 12,
  timeSavedHours: 48.5,
};

export const INITIAL_HANDOFF: ShiftHandoff = {
  shiftId: 'SHIFT-20260726-US-EAST',
  timestamp: '2026-07-26T18:00:00Z',
  outgoingLead: 'Rudra (Staff SRE)',
  incomingLead: 'Yash (Lead Ops Commander)',
  activeSevCount: 3,
  openTasksCount: 12,
  keySummaries: [
    'SEV-1 Active: API Gateway Kong rate limit misconfiguration — 429 storm on mobile clients.',
    'SEV-0 Open: Auth-service OOMKilled under JWT key rotation load in us-east-1.',
    'SEV-1 Investigating: CockroachDB connection pool exhaustion in billing-service checkout path.',
    'SEV-2 Mitigated: CDN invalidation storm — stale assets in APAC region.'
  ],
  handshakeStatus: 'PENDING',
};

export const SAMPLE_INCIDENTS: Incident[] = [
  {
    id: 'INC-8942',
    title: 'CockroachDB Connection Pool Exhaustion in Billing Microservice',
    service: 'billing-service',
    component: 'db-pool-pgbouncer',
    severity: 'SEV-1',
    status: 'INVESTIGATING',
    summary: 'High HTTP 500 spike (38% rate) in checkout endpoint due to exhausted CockroachDB backend connections. OpsRelay extracted root cause as unclosed gRPC transaction leaks in billing v2.4 deployment.',
    createdAt: '2026-07-25T17:15:00Z',
    leadSRE: 'Rudra',
    shiftId: 'SHIFT-20260725-US-EAST',
    aiConfidence: 96,
    timeline: [
      {
        id: 'tl-1',
        timestamp: '17:15:02',
        title: 'PagerDuty Alert Triggered',
        description: 'billing-service error rate > 5% threshold (Actual: 38.2%)',
        actor: 'PagerDuty',
        type: 'alert'
      },
      {
        id: 'tl-2',
        timestamp: '17:18:40',
        title: 'OpsRelay AI Extraction Initiated',
        description: 'Auto-scraped Slack #inc-billing logs, PgBouncer metrics, and Datadog trace dumps.',
        actor: 'OpsRelay AI',
        type: 'detection'
      },
      {
        id: 'tl-3',
        timestamp: '17:22:10',
        title: 'Mitigation Decision Logged',
        description: 'Increased PgBouncer pool_size from 100 to 250 temporary capacity.',
        actor: 'SRE Team',
        type: 'decision'
      },
      {
        id: 'tl-4',
        timestamp: '17:35:00',
        title: 'Hotfix Deployed',
        description: 'Applied patch v2.4.1 disabling connection leakage on retry loops.',
        actor: 'SRE Team',
        type: 'fix'
      }
    ],
    decisions: [
      {
        id: 'dec-1',
        title: 'Bypass Read Replicas during Triage',
        description: 'Rerouted read queries to primary cluster nodes while PgBouncer pool expanded.',
        madeBy: 'Rudra',
        timestamp: '17:22:10',
        impact: 'Reduced downstream timeout cascade by 82% within 3 minutes.'
      },
      {
        id: 'dec-2',
        title: 'Freeze Billing v2.4 Rollout',
        description: 'Halted progressive canary deployment in us-west-2 region.',
        madeBy: 'Yash',
        timestamp: '17:28:00',
        impact: 'Prevented outage propagation to 40% of active user sessions.'
      }
    ],
    fixesApplied: [
      'Increased PgBouncer default_pool_size to 250 in us-east-1 helm values.',
      'Merged PR #4812: Graceful context timeout on SQL transaction release.',
      'Added alerts for DB connection utilization > 85%.'
    ],
    tasks: [
      {
        id: 'tsk-101',
        incidentId: 'INC-8942',
        incidentTitle: 'CockroachDB Connection Pool Exhaustion in Billing Microservice',
        title: 'Audit all gRPC context deadlines across billing-service database handlers',
        assignee: 'Devon Vance',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        severity: 'SEV-1',
        createdAt: '2026-07-25T17:40:00Z'
      },
      {
        id: 'tsk-102',
        incidentId: 'INC-8942',
        incidentTitle: 'CockroachDB Connection Pool Exhaustion in Billing Microservice',
        title: 'Deploy Grafana dashboard panel for CockroachDB pending lease requests',
        assignee: 'Elena Rostova',
        status: 'TODO',
        priority: 'HIGH',
        severity: 'SEV-1',
        createdAt: '2026-07-25T17:45:00Z'
      }
    ],
    similarIncidents: [
      {
        id: 'INC-7810',
        title: 'PgBouncer Max Client Connection Limit Reached in Auth Pods',
        similarityScore: 94,
        service: 'auth-service',
        resolvedDuration: '22 mins',
        keyTakeaway: 'Idle connection timeouts were set to infinity; tuned idle_transaction_timeout to 30s.',
        citations: ['Slack #inc-7810', 'Postmortem Doc #PM-309'],
        severity: 'SEV-1',
        resolvedDate: '2026-06-12'
      },
      {
        id: 'INC-6520',
        title: 'CockroachDB Range Lease Starvation under High Write Throughput',
        similarityScore: 88,
        service: 'billing-service',
        resolvedDuration: '45 mins',
        keyTakeaway: 'Split large range partitions manually using CRDB CLI to distribute leaseholders.',
        citations: ['OpsRelay Memory Log #MEM-91', 'Runbook: CRDB-Lease-Triage'],
        severity: 'SEV-2',
        resolvedDate: '2026-05-04'
      }
    ]
  },
  {
    id: 'INC-8941',
    title: 'Kubernetes Auth-Service OOMKilled in Production Cluster',
    service: 'auth-service',
    component: 'k8s-pod-memory',
    severity: 'SEV-0',
    status: 'OPEN',
    summary: 'Auth service pods crashing every 12 minutes in us-east-1 due to rapid RSS memory inflation following JWT verification key rotation batch job.',
    createdAt: '2026-07-25T18:10:00Z',
    leadSRE: 'Marcus Brody',
    shiftId: 'SHIFT-20260725-US-EAST',
    aiConfidence: 98,
    timeline: [
      {
        id: 'tl-10',
        timestamp: '18:10:00',
        title: 'K8s OOMKilled Event',
        description: 'Pod auth-service-7f98b9-x291 terminated with exit code 137 (OOM)',
        actor: 'K8s Cluster',
        type: 'alert'
      },
      {
        id: 'tl-11',
        timestamp: '18:12:30',
        title: 'Memory Leak Analysis',
        description: 'Heap profile shows Go map holding 1.2M cache entries without TTL expiration.',
        actor: 'OpsRelay AI',
        type: 'detection'
      }
    ],
    decisions: [
      {
        id: 'dec-10',
        title: 'Double Pod Memory Limit to 4Gi temporary bandaid',
        description: 'Patched Deployment spec memory limits from 2Gi to 4Gi to buy triage time.',
        madeBy: 'Marcus Brody',
        timestamp: '18:15:00',
        impact: 'Extended crash interval from 12 mins to ~55 mins.'
      }
    ],
    fixesApplied: [
      'Scale replicas from 6 to 12 to distribute memory load temporarily.'
    ],
    tasks: [
      {
        id: 'tsk-103',
        incidentId: 'INC-8941',
        incidentTitle: 'Kubernetes Auth-Service OOMKilled in Production Cluster',
        title: 'Implement LRU eviction with maximum 50,000 keys for JWT cache map',
        assignee: 'Marcus Brody',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        severity: 'SEV-0',
        createdAt: '2026-07-25T18:20:00Z'
      },
      {
        id: 'tsk-104',
        incidentId: 'INC-8941',
        incidentTitle: 'Kubernetes Auth-Service OOMKilled in Production Cluster',
        title: 'Verify memory pprof profile under synthetic load testing in staging environment',
        assignee: 'Yash',
        status: 'TODO',
        priority: 'HIGH',
        severity: 'SEV-0',
        createdAt: '2026-07-25T18:25:00Z'
      }
    ],
    similarIncidents: [
      {
        id: 'INC-8112',
        title: 'Go Routine and Cache Leak in Auth-Service Token Validator',
        similarityScore: 97,
        service: 'auth-service',
        resolvedDuration: '35 mins',
        keyTakeaway: 'Uncapped map cache grew unbounded during key refresh cycles.',
        citations: ['GitHub PR #3104', 'Datadog Flamegraph #FG-88'],
        severity: 'SEV-1',
        resolvedDate: '2026-06-29'
      }
    ]
  },
  {
    id: 'INC-8938',
    title: 'Stripe Payment Gateway Webhook Delivery Failure',
    service: 'payment-gateway',
    component: 'stripe-webhook-listener',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Stripe webhook event processing delayed by up to 14 minutes due to deadlocks on database idempotency locks.',
    createdAt: '2026-07-25T12:00:00Z',
    resolvedAt: '2026-07-25T12:45:00Z',
    mttrMinutes: 45,
    leadSRE: 'Yash',
    shiftId: 'SHIFT-20260725-EU-WEST',
    aiConfidence: 93,
    timeline: [
      {
        id: 'tl-20',
        timestamp: '12:00:00',
        title: 'Webhook Backlog Alert',
        description: 'Stripe queue depth exceeded 10,000 pending items.',
        actor: 'System Monitor',
        type: 'alert'
      },
      {
        id: 'tl-21',
        timestamp: '12:45:00',
        title: 'Queue Drain Complete',
        description: 'Redis lock TTL lowered from 120s to 5s. Processing rate normalized.',
        actor: 'OpsRelay AI',
        type: 'fix'
      }
    ],
    decisions: [],
    fixesApplied: [
      'Updated Redis locking strategy to rely on redlock with automatic 5s expiration.',
      'Replayed 14,200 failed webhook events via Stripe CLI batch backfill tool.'
    ],
    tasks: [
      {
        id: 'tsk-105',
        incidentId: 'INC-8938',
        incidentTitle: 'Stripe Payment Gateway Webhook Delivery Failure',
        title: 'Add automated dead-letter queue recovery job for failed webhook payloads',
        assignee: 'Yash',
        status: 'COMPLETED',
        priority: 'MEDIUM',
        severity: 'SEV-2',
        createdAt: '2026-07-25T12:50:00Z'
      }
    ],
    similarIncidents: []
  },
  {
    id: 'INC-8920',
    title: 'Redis Cache Cluster Split-Brain during AWS Availability Zone Network Partition',
    service: 'cache-cluster',
    component: 'redis-sentinel',
    severity: 'SEV-1',
    status: 'RESOLVED',
    summary: 'AWS us-east-1a network partition caused Redis Sentinel to elect duplicate master nodes, corrupting session cache keys.',
    createdAt: '2026-07-24T22:15:00Z',
    resolvedAt: '2026-07-24T23:05:00Z',
    mttrMinutes: 50,
    leadSRE: 'Rudra',
    shiftId: 'SHIFT-20260724-US-EAST',
    aiConfidence: 95,
    timeline: [
      {
        id: 'tl-30',
        timestamp: '22:15:00',
        title: 'AZ Partition Detected',
        description: 'AWS CloudWatch network packet drop alert in us-east-1a',
        actor: 'System Monitor',
        type: 'alert'
      }
    ],
    decisions: [],
    fixesApplied: [
      'Migrated cluster quorum to 5 Sentinels across 3 distinct AZs.',
      'Flushed session cache partition and forced re-authentication for affected sessions.'
    ],
    tasks: [
      {
        id: 'tsk-106',
        incidentId: 'INC-8920',
        incidentTitle: 'Redis Cache Cluster Split-Brain during AWS AZ Network Partition',
        title: 'Upgrade Sentinel quorum configuration to min-slaves-to-write=1',
        assignee: 'Rudra',
        status: 'COMPLETED',
        priority: 'HIGH',
        severity: 'SEV-1',
        createdAt: '2026-07-24T23:15:00Z'
      }
    ],
    similarIncidents: []
  },
  {
    id: 'INC-8955',
    title: 'CDN Edge Cache Invalidation Storm — Stale Assets Globally',
    service: 'cdn-edge',
    component: 'cloudfront-invalidation',
    severity: 'SEV-2',
    status: 'MITIGATED',
    summary: 'Deploy pipeline triggered 2,400 CloudFront invalidations in 10 minutes, hitting AWS rate limits. Users in APAC saw stale JS bundles for ~25 minutes.',
    createdAt: '2026-07-26T08:30:00Z',
    leadSRE: 'Priya Patel',
    shiftId: 'SHIFT-20260726-APAC',
    aiConfidence: 91,
    timeline: [
      { id: 'tl-40', timestamp: '08:30:00', title: 'Support Ticket Spike', description: '47 tickets: UI not updating after deploy v3.8.0', actor: 'System Monitor', type: 'alert' },
      { id: 'tl-41', timestamp: '08:38:00', title: 'Invalidation Queue Full', description: 'CloudFront API returning 503 on batch invalidation requests', actor: 'OpsRelay AI', type: 'detection' },
      { id: 'tl-42', timestamp: '08:55:00', title: 'Mitigation Applied', description: 'Paused auto-invalidation; manual wildcard purge on /assets/*', actor: 'SRE Team', type: 'fix' }
    ],
    decisions: [
      { id: 'dec-20', title: 'Throttle deploy invalidations to 50/min', description: 'Added rate limiter in CI pipeline for CloudFront API calls', madeBy: 'Priya Patel', timestamp: '08:45:00', impact: 'Prevented further API throttling during recovery.' }
    ],
    fixesApplied: ['Manual wildcard invalidation on /assets/*', 'CI pipeline rate limit: max 50 invalidations per deploy'],
    tasks: [
      { id: 'tsk-107', incidentId: 'INC-8955', incidentTitle: 'CDN Edge Cache Invalidation Storm', title: 'Add invalidation batching to deploy pipeline', assignee: 'Priya Patel', status: 'TODO', priority: 'HIGH', severity: 'SEV-2', createdAt: '2026-07-26T09:00:00Z' }
    ],
    similarIncidents: []
  },
  {
    id: 'INC-8958',
    title: 'Datadog Agent Memory Leak on Monitoring Nodes',
    service: 'observability',
    component: 'datadog-agent',
    severity: 'SEV-3',
    status: 'OPEN',
    summary: 'Datadog agent RSS grew from 512MB to 3.2GB over 72 hours on 8 monitoring nodes, causing node pressure and pod evictions on shared k8s workers.',
    createdAt: '2026-07-26T10:15:00Z',
    leadSRE: 'James Wu',
    shiftId: 'SHIFT-20260726-US-EAST',
    aiConfidence: 89,
    timeline: [
      { id: 'tl-50', timestamp: '10:15:00', title: 'Node Memory Pressure', description: 'K8s MemoryPressure on worker nodes running datadog-agent DaemonSet', actor: 'K8s Cluster', type: 'alert' },
      { id: 'tl-51', timestamp: '10:22:00', title: 'Agent Version Identified', description: 'Leak correlates with datadog-agent v7.52.0 rollout', actor: 'OpsRelay AI', type: 'detection' }
    ],
    decisions: [],
    fixesApplied: ['Pinned datadog-agent to v7.51.1 on affected nodes'],
    tasks: [
      { id: 'tsk-108', incidentId: 'INC-8958', incidentTitle: 'Datadog Agent Memory Leak', title: 'Open ticket with Datadog support for v7.52.0 leak', assignee: 'James Wu', status: 'IN_PROGRESS', priority: 'MEDIUM', severity: 'SEV-3', createdAt: '2026-07-26T10:30:00Z' },
      { id: 'tsk-109', incidentId: 'INC-8958', incidentTitle: 'Datadog Agent Memory Leak', title: 'Add memory limit alerts on monitoring node pool', assignee: 'Elena Rostova', status: 'TODO', priority: 'MEDIUM', severity: 'SEV-3', createdAt: '2026-07-26T10:35:00Z' }
    ],
    similarIncidents: []
  },
  {
    id: 'INC-8962',
    title: 'API Gateway Rate Limiter Misconfiguration — 429 Storm',
    service: 'api-gateway',
    component: 'kong-rate-limit',
    severity: 'SEV-1',
    status: 'INVESTIGATING',
    summary: 'Kong rate limit plugin accidentally set to 10 req/min (was 10 req/sec) after config migration. Mobile app users mass-logged out; 62% of API calls returned 429.',
    createdAt: '2026-07-26T11:45:00Z',
    leadSRE: 'Yash',
    shiftId: 'SHIFT-20260726-US-EAST',
    aiConfidence: 97,
    rawNotes: 'Config migration PR #5201 changed rate limit units from rps to rpm by mistake. Rollback in progress. Mobile clients retrying aggressively making it worse.',
    timeline: [
      { id: 'tl-60', timestamp: '11:45:00', title: '429 Rate Spike', description: 'api-gateway 429 rate > 40% for 5 min', actor: 'PagerDuty', type: 'alert' },
      { id: 'tl-61', timestamp: '11:50:00', title: 'Bad Config Found', description: 'Kong plugin config shows 10/min instead of 10/sec', actor: 'OpsRelay AI', type: 'detection' },
      { id: 'tl-62', timestamp: '11:55:00', title: 'Rollback Started', description: 'Reverting Kong declarative config to previous Git SHA', actor: 'SRE Team', type: 'action' }
    ],
    decisions: [
      { id: 'dec-30', title: 'Emergency config rollback', description: 'Revert Kong config to pre-migration state immediately', madeBy: 'Yash', timestamp: '11:52:00', impact: '429 rate dropped from 62% to 8% within 4 minutes.' }
    ],
    fixesApplied: ['Reverted Kong rate limit config to 10 req/sec'],
    tasks: [
      { id: 'tsk-110', incidentId: 'INC-8962', incidentTitle: 'API Gateway Rate Limiter Misconfiguration', title: 'Add config validation test for rate limit units in CI', assignee: 'Devon Vance', status: 'TODO', priority: 'CRITICAL', severity: 'SEV-1', createdAt: '2026-07-26T12:00:00Z' }
    ],
    similarIncidents: [
      { id: 'INC-8100', title: 'Kong Plugin Config Drift in Staging', similarityScore: 85, service: 'api-gateway', resolvedDuration: '18 mins', keyTakeaway: 'Added declarative config diff check in deploy pipeline.', citations: ['Postmortem #PM-412'], severity: 'SEV-2', resolvedDate: '2026-06-20' }
    ]
  },
  {
    id: 'INC-8965',
    title: 'CockroachDB Replica Lag Spike — Analytics Workload',
    service: 'cockroachdb-cluster',
    component: 'read-replica',
    severity: 'SEV-2',
    status: 'OPEN',
    summary: 'Read replica lag on analytics-db-02 reached 78 seconds during nightly ETL job. SLA is 30s. Heavy full-table scans on orders_archive suspected.',
    createdAt: '2026-07-26T02:00:00Z',
    leadSRE: 'Rudra',
    shiftId: 'SHIFT-20260725-US-EAST',
    aiConfidence: 94,
    timeline: [
      { id: 'tl-70', timestamp: '02:00:00', title: 'Replica Lag Alert', description: 'follower_read_timestamp lag > 30s on node analytics-db-02', actor: 'System Monitor', type: 'alert' },
      { id: 'tl-71', timestamp: '02:15:00', title: 'Long Query Identified', description: 'ETL job scan on orders_archive — 45M rows, no index on created_at', actor: 'OpsRelay AI', type: 'detection' }
    ],
    decisions: [
      { id: 'dec-40', title: 'Pause ETL until index added', description: 'Stop nightly archive scan to prevent further lag', madeBy: 'Rudra', timestamp: '02:20:00', impact: 'Lag stabilized at 12s within 10 minutes.' }
    ],
    fixesApplied: ['Paused ETL job on orders_archive table'],
    tasks: [
      { id: 'tsk-111', incidentId: 'INC-8965', incidentTitle: 'CockroachDB Replica Lag Spike', title: 'CREATE INDEX on orders_archive(created_at)', assignee: 'Rudra', status: 'IN_PROGRESS', priority: 'HIGH', severity: 'SEV-2', createdAt: '2026-07-26T02:30:00Z' },
      { id: 'tsk-112', incidentId: 'INC-8965', incidentTitle: 'CockroachDB Replica Lag Spike', title: 'Route analytics queries to dedicated read pool', assignee: 'Elena Rostova', status: 'TODO', priority: 'MEDIUM', severity: 'SEV-2', createdAt: '2026-07-26T02:35:00Z' }
    ],
    similarIncidents: [
      { id: 'INC-8942', title: 'CockroachDB Connection Pool Exhaustion in Billing Microservice', similarityScore: 76, service: 'billing-service', resolvedDuration: 'ongoing', keyTakeaway: 'Connection pool tuning resolved checkout errors.', citations: ['INC-8942 timeline'], severity: 'SEV-1', resolvedDate: '2026-07-25' }
    ]
  },
  {
    id: 'INC-8970',
    title: 'Email Queue Backlog — SendGrid Rate Limit Hit',
    service: 'notification-service',
    component: 'sendgrid-api',
    severity: 'SEV-2',
    status: 'RESOLVED',
    summary: 'Transactional emails delayed up to 45 minutes. Marketing blast overlapped with password-reset surge, hitting SendGrid 100k/hour cap.',
    createdAt: '2026-07-25T06:00:00Z',
    resolvedAt: '2026-07-25T07:30:00Z',
    mttrMinutes: 90,
    leadSRE: 'Marcus Brody',
    shiftId: 'SHIFT-20260725-EU-WEST',
    aiConfidence: 92,
    timeline: [
      { id: 'tl-80', timestamp: '06:00:00', title: 'SendGrid 429 Responses', description: 'Mail API rate limit exceeded — 429 on 34% of sends', actor: 'System Monitor', type: 'alert' },
      { id: 'tl-81', timestamp: '06:20:00', title: 'Marketing Queue Paused', description: 'Paused bulk marketing sends to prioritize transactional', actor: 'SRE Team', type: 'decision' },
      { id: 'tl-82', timestamp: '07:30:00', title: 'Queue Drained', description: 'Backlog cleared; p99 delivery latency back to 12s', actor: 'OpsRelay AI', type: 'fix' }
    ],
    decisions: [
      { id: 'dec-50', title: 'Pause marketing email queue', description: 'Prioritize password-reset and billing emails over marketing', madeBy: 'Marcus Brody', timestamp: '06:20:00', impact: 'Transactional delivery restored within 30 minutes.' }
    ],
    fixesApplied: ['Paused marketing blast queue', 'Created separate SendGrid subaccount for transactional mail'],
    tasks: [
      { id: 'tsk-113', incidentId: 'INC-8970', incidentTitle: 'Email Queue Backlog', title: 'Implement priority queues for transactional vs marketing', assignee: 'Marcus Brody', status: 'COMPLETED', priority: 'HIGH', severity: 'SEV-2', createdAt: '2026-07-25T07:00:00Z' }
    ],
    similarIncidents: []
  },
  {
    id: 'INC-8975',
    title: 'Terraform State Lock — Deploy Pipeline Blocked',
    service: 'platform-infra',
    component: 'terraform-backend',
    severity: 'SEV-3',
    status: 'RESOLVED',
    summary: 'Stale DynamoDB lock from crashed CI runner blocked all infra deploys for 3 hours. 14 PRs queued waiting on terraform apply.',
    createdAt: '2026-07-24T14:00:00Z',
    resolvedAt: '2026-07-24T17:00:00Z',
    mttrMinutes: 180,
    leadSRE: 'Devon Vance',
    shiftId: 'SHIFT-20260724-US-EAST',
    aiConfidence: 88,
    timeline: [
      { id: 'tl-90', timestamp: '14:00:00', title: 'Lock Timeout Errors', description: 'terraform apply failing: Error acquiring state lock', actor: 'System Monitor', type: 'alert' },
      { id: 'tl-91', timestamp: '16:45:00', title: 'Force Unlock', description: 'Identified stale lock from runner ci-8842 killed mid-apply', actor: 'SRE Team', type: 'fix' }
    ],
    decisions: [],
    fixesApplied: ['Force-unlocked stale Terraform state lock', 'Added lock TTL monitoring alert'],
    tasks: [
      { id: 'tsk-114', incidentId: 'INC-8975', incidentTitle: 'Terraform State Lock', title: 'Add automatic stale lock cleanup job', assignee: 'Devon Vance', status: 'TODO', priority: 'LOW', severity: 'SEV-3', createdAt: '2026-07-24T17:15:00Z' }
    ],
    similarIncidents: []
  }
];

export const RAW_LOG_SAMPLE_TEMPLATES = [
  {
    id: 'log-001',
    title: 'CockroachDB Pool Leak',
    category: 'database',
    content: `[2026-07-25 17:14:22] ALERT pgbouncer_1: ERROR connection count 100/100 reached for DB 'billing_prod'
[2026-07-25 17:15:00] SLACK #inc-billing | alex.rivera: Users reporting HTTP 500 on /api/v2/checkout/pay! Datadog shows 38% error spike.
[2026-07-25 17:16:12] LOG billing-service-v2.4-78fd: dial tcp 10.0.4.12:6432: i/o timeout while acquiring SQL lease
[2026-07-25 17:18:00] SLACK #inc-billing | sarah.chen: gRPC client retry loops not closing connections when context cancels.
[2026-07-25 17:22:10] DECISION: Scaling PgBouncer default_pool_size from 100 to 250. Rerouting read queries.
[2026-07-25 17:35:00] FIX: Merged PR #4812 to fix transaction leak. Pushed hotfix v2.4.1.`,
  },
  {
    id: 'log-002',
    title: 'Auth-Service OOMKilled',
    category: 'kubernetes',
    content: `2026-07-25T18:10:02Z k8s-events: Pod auth-service-7f98b9-x291 in namespace prod OOMKilled (exit code 137). Memory limit 2048Mi exceeded (Current: 2054Mi).
2026-07-25T18:11:45Z datadog: Auth key rotation cron at 18:00Z. JWT verification key map grew to 1,240,000 entries — no eviction.
2026-07-25T18:15:00Z marcus.brody: Bumped deployment memory from 2Gi to 4Gi as temporary stopgap.
2026-07-25T18:18:00Z TASK: Implement LRU cache cap at 50k keys. Sarah running load test on /auth/verify.`,
  },
  {
    id: 'log-003',
    title: 'Elasticsearch Shard Unassigned',
    category: 'search',
    content: `2026-07-25T09:30:11Z es-cluster-01: CLUSTER HEALTH YELLOW — 4 unassigned primary shards on index logs-2026.07.25
2026-07-25T09:32:00Z ops-bot: Disk watermark high (92%) on es-node-03. Shard allocation locked.
2026-07-25T09:40:00Z DECISION: Purged index logs-2026.06.01 to free 140GB. Rerouted shards to es-node-01,02.`,
  },
  {
    id: 'log-004',
    title: 'API Gateway 429 Storm',
    category: 'gateway',
    content: `[2026-07-26 08:02:11] PagerDuty: Kong rate-limit plugin firing on route mobile-api-v3 — 12,400 req/min vs limit 8,000
[2026-07-26 08:03:30] SLACK #inc-platform | priya.shah: Mobile clients getting mass 429s. iOS app v4.2.1 retry storm suspected.
[2026-07-26 08:05:00] LOG kong-gateway: plugin rate-limiting exceeded for consumer mobile-prod-key-7a
[2026-07-26 08:08:00] DECISION: Raised burst limit 8k→15k temporarily. Enabled request coalescing on CDN edge.
[2026-07-26 08:15:00] FIX: Rolled back Kong plugin config from deploy kong-helm-3.8.2. Error rate dropped 429→0.2%.`,
  },
  {
    id: 'log-005',
    title: 'Redis Split-Brain Failover',
    category: 'cache',
    content: `2026-07-24T22:41:00Z redis-sentinel: +switch-master mymaster 10.0.8.12:6379 10.0.8.15:6379
2026-07-24T22:41:30Z session-service: ERROR WRONGTYPE Operation against a key holding the wrong kind of value (session:usr_*)
2026-07-24T22:43:00Z SLACK #inc-cache | devon.vance: Network partition between AZ-a and AZ-b caused dual master for 90 seconds.
2026-07-24T22:50:00Z DECISION: Forced failover to replica-02. Flushed corrupted session keys (approx 18k).
2026-07-24T23:05:00Z FIX: Updated sentinel quorum from 2→3. Added network partition detection alert.`,
  },
  {
    id: 'log-006',
    title: 'Stripe Webhook Failures',
    category: 'payments',
    content: `[2026-07-23 14:20:00] ALERT stripe-webhook-handler: HTTP 503 on POST /webhooks/stripe — 847 failures in 10 min
[2026-07-23 14:21:15] LOG payment-api: Signature verification failed — clock skew 312s between pod and Stripe timestamp
[2026-07-23 14:22:00] SLACK #inc-payments | jordan.lee: NTP drift on k8s node pool payments-np-3 after hypervisor maintenance.
[2026-07-23 14:30:00] DECISION: Drained payments-np-3. Replayed failed webhooks from Stripe dashboard (event IDs logged).
[2026-07-23 14:45:00] FIX: Enabled chrony sync DaemonSet. Added webhook replay dead-letter queue in SQS.`,
  },
  {
    id: 'log-007',
    title: 'Kafka Consumer Lag Spike',
    category: 'messaging',
    content: `2026-07-26T03:15:00Z datadog: kafka.consumer.lag max=2,400,000 on topic order-events partition 7
2026-07-26T03:16:30Z order-processor-5f8c: ERROR processing message — deserialization failed UnknownSchema id=88291
2026-07-26T03:18:00Z SLACK #inc-orders | alex.rivera: Schema registry v2 deployed without backward compat. Old consumers stuck.
2026-07-26T03:25:00Z DECISION: Rolled back schema registry. Reset consumer group order-processor-v3 offset to 2h ago.
2026-07-26T03:40:00Z TASK: Add schema compatibility CI check. Replay 1.2M messages from S3 archive.`,
  },
  {
    id: 'log-008',
    title: 'CDN Cache Invalidation Storm',
    category: 'cdn',
    content: `[2026-07-25 11:00:00] CloudFront: Invalidation batch inv-20260725-001 submitted — 4,200 paths (/*)
[2026-07-25 11:02:00] SLACK #inc-frontend | sarah.chen: Deploy script ran invalidate /* instead of /assets/v2/*. APAC users seeing stale JS bundles.
[2026-07-25 11:05:00] LOG edge-pop-sydney: Origin fetch rate 340% above baseline. Origin latency p99 2.8s.
[2026-07-25 11:10:00Z DECISION: Paused auto-invalidation in CI. Warmed cache from origin for top 50 paths manually.
[2026-07-25 11:30:00] FIX: Patched deploy script — require explicit path prefix. Added invalidation rate limit alert.`,
  },
  {
    id: 'log-009',
    title: 'Datadog Agent Memory Leak',
    category: 'observability',
    content: `2026-07-22T16:44:00Z k8s: Pod datadog-agent-xk9m on node worker-12 using 3.8Gi / 4Gi limit
2026-07-22T16:45:30Z worker-12: NODE MEMORY PRESSURE — evicting best-effort pods
2026-07-22T16:47:00Z SLACK #inc-infra | marcus.brody: DD agent 7.52.0 known leak with eBPF network monitoring enabled.
2026-07-22T16:55:00Z DECISION: Disabled eBPF NPM on affected daemonset. Restarted agents on 48 nodes rolling.
2026-07-22T17:10:00Z FIX: Pinned datadog-agent to 7.51.1. Opened vendor ticket #DD-88421.`,
  },
  {
    id: 'log-010',
    title: 'Lambda Timeout Cascade',
    category: 'serverless',
    content: `[2026-07-26 06:30:00] AWS CloudWatch: Lambda pdf-generator Duration Max=30000ms Timeout=30000ms (100% timeout rate)
[2026-07-26 06:31:00] SLACK #inc-docs | priya.shah: Invoice PDF queue backing up — 12,000 messages in SQS dead-letter not moving
[2026-07-26 06:32:15] LOG pdf-generator: Chromium headless OOM in 128MB lambda — puppeteer launch failed
[2026-07-26 06:38:00] DECISION: Increased Lambda memory 128→512MB and timeout 30→60s. Scaled concurrency 10→50.
[2026-07-26 06:50:00] FIX: Switched to pre-rendered HTML template. DLQ drained via replay Lambda.`,
  },
  {
    id: 'log-011',
    title: 'DNS Propagation Failure',
    category: 'network',
    content: `[2026-07-24 19:00:00] PagerDuty: External synthetic check failed — api.opsrelay.io resolve timeout (US, EU, APAC)
[2026-07-24 19:02:00] SLACK #inc-network | devon.vance: Route53 health check flipped unhealthy after TTL change 300→60 on apex record.
[2026-07-24 19:05:00] dig @8.8.8.8 api.opsrelay.io → NXDOMAIN intermittently
[2026-07-24 19:12:00] DECISION: Reverted TTL to 300. Failover to secondary CNAME api-failover.opsrelay.io.
[2026-07-24 19:25:00] FIX: Root cause — typo in Terraform route53 module v2.1.3. PR #4901 merged.`,
  },
  {
    id: 'log-012',
    title: 'Terraform State Lock',
    category: 'infrastructure',
    content: `[2026-07-24 17:10:00] CI pipeline deploy-prod: Error acquiring state lock — lock ID 8842 held by user jenkins@ci (created 2026-07-24 09:00:00)
[2026-07-24 17:11:00] SLACK #inc-infra | jordan.lee: Stale lock from aborted Friday deploy blocking all prod applies.
[2026-07-24 17:15:00] terraform force-unlock 8842 — approved by sarah.chen
[2026-07-24 17:20:00] DECISION: Added stale lock cleanup cron (locks >4h). Require force-unlock approval in Slack.
[2026-07-24 17:30:00] FIX: Deploy pipeline unblocked. Retro scheduled for Monday.`,
  },
  {
    id: 'log-013',
    title: 'CRDB Replica Lag SEV-0',
    category: 'database-error',
    content: `[2026-07-26 09:01:00] PagerDuty SEV-0: checkout-api error rate 62% — all writes timing out
[2026-07-26 09:01:22] ERROR crdb-node-4: replica r42/5 on n4 not leaseholder — replication lag 847s (threshold 30s)
[2026-07-26 09:02:00] SLACK #inc-db | alex.rivera: SHOW RANGES output — hot range on billing_events table, QPS 48k on single range
[2026-07-26 09:02:45] LOG checkout-api: ERROR sql: transaction rollback failed — context deadline exceeded (5000ms)
[2026-07-26 09:05:00] DECISION: Emergency ALTER TABLE ... SPLIT AT VALUES ('2026-07-26') on billing_events
[2026-07-26 09:18:00] FIX: Lag dropped to 4s. Added load-based auto-split alert at 10k QPS/range.`,
  },
  {
    id: 'log-014',
    title: 'CrashLoopBackOff Stack Trace',
    category: 'kubernetes-error',
    content: `2026-07-26T10:22:00Z k8s Warning BackOff: Back-off restarting failed container notification-worker in pod notification-worker-6d4f8-xk2
2026-07-26T10:22:15Z LOG notification-worker: panic: runtime error: invalid memory address or nil pointer dereference
goroutine 847 [running]:
notification/internal/dispatcher.(*Worker).Process(0xc0004a8000, ...)
    /app/internal/dispatcher/worker.go:142 +0x3a1
2026-07-26T10:23:00Z SLACK #inc-notify | sarah.chen: Deploy v3.2.0 introduced nil handler when SMS provider config missing
2026-07-26T10:25:00Z DECISION: Rolled back to v3.1.9. Scaled replicas 0 until patch ready.
2026-07-26T10:40:00Z FIX: PR #4920 null-check + fail-fast on missing TWILIO_SID at startup.`,
  },
  {
    id: 'log-015',
    title: 'SSL Cert Expired 502',
    category: 'security-error',
    content: `[2026-07-25 23:59:01] ALERT synthetic-monitor: HTTPS check failed — certificate has expired for api-mobile.opsrelay.io
[2026-07-26 00:00:30] ERROR nginx-ingress: SSL_do_handshake() failed (SSL: error:1416F086:SSL routines:tls_process_server_certificate:certificate verify failed)
[2026-07-26 00:01:00] SLACK #inc-sec | devon.vance: LetsEncrypt renewal cron failed silently since July 20 — cert-manager pod CrashLoop
[2026-07-26 00:01:30] LOG mobile-app: java.net.SSLHandshakeException: Certificate expired at 2026-07-25T23:59:00Z
[2026-07-26 00:08:00] DECISION: Manual cert-manager reinstall. Force cert renewal via kubectl cert-manager renew
[2026-07-26 00:22:00] FIX: Valid cert issued. Added 14-day expiry PagerDuty alert + cert-manager health check.`,
  },
  {
    id: 'log-016',
    title: 'Disk Full ENOSPC',
    category: 'infrastructure-error',
    content: `[2026-07-24 04:12:00] ERROR log-shipper-daemonset: write /var/log/pods/.../0.log: no space left on device (ENOSPC)
[2026-07-24 04:12:30] k8s Warning Evicted: Pod metrics-server-7x9 evicted — ephemeral-storage exceeded (limit 2Gi, used 2.1Gi)
[2026-07-24 04:13:00] SLACK #inc-infra | marcus.brody: Node worker-08 root volume 100% — debug pod logs not rotated since logrotate cron disabled in AMI v2.3
[2026-07-24 04:14:00] ERROR prometheus: scrape failed — target kubelet unreachable on worker-08
[2026-07-24 04:20:00] DECISION: Cordon worker-08. Truncate /var/log/*.log > 7 days. Expand EBS 100→200GB.
[2026-07-24 04:45:00] FIX: Re-enabled logrotate in node AMI. Added disk >85% alert on all workers.`,
  },
  {
    id: 'log-017',
    title: 'Circuit Breaker Open Storm',
    category: 'application-error',
    content: `[2026-07-26 13:45:00] ERROR inventory-service: Resilience4j CircuitBreaker 'payment-client' is OPEN — failures 52/50 in window 60s
[2026-07-26 13:45:30] ERROR inventory-service: HTTP 503 Service Unavailable — fallback returned empty stock for SKU-* (12,400 requests affected)
[2026-07-26 13:46:00] SLACK #inc-commerce | priya.shah: payment-service returning 500 — DB connection pool exhausted (see INC-8942). Inventory CB tripped.
[2026-07-26 13:46:30] LOG payment-service: ERROR HikariPool-1 - Connection is not available, request timed out after 30000ms
[2026-07-26 13:50:00] DECISION: Half-open CB manually. Increased payment-service pool 50→100. Enabled bulkhead isolation.
[2026-07-26 14:05:00] FIX: CB closed. Added dependency health dashboard linking payment↔inventory SLOs.`,
  },
];

export const INITIAL_MEMORY_CHATS: MemoryChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    text: 'Have we seen this CockroachDB connection pool leak or PgBouncer exhaustion before in billing or auth services?',
    timestamp: '17:42'
  },
  {
    id: 'msg-2',
    sender: 'assistant',
    text: 'Yes! OpsRelay found **2 closely matching historical incidents** in vector memory (94% and 88% similarity match).\n\n1. **INC-7810 (PgBouncer Max Client Limit in Auth Pods)** - Resolved in 22 mins on June 12.\n   * *Root cause:* Idle connections had no TTL, exhausting PgBouncer pool.\n   * *Fix applied:* Tuned `idle_transaction_timeout` to `30s` in Helm values.\n\n2. **INC-6520 (CockroachDB Range Lease Starvation)** - Resolved in 45 mins on May 4.\n   * *Fix applied:* Manually split large range partitions using CRDB CLI to distribute leaseholders.',
    timestamp: '17:42',
    matchedIncidents: [
      {
        id: 'INC-7810',
        title: 'PgBouncer Max Client Connection Limit Reached in Auth Pods',
        similarityScore: 94,
        service: 'auth-service',
        resolvedDuration: '22 mins',
        keyTakeaway: 'Tuned idle_transaction_timeout to 30s in PgBouncer config.',
        citations: ['Slack #inc-7810 archive', 'Postmortem #PM-309'],
        severity: 'SEV-1',
        resolvedDate: '2026-06-12'
      },
      {
        id: 'INC-6520',
        title: 'CockroachDB Range Lease Starvation under High Write Throughput',
        similarityScore: 88,
        service: 'billing-service',
        resolvedDuration: '45 mins',
        keyTakeaway: 'Split large range partitions manually using CRDB CLI.',
        citations: ['OpsRelay Memory Log #MEM-91', 'Runbook: CRDB-Lease-Triage'],
        severity: 'SEV-2',
        resolvedDate: '2026-05-04'
      }
    ],
    suggestedRunbooks: [
      {
        title: 'CockroachDB PgBouncer Pool Exhaustion Runbook',
        url: 'https://internal-wiki.opsrelay.io/runbooks/cockroachdb-pgbouncer-pool',
        codeSnippet: `SHOW max_connections;\nALTER ROLE billing SET idle_in_transaction_session_timeout = '15s';`
      }
    ]
  },
  {
    id: 'msg-3',
    sender: 'user',
    text: 'Any past incidents with Kong rate limiting or API gateway 429 errors?',
    timestamp: '12:05'
  },
  {
    id: 'msg-4',
    sender: 'assistant',
    text: 'Found **1 direct match** — **INC-8962** (Kong rate limit misconfiguration, SEV-1, currently investigating). Similar historical case **INC-8100** (Kong plugin config drift, resolved in 18 mins).\n\n*Recommended:* Roll back Kong declarative config and add unit validation for rate limit fields in CI.',
    timestamp: '12:05',
    matchedIncidents: [
      {
        id: 'INC-8962',
        title: 'API Gateway Rate Limiter Misconfiguration — 429 Storm',
        similarityScore: 96,
        service: 'api-gateway',
        resolvedDuration: 'ongoing',
        keyTakeaway: 'Config migration changed rps to rpm by mistake; rollback fixed 429 storm.',
        citations: ['Slack #inc-api-gateway', 'Kong config PR #5201'],
        severity: 'SEV-1',
        resolvedDate: '2026-07-26'
      }
    ]
  }
];
