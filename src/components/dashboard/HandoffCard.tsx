import React from 'react';
import type { ShiftHandoff } from '../../types/incident';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { firstName } from '../../utils/avatar';

interface HandoffCardProps {
  handoff: ShiftHandoff;
  investigatingCount: number;
  onAcknowledge: () => void;
}

export const HandoffCard: React.FC<HandoffCardProps> = ({ handoff, investigatingCount, onAcknowledge }) => {
  const acked = handoff.handshakeStatus === 'ACKNOWLEDGED';

  return (
    <div className="ops-card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4 min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">Shift handoff</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <UserAvatar name={handoff.outgoingLead} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-ops-text">{firstName(handoff.outgoingLead)}</p>
                  <p className="text-xs text-ops-muted">Outgoing</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-ops-muted shrink-0" aria-hidden />
              <div className="flex items-center gap-2">
                <UserAvatar name={handoff.incomingLead} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-ops-text">{firstName(handoff.incomingLead)}</p>
                  <p className="text-xs text-ops-muted">Incoming</p>
                </div>
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {handoff.keySummaries.slice(0, 4).map((s, i) => (
              <li key={i} className="text-sm text-ops-subtext leading-snug break-words">
                <span className="mr-2 text-ops-muted">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-center min-w-[4.5rem]">
              <p className="text-xl font-bold text-brand tabular-nums">{handoff.activeSevCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-red-700/80 mt-0.5">Critical</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-center min-w-[4.5rem]">
              <p className="text-xl font-bold text-amber-900 tabular-nums">{investigatingCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800/80 mt-0.5">Active</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center min-w-[4.5rem]">
              <p className="text-xl font-bold text-ops-text tabular-nums">{handoff.openTasksCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-ops-muted mt-0.5">Tasks</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onAcknowledge}
            disabled={acked}
            title={acked ? 'Handoff acknowledged' : 'Acknowledge shift handoff'}
            className={`min-h-[44px] w-full sm:w-auto lg:min-w-[11rem] ${
              acked
                ? 'ops-btn-secondary border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'ops-btn-primary'
            }`}
          >
            {acked ? (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Acknowledged
              </>
            ) : (
              'Acknowledge handoff'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
