import React from 'react';
import type { AppIcon } from './iconTypes';
import { ICON_SIZE } from './iconTypes';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: AppIcon;
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
      className={`ops-card p-4 h-full text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(1,118,211,0.25)] ${
        highlight ? 'border-brand-muted bg-brand-light/30' : ''
      } ${onClick ? 'cursor-pointer hover:bg-ops-cardHover' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ops-subtext">{label}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${highlight ? 'text-brand' : 'text-ops-text'}`}>
            {value}
          </p>
          <p className="mt-1 text-xs text-ops-muted">{subtitle}</p>
        </div>
        <div className={`rounded-md p-2 shrink-0 ${highlight ? 'bg-white text-brand' : 'bg-ops-cardHover text-ops-muted'}`}>
          <Icon size={ICON_SIZE.page} weight="regular" aria-hidden />
        </div>
      </div>
    </Tag>
  );
};
