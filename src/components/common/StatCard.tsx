import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  highlight?: boolean;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, highlight, subtitle }) => (
  <div className={`ops-card p-5 ${highlight ? 'ring-2 ring-red-100 border-red-200' : ''}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ops-muted">{title}</p>
        <p className={`text-3xl font-semibold mt-2 tabular-nums ${highlight ? 'text-brand' : 'text-ops-text'}`}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-ops-subtext mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${highlight ? 'bg-red-100 text-brand' : 'bg-slate-100 text-ops-muted'}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);
