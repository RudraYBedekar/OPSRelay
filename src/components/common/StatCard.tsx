import React from 'react';
import type { AppIcon } from './iconTypes';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: AppIcon;
  highlight?: boolean;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, highlight, subtitle }) => (
  <div className={`ops-card p-5 ${highlight ? 'ring-2 ring-brand-muted border-brand-muted' : ''}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">{title}</p>
        <p className={`text-3xl font-semibold mt-2 tabular-nums ${highlight ? 'text-brand' : 'text-ops-text'}`}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-ops-subtext mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${highlight ? 'bg-brand-light text-brand' : 'bg-slate-100 text-ops-muted'}`}>
        <Icon size={20} weight="regular" aria-hidden />
      </div>
    </div>
  </div>
);
