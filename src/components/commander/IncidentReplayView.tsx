import React from 'react';
import {
  AlertTriangle,
  ArrowUpCircle,
  Bot,
  CheckCircle2,
  Clock,
  Radio,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import type { ReplayEvent, ReplayEventType } from '../../types/commander';
import { formatDate } from '../../utils/formatters';

const EVENT_META: Record<ReplayEventType, { icon: typeof Bot; color: string; label: string }> = {
  alert: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200', label: 'Alert' },
  ai_decision: { icon: Bot, color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'AI Decision' },
  assignment: { icon: User, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Assignment' },
  action: { icon: Zap, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Action' },
  failure: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Failed Step' },
  escalation: { icon: ArrowUpCircle, color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Escalation' },
  resolution: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Resolution' },
  sla: { icon: Clock, color: 'bg-slate-100 text-slate-700 border-slate-200', label: 'SLA' },
};

interface IncidentReplayViewProps {
  incidentId: string;
  incidentTitle: string;
  events: ReplayEvent[];
  handoffSummary?: string;
  onBack?: () => void;
}

export const IncidentReplayView: React.FC<IncidentReplayViewProps> = ({
  incidentId,
  incidentTitle,
  events,
  handoffSummary,
  onBack,
}) => (
  <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-xs text-ops-muted">
          <Radio className="h-3.5 w-3.5" aria-hidden />
          Incident Replay
        </div>
        <h2 className="mt-1 text-lg font-bold text-ops-text">{incidentTitle}</h2>
        <p className="font-mono text-xs text-ops-muted">{incidentId}</p>
      </div>
      {onBack && (
        <button type="button" onClick={onBack} className="ops-btn-secondary text-sm min-h-[40px]">
          Back to war room
        </button>
      )}
    </div>

    {handoffSummary && (
      <div className="ops-card border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <Shield className="h-4 w-4" aria-hidden />
          Final shift handoff summary
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/90">{handoffSummary}</div>
      </div>
    )}

    <div className="ops-card p-5 md:p-6">
      <h3 className="mb-4 text-sm font-semibold text-ops-text">
        Chronological timeline ({events.length} events)
      </h3>

      {events.length === 0 ? (
        <p className="text-sm text-ops-muted">No replay events recorded yet.</p>
      ) : (
        <ol className="relative space-y-0 border-l-2 border-ops-border ml-3">
          {events.map((event, idx) => {
            const meta = EVENT_META[event.eventType] ?? EVENT_META.action;
            const Icon = meta.icon;
            return (
              <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
                <span className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border ${meta.color}`}>
                  <Icon className="h-2.5 w-2.5" aria-hidden />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                    {meta.label}
                  </span>
                  {event.confidence != null && (
                    <span className="text-[10px] font-medium text-ops-muted">
                      {Math.round(event.confidence)}% confidence
                    </span>
                  )}
                  <time className="text-[11px] text-ops-muted ml-auto">
                    {formatDate(event.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm font-medium text-ops-text">{event.title}</p>
                {event.description && (
                  <p className="mt-0.5 text-sm text-ops-subtext">{event.description}</p>
                )}
                <p className="mt-1 text-xs text-ops-muted">Actor: {event.actor}</p>
                {idx < events.length - 1 && (
                  <div className="mt-3 h-px bg-ops-border/60" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  </div>
);
