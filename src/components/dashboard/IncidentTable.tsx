import React, { useMemo, useState, useEffect } from 'react';
import type { Incident } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { IncidentMobileCard } from './IncidentMobileCard';
import { timeAgo } from '../../utils/formatters';
import { CaretRight, CaretUp, CaretDown, MagnifyingGlass, Funnel, WarningCircle } from '@phosphor-icons/react';

type SortKey = 'title' | 'severity' | 'service' | 'status' | 'updated' | 'owner';
type SortDir = 'asc' | 'desc';

const SEV_ORDER: Record<string, number> = { 'SEV-0': 0, 'SEV-1': 1, 'SEV-2': 2, 'SEV-3': 3 };
const PAGE_SIZE = 10;

function matchesSeverityFilter(severity: string, filter: string): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'CRITICAL') return severity === 'SEV-0' || severity === 'SEV-1';
  return severity === filter;
}

function matchesStatusFilter(status: string, filter: string): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return status !== 'RESOLVED';
  return status === filter;
}

interface IncidentTableProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  searchFilter?: string;
  initialSeverity?: string;
  initialStatus?: string;
  isRefreshing?: boolean;
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 hover:text-ops-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(1,118,211,0.3)] rounded"
    >
      {label}
      {active && (dir === 'asc' ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />)}
    </button>
  );
}

export const IncidentTable: React.FC<IncidentTableProps> = ({
  incidents,
  onSelectIncident,
  searchFilter = '',
  initialSeverity = 'ALL',
  initialStatus = 'ALL',
  isRefreshing = false,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [severity, setSeverity] = useState(initialSeverity);
  const [status, setStatus] = useState(initialStatus);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setSeverity(initialSeverity);
    setStatus(initialStatus);
    setPage(0);
  }, [initialSeverity, initialStatus]);

  useEffect(() => {
    setPage(0);
  }, [incidents.length]);

  const query = (searchFilter || localSearch).toLowerCase();

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (!matchesSeverityFilter(inc.severity, severity)) return false;
      if (!matchesStatusFilter(inc.status, status)) return false;
      if (
        query &&
        !inc.title.toLowerCase().includes(query) &&
        !inc.id.toLowerCase().includes(query) &&
        !inc.service.toLowerCase().includes(query) &&
        !inc.leadSRE.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [incidents, severity, status, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'severity':
          cmp = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
          break;
        case 'service':
          cmp = a.service.localeCompare(b.service);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'owner':
          cmp = a.leadSRE.localeCompare(b.leadSRE);
          break;
        case 'updated':
        default: {
          const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
          const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'title' || key === 'service' || key === 'owner' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  return (
    <div className="ops-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ops-border bg-white px-4 py-3 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="ops-section-title">
          Incidents <span className="font-normal text-ops-muted text-sm">({filtered.length})</span>
          {isRefreshing && <span className="ml-2 text-xs font-normal text-ops-muted">Refreshing…</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[10rem] sm:max-w-[14rem]">
            <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ops-muted" aria-hidden />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => { setLocalSearch(e.target.value); setPage(0); }}
              placeholder="Filter incidents…"
              className="ops-input py-1.5 pl-8 text-xs"
              aria-label="Filter incidents"
            />
          </div>
          <Funnel size={14} className="hidden text-ops-muted sm:block" aria-hidden />
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(0); }}
            className="ops-input w-auto py-1.5 text-xs"
            aria-label="Filter by severity"
          >
            <option value="ALL">All severity</option>
            <option value="CRITICAL">Critical (SEV-0/1)</option>
            <option value="SEV-0">SEV-0</option>
            <option value="SEV-1">SEV-1</option>
            <option value="SEV-2">SEV-2</option>
            <option value="SEV-3">SEV-3</option>
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="ops-input w-auto py-1.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="ALL">All status</option>
            <option value="ACTIVE">Active (not resolved)</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="MITIGATED">Mitigated</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={WarningCircle}
            title="No incidents match"
            description="Try clearing filters or adjusting your search terms."
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ops-border text-left text-[11px] font-semibold uppercase tracking-wide text-ops-muted bg-ops-bg">
                  <th className="px-4 py-2.5">
                    <SortBtn label="Incident" active={sortKey === 'title'} dir={sortDir} onClick={() => toggleSort('title')} />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortBtn label="Severity" active={sortKey === 'severity'} dir={sortDir} onClick={() => toggleSort('severity')} />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortBtn label="Service" active={sortKey === 'service'} dir={sortDir} onClick={() => toggleSort('service')} />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortBtn label="Status" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortBtn label="Updated" active={sortKey === 'updated'} dir={sortDir} onClick={() => toggleSort('updated')} />
                  </th>
                  <th className="px-4 py-2.5">
                    <SortBtn label="Owner" active={sortKey === 'owner'} dir={sortDir} onClick={() => toggleSort('owner')} />
                  </th>
                  <th className="px-5 py-3 w-8"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ops-border">
                {pageItems.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onSelectIncident(inc)}
                    className="group cursor-pointer transition-colors duration-150 hover:bg-ops-cardHover focus-within:bg-ops-cardHover"
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-ops-text leading-snug break-words group-hover:text-brand">{inc.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ops-muted">{inc.id}</p>
                    </td>
                    <td className="px-4 py-3"><SeverityBadge severity={inc.severity} size="sm" /></td>
                    <td className="px-4 py-3">
                      <span className="inline-block max-w-[8rem] truncate text-xs font-medium text-ops-subtext" title={inc.service}>
                        {inc.service}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                    <td className="px-4 py-3 text-xs text-ops-subtext whitespace-nowrap">{timeAgo(inc.updatedAt ?? inc.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-ops-subtext">{inc.leadSRE}</td>
                    <td className="px-4 py-3">
                      <CaretRight size={16} className="text-ops-muted group-hover:text-brand" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden p-3 space-y-2">
            {pageItems.map((inc) => (
              <IncidentMobileCard key={inc.id} incident={inc} onSelect={onSelectIncident} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ops-border px-4 py-3 text-xs text-ops-subtext sm:px-5">
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="ops-btn-secondary min-h-[44px] px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="ops-btn-secondary min-h-[44px] px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
