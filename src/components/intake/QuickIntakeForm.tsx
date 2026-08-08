import React, { useState } from 'react';
import type { Incident, Severity } from '../../types/incident';
import { buildQuickIncident } from '../../utils/quickIncident';
import { ShareIncidentDialog } from './ShareIncidentDialog';
import { FloppyDisk, CircleNotch, Lightning } from '@phosphor-icons/react';

interface QuickIntakeFormProps {
  onSave: (incident: Incident, shareWithMemberId?: string) => Promise<void>;
  onSaveSampleLog?: (log: { title: string; content: string; category?: string }) => Promise<void>;
  defaultOwner?: string;
  senderMemberId?: string;
}

export const QuickIntakeForm: React.FC<QuickIntakeFormProps> = ({
  onSave,
  onSaveSampleLog,
  defaultOwner = 'Yash',
  senderMemberId,
}) => {
  const [title, setTitle] = useState('');
  const [service, setService] = useState('');
  const [severity, setSeverity] = useState<Severity>('SEV-2');
  const [owner, setOwner] = useState(defaultOwner);
  const [notes, setNotes] = useState('');
  const [alsoSaveLog, setAlsoSaveLog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingIncident, setPendingIncident] = useState<Incident | null>(null);

  const canSave = title.trim().length > 0 && notes.trim().length > 0 && !saving;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const incident = buildQuickIncident({
      title,
      notes,
      service: service || undefined,
      severity,
      leadSRE: owner,
    });
    setPendingIncident(incident);
    setShareOpen(true);
  };

  const finalizeSave = async (shareWithMemberId?: string) => {
    if (!pendingIncident) return;

    setSaving(true);
    setSavedId(null);
    try {
      await onSave(pendingIncident, shareWithMemberId);

      if (alsoSaveLog && onSaveSampleLog) {
        await onSaveSampleLog({
          title: title.trim(),
          content: notes.trim(),
          category: 'manual',
        });
      }

      setSavedId(pendingIncident.id);
      setTitle('');
      setService('');
      setNotes('');
      setSeverity('SEV-2');
      setShareOpen(false);
      setPendingIncident(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ops-card p-5 md:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
          <Lightning size={20} weight="regular" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ops-text">Quick add</h2>
          <p className="mt-0.5 text-sm text-ops-subtext">
            Name the incident, paste a few lines of logs, and save straight to the database — no AI step.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="quick-title" className="ops-label">Incident name *</label>
          <input
            id="quick-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="ops-input"
            placeholder="e.g. Redis cache eviction spike"
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="quick-service" className="ops-label">Service</label>
            <input
              id="quick-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="ops-input"
              placeholder="billing-service"
            />
          </div>
          <div>
            <label htmlFor="quick-severity" className="ops-label">Severity</label>
            <select
              id="quick-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className="ops-input"
            >
              <option value="SEV-0">SEV-0</option>
              <option value="SEV-1">SEV-1</option>
              <option value="SEV-2">SEV-2</option>
              <option value="SEV-3">SEV-3</option>
            </select>
          </div>
          <div>
            <label htmlFor="quick-owner" className="ops-label">Owner</label>
            <input
              id="quick-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="ops-input"
              placeholder="Yash"
            />
          </div>
        </div>

        <div>
          <label htmlFor="quick-notes" className="ops-label">Logs / notes (few lines) *</label>
          <textarea
            id="quick-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="ops-input resize-y font-mono text-xs leading-relaxed"
            placeholder={`[20:15] ALERT payment-api error rate 18%\n[20:16] rudra: checking recent deploy\n[20:18] rolled back canary v2.3.1`}
            required
          />
        </div>

        {onSaveSampleLog && (
          <label className="flex items-center gap-2 text-sm text-ops-subtext cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={alsoSaveLog}
              onChange={(e) => setAlsoSaveLog(e.target.checked)}
              className="h-4 w-4 rounded border-ops-border text-brand focus:ring-brand-muted"
            />
            Also save as sample log (reuse in AI intake later)
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {savedId ? (
            <p className="text-sm font-medium text-emerald-700">Saved {savedId} to database</p>
          ) : (
            <span className="text-xs text-ops-muted">* Title and at least one log line required</span>
          )}
          <button type="submit" disabled={!canSave} className="ops-btn-primary min-h-[44px] min-w-[140px]">
            {saving ? (
              <><CircleNotch size={16} weight="regular" className="animate-spin" aria-hidden /> Saving…</>
            ) : (
              <><FloppyDisk size={16} weight="regular" aria-hidden /> Save to DB</>
            )}
          </button>
        </div>
      </form>

      <ShareIncidentDialog
        open={shareOpen}
        incidentTitle={pendingIncident?.title ?? title}
        senderMemberId={senderMemberId}
        loading={saving}
        onClose={() => {
          if (saving) return;
          setShareOpen(false);
          setPendingIncident(null);
        }}
        onConfirm={(shareWithMemberId) => void finalizeSave(shareWithMemberId)}
      />
    </div>
  );
};
