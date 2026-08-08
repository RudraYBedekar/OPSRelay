import React from 'react';
import type { Severity } from '../../types/incident';
import { getSeverityBadgeProps } from '../../utils/formatters';

interface SeverityBadgeProps {
  severity: Severity;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  showLabel = true,
  size = 'md'
}) => {
  const props = getSeverityBadgeProps(severity);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-mono',
    md: 'px-2.5 py-1 text-xs font-mono',
    lg: 'px-3 py-1.5 text-sm font-mono font-semibold'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${props.bg} ${sizeClasses[size]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${props.indicator}`} />
      {showLabel ? props.label : severity}
    </span>
  );
};
