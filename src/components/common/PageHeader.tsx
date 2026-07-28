import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 className="text-xl font-bold tracking-tight text-ops-text md:text-2xl">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-ops-subtext">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
