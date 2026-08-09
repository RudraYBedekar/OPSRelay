import React, { useState } from 'react';
import type { ActionItemTask, Incident, TaskStatus } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { EmptyState } from '../common/EmptyState';
import { getTaskStatusBadgeProps } from '../../utils/formatters';
import { formatDate, timeAgo } from '../../utils/formatters';
import { Kanban, List } from '@phosphor-icons/react';

interface OpenTaskBoardProps {
  tasks: ActionItemTask[];
  incidents: Incident[];
  onUpdateTaskStatus: (incidentId: string, taskId: string, newStatus: TaskStatus) => void;
  onInspectIncident: (incidentId: string) => void;
}

const COLS: { status: TaskStatus; title: string; accent: string }[] = [
  { status: 'TODO', title: 'Open', accent: 'border-t-slate-300' },
  { status: 'IN_PROGRESS', title: 'In progress', accent: 'border-t-amber-400' },
  { status: 'BLOCKED', title: 'Blocked', accent: 'border-t-red-400' },
  { status: 'COMPLETED', title: 'Done', accent: 'border-t-emerald-400' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'COMPLETED', label: 'Done' },
];

export const OpenTaskBoard: React.FC<OpenTaskBoardProps> = ({
  tasks,
  incidents,
  onUpdateTaskStatus,
  onInspectIncident,
}) => {
  const [filter, setFilter] = useState('ALL');
  const [view, setView] = useState<'board' | 'list'>('board');
  const taskIncidents = [...new Map(tasks.map((t) => [t.incidentId, t.incidentTitle])).entries()];
  const openIncidents = incidents
    .filter((i) => i.status !== 'RESOLVED')
    .map((i) => [i.id, i.title] as const);
  const incidentOptions = [
    ...new Map([...openIncidents, ...taskIncidents]).entries(),
  ];
  const filtered = filter === 'ALL' ? tasks : tasks.filter((t) => t.incidentId === filter);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="No open tasks"
        description="Action items from incidents will appear here once created."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ops-subtext">{filtered.length} tasks</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-ops-border p-0.5">
            <button
              type="button"
              onClick={() => setView('board')}
              title="Kanban board"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs min-h-[36px] ${view === 'board' ? 'bg-slate-100 font-medium text-ops-text' : 'text-ops-muted'}`}
            >
              <Kanban size={14} weight="regular" aria-hidden /> Board
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs min-h-[36px] ${view === 'list' ? 'bg-slate-100 font-medium text-ops-text' : 'text-ops-muted'}`}
            >
              <List size={14} weight="regular" aria-hidden /> List
            </button>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ops-input w-auto py-1.5 text-sm">
            <option value="ALL">All incidents</option>
            {incidentOptions.map(([id, title]) => (
              <option key={id} value={id}>{id} — {title.slice(0, 40)}</option>
            ))}
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="ops-card overflow-hidden">
          <div className="border-b border-ops-border bg-slate-50/60 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-ops-text">
              Task list <span className="font-normal text-ops-muted">({filtered.length})</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ops-border text-left text-[11px] font-medium uppercase tracking-wide text-ops-muted">
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Incident</th>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Assignee</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ops-border">
                {filtered.map((task) => {
                  const st = getTaskStatusBadgeProps(task.status);
                  return (
                    <tr key={task.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-medium text-ops-text leading-snug break-words">{task.title}</p>
                        <p className="mt-0.5 text-xs text-ops-muted line-clamp-1">{task.incidentTitle}</p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectIncident(task.incidentId)}
                          className="font-mono text-xs font-medium text-brand hover:underline"
                        >
                          {task.incidentId}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <SeverityBadge severity={task.severity} size="sm" />
                      </td>
                      <td className="px-5 py-4 text-xs text-ops-subtext">{task.assignee}</td>
                      <td className="px-5 py-4 text-xs text-ops-subtext whitespace-nowrap">
                        <span title={formatDate(task.createdAt)}>{timeAgo(task.createdAt)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={task.status}
                          onChange={(e) => onUpdateTaskStatus(task.incidentId, task.id, e.target.value as TaskStatus)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium min-h-[36px] ${st.bg}`}
                          aria-label="Update task status"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map(({ status, title, accent }) => {
            const col = filtered.filter((t) => t.status === status);
            return (
              <div key={status} className={`ops-card overflow-hidden border-t-4 ${accent}`}>
                <div className="border-b border-ops-border bg-slate-50/80 px-4 py-3">
                  <h3 className="text-sm font-semibold text-ops-text">{title}</h3>
                  <p className="text-xs text-ops-muted">{col.length} items</p>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto p-3 min-h-[100px]">
                  {col.length === 0 ? (
                    <p className="py-6 text-center text-xs text-ops-muted">No tasks</p>
                  ) : (
                    col.map((task) => {
                      const st = getTaskStatusBadgeProps(task.status);
                      return (
                        <div key={task.id} className="rounded-lg border border-ops-border bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                          <button type="button" onClick={() => onInspectIncident(task.incidentId)} className="font-mono text-[11px] font-medium text-brand hover:underline">
                            {task.incidentId}
                          </button>
                          <p className="mt-1.5 text-sm leading-snug text-ops-text">{task.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ops-muted">
                            <SeverityBadge severity={task.severity} size="sm" showLabel={false} />
                            <span>{task.assignee}</span>
                          </div>
                          <select
                            value={task.status}
                            onChange={(e) => onUpdateTaskStatus(task.incidentId, task.id, e.target.value as TaskStatus)}
                            className={`mt-3 w-full text-[10px] font-medium rounded border px-2 py-1 min-h-[36px] ${st.bg}`}
                            aria-label="Update task status"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
