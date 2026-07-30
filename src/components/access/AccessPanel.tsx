import React, { useCallback, useEffect, useState } from 'react';
import type { AccessGrant, AccessRequest } from '../../types/access';
import { apiService } from '../../services/apiService';
import { useToast } from '../common/Toast';
import { X, UserPlus, Check, XCircle, Copy } from 'lucide-react';

interface AccessPanelProps {
  memberId: string;
  onClose: () => void;
}

export const AccessPanel: React.FC<AccessPanelProps> = ({ memberId, onClose }) => {
  const { toast } = useToast();
  const [ownerMemberId, setOwnerMemberId] = useState('');
  const [message, setMessage] = useState('');
  const [incoming, setIncoming] = useState<AccessRequest[]>([]);
  const [outgoing, setOutgoing] = useState<AccessRequest[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out, g] = await Promise.all([
        apiService.getIncomingAccessRequests(),
        apiService.getOutgoingAccessRequests(),
        apiService.getAccessGrants(),
      ]);
      setIncoming(inc);
      setOutgoing(out);
      setGrants(g);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to load access data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const copyMemberId = async () => {
    try {
      await navigator.clipboard.writeText(memberId);
      toast('Member ID copied', 'success');
    } catch {
      toast('Could not copy member ID', 'error');
    }
  };

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiService.requestIncidentAccess(ownerMemberId.trim(), message.trim() || undefined);
      toast('Access request sent', 'success');
      setOwnerMemberId('');
      setMessage('');
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Request failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (id: string, approve: boolean) => {
    try {
      if (approve) await apiService.approveAccessRequest(id);
      else await apiService.rejectAccessRequest(id);
      toast(approve ? 'Access approved' : 'Request rejected', 'success');
      await refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ops-card w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between border-b border-ops-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ops-text">Incident access</h2>
            <p className="text-xs text-ops-muted mt-0.5">Share your member ID so others can request to view your incidents.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-lg border border-ops-border bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">Your member ID</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-brand">{memberId}</p>
              <button type="button" onClick={() => void copyMemberId()} className="ops-btn-secondary text-xs py-1.5 px-2.5">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>

          <form onSubmit={(e) => void sendRequest(e)} className="space-y-3">
            <p className="text-sm font-medium text-ops-text flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Request access to someone&apos;s incidents
            </p>
            <input
              type="text"
              value={ownerMemberId}
              onChange={(e) => setOwnerMemberId(e.target.value.toUpperCase())}
              placeholder="MEM-XXXXXXXX"
              className="ops-input font-mono text-sm"
              required
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message to the owner…"
              rows={2}
              className="ops-input text-sm resize-none"
            />
            <button type="submit" disabled={submitting} className="ops-btn-primary w-full">
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </form>

          {loading ? (
            <p className="text-sm text-ops-muted">Loading requests…</p>
          ) : (
            <>
              {incoming.filter((r) => r.status === 'pending').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ops-text mb-2">Incoming requests</p>
                  <ul className="space-y-2">
                    {incoming.filter((r) => r.status === 'pending').map((r) => (
                      <li key={r.id} className="rounded-lg border border-ops-border p-3">
                        <p className="text-sm font-medium text-ops-text">{r.requesterName}</p>
                        <p className="text-xs font-mono text-ops-muted">{r.requesterMemberId}</p>
                        {r.message && <p className="text-xs text-ops-subtext mt-1">{r.message}</p>}
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => void respond(r.id, true)} className="ops-btn-primary text-xs py-1.5 px-3">
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button type="button" onClick={() => void respond(r.id, false)} className="ops-btn-secondary text-xs py-1.5 px-3">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {outgoing.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ops-text mb-2">Your requests</p>
                  <ul className="space-y-2">
                    {outgoing.slice(0, 5).map((r) => (
                      <li key={r.id} className="rounded-lg border border-ops-border px-3 py-2 text-xs">
                        <span className="font-mono text-brand">{r.ownerMemberId}</span>
                        <span className={`ml-2 capitalize ${r.status === 'approved' ? 'text-emerald-700' : r.status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {grants.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ops-text mb-2">Members with access to your incidents</p>
                  <ul className="space-y-1">
                    {grants.map((g) => (
                      <li key={g.viewerMemberId} className="text-xs font-mono text-ops-subtext">{g.viewerMemberId}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
