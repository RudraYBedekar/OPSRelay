import React from 'react';
import { Warning } from '@phosphor-icons/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} aria-hidden />
      <div className="relative ops-card max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${destructive ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-ops-subtext'}`}>
            <Warning size={20} weight="regular" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-ops-text">{title}</h2>
            <p className="text-sm text-ops-subtext mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} className="ops-btn-secondary min-h-[44px]">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={destructive ? 'ops-btn-primary min-h-[44px]' : 'ops-btn-primary min-h-[44px]'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
