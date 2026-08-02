import { z } from 'zod';

const severitySchema = z.enum(['SEV-0', 'SEV-1', 'SEV-2', 'SEV-3']);

const timelineItemSchema = z.object({
  timestamp: z.string().max(32).optional().default('00:00'),
  title: z.string().max(500).default('Event'),
  description: z.string().max(2000).default(''),
  actor: z.string().max(120).optional().default('OpsRelay AI'),
  type: z.enum(['alert', 'action', 'decision', 'fix', 'detection']).optional().default('detection'),
});

const decisionSchema = z.object({
  title: z.string().max(500).default('Decision'),
  description: z.string().max(2000).default(''),
  madeBy: z.string().max(120).optional().default('SRE Team'),
  timestamp: z.string().max(32).optional().default('00:00'),
  impact: z.string().max(1000).optional().default(''),
});

const taskSchema = z.object({
  title: z.string().max(500),
  assignee: z.string().max(120).optional().default('Unassigned (Ops Team)'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional().default('TODO'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM'),
  severity: severitySchema.optional().default('SEV-2'),
  createdAt: z.string().optional(),
});

export const extractionResultSchema = z.object({
  severity: severitySchema.default('SEV-2'),
  severityReason: z.string().max(2000).optional().default(''),
  service: z.string().max(120).default('unknown-service'),
  component: z.string().max(120).default('unknown-component'),
  summary: z.string().max(4000).default(''),
  confidenceScore: z.number().min(0).max(100).optional().default(85),
  timeline: z.array(timelineItemSchema).max(50).nullish().transform((v) => v ?? []),
  decisions: z.array(decisionSchema).max(30).nullish().transform((v) => v ?? []),
  tasks: z.array(taskSchema).max(30).nullish().transform((v) => v ?? []),
  suggestedFixes: z.array(z.string().max(1000)).max(20).nullish().transform((v) => v ?? []),
});

export type ValidatedExtractionResult = z.infer<typeof extractionResultSchema>;

export function parseExtractionResult(raw: unknown): ValidatedExtractionResult {
  return extractionResultSchema.parse(raw);
}
