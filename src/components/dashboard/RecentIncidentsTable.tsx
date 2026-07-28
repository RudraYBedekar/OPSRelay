import React, { useState } from 'react';
import type { Incident } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { timeAgo } from '../../utils/formatters';
import { ChevronRight, Filter } from 'lucide-react';

interface RecentIncidentsTableProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  searchFilter?: string;
}

export const RecentIncidentsTable: React.FC<RecentIncidentsTableProps> = ({
  incidents,
  onSelectIncident,
  searchFilter = '',
}) => {
  const [severity, setSeverity] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const filtered = incidents.filter((inc) => {
    const q = searchFilter.toLowerCase();
    if (severity !== 'ALL' && inc.severity !== severity) return false;
    if (status !== 'ALL' && inc.status !== status) return false;
    if (q && !inc.title.toLowerCase().includes(q) && !inc.id.toLowerCase().includes(q) && !inc.service.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="ops-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-ops-border bg-slate-50/50">
        <h2 className="text-sm font-semibold text-ops-text">
          Incidents <span className="text-ops-muted font-normal">({filtered.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-ops-muted" />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="text-xs ops-input py-1.5 w-auto">
            <option value="ALL">All severity</option>
            <option value="SEV-0">SEV-0</option>
            <option value="SEV-1">SEV-1</option>
            <option value="SEV-2">SEV-2</option>
            <option value="SEV-3">SEV-3</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs ops-input py-1.5 w-auto">
            <option value="ALL">All status</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="MITIGATED">Mitigated</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ops-border text-left text-xs font-medium text-ops-muted uppercase tracking-wide">
              <th className="px-5 py-3">Incident</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ops-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-ops-subtext">No incidents match your filters</td>
              </tr>
            ) : (
              filtered.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident(inc)}
                  className="group hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs font-medium text-brand">{inc.id}</p>
                    <p className="text-ops-text font-medium mt-0.5 line-clamp-1 group-hover:text-brand transition-colors">{inc.title}</p>
                  </td>
                  <td className="px-5 py-4"><SeverityBadge severity={inc.severity} size="sm" /></td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">{inc.service}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={inc.status} /></td>
                  <td className="px-5 py-4 text-xs text-ops-subtext">{timeAgo(inc.createdAt)}</td>
                  <td className="px-5 py-4">
                    <ChevronRight className="h-4 w-4 text-ops-muted group-hover:text-brand transition-colors" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
