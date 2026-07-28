import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
    <div className="flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium">Something went wrong</p>
        <p className="text-sm mt-1">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 text-sm text-red-700 underline flex items-center gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        )}
      </div>
    </div>
  </div>
);
