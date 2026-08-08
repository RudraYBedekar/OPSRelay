import React from 'react';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
    <div className="flex items-start gap-3">
      <Warning size={20} weight="fill" className="text-red-600 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Unable to load data</p>
        <p className="text-sm mt-1 text-red-800">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 ops-btn-secondary h-8 px-3 text-xs border-red-200 text-red-800 hover:bg-red-100"
          >
            <ArrowClockwise size={14} aria-hidden />
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);
