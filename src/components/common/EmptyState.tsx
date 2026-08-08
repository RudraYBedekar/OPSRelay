import React from 'react';
import { Tray } from '@phosphor-icons/react';
import type { AppIcon } from './iconTypes';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: AppIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Tray,
}) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ops-border bg-white p-10 text-center">
    <div className="mb-4 rounded-md border border-ops-border bg-ops-bg p-3 text-ops-muted">
      <Icon size={28} weight="regular" aria-hidden />
    </div>
    <h3 className="text-base font-semibold text-ops-text">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-ops-subtext">{description}</p>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="ops-btn-primary mt-5">
        {actionLabel}
      </button>
    )}
  </div>
);
