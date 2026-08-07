import React, { useState } from 'react';
import type { ExtractionResult, Severity } from '../../types/incident';
import { ShareIncidentDialog } from './ShareIncidentDialog';
import { SeverityBadge } from '../common/SeverityBadge';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, GitBranch, ListTodo, RotateCcw, Save, Loader2 } from 'lucide-react';

interface ExtractionResultViewProps {
  result: ExtractionResult;
  rawNotes: string;
  incidentId: string;
  runId: string;
  onApprove: (incidentId: string, runId: string, draft: ExtractionResult, shareWithMemberId?: string) => Promise<void>;
  onRetryAnalysis?: () => void;
  onReset: () => void;
  senderMemberId?: string;
  analysisFailed?: boolean;
  jobs?: Array<{ jobType: string; status: string }>;
}

export const ExtractionResultView: React.FC<ExtractionResultViewProps> = ({
  result,
  rawNotes,
  incidentId,
  runId,
  onApprove,
  onRetryAnalysis,
  onReset,
  senderMemberId,
  analysisFailed,
  jobs,
}) => {
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [title, setTitle] = useState(`${result.service} — ${result.component}`);
  const [summary, setSummary] = useState(result.summary);
  const [severity, setSeverity] = useState<Severity>(result.severity);
  const [service, setService] = useState(result.service);
  const [component, setComponent] = useState(result.component);

  const buildDraft = (): ExtractionResult => ({
    ...result,
    severity,
    service,
    component,
    summary,
    confidenceScore: result.confidenceScore,
  });

  const handleApproveClick = () => setShareOpen(true);

  const finalizeApprove = async (shareWithMemberId?: string) => {
    setSaving(true);
    try {
      await onApprove(incidentId, runId, buildDraft(), shareWithMemberId);
      setApproved(true);
      setShareOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Incident saved as <span className="font-mono font-semibold">{incidentId}</span>
        {analysisFailed ? (
          <span> — analysis failed. You can retry or open the saved incident.</span>
        ) : (
          <span> — AI draft ready for review.</span>
        )}
      </div>

      {jobs && jobs.length > 0 && approved && (
        <div className="ops-card p-4 text-xs text-ops-subtext space-y-1">
          <p className="font-semibold text-ops-text">Background jobs</p>
          {jobs.map((j) => (
            <p key={j.jobType}>
              {j.jobType}: <span className="font-medium">{j.status}</span>
            </p>
          ))}
        </div>
      )}

      <div className="ops-card p-5 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ops-text">Step 3 — Review & approve</h2>
            <p className="text-sm text-ops-subtext mt-0.5">Edit the AI draft, then approve to finalize fields and enqueue indexing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysisFailed && onRetryAnalysis && (
              <button type="button" onClick={onRetryAnalysis} className="ops-btn-secondary min-h-[44px] text-sm">
                Retry analysis
              </button>
            )}
            <button type="button" onClick={onReset} className="ops-btn-secondary min-h-[44px] text-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Start over
            </button>
            {!approved ? (
              <button type="button" onClick={handleApproveClick} disabled={saving} className="ops-btn-primary min-h-[44px] text-sm">
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Approving…</>
                ) : (
                  <><Save className="h-3.5 w-3.5" aria-hidden /> Approve & finalize</>
                )}
              </button>
            ) : (
              <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Approved
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={severity} />
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {result.confidenceScore}% AI confidence
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ops-label">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="ops-input" />
          </div>
          <div>
            <label className="ops-label">Service</label>
            <input value={service} onChange={(e) => setService(e.target.value)} className="ops-input" />
          </div>
          <div>
            <label className="ops-label">Component</label>
            <input value={component} onChange={(e) => setComponent(e.target.value)} className="ops-input" />
          </div>
          <div>
            <label className="ops-label">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="ops-input">
              <option value="SEV-0">SEV-0</option>
              <option value="SEV-1">SEV-1</option>
              <option value="SEV-2">SEV-2</option>
              <option value="SEV-3">SEV-3</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-ops-border bg-slate-50/80 p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ops-muted">Executive summary</p>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="ops-input mt-2 resize-y" />
        </div>

        {(result.tasks?.length ?? 0) > 0 && (
          <div>
            <p className="ops-label flex items-center gap-1.5"><ListTodo className="h-4 w-4" /> Suggested tasks ({result.tasks.length})</p>
            <ul className="mt-2 space-y-1 text-sm text-ops-subtext">
              {result.tasks.map((t, i) => (
                <li key={i} className="rounded-lg border border-ops-border bg-white px-3 py-2">{t.title}</li>
              ))}
            </ul>
          </div>
        )}

        {(result.timeline?.length ?? 0) > 0 && (
          <div>
            <p className="ops-label flex items-center gap-1.5"><Clock className="h-4 w-4" /> Timeline ({result.timeline.length})</p>
            <ol className="mt-2 space-y-2">
              {result.timeline.map((e, i) => (
                <li key={i} className="rounded-lg border border-ops-border bg-white px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-ops-muted">{e.timestamp}</span>
                  <span className="mx-2 text-ops-muted">·</span>
                  <span className="font-medium text-ops-text">{e.title}</span>
                  <p className="mt-1 text-ops-subtext">{e.description}</p>
                  <p className="mt-0.5 text-xs text-ops-muted">{e.actor}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(result.decisions?.length ?? 0) > 0 && (
          <div>
            <p className="ops-label flex items-center gap-1.5"><GitBranch className="h-4 w-4" /> Decisions ({result.decisions.length})</p>
            <ul className="mt-2 space-y-2">
              {result.decisions.map((d, i) => (
                <li key={i} className="rounded-lg border border-ops-border bg-white px-3 py-2 text-sm">
                  <p className="font-medium text-ops-text">{d.title}</p>
                  {d.description && <p className="mt-1 text-ops-subtext">{d.description}</p>}
                  {d.impact && <p className="mt-1 text-xs text-emerald-700">{d.impact}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(result.suggestedFixes?.length ?? 0) > 0 && (
          <div>
            <p className="ops-label">Suggested fixes ({result.suggestedFixes.length})</p>
            <ul className="mt-2 space-y-1 text-sm text-ops-subtext">
              {result.suggestedFixes.map((fix, i) => (
                <li key={i} className="rounded-lg border border-ops-border bg-white px-3 py-2">✓ {fix}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          className="flex items-center gap-1 text-xs text-ops-muted hover:text-ops-text"
        >
          {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showRaw ? 'Hide' : 'Show'} raw notes
        </button>
        {showRaw && (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100 font-mono">{rawNotes}</pre>
        )}
      </div>

      <ShareIncidentDialog
        open={shareOpen}
        incidentTitle={title}
        senderMemberId={senderMemberId}
        loading={saving}
        onClose={() => { if (!saving) setShareOpen(false); }}
        onConfirm={(shareWithMemberId) => void finalizeApprove(shareWithMemberId)}
      />
    </div>
  );
};
