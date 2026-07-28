/** Rule-based extraction when Bedrock is disabled or unavailable */



import { buildExecutiveSummary } from '../utils/summaryFormat.js';



export function fallbackExtract(rawNotes: string) {

  const lower = rawNotes.toLowerCase();

  let severity = 'SEV-2';

  let severityReason = 'Moderate service degradation observed; full user impact has not been confirmed.';

  if (lower.includes('oom') || lower.includes('crashloop') || lower.includes('sev-0') || lower.includes('outage')) {

    severity = 'SEV-0';

    severityReason = 'Critical outage indicators detected (service down, crash loop, or explicit SEV-0 classification).';

  } else if (lower.includes('pgbouncer') || lower.includes('exhausted') || lower.includes('500') || lower.includes('sev-1') || lower.includes('db')) {

    severity = 'SEV-1';

    severityReason = 'Major degradation indicated by elevated error rates or database connection exhaustion.';

  } else if (lower.includes('minor') || lower.includes('slow') || lower.includes('warning')) {

    severity = 'SEV-3';

    severityReason = 'Low-severity warning signals with limited expected user impact.';

  }



  let service = 'billing-service';

  let component = 'pgbouncer-pool';

  if (lower.includes('auth') || lower.includes('jwt')) {

    service = 'auth-service';

    component = 'k8s-pod-memory';

  } else if (lower.includes('stripe') || lower.includes('payment') || lower.includes('webhook')) {

    service = 'payment-gateway';

    component = 'stripe-listener';

  } else if (lower.includes('redis') || lower.includes('cache') || lower.includes('cockroach')) {

    service = 'cache-cluster';

    component = 'cockroachdb-node';

  }



  const now = new Date();

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });



  return {

    severity,

    severityReason,

    service,

    component,

    summary: buildExecutiveSummary({ service, component, severity, rawNotes }),

    confidenceScore: 88,

    timeline: [

      {

        timestamp: timeStr,

        title: 'Incident signal detected',

        description: 'OpsRelay received unstructured log input and initiated automated triage (fallback mode).',

        actor: 'OpsRelay AI',

        type: 'detection',

      },

    ],

    decisions: [],

    tasks: [

      {

        title: `Investigate root cause for ${service}`,

        assignee: 'Unassigned (Ops Team)',

        status: 'TODO',

        priority: severity === 'SEV-0' || severity === 'SEV-1' ? 'CRITICAL' : 'HIGH',

        severity,

        createdAt: now.toISOString(),

      },

    ],

    suggestedFixes: [`Validate ${service} health metrics and error budgets`, 'Review recent deployments and configuration changes'],

  };

}


