import React from 'react';
import { BellOff, AlertTriangle } from 'lucide-react';
import type { AlertSuppressedResponse } from '../../types/alertFatigue';

interface AlertSuppressedBannerProps {
  suppression: AlertSuppressedResponse;
  onCreateAnyway: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

export const AlertSuppressedBanner: React.FC<AlertSuppressedBannerProps> = ({
  suppression,
  onCreateAnyway,
  onDismiss,
  busy,
}) => (
  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0">
        <BellOff className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-amber-900">Alert suppressed — duplicate noise</h3>
        <p className="mt-1 text-sm text-amber-900/90">
          {suppression.message ?? 'This alert matches a recent resolved or noise-classified pattern.'}
        </p>
        {suppression.similarity != null && (
          <p className="mt-1 text-xs text-amber-800">
            Vector similarity: {Math.round(suppression.similarity * 100)}%
            {suppression.matchedAlert?.linkedIncidentId && (
              <> · linked to {suppression.matchedAlert.linkedIncidentId}</>
            )}
          </p>
        )}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCreateAnyway}
        disabled={busy}
        className="ops-btn-primary text-sm min-h-[36px]"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Actually distinct — create incident
      </button>
      <button type="button" onClick={onDismiss} className="ops-btn-secondary text-sm min-h-[36px]">
        Dismiss
      </button>
    </div>
    <p className="text-[11px] text-amber-800/70">
      Suppression is read-only and reversible. No auto-resolution or escalation — you decide.
    </p>
  </div>
);
