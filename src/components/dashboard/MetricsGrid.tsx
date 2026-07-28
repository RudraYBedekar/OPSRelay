import React from 'react';
import type { DashboardMetrics } from '../../types/incident';
import { AlertTriangle, Clock, Kanban, Timer } from 'lucide-react';
import { MetricCard } from '../common/MetricCard';

interface MetricsGridProps {
  metrics: DashboardMetrics;
  onCriticalClick?: () => void;
  onTasksClick?: () => void;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, onCriticalClick, onTasksClick }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
    <MetricCard
      label="Critical incidents"
      value={metrics.activeSev0Sev1}
      subtitle="SEV-0 and SEV-1 currently open"
      icon={AlertTriangle}
      highlight={metrics.activeSev0Sev1 > 0}
      onClick={onCriticalClick}
    />
    <MetricCard
      label="Last 24 hours"
      value={metrics.totalIncidents24h}
      subtitle="Total incidents logged today"
      icon={Clock}
    />
    <MetricCard
      label="Average MTTR"
      value={`${metrics.avgMttrMinutes}m`}
      subtitle="Mean time to resolve"
      icon={Timer}
    />
    <MetricCard
      label="Open tasks"
      value={metrics.openTasksCount}
      subtitle="Action items across incidents"
      icon={Kanban}
      onClick={onTasksClick}
    />
  </div>
);
