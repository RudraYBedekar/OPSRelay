import React from 'react';
import type { RelatedIncident } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { similarityLabel } from '../../utils/similarity';
import { ArrowUpRight } from '@phosphor-icons/react';

interface MemorySourceCardProps {
  incident: RelatedIncident;
  onInspect: (id: string) => void;
  onCreateTask?: (id: string) => void;
}

export const MemorySourceCard: React.FC<MemorySourceCardProps> = ({ incident, onInspect, onCreateTask }) => (
  <div className="ops-card p-4 flex flex-col h-full">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-medium text-ops-muted">{incident.id}</p>
        <p className="mt-1 text-sm font-medium text-ops-text leading-snug line-clamp-2">{incident.title}</p>
      </div>
      <SeverityBadge severity={incident.severity} size="sm" showLabel={false} />
    </div>
    <p className="mt-2 text-xs text-ops-subtext line-clamp-2 flex-1">{incident.keyTakeaway}</p>
    <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-ops-border">
      <div>
        <p className="text-xs font-semibold text-emerald-700">{incident.similarityScore}%</p>
        <p className="text-[10px] text-ops-muted">{similarityLabel(incident.similarityScore)}</p>
      </div>
      <div className="flex gap-1.5">
        {onCreateTask && (
          <button
            type="button"
            onClick={() => onCreateTask(incident.id)}
            className="ops-btn-secondary text-[11px] py-1 px-2 min-h-[36px]"
          >
            Task
          </button>
        )}
        <button
          type="button"
          onClick={() => onInspect(incident.id)}
          title="Open incident"
          className="ops-btn-secondary text-[11px] py-1 px-2 min-h-[36px]"
        >
          Open <ArrowUpRight size={12} weight="regular" aria-hidden />
        </button>
      </div>
    </div>
  </div>
);
