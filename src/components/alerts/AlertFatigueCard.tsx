import React, { useEffect, useState } from 'react';
import { BellOff, ShieldAlert } from 'lucide-react';
import { apiService } from '../../services/apiService';
import type { AlertIncidentStats } from '../../types/alertFatigue';

interface AlertFatigueCardProps {
  incidentId: string;
}

export const AlertFatigueCard: React.FC<AlertFatigueCardProps> = ({ incidentId }) => {
  const [stats, setStats] = useState<AlertIncidentStats | null>(null);

  useEffect(() => {
    if (!apiService.isUsingCrdb()) return;
    void apiService
      .getAlertStatsForIncident(incidentId)
      .then((result) => {
        if ('alertId' in result) setStats(result);
        else setStats(null);
      })
      .catch(() => setStats(null));
  }, [incidentId]);

  if (!stats || stats.suppressedCount === 0) return null;

  return (
    <div className="ops-card border-amber-200 bg-amber-50/60 p-5 flex items-start gap-3">
      <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0">
        <BellOff className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-amber-900">Alert fatigue agent</h2>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            {stats.suppressedCount} suppressed
          </span>
        </div>
        <p className="mt-1 text-sm text-amber-900/90">{stats.summaryMessage}</p>
        <p className="mt-2 text-xs text-amber-800/80 flex items-center gap-1">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          Duplicate low-signal alerts were blocked before becoming separate incidents.
        </p>
      </div>
    </div>
  );
};
