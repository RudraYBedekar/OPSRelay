import { queryOne } from '../db.js';
import { indexIncident, type IncidentRecord } from './vectorService.js';
import {
  buildAlertText,
  evaluateDuplicateCandidate,
  recordAlertForIncident,
  incrementSuppressedCount,
} from './alertFatigueService.js';
import { projectIncidentEvidence } from './evidenceProjectionService.js';
import { processJobBatch } from './incidentJobService.js';
import type { JobType } from '../types/analysis.js';

async function handleJob(incidentId: string, jobType: JobType): Promise<void> {
  const row = await queryOne<{ data: IncidentRecord & {
    ownerMemberId?: string;
    analysisStatus?: string;
    duplicateCandidate?: { matchedAlertId?: string };
  } }>(
    'SELECT data FROM incidents WHERE id = $1',
    [incidentId],
  );
  if (!row) throw new Error('incident_not_found');

  const incident = row.data;
  const ownerMemberId = incident.ownerMemberId;
  if (!ownerMemberId) throw new Error('incident_no_owner');

  switch (jobType) {
    case 'index_incident_vector':
      await indexIncident(incident);
      break;
    case 'evaluate_alert_duplicate': {
      const alertText = buildAlertText({
        title: incident.title,
        summary: incident.summary,
        rawNotes: incident.rawNotes,
      });
      const dup = await evaluateDuplicateCandidate(alertText, incident.service, ownerMemberId);
      if (dup.state === 'candidate' && dup.matchedAlertId) {
        await incrementSuppressedCount(dup.matchedAlertId, ownerMemberId);
        incident.duplicateCandidate = {
          state: 'candidate',
          matchedAlertId: dup.matchedAlertId,
          matchedIncidentId: dup.matchedIncidentId,
          similarity: dup.similarity,
          message: dup.message,
        };
      } else {
        await recordAlertForIncident(alertText, incident.service, incidentId, ownerMemberId);
        incident.duplicateCandidate = { state: 'none' };
      }
      const { query } = await import('../db.js');
      await query(
        'UPDATE incidents SET data = $2::jsonb, updated_at = now() WHERE id = $1',
        [incidentId, JSON.stringify(incident)],
      );
      break;
    }
    case 'project_mcp_evidence':
      if (incident.analysisStatus !== 'approved') return;
      await projectIncidentEvidence({
        incidentId,
        title: incident.title,
        service: incident.service,
        severity: incident.severity,
        status: String(incident.status ?? 'INVESTIGATING'),
        summary: incident.summary,
        fixesApplied: incident.fixesApplied,
        decisions: incident.decisions as Array<{ title: string; description?: string }> | undefined,
        tasks: incident.tasks as Array<{ title: string }> | undefined,
        sourceUpdatedAt: new Date().toISOString(),
      });
      break;
    default:
      throw new Error('unknown_job');
  }
}

export function startJobWorker(intervalMs = 15_000): NodeJS.Timeout {
  return setInterval(() => {
    void processJobBatch(handleJob).catch((err) => {
      console.warn('Job worker error:', err instanceof Error ? err.message : err);
    });
  }, intervalMs);
}
