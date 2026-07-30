import React from 'react';
import type { DashboardMetrics } from '../../types/incident';
import { AlertTriangle, Clock, Kanban, Layers, Timer } from 'lucide-react';
import { MetricCard } from '../common/MetricCard';

interface MetricsGridProps {
  metrics: DashboardMetrics;
  openIncidentCount?: number;
  resolvedIncidentCount?: number;
  onOpenClick?: () => void;
  onCriticalClick?: () => void;
  onTasksClick?: () => void;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  openIncidentCount = 0,
  resolvedIncidentCount = 0,
  onOpenClick,
  onCriticalClick,
  onTasksClick,
}) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
    <MetricCard
      label="Open incidents"
      value={openIncidentCount}
      subtitle={`${metrics.activeSev0Sev1} critical · ${resolvedIncidentCount} resolved`}
      icon={Layers}
      highlight={openIncidentCount > 0}
      onClick={onOpenClick}
    />
    <MetricCard
      label="Critical (SEV-0/1)"
      value={metrics.activeSev0Sev1}
      subtitle="Open high-severity incidents"
      icon={AlertTriangle}
      highlight={metrics.activeSev0Sev1 > 0}
      onClick={onCriticalClick}
    />
    <MetricCard
      label="Last 24 hours"
      value={metrics.totalIncidents24h}
      subtitle="Created in the last 24h"
      icon={Clock}
    />
    <MetricCard
      label="Average MTTR"
      value={`${metrics.avgMttrMinutes}m`}
      subtitle="From resolved incidents"
      icon={Timer}
    />
    <MetricCard
      label="Open tasks"
      value={metrics.openTasksCount}
      subtitle="Action items not done"
      icon={Kanban}
      onClick={onTasksClick}
    />
  </div>
);
