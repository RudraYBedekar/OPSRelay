import React, { useCallback, useEffect, useState } from 'react';
import {
  Warning,
  Robot,
  Clock,
  ClockCounterClockwise,
  CircleNotch,
  Play,
  Broadcast,
  ArrowClockwise,
  Shield,
  UserCheck,
  Users,
  Lightning,
} from '@phosphor-icons/react';
import type { Incident } from '../../types/incident';
import type { ActiveWarRoom, WarRoomState } from '../../types/commander';
import { apiService } from '../../services/apiService';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { ConfidenceBreakdown } from './ConfidenceBreakdown';
import { IncidentReplayView } from './IncidentReplayView';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Breached';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

interface WarRoomPanelProps {
  incidents: Incident[];
  memberId?: string;
  userName?: string;
  onRefreshIncidents?: () => void;
  onInspectIncident?: (id: string) => void;
}

export const WarRoomPanel: React.FC<WarRoomPanelProps> = ({
  incidents,
  memberId,
  userName,
  onRefreshIncidents,
  onInspectIncident,
}) => {
  const [activeRooms, setActiveRooms] = useState<ActiveWarRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warRoom, setWarRoom] = useState<WarRoomState | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionTitle, setActionTitle] = useState('');
  const [actionOutcome, setActionOutcome] = useState<'pending' | 'success' | 'failed'>('pending');
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criticalIncidents = incidents.filter(
    (i) => (i.severity === 'SEV-0' || i.severity === 'SEV-1') && i.status !== 'RESOLVED',
  );

  const loadRooms = useCallback(async () => {
    if (!apiService.isUsingCrdb()) {
      setLoading(false);
      return;
    }
    try {
      const rooms = await apiService.listWarRooms();
      setActiveRooms(rooms);
      if (!selectedId && rooms.length > 0) {
        setSelectedId(rooms[0].incidentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load war rooms');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadWarRoom = useCallback(async (incidentId: string) => {
    if (!apiService.isUsingCrdb()) return;
    try {
      const room = await apiService.getWarRoom(incidentId);
      setWarRoom(room);
      setError(null);
    } catch (err) {
      setWarRoom(null);
      setError(err instanceof Error ? err.message : 'War room not found');
    }
  }, []);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  useEffect(() => {
    if (!selectedId) return;
    void loadWarRoom(selectedId);
    const id = window.setInterval(() => { void loadWarRoom(selectedId); }, 8000);
    return () => window.clearInterval(id);
  }, [selectedId, loadWarRoom]);

  const handleLaunch = async (incidentId: string) => {
    setBusy(true);
    setError(null);
    try {
      const room = await apiService.launchCommander(incidentId);
      setWarRoom(room);
      setSelectedId(incidentId);
      await loadRooms();
      onRefreshIncidents?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedId || !memberId) return;
    setBusy(true);
    try {
      const room = await apiService.acknowledgeCommander(selectedId, memberId);
      setWarRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acknowledge failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRecordAction = async () => {
    if (!selectedId || !actionTitle.trim()) return;
    setBusy(true);
    setWarning(null);
    try {
      const result = await apiService.recordCommanderAction(selectedId, {
        title: actionTitle.trim(),
        outcome: actionOutcome,
      });
      if (result.warning) setWarning(result.warning);
      setActionTitle('');
      await loadWarRoom(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const room = await apiService.escalateCommander(selectedId);
      setWarRoom(room);
      onRefreshIncidents?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Escalation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const room = await apiService.resolveCommander(selectedId);
      setWarRoom(room);
      await loadRooms();
      onRefreshIncidents?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setBusy(false);
    }
  };

  if (!apiService.isUsingCrdb()) {
    return (
      <div className="ops-card p-6 text-center text-sm text-ops-subtext">
        Incident Commander requires CockroachDB mode (VITE_USE_CRDB=true).
      </div>
    );
  }

  if (showReplay && warRoom) {
    return (
      <IncidentReplayView
        incidentId={warRoom.session.incidentId}
        incidentTitle={String(warRoom.incident.title ?? warRoom.session.incidentId)}
        events={warRoom.replay}
        handoffSummary={warRoom.session.handoffSummary}
        onBack={() => setShowReplay(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <Broadcast size={16} weight="regular" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-bold text-ops-text">Autonomous Incident Commander</h2>
            <p className="text-xs text-ops-muted">AI-driven war rooms for SEV-0 / SEV-1 incidents</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { void loadRooms(); if (selectedId) void loadWarRoom(selectedId); }}
          className="ops-btn-secondary text-sm min-h-[40px]"
          disabled={loading}
        >
          <ArrowClockwise size={16} weight="regular" className={loading ? 'animate-spin' : ''} aria-hidden />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {warning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <Warning size={16} weight="regular" className="shrink-0 mt-0.5" aria-hidden />
          {warning}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="ops-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ops-muted mb-3">
              Active war rooms ({activeRooms.length})
            </h3>
            {activeRooms.length === 0 ? (
              <p className="text-sm text-ops-subtext">No active commander sessions.</p>
            ) : (
              <ul className="space-y-2">
                {activeRooms.map((room) => (
                  <li key={room.incidentId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(room.incidentId)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        selectedId === room.incidentId
                          ? 'border-brand bg-brand-light'
                          : 'border-ops-border hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-mono text-ops-muted">{room.incidentId}</p>
                      <p className="text-sm font-medium text-ops-text truncate">{room.incidentTitle}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <SeverityBadge severity={room.severity as Incident['severity']} />
                        <span className="text-[10px] uppercase text-ops-muted">{room.session.status}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ops-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ops-muted mb-3">
              Launch commander
            </h3>
            {criticalIncidents.length === 0 ? (
              <p className="text-sm text-ops-subtext">No open critical incidents.</p>
            ) : (
              <ul className="space-y-2">
                {criticalIncidents.map((inc) => {
                  const hasRoom = activeRooms.some((r) => r.incidentId === inc.id);
                  return (
                    <li key={inc.id} className="flex items-center justify-between gap-2 rounded-lg border border-ops-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-ops-muted">{inc.id}</p>
                        <p className="text-sm truncate text-ops-text">{inc.title}</p>
                      </div>
                      {hasRoom ? (
                        <button
                          type="button"
                          onClick={() => setSelectedId(inc.id)}
                          className="ops-btn-secondary text-xs px-2 py-1 min-h-0"
                        >
                          Open
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleLaunch(inc.id)}
                          disabled={busy}
                          className="ops-btn-primary text-xs px-2 py-1 min-h-0"
                        >
                          <Play size={12} weight="fill" aria-hidden />
                          Launch
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!warRoom ? (
            <div className="ops-card flex flex-col items-center justify-center p-12 text-center">
              {loading ? (
                <CircleNotch size={32} weight="regular" className="animate-spin text-brand" aria-hidden />
              ) : (
                <>
                  <Robot size={40} weight="regular" className="text-ops-muted mb-3" aria-hidden />
                  <p className="text-sm text-ops-subtext">
                    Select a war room or launch the commander on a critical incident.
                  </p>
                  <p className="mt-2 text-xs text-ops-muted">
                    Creating a SEV-0/SEV-1 incident auto-starts the commander pipeline.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="ops-card p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ops-muted">{warRoom.session.incidentId}</span>
                      <SeverityBadge severity={String(warRoom.incident.severity) as Incident['severity']} />
                      <StatusBadge status={String(warRoom.incident.status) as Incident['status']} />
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
                        {warRoom.session.status}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-ops-text">
                      {String(warRoom.incident.title ?? 'War room')}
                    </h3>
                    <p className="text-sm text-ops-subtext mt-1">
                      {String((warRoom.session.analysis as { impactAssessment?: string }).impactAssessment ?? warRoom.incident.summary ?? '')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setShowReplay(true)} className="ops-btn-secondary text-sm min-h-[36px]">
                      <ClockCounterClockwise size={16} weight="regular" aria-hidden />
                      Replay
                    </button>
                    {onInspectIncident && (
                      <button
                        type="button"
                        onClick={() => onInspectIncident(warRoom.session.incidentId)}
                        className="ops-btn-secondary text-sm min-h-[36px]"
                      >
                        Incident detail
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={`rounded-lg border p-3 ${warRoom.session.slaBreached ? 'border-red-300 bg-red-50' : 'border-ops-border bg-slate-50'}`}>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ops-muted">
                      <Clock size={14} weight="regular" aria-hidden />
                      Resolution SLA
                    </div>
                    <p className={`mt-1 text-lg font-bold ${warRoom.session.slaBreached ? 'text-red-700' : 'text-ops-text'}`}>
                      {formatCountdown(warRoom.slaRemainingMs)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ops-border bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ops-muted">
                      <UserCheck size={14} weight="regular" aria-hidden />
                      Response SLA
                    </div>
                    <p className="mt-1 text-lg font-bold text-ops-text">
                      {formatCountdown(warRoom.responseRemainingMs)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ops-border bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-ops-muted">
                      <Shield size={14} weight="regular" aria-hidden />
                      AI mode
                    </div>
                    <p className="mt-1 text-lg font-bold capitalize text-ops-text">{warRoom.mode}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-ops-border pt-4">
                  {memberId && warRoom.session.primaryExpertMemberId === memberId && (
                    <button type="button" onClick={() => void handleAcknowledge()} disabled={busy} className="ops-btn-primary text-sm min-h-[36px]">
                      Accept assignment
                    </button>
                  )}
                  <button type="button" onClick={() => void handleEscalate()} disabled={busy} className="ops-btn-secondary text-sm min-h-[36px]">
                    Force escalate
                  </button>
                  <button type="button" onClick={() => void handleResolve()} disabled={busy} className="ops-btn-secondary text-sm min-h-[36px] text-emerald-700 border-emerald-200">
                    Mark resolved
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="ops-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} weight="regular" className="text-brand" aria-hidden />
                    <h4 className="text-sm font-semibold text-ops-text">Expert rankings</h4>
                  </div>
                  <ul className="space-y-2">
                    {warRoom.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border border-ops-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-ops-text">
                            #{a.rank} {a.expertName}
                          </p>
                          <p className="text-xs text-ops-muted font-mono">{a.memberId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-brand">{Math.round(a.score)}</p>
                          <p className="text-[10px] uppercase text-ops-muted">{a.status}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="ops-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightning size={16} weight="regular" className="text-brand" aria-hidden />
                    <h4 className="text-sm font-semibold text-ops-text">Similar incidents (vector memory)</h4>
                  </div>
                  {warRoom.similarIncidents.length === 0 ? (
                    <p className="text-sm text-ops-muted">No vector matches yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {warRoom.similarIncidents.map((s) => (
                        <li key={s.id} className="rounded-lg border border-ops-border px-3 py-2">
                          <div className="flex justify-between gap-2">
                            <span className="font-mono text-xs text-ops-muted">{s.id}</span>
                            <span className="text-xs font-bold text-brand">{s.similarityScore}%</span>
                          </div>
                          <p className="text-sm text-ops-text">{s.title}</p>
                          <p className="text-xs text-ops-subtext mt-1">{s.keyTakeaway}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="ops-card p-4 space-y-3">
                <h4 className="text-sm font-semibold text-ops-text">AI decisions with confidence scoring</h4>
                {warRoom.decisions.map((d) => (
                  <ConfidenceBreakdown key={d.id} decision={d} />
                ))}
              </div>

              <div className="ops-card p-4 space-y-3">
                <h4 className="text-sm font-semibold text-ops-text">Log troubleshooting action</h4>
                <p className="text-xs text-ops-muted">
                  Failed or repeated steps are detected and stored in CockroachDB memory.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder="e.g. Restart connection pool"
                    className="ops-input flex-1 min-w-[200px]"
                  />
                  <select
                    value={actionOutcome}
                    onChange={(e) => setActionOutcome(e.target.value as typeof actionOutcome)}
                    className="ops-input w-auto"
                  >
                    <option value="pending">Pending</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRecordAction()}
                    disabled={busy || !actionTitle.trim()}
                    className="ops-btn-primary text-sm min-h-[40px]"
                  >
                    Record
                  </button>
                </div>
                {warRoom.actions.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-ops-border pt-3">
                    {warRoom.actions.slice(-5).reverse().map((a) => (
                      <li key={a.id} className="flex justify-between text-xs">
                        <span className="text-ops-text">{a.title}</span>
                        <span className={`font-medium uppercase ${
                          a.outcome === 'failed' || a.outcome === 'repeated' ? 'text-red-600' : 'text-ops-muted'
                        }`}>
                          {a.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {warRoom.session.handoffSummary && (
                <div className="ops-card border-emerald-200 bg-emerald-50/40 p-4">
                  <h4 className="text-sm font-semibold text-emerald-800">Shift handoff summary</h4>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/90">
                    {warRoom.session.handoffSummary}
                  </div>
                </div>
              )}

              {userName && (
                <p className="text-xs text-ops-muted text-center">
                  Logged in as {userName}. Primary expert: {warRoom.session.primaryExpertName ?? '—'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
