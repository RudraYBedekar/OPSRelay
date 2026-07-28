import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ops-border bg-slate-50/50 p-10 text-center">
    <div className="mb-4 rounded-full border border-ops-border bg-white p-3 text-ops-muted">
      <Icon className="h-7 w-7" aria-hidden />
    </div>
    <h3 className="text-base font-semibold text-ops-text">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-ops-subtext">{description}</p>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="ops-btn-primary mt-5 min-h-[44px]">
        {actionLabel}
      </button>
    )}
  </div>
);
