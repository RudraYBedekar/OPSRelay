import React, { useState } from 'react';
import { PaperPlaneTilt, X } from '@phosphor-icons/react';

interface ShareIncidentDialogProps {
  open: boolean;
  incidentTitle: string;
  senderMemberId?: string;
  onClose: () => void;
  onConfirm: (shareWithMemberId?: string) => void;
  loading?: boolean;
}

export const ShareIncidentDialog: React.FC<ShareIncidentDialogProps> = ({
  open,
  incidentTitle,
  senderMemberId,
  onClose,
  onConfirm,
  loading = false,
}) => {
  const [memberId, setMemberId] = useState('');

  if (!open) return null;

  const normalized = memberId.trim().toUpperCase();
  const validFormat = !normalized || /^MEM-[A-Z0-9]{8}$/.test(normalized);
  const isSelf = Boolean(senderMemberId && normalized && normalized === senderMemberId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="ops-card w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between border-b border-ops-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ops-text">Send incident</h2>
            <p className="mt-1 text-sm text-ops-subtext line-clamp-2">{incidentTitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X size={16} weight="regular" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-ops-subtext">
            Enter the recipient&apos;s unique member ID to share this incident. They will only see this incident after you send it.
          </p>
          <div>
            <label htmlFor="share-member-id" className="ops-label">Recipient member ID</label>
            <input
              id="share-member-id"
              type="text"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value.toUpperCase())}
              placeholder="MEM-XXXXXXXX"
              className="ops-input font-mono text-sm mt-1"
              autoFocus
            />
            {!validFormat && (
              <p className="mt-1 text-xs text-red-600">Use format MEM-XXXXXXXX</p>
            )}
            {isSelf && (
              <p className="mt-1 text-xs text-red-600">You cannot send an incident to yourself.</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => onConfirm(undefined)}
              className="ops-btn-secondary min-h-[44px]"
            >
              Save only (don&apos;t share)
            </button>
            <button
              type="button"
              disabled={loading || !normalized || !validFormat || isSelf}
              onClick={() => onConfirm(normalized)}
              className="ops-btn-primary min-h-[44px]"
            >
              {loading ? 'Sending…' : (
                <>
                  <PaperPlaneTilt size={16} weight="regular" aria-hidden />
                  Save &amp; send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
