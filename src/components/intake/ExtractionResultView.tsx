import React, { useState } from 'react';
import type { ExtractionResult, Incident, Severity } from '../../types/incident';
import { withDefaultTasks } from '../../utils/incidentTasks';
import { SeverityBadge } from '../common/SeverityBadge';
import { CheckCircle2, ChevronDown, ChevronUp, ListTodo, RotateCcw, Save, Clock } from 'lucide-react';

interface ExtractionResultViewProps {
  result: ExtractionResult;
  rawNotes: string;
  onSave: (newIncident: Incident) => void;
  onReset: () => void;
}

export const ExtractionResultView: React.FC<ExtractionResultViewProps> = ({
  result,
  rawNotes,
  onSave,
  onReset,
}) => {
  const [saved, setSaved] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [title, setTitle] = useState(`${result.service} — ${result.component}`);
  const [summary, setSummary] = useState(result.summary);
  const [severity, setSeverity] = useState<Severity>(result.severity);
  const [service, setService] = useState(result.service);
  const [component, setComponent] = useState(result.component);

  const handleSave = () => {
    const id = `INC-${Math.floor(Math.random() * 9000 + 1000)}`;
    onSave(withDefaultTasks({
      id,
      title,
      service,
      component,
      severity,
      status: 'INVESTIGATING',
      summary,
      createdAt: new Date().toISOString(),
      leadSRE: 'OpsRelay AI',
      shiftId: 'SHIFT-CURRENT',
      aiConfidence: result.confidenceScore,
      rawNotes,
      timeline: result.timeline.map((t, i) => ({ ...t, id: `tl-${i}` })),
      decisions: result.decisions.map((d, i) => ({ ...d, id: `dec-${i}` })),
      fixesApplied: result.suggestedFixes,
      tasks: result.tasks.map((t, i) => ({ ...t, id: `tsk-${i}`, incidentId: id, incidentTitle: title })),
      similarIncidents: [],
    }));
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <div className="ops-card p-5 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ops-text">Step 3 — Review & save</h2>
            <p className="text-sm text-ops-subtext mt-0.5">Edit extracted fields before saving to the database.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onReset} className="ops-btn-secondary min-h-[44px] text-sm">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Start over
            </button>
            {!saved ? (
              <button type="button" onClick={handleSave} className="ops-btn-primary min-h-[44px] text-sm">
                <Save className="h-3.5 w-3.5" aria-hidden /> Save incident
              </button>
            ) : (
              <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved
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

        <div className="rounded-xl border border-ops-border bg-slate-50/80 p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ops-muted">Executive summary</p>
          <p className="mt-2 text-sm leading-relaxed text-ops-text">{summary}</p>
          <p className="mt-3 border-t border-ops-border pt-3 text-xs leading-relaxed text-ops-subtext">
            <span className="font-medium text-ops-text">Severity rationale: </span>
            {result.severityReason}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="ops-label">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="ops-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ops-label">Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="ops-input">
                  <option value="SEV-0">SEV-0</option>
                  <option value="SEV-1">SEV-1</option>
                  <option value="SEV-2">SEV-2</option>
                  <option value="SEV-3">SEV-3</option>
                </select>
              </div>
              <div>
                <label className="ops-label">Service</label>
                <input value={service} onChange={(e) => setService(e.target.value)} className="ops-input" />
              </div>
            </div>
            <div>
              <label className="ops-label">Component</label>
              <input value={component} onChange={(e) => setComponent(e.target.value)} className="ops-input" />
            </div>
            <div>
              <label className="ops-label">Executive summary (editable)</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} className="ops-input resize-none leading-relaxed" />
            </div>
          </div>

          <div className="space-y-5">
            {result.timeline.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ops-text">
                  <Clock className="h-4 w-4 text-ops-subtext" aria-hidden /> Timeline
                </h3>
                <ol className="space-y-3">
                  {result.timeline.map((e, i) => (
                    <li key={i} className="border-l-2 border-slate-200 pl-4">
                      <p className="text-sm font-medium text-ops-text">{e.title}</p>
                      <p className="text-xs text-ops-muted">{e.timestamp} · {e.actor}</p>
                      <p className="mt-0.5 text-xs text-ops-subtext">{e.description}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {result.tasks.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ops-text">
                  <ListTodo className="h-4 w-4 text-ops-subtext" aria-hidden /> Action items ({result.tasks.length})
                </h3>
                <ul className="space-y-2">
                  {result.tasks.map((t, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-ops-border bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-ops-text">{t.title}</span>
                      <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">{t.priority}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-ops-border pt-4">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium text-ops-subtext hover:text-ops-text min-h-[44px]"
          >
            {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Raw log input
          </button>
          {showRaw && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-ops-border bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-ops-subtext whitespace-pre-wrap">
              {rawNotes}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
