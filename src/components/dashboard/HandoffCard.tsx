import React from 'react';
import type { ShiftHandoff } from '../../types/incident';
import { CheckCircle } from '@phosphor-icons/react';
import { UserAvatar } from '../common/UserAvatar';
import { firstName } from '../../utils/avatar';

interface HandoffCardProps {
  handoff: ShiftHandoff;
  liveSummaries: string[];
  openIncidentCount: number;
  activeSevCount: number;
  openTasksCount: number;
  lastUpdated?: string;
  userName?: string;
  memberId?: string;
  onAcknowledge: () => void;
}

export const HandoffCard: React.FC<HandoffCardProps> = ({
  handoff,
  liveSummaries,
  openIncidentCount,
  activeSevCount,
  openTasksCount,
  lastUpdated,
  userName,
  memberId,
  onAcknowledge,
}) => {
  const acked = handoff.handshakeStatus === 'ACKNOWLEDGED';
  const personalized = Boolean(memberId && userName);

  return (
    <div className="ops-card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4 min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">
                {personalized ? 'Your workspace' : 'Shift handoff'}
              </p>
              {lastUpdated && (
                <p className="text-[10px] text-ops-muted">Live · {lastUpdated}</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <UserAvatar name={userName ?? handoff.outgoingLead} size="lg" />
                <div>
                  <p className="text-sm font-semibold text-ops-text">
                    {firstName(userName ?? handoff.outgoingLead)}
                  </p>
                  <p className="text-xs text-ops-muted">
                    {personalized ? 'Your incidents & tasks' : 'Outgoing'}
                  </p>
                  {personalized && memberId && (
                    <p className="text-[11px] font-mono text-brand mt-0.5">{memberId}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {liveSummaries.length === 0 ? (
              <li className="text-sm text-ops-muted">
                {personalized
                  ? 'No open incidents yet — create one under New Incident or wait for a shared incident.'
                  : 'No open incidents — queue is clear.'}
              </li>
            ) : (
              liveSummaries.map((s, i) => (
                <li key={i} className="text-sm text-ops-subtext leading-snug break-words">
                  <span className="mr-2 text-ops-muted">•</span>
                  {s}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-ops-border bg-white px-3 py-2 text-center min-w-[4.5rem]">
              <p className={`text-xl font-semibold tabular-nums ${activeSevCount > 0 ? 'text-red-700' : 'text-ops-text'}`}>{activeSevCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-ops-muted mt-0.5">Critical</p>
            </div>
            <div className="rounded-md border border-ops-border bg-white px-3 py-2 text-center min-w-[4.5rem]">
              <p className="text-xl font-semibold text-ops-text tabular-nums">{openIncidentCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-ops-muted mt-0.5">Open</p>
            </div>
            <div className="rounded-md border border-ops-border bg-white px-3 py-2 text-center min-w-[4.5rem]">
              <p className="text-xl font-semibold text-ops-text tabular-nums">{openTasksCount}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-ops-muted mt-0.5">Tasks</p>
            </div>
          </div>

          {!personalized && (
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
                  <CheckCircle size={16} weight="regular" aria-hidden /> Acknowledged
                </>
              ) : (
                'Acknowledge handoff'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
