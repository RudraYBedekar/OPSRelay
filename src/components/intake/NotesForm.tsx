import React, { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { RAW_LOG_SAMPLE_TEMPLATES } from '../../data/mockData';
import { apiService } from '../../services/apiService';

type SampleLog = { id: string; title: string; content: string; category?: string };

interface NotesFormProps {
  onExtract: (notes: string) => void;
  isExtracting: boolean;
  step: 1 | 2 | 3;
  savedIncidentId?: string;
}

const STEPS = [
  { n: 1, label: 'Paste logs' },
  { n: 2, label: 'Save & analyze' },
  { n: 3, label: 'Review & approve' },
];

export const NotesForm: React.FC<NotesFormProps> = ({ onExtract, isExtracting, step, savedIncidentId }) => {
  const [templates, setTemplates] = useState<SampleLog[]>(RAW_LOG_SAMPLE_TEMPLATES);
  const [notes, setNotes] = useState(RAW_LOG_SAMPLE_TEMPLATES[0].content);
  const [activeSample, setActiveSample] = useState(RAW_LOG_SAMPLE_TEMPLATES[0].id);

  useEffect(() => {
    apiService.getSampleLogs().then((logs) => {
      if (logs.length) {
        setTemplates(logs);
        const demo = logs.find((l) => l.id === 'log-006') ?? logs[0];
        setNotes(demo.content);
        setActiveSample(demo.id);
      }
    }).catch(() => {});
  }, []);

  const pickSample = (tmpl: SampleLog) => {
    setNotes(tmpl.content);
    setActiveSample(tmpl.id);
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Intake progress" className="flex items-center gap-2">
        {STEPS.map(({ n, label }, i) => (
          <React.Fragment key={n}>
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                step >= n ? 'bg-red-50 text-brand' : 'bg-slate-100 text-ops-muted'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                step >= n ? 'bg-brand text-white' : 'bg-white text-ops-muted ring-1 ring-slate-200'
              }`}>
                {step > n ? '✓' : n}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && <div className="hidden h-px w-6 bg-ops-border sm:block" />}
          </React.Fragment>
        ))}
      </nav>

      <div className="ops-card p-5 md:p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ops-text">Step 1 — Paste logs or notes</h2>
          <p className="mt-0.5 text-sm text-ops-subtext">
            Drop in Slack threads, PagerDuty alerts, or pick a sample log from the database.
          </p>
        </div>

        <div>
          <p className="ops-label">Sample logs ({templates.length})</p>
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => pickSample(tmpl)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${
                  activeSample === tmpl.id
                    ? 'border-red-200 bg-red-50 font-medium text-brand'
                    : 'border-ops-border text-ops-subtext hover:border-slate-300 hover:text-ops-text'
                }`}
              >
                {tmpl.title}
              </button>
            ))}
          </div>
        </div>

        {savedIncidentId && isExtracting && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Incident saved as <span className="font-mono font-semibold">{savedIncidentId}</span>
            {' '}— Bedrock is still analyzing. Your notes are already persisted in CockroachDB.
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); if (!isExtracting && notes.trim()) onExtract(notes); }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="raw-notes" className="ops-label">Raw log input</label>
            <textarea
              id="raw-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={14}
              disabled={isExtracting || step >= 3}
              className="ops-input min-h-[240px] resize-y font-mono text-xs leading-relaxed"
              placeholder="Paste Slack threads, PagerDuty alerts, stack traces…"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setNotes(''); setActiveSample(''); }}
              className="text-sm text-ops-subtext hover:text-ops-text min-h-[44px] px-2"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={isExtracting || !notes.trim() || step >= 3}
              className="ops-btn-primary min-h-[44px] min-w-[160px]"
            >
              {isExtracting ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Step 2 — Saving & analyzing…</>
              ) : (
                <><FileText className="h-4 w-4" aria-hidden /> Step 2 — Save & analyze</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
