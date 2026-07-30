import React from 'react';
import type { DashboardMetrics } from '../../types/incident';
import { AlertTriangle, Clock, Kanban, Timer } from 'lucide-react';
import { MetricCard } from '../common/MetricCard';

interface MetricsGridProps {
  metrics: DashboardMetrics;
  openIncidentCount?: number;
  resolvedIncidentCount?: number;
  onCriticalClick?: () => void;
  onTasksClick?: () => void;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  metrics,
  openIncidentCount = 0,
  resolvedIncidentCount = 0,
  onCriticalClick,
  onTasksClick,
}) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    <MetricCard
      label="Critical incidents"
      value={metrics.activeSev0Sev1}
      subtitle={`${openIncidentCount} open · ${resolvedIncidentCount} resolved`}
      icon={AlertTriangle}
      highlight={metrics.activeSev0Sev1 > 0}
      onClick={onCriticalClick}
    />
    <MetricCard
      label="Last 24 hours"
      value={metrics.totalIncidents24h}
      subtitle="Incidents created in last 24h (live)"
      icon={Clock}
    />
    <MetricCard
      label="Average MTTR"
      value={`${metrics.avgMttrMinutes}m`}
      subtitle="From resolved incidents (live)"
      icon={Timer}
    />
    <MetricCard
      label="Open tasks"
      value={metrics.openTasksCount}
      subtitle="Action items not yet done (live)"
      icon={Kanban}
      onClick={onTasksClick}
    />
  </div>
);
