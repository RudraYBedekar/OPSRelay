import {
  isValidMemberIdFormat,
  normalizeMemberId,
  type InvestigatorAccessScope,
} from '../services/incidentAccessService.js';

const INCIDENT_ID_PATTERN = /^INC-[A-Z0-9-]+$/i;
const MAX_SCOPE_LIST = 500;

export function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Build SQL authorization predicate for rendered MCP SELECT templates. */
export function buildOwnerScopeSql(scope: InvestigatorAccessScope): string {
  const parts: string[] = [];

  if (scope.allowedOwnerMemberIds.length > 0) {
    const owners = scope.allowedOwnerMemberIds.slice(0, MAX_SCOPE_LIST).map((id) => {
      if (!isValidMemberIdFormat(id)) {
        throw new Error('Invalid owner member ID in investigator scope');
      }
      return escapeSqlLiteral(normalizeMemberId(id));
    });
    parts.push(`source_owner_member_id IN (${owners.join(', ')})`);
  }

  if (scope.explicitlySharedIncidentIds.length > 0) {
    const ids = scope.explicitlySharedIncidentIds.slice(0, MAX_SCOPE_LIST).map((id) => {
      const normalized = id.trim().toUpperCase();
      if (!INCIDENT_ID_PATTERN.test(normalized)) {
        throw new Error('Invalid incident ID in investigator scope');
      }
      return escapeSqlLiteral(normalized);
    });
    parts.push(`incident_id IN (${ids.join(', ')})`);
  }

  if (parts.length === 0) {
    throw Object.assign(new Error('Investigator access scope is empty'), { status: 403 });
  }

  return `(${parts.join(' OR ')})`;
}

export function isIncidentIdAllowed(incidentId: string, scope: InvestigatorAccessScope): boolean {
  return scope.allowedIncidentIds.includes(incidentId.trim().toUpperCase());
}
