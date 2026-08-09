import { describe, expect, it } from 'vitest';
import { countOpenTasks, countCompletedTasks, isOpenTaskStatus } from '../../src/utils/taskMetrics.js';
import type { ActionItemTask } from '../../src/types/incident.js';

const tasks: ActionItemTask[] = [
  {
    id: 't1',
    incidentId: 'INC-1',
    incidentTitle: 'A',
    title: 'Open',
    assignee: 'Ops',
    status: 'TODO',
    priority: 'HIGH',
    severity: 'SEV-2',
    createdAt: '2026-01-01',
  },
  {
    id: 't2',
    incidentId: 'INC-1',
    incidentTitle: 'A',
    title: 'Working',
    assignee: 'Ops',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    severity: 'SEV-2',
    createdAt: '2026-01-01',
  },
  {
    id: 't3',
    incidentId: 'INC-2',
    incidentTitle: 'B',
    title: 'Blocked',
    assignee: 'Ops',
    status: 'BLOCKED',
    priority: 'LOW',
    severity: 'SEV-3',
    createdAt: '2026-01-01',
  },
  {
    id: 't4',
    incidentId: 'INC-2',
    incidentTitle: 'B',
    title: 'Done',
    assignee: 'Ops',
    status: 'COMPLETED',
    priority: 'LOW',
    severity: 'SEV-3',
    createdAt: '2026-01-01',
  },
];

describe('taskMetrics', () => {
  it('counts open tasks including IN_PROGRESS and BLOCKED', () => {
    expect(countOpenTasks(tasks)).toBe(3);
    expect(countCompletedTasks(tasks)).toBe(1);
  });

  it('treats all four statuses consistently', () => {
    expect(isOpenTaskStatus('TODO')).toBe(true);
    expect(isOpenTaskStatus('IN_PROGRESS')).toBe(true);
    expect(isOpenTaskStatus('BLOCKED')).toBe(true);
    expect(isOpenTaskStatus('COMPLETED')).toBe(false);
  });

  it('shows consistent total and open counts', () => {
    expect(tasks.length - countCompletedTasks(tasks)).toBe(countOpenTasks(tasks));
  });
});
