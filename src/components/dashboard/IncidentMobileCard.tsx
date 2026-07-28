import React from 'react';
import type { Incident } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { timeAgo } from '../../utils/formatters';
import { ChevronRight } from 'lucide-react';

interface IncidentMobileCardProps {
  incident: Incident;
  onSelect: (incident: Incident) => void;
}

export const IncidentMobileCard: React.FC<IncidentMobileCardProps> = ({ incident, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(incident)}
    className="w-full text-left ops-card p-4 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 min-h-[44px]"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ops-text leading-snug break-words">{incident.title}</p>
        <p className="text-[11px] font-mono text-ops-muted mt-1">{incident.id}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ops-muted mt-1" aria-hidden />
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <SeverityBadge severity={incident.severity} size="sm" />
      <StatusBadge status={incident.status} />
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ops-subtext">
      <span className="truncate max-w-[10rem]">{incident.service}</span>
      <span>{incident.leadSRE}</span>
      <span>{timeAgo(incident.createdAt)}</span>
    </div>
  </button>
);
