import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  highlight?: boolean;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  highlight,
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`ops-card p-5 h-full text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${
        highlight ? 'border-red-200 ring-1 ring-red-100' : ''
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`rounded-lg p-2.5 ${highlight ? 'bg-red-50 text-brand' : 'bg-slate-100 text-ops-subtext'}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <div>
          <p className={`text-3xl font-bold tabular-nums tracking-tight ${highlight ? 'text-brand' : 'text-ops-text'}`}>
            {value}
          </p>
          <p className="mt-1 text-sm font-medium text-ops-text">{label}</p>
          <p className="mt-0.5 text-xs text-ops-subtext">{subtitle}</p>
        </div>
      </div>
    </Tag>
  );
};
