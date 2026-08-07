import React, { useState } from 'react';
import type { Incident, IncidentStatus } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { MemorySourceCard } from '../agent/MemorySourceCard';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { AlertFatigueCard } from '../alerts/AlertFatigueCard';
import { DuplicateCandidateBanner } from '../alerts/DuplicateCandidateBanner';
import { McpCitationCard } from '../agent/McpCitationCard';
import { apiService } from '../../services/apiService';
import { useToast } from '../common/Toast';
import { ExportReportModal } from './ExportReportModal';
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Server, User, Bot, Search, Loader2, FileText } from 'lucide-react';
import { timeAgo, formatDate } from '../../utils/formatters';

interface IncidentDetailViewProps {
  incident: Incident;
  onBack: () => void;
  onUpdateStatus: (id: string, newStatus: IncidentStatus) => void;
  onInspectIncident?: (id: string) => void;
}

export const IncidentDetailView: React.FC<IncidentDetailViewProps> = ({
  incident,
  onBack,
  onUpdateStatus,
  onInspectIncident,
}) => {
  const { toast } = useToast();
  const [showRaw, setShowRaw] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<IncidentStatus | null>(null);
  const [mcpQuestion, setMcpQuestion] = useState('');
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpResult, setMcpResult] = useState<Awaited<ReturnType<typeof apiService.queryInvestigator>> | null>(null);
  const [distinctBusy, setDistinctBusy] = useState(false);
  const [dismissDuplicate, setDismissDuplicate] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const confirmStatus = () => {
    if (pendingStatus) {
      onUpdateStatus(incident.id, pendingStatus);
      setPendingStatus(null);
    }
  };

  const runMcpInvestigation = async () => {
    if (!mcpQuestion.trim()) return;
    setMcpLoading(true);
    try {
      setMcpResult(await apiService.queryInvestigator(mcpQuestion.trim(), incident.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Investigation failed', 'error');
    } finally {
      setMcpLoading(false);
    }
  };

  const markDistinct = async () => {
    const alertId = incident.duplicateCandidate?.matchedAlertId;
    if (!alertId) return;
    setDistinctBusy(true);
    try {
      await apiService.overrideAlertDistinct(alertId);
      setDismissDuplicate(true);
      toast('Marked as distinct incident', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setDistinctBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button type="button" onClick={onBack} className="ops-btn-secondary min-h-[44px] text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      <div className="ops-card p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ops-muted">{incident.id}</span>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
        </div>
        <h1 className="text-xl font-bold leading-tight text-ops-text md:text-2xl">{incident.title}</h1>
        <p className="text-sm leading-relaxed text-ops-subtext">{incident.summary}</p>

        <div className="flex flex-wrap gap-4 border-t border-ops-border pt-4 text-sm text-ops-subtext">
          <span className="flex items-center gap-1.5"><Server className="h-4 w-4" aria-hidden /> {incident.service} / {incident.component}</span>
          <span className="flex items-center gap-1.5"><User className="h-4 w-4" aria-hidden /> {incident.leadSRE}</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden /> {formatDate(incident.createdAt)} ({timeAgo(incident.createdAt)})</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="inc-status" className="text-sm font-medium text-ops-subtext">Update status</label>
          <select
            id="inc-status"
            value={incident.status}
            onChange={(e) => {
              const next = e.target.value as IncidentStatus;
              if (next === 'RESOLVED') setPendingStatus(next);
              else onUpdateStatus(incident.id, next);
            }}
            className="ops-input w-auto text-sm min-h-[44px]"
          >
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="MITIGATED">Mitigated</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="ops-btn-secondary min-h-[44px] text-sm"
          >
            <FileText className="h-4 w-4" aria-hidden /> Generate handoff report
          </button>
        </div>
      </div>

      {incident.duplicateCandidate?.state === 'candidate' && !dismissDuplicate && (
        <DuplicateCandidateBanner
          candidate={incident.duplicateCandidate}
          incidentId={incident.id}
          onMarkDistinct={() => void markDistinct()}
          onDismiss={() => setDismissDuplicate(true)}
          busy={distinctBusy}
        />
      )}

      <AlertFatigueCard incidentId={incident.id} />

      {apiService.isUsingCrdb() && (
        <div className="ops-card p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-ops-text">Investigate with MCP</h2>
          </div>
          <p className="text-xs text-ops-subtext">
            Read-only query against approved incident evidence in CockroachDB Managed MCP.
          </p>
          <div className="flex gap-2">
            <input
              value={mcpQuestion}
              onChange={(e) => setMcpQuestion(e.target.value)}
              className="ops-input flex-1 text-sm"
              placeholder="Which approved resolutions match this service?"
            />
            <button
              type="button"
              onClick={() => void runMcpInvestigation()}
              disabled={mcpLoading || !mcpQuestion.trim()}
              className="ops-btn-primary min-h-[44px] text-sm"
            >
              {mcpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Query'}
            </button>
          </div>
          {mcpResult && (
            <div className="space-y-3">
              <p className="text-sm text-ops-text whitespace-pre-wrap">{mcpResult.answer}</p>
              {mcpResult.citations.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {mcpResult.citations.map((c) => (
                    <McpCitationCard key={c.citationId} citation={c} onInspectIncident={onInspectIncident} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {incident.timeline.length > 0 && (
        <div className="ops-card p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-ops-text">Timeline</h2>
          <ol className="space-y-4">
            {incident.timeline.map((e) => (
              <li key={e.id} className="flex gap-4">
                <div className="w-14 shrink-0 pt-0.5 font-mono text-xs text-ops-muted">{e.timestamp}</div>
                <div className="flex-1 border-l-2 border-slate-200 pl-4">
                  <p className="font-medium text-ops-text">{e.title}</p>
                  <p className="mt-0.5 text-xs text-ops-muted">{e.actor}</p>
                  <p className="mt-1 text-sm text-ops-subtext">{e.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {incident.similarIncidents.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ops-text">Similar incidents</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {incident.similarIncidents.map((si) => (
              <MemorySourceCard key={si.id} incident={si} onInspect={onInspectIncident ?? (() => {})} />
            ))}
          </div>
        </div>
      )}

      {incident.aiConfidence > 0 && (
        <div className="ops-card p-5 flex items-start gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-ops-subtext"><Bot className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-ops-text">AI extraction confidence</h2>
            <p className="mt-1 text-sm text-ops-subtext">{incident.aiConfidence}% — structured from raw notes via Bedrock.</p>
          </div>
        </div>
      )}

      {incident.tasks.length > 0 && (
        <div className="ops-card p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-ops-text">Tasks ({incident.tasks.length})</h2>
          <ul className="divide-y divide-ops-border">
            {incident.tasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-ops-text">{t.title}</span>
                <span className="shrink-0 text-xs text-ops-muted">{t.status.replace('_', ' ')} · {t.assignee}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {incident.decisions.length > 0 && (
        <div className="ops-card p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold text-ops-text">Decisions</h2>
          <ul className="space-y-4">
            {incident.decisions.map((d) => (
              <li key={d.id} className="border-l-2 border-slate-200 pl-4">
                <p className="font-medium text-ops-text">{d.title}</p>
                <p className="text-xs text-ops-muted mt-0.5">{d.madeBy} · {d.timestamp}</p>
                <p className="text-sm text-ops-subtext mt-1">{d.description}</p>
                <p className="text-xs text-emerald-700 mt-1">{d.impact}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {incident.fixesApplied.length > 0 && (
        <div className="ops-card p-5 md:p-6">
          <h2 className="mb-3 text-sm font-semibold text-ops-text">Remediation</h2>
          <ul className="space-y-2">
            {incident.fixesApplied.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-ops-subtext">
                <span className="text-emerald-600 shrink-0">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {incident.rawNotes && (
        <div className="ops-card p-5">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="flex w-full items-center justify-between text-sm font-medium text-ops-text min-h-[44px]"
          >
            Raw logs
            {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showRaw && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-ops-border bg-slate-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ops-subtext">
              {incident.rawNotes}
            </pre>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingStatus === 'RESOLVED'}
        title="Resolve incident?"
        message="Marking this incident as resolved will close it in the dashboard. Continue?"
        confirmLabel="Resolve"
        destructive
        onConfirm={confirmStatus}
        onCancel={() => setPendingStatus(null)}
      />

      {exportOpen && (
        <ExportReportModal incident={incident} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
};
