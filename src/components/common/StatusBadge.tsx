import React from 'react';
import type { IncidentStatus } from '../../types/incident';
import { getStatusBadgeProps } from '../../utils/formatters';

interface StatusBadgeProps {
  status: IncidentStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const props = getStatusBadgeProps(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${props.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {props.label}
    </span>
  );
};
