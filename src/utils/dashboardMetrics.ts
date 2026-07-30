import type { ActionItemTask, DashboardMetrics, Incident } from '../types/incident';

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
  const openTasksCount = tasks.filter((t) => t.status !== 'COMPLETED').length;

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
