import React from 'react';
import type { RelatedIncident } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { ArrowUpRight } from '@phosphor-icons/react';

interface RelatedIncidentCardProps {
  incident: RelatedIncident;
  onInspect: (id: string) => void;
}

export const RelatedIncidentCard: React.FC<RelatedIncidentCardProps> = ({ incident, onInspect }) => (
  <button
    type="button"
    onClick={() => onInspect(incident.id)}
    className="w-full text-left ops-card p-4 hover:ring-2 hover:ring-brand-muted hover:border-brand-muted transition-all group"
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <span className="font-mono text-xs font-semibold text-brand">{incident.id}</span>
      <ArrowUpRight size={14} weight="regular" className="text-ops-muted group-hover:text-brand transition-colors" aria-hidden />
    </div>
    <p className="text-sm font-medium text-ops-text line-clamp-2 leading-snug">{incident.title}</p>
    <p className="text-xs text-ops-subtext mt-2 line-clamp-2">{incident.keyTakeaway}</p>
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-ops-border">
      <SeverityBadge severity={incident.severity} size="sm" showLabel={false} />
      <span className="text-xs font-medium text-emerald-600">{incident.similarityScore}% match</span>
    </div>
  </button>
);
