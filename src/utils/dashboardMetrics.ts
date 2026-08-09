import type { ActionItemTask, DashboardMetrics, Incident } from '../types/incident';
import { countOpenTasks } from './taskMetrics';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Derive dashboard metric cards from live incidents and tasks (not static DB seed). */
export function deriveLiveMetrics(
  incidents: Incident[],
  tasks: ActionItemTask[],
  base?: DashboardMetrics | null,
): DashboardMetrics {
  const now = Date.now();
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const activeSev0Sev1 = openIncidents.filter(
    (i) => i.severity === 'SEV-0' || i.severity === 'SEV-1',
  ).length;
  const totalIncidents24h = incidents.filter(
    (i) => now - new Date(i.createdAt).getTime() <= DAY_MS,
  ).length;
  const resolvedWithMttr = incidents.filter(
    (i) => i.status === 'RESOLVED' && typeof i.mttrMinutes === 'number' && i.mttrMinutes > 0,
  );
  const avgMttrMinutes =
    resolvedWithMttr.length > 0
      ? Math.round(
          resolvedWithMttr.reduce((sum, i) => sum + (i.mttrMinutes ?? 0), 0) / resolvedWithMttr.length,
        )
      : (base?.avgMttrMinutes ?? 0);
  const openTasksCount = countOpenTasks(tasks);

  return {
    totalIncidents24h,
    activeSev0Sev1,
    avgMttrMinutes,
    aiExtractionAccuracy: base?.aiExtractionAccuracy ?? 96,
    openTasksCount,
    timeSavedHours: base?.timeSavedHours ?? 0,
  };
}

export function countOpenIncidents(incidents: Incident[]): number {
  return incidents.filter((i) => i.status !== 'RESOLVED').length;
}

export function countResolvedIncidents(incidents: Incident[]): number {
  return incidents.filter((i) => i.status === 'RESOLVED').length;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  MITIGATED: 'Mitigated',
  RESOLVED: 'Resolved',
};

/** Live handoff bullet list from open incidents in the database. */
export function buildLiveHandoffSummaries(incidents: Incident[], limit = 4): string[] {
  const sevOrder: Record<string, number> = { 'SEV-0': 0, 'SEV-1': 1, 'SEV-2': 2, 'SEV-3': 3 };
  return incidents
    .filter((i) => i.status !== 'RESOLVED')
    .sort((a, b) => {
      const sev = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
      if (sev !== 0) return sev;
      return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
    })
    .slice(0, limit)
    .map(
      (i) =>
        `${i.severity} ${STATUS_LABEL[i.status] ?? i.status}: ${i.title}${i.service ? ` — ${i.service}` : ''}`,
    );
}
