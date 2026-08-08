import React from 'react';
import type { ShiftHandoff } from '../../types/incident';
import { ArrowRight, CheckCircle, Users } from '@phosphor-icons/react';

interface ShiftHandoffBannerProps {
  handoff: ShiftHandoff;
  onAcknowledge: () => void;
}

export const ShiftHandoffBanner: React.FC<ShiftHandoffBannerProps> = ({ handoff, onAcknowledge }) => {
  const acked = handoff.handshakeStatus === 'ACKNOWLEDGED';

  return (
    <div className="ops-card p-5 border-l-4 border-l-brand">
      <div className="flex flex-col lg:flex-row lg:items-start gap-5">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 text-brand">
            <Users size={16} weight="regular" aria-hidden />
            <span className="text-sm font-semibold">Shift handoff</span>
          </div>
          <p className="text-sm text-ops-text flex items-center gap-2 flex-wrap">
            <span>{handoff.outgoingLead.split('(')[0].trim()}</span>
            <ArrowRight size={14} weight="regular" className="text-ops-muted" aria-hidden />
            <span>{handoff.incomingLead.split('(')[0].trim()}</span>
          </p>
          <ul className="space-y-1.5">
            {handoff.keySummaries.slice(0, 3).map((s, i) => (
              <li key={i} className="text-sm text-ops-subtext flex gap-2">
                <span className="text-brand shrink-0">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 shrink-0">
          <div className="flex gap-3">
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-2 text-center min-w-[5rem]">
              <p className="text-2xl font-semibold text-red-700">{handoff.activeSevCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-red-600/80 mt-0.5">Critical</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2 text-center min-w-[5rem]">
              <p className="text-2xl font-semibold text-amber-800">{handoff.openTasksCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-700/80 mt-0.5">Tasks</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAcknowledge}
            disabled={acked}
            className={acked ? 'ops-btn-secondary text-emerald-700 border-emerald-200 bg-emerald-50' : 'ops-btn-primary'}
          >
            {acked ? (
              <><CheckCircle size={16} weight="regular" aria-hidden /> Acknowledged</>
            ) : (
              'Acknowledge handoff'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
