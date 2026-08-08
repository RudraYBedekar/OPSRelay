import React, { useMemo, useState } from 'react';
import type { Incident } from '../../types/incident';
import { apiService } from '../../services/apiService';
import { useToast } from '../common/Toast';
import { PaperPlaneTilt, UserCircle } from '@phosphor-icons/react';

interface SendToEmployeePanelProps {
  incidents: Incident[];
  senderMemberId?: string;
  onShared?: () => void;
}

export const SendToEmployeePanel: React.FC<SendToEmployeePanelProps> = ({
  incidents,
  senderMemberId,
  onShared,
}) => {
  const { toast } = useToast();
  const [incidentId, setIncidentId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [sending, setSending] = useState(false);

  const ownedIncidents = useMemo(
    () => incidents.filter((i) => !i.ownerMemberId || i.ownerMemberId === senderMemberId),
    [incidents, senderMemberId],
  );

  const normalized = memberId.trim().toUpperCase();
  const validFormat = !normalized || /^MEM-[A-Z0-9]{8}$/.test(normalized);
  const isSelf = Boolean(senderMemberId && normalized && normalized === senderMemberId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentId || !normalized || !validFormat || isSelf) return;

    setSending(true);
    try {
      await apiService.shareIncidentWithMember(incidentId, normalized);
      toast(`Incident shared with ${normalized}. They can now use it in Ask AI.`, 'success');
      setMemberId('');
      setIncidentId('');
      onShared?.();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Share failed', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ops-card p-5 md:p-6 space-y-5 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-brand-light p-2 text-brand">
          <PaperPlaneTilt size={20} weight="regular" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ops-text">Send to employee</h2>
          <p className="mt-0.5 text-sm text-ops-subtext">
            Share one of your incidents with a teammate using their unique member ID. Once shared, they can review it on their dashboard and ask Ask AI about it.
          </p>
        </div>
      </div>

      {senderMemberId && (
        <div className="rounded-lg border border-ops-border bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">Your member ID</p>
          <p className="mt-1 font-mono text-sm font-semibold text-brand">{senderMemberId}</p>
        </div>
      )}

      {ownedIncidents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ops-border px-4 py-8 text-center">
          <UserCircle size={32} weight="regular" className="mx-auto text-ops-muted" aria-hidden />
          <p className="mt-2 text-sm font-medium text-ops-text">No incidents to share yet</p>
          <p className="mt-1 text-xs text-ops-muted">Create an incident first under New Incident.</p>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSend(e)} className="space-y-4">
          <div>
            <label htmlFor="share-incident" className="ops-label">Your incident</label>
            <select
              id="share-incident"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              className="ops-input mt-1"
              required
            >
              <option value="">Select an incident…</option>
              {ownedIncidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.id} — {inc.title.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="share-employee-id" className="ops-label">Employee member ID</label>
            <input
              id="share-employee-id"
              type="text"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value.toUpperCase())}
              placeholder="MEM-XXXXXXXX"
              className="ops-input font-mono text-sm mt-1"
              required
            />
            {!validFormat && (
              <p className="mt-1 text-xs text-red-600">Use format MEM-XXXXXXXX</p>
            )}
            {isSelf && (
              <p className="mt-1 text-xs text-red-600">You cannot send an incident to yourself.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={sending || !incidentId || !normalized || !validFormat || isSelf}
            className="ops-btn-primary min-h-[44px]"
          >
            {sending ? 'Sending…' : 'Send incident'}
          </button>
        </form>
      )}
    </div>
  );
};
