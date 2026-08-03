export const PROMPT_VERSION = 'extraction-v1';

export type AnalysisStatus =
  | 'not_started'
  | 'running'
  | 'review_required'
  | 'failed'
  | 'approved';

export type JobType =
  | 'index_incident_vector'
  | 'evaluate_alert_duplicate'
  | 'project_mcp_evidence';

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed';
