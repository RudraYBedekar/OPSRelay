import { z } from 'zod';

export const taskStatusSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']),
});

export type ValidatedTaskStatus = z.infer<typeof taskStatusSchema>['status'];

export function parseTaskStatus(body: unknown): ValidatedTaskStatus {
  return taskStatusSchema.parse(body).status;
}
