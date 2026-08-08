import React from 'react';
import { WarningCircle, Terminal, ArrowRight } from '@phosphor-icons/react';

interface ActiveAlertsWidgetProps {
  onOpenIntake: () => void;
  onOpenMemory: () => void;
}

export const ActiveAlertsWidget: React.FC<ActiveAlertsWidgetProps> = ({ onOpenIntake, onOpenMemory }) => {
  const alerts = [
    {
      id: 'alt-1',
      title: 'PgBouncer Pool Utilization > 85%',
      cluster: 'us-east-1a / prod-db-01',
      time: '4m ago',
      severity: 'HIGH',
    },
    {
      id: 'alt-2',
      title: 'Auth Service Pod RSS Memory 1.95Gi / 2.0Gi',
      cluster: 'us-east-1 / k8s-main',
      time: '12m ago',
      severity: 'CRITICAL',
    }
  ];

  return (
    <div className="rounded-xl border border-ops-border bg-ops-card p-5 space-y-4 shadow-card-dark">
      <div className="flex items-center justify-between border-b border-ops-border pb-3">
        <div className="flex items-center gap-2">
          <WarningCircle size={16} weight="regular" className="text-cockroach-red" aria-hidden />
          <h3 className="font-mono text-sm font-bold uppercase text-white tracking-wider">
            Active Cluster Telemetry Alerts
          </h3>
        </div>
        <span className="font-mono text-xs text-ops-muted">2 Ingested</span>
      </div>

      <div className="space-y-2.5">
        {alerts.map(alt => (
          <div
            key={alt.id}
            className="flex items-center justify-between rounded-lg bg-ops-sidebar p-3 border border-ops-border hover:border-cockroach-red/40 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cockroach-red animate-pulse" />
                <span className="font-mono text-xs font-semibold text-white">{alt.title}</span>
              </div>
              <p className="mt-1 text-[11px] font-mono text-ops-subtext">{alt.cluster} • {alt.time}</p>
            </div>

            <button
              onClick={onOpenIntake}
              className="flex items-center gap-1 text-xs font-mono text-cockroach-red hover:underline"
            >
              <span>Auto-Ingest</span>
              <ArrowRight size={12} weight="regular" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-ops-border flex items-center justify-between text-xs font-mono">
        <button
          onClick={onOpenMemory}
          className="flex items-center gap-1.5 text-ops-subtext hover:text-white transition-colors"
        >
          <Terminal size={14} weight="regular" className="text-cockroach-red" aria-hidden />
          <span>Ask OpsRelay RAG Memory...</span>
        </button>
      </div>
    </div>
  );
};
