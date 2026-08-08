import React from 'react';
import { Warning, Copy } from '@phosphor-icons/react';
import type { DuplicateCandidate } from '../../types/alertFatigue';

interface DuplicateCandidateBannerProps {
  candidate: DuplicateCandidate;
  incidentId: string;
  onMarkDistinct?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}

export const DuplicateCandidateBanner: React.FC<DuplicateCandidateBannerProps> = ({
  candidate,
  incidentId,
  onMarkDistinct,
  onDismiss,
  busy,
}) => {
  if (candidate.state !== 'candidate') return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0">
          <Copy size={20} weight="regular" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Possible duplicate alert</h3>
          <p className="mt-1 text-sm text-amber-900/90">
            {candidate.message ?? 'This incident is saved. A similar pattern was seen recently.'}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Incident {incidentId} is already in the database.
            {candidate.similarity != null && (
              <> · Vector similarity: {Math.round(candidate.similarity * 100)}%</>
            )}
            {candidate.matchedIncidentId && (
              <> · similar to {candidate.matchedIncidentId}</>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onMarkDistinct && candidate.matchedAlertId && (
          <button
            type="button"
            onClick={onMarkDistinct}
            disabled={busy}
            className="ops-btn-primary text-sm min-h-[36px]"
          >
            <Warning size={16} weight="regular" aria-hidden />
            Keep as distinct incident
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="ops-btn-secondary text-sm min-h-[36px]">
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

/** @deprecated Use DuplicateCandidateBanner */
export const AlertSuppressedBanner = DuplicateCandidateBanner;
