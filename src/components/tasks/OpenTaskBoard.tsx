import React, { useState } from 'react';
import type { ActionItemTask, TaskStatus } from '../../types/incident';
import { SeverityBadge } from '../common/SeverityBadge';
import { EmptyState } from '../common/EmptyState';
import { getTaskStatusBadgeProps } from '../../utils/formatters';
import { formatDate } from '../../utils/formatters';
import { Kanban, List } from 'lucide-react';

interface OpenTaskBoardProps {
  tasks: ActionItemTask[];
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onInspectIncident: (incidentId: string) => void;
}

const COLS: { status: TaskStatus; title: string; accent: string }[] = [
  { status: 'TODO', title: 'Open', accent: 'border-t-slate-300' },
  { status: 'IN_PROGRESS', title: 'In progress', accent: 'border-t-amber-400' },
  { status: 'BLOCKED', title: 'Blocked', accent: 'border-t-red-400' },
  { status: 'COMPLETED', title: 'Done', accent: 'border-t-emerald-400' },
];

export const OpenTaskBoard: React.FC<OpenTaskBoardProps> = ({
  tasks,
  onUpdateTaskStatus,
  onInspectIncident,
}) => {
  const [filter, setFilter] = useState('ALL');
  const [view, setView] = useState<'board' | 'list'>('board');
  const incidents = [...new Map(tasks.map((t) => [t.incidentId, t.incidentTitle])).entries()];
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
              <Kanban className="h-3.5 w-3.5" /> Board
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              title="List view"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs min-h-[36px] ${view === 'list' ? 'bg-slate-100 font-medium text-ops-text' : 'text-ops-muted'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ops-input w-auto py-1.5 text-sm">
            <option value="ALL">All incidents</option>
            {incidents.map(([id, title]) => (
              <option key={id} value={id}>{id} — {title.slice(0, 40)}</option>
            ))}
          </select>
        </div>
      </div>

      {view === 'list' ? (
        <div className="ops-card overflow-hidden">
          <ul className="divide-y divide-ops-border">
            {filtered.map((task) => {
              const st = getTaskStatusBadgeProps(task.status);
              return (
                <li key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onInspectIncident(task.incidentId)} className="font-mono text-xs font-medium text-brand hover:underline">
                      {task.incidentId}
                    </button>
                    <p className="mt-1 text-sm text-ops-text">{task.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-ops-muted">
                      <SeverityBadge severity={task.severity} size="sm" showLabel={false} />
                      <span>{task.assignee}</span>
                      <span>{formatDate(task.createdAt)}</span>
                    </div>
                  </div>
                  <select
                    value={task.status}
                    onChange={(e) => onUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                    className={`ops-input w-auto text-xs ${st.bg}`}
                    aria-label="Update task status"
                  >
                    <option value="TODO">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="COMPLETED">Done</option>
                  </select>
                </li>
              );
            })}
          </ul>
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
                            onChange={(e) => onUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                            className={`mt-3 w-full text-[10px] font-medium rounded border px-2 py-1 min-h-[36px] ${st.bg}`}
                            aria-label="Update task status"
                          >
                            <option value="TODO">Open</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="BLOCKED">Blocked</option>
                            <option value="COMPLETED">Done</option>
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
