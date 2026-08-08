import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="mb-6 flex flex-col gap-3 border-b border-ops-border pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="ops-page-title">{title}</h1>
      {description && <p className="mt-1 text-sm text-ops-subtext max-w-2xl">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
