import type { Severity, IncidentStatus, TaskStatus } from '../types/incident';

export function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

export function timeAgo(isoString: string): string {
  try {
    const diffMins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const h = Math.floor(diffMins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return isoString;
  }
}

export function getSeverityBadgeProps(severity: Severity) {
  switch (severity) {
    case 'SEV-0':
      return { bg: 'bg-red-100 text-red-800 border-red-200', indicator: 'bg-red-600', label: 'SEV-0' };
    case 'SEV-1':
      return { bg: 'bg-orange-100 text-orange-800 border-orange-200', indicator: 'bg-orange-500', label: 'SEV-1' };
    case 'SEV-2':
      return { bg: 'bg-amber-100 text-amber-800 border-amber-200', indicator: 'bg-amber-500', label: 'SEV-2' };
    case 'SEV-3':
      return { bg: 'bg-sky-100 text-sky-800 border-sky-200', indicator: 'bg-sky-500', label: 'SEV-3' };
  }
}

export function getStatusBadgeProps(status: IncidentStatus) {
  switch (status) {
    case 'OPEN':
      return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Open' };
    case 'INVESTIGATING':
      return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Investigating' };
    case 'MITIGATED':
      return { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Mitigated' };
    case 'RESOLVED':
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Resolved' };
  }
}

export function getTaskStatusBadgeProps(status: TaskStatus) {
  switch (status) {
    case 'TODO':
      return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'To do' };
    case 'IN_PROGRESS':
      return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'In progress' };
    case 'BLOCKED':
      return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Blocked' };
    case 'COMPLETED':
      return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Done' };
  }
}
