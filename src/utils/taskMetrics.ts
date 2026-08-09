import type { ActionItemTask, TaskStatus } from '../types/incident';

export const OPEN_TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

export function isOpenTaskStatus(status: TaskStatus): boolean {
  return OPEN_TASK_STATUSES.includes(status);
}

export function countOpenTasks(tasks: ActionItemTask[]): number {
  return tasks.filter((t) => isOpenTaskStatus(t.status)).length;
}

export function countCompletedTasks(tasks: ActionItemTask[]): number {
  return tasks.filter((t) => t.status === 'COMPLETED').length;
}

export function countTotalTasks(tasks: ActionItemTask[]): number {
  return tasks.length;
}
