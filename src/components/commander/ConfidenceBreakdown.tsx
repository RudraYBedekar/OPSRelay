import React from 'react';
import { Brain, Database, User, Wrench } from 'lucide-react';
import type { CommanderDecision } from '../../types/commander';

interface ConfidenceBreakdownProps {
  decision: CommanderDecision;
  compact?: boolean;
}

function confidenceColor(score: number): string {
  if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

export const ConfidenceBreakdown: React.FC<ConfidenceBreakdownProps> = ({ decision, compact }) => {
  const reasoning = decision.reasoning ?? {};
  const similar = Array.isArray(reasoning.similarIncidents)
    ? (reasoning.similarIncidents as Array<{ id: string; similarityScore?: number; title?: string }>)
    : [];
  const primaryExpert = reasoning.primaryExpert as { name?: string; score?: number; factors?: Record<string, number> } | undefined;
  const technologies = Array.isArray(reasoning.technologies) ? reasoning.technologies as string[] : [];
  const summary = typeof reasoning.summary === 'string' ? reasoning.summary : decision.description;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceColor(decision.confidence)}`}>
        {Math.round(decision.confidence)}% confidence
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-ops-border bg-slate-50/80 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ops-text">{decision.title}</h4>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${confidenceColor(decision.confidence)}`}>
          {Math.round(decision.confidence)}% confidence
        </span>
      </div>
      <p className="text-sm text-ops-subtext">{decision.description}</p>
      {summary && summary !== decision.description && (
        <p className="text-xs italic text-ops-muted">{summary}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {similar.length > 0 && (
          <div className="flex gap-2 rounded-md border border-ops-border bg-white p-2.5">
            <Database className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-medium text-ops-text">Vector memory matches</p>
              <ul className="mt-1 space-y-0.5">
                {similar.slice(0, 3).map((s) => (
                  <li key={s.id} className="text-xs text-ops-subtext">
                    {s.id} — {s.similarityScore ?? '—'}% match
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {primaryExpert && (
          <div className="flex gap-2 rounded-md border border-ops-border bg-white p-2.5">
            <User className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-medium text-ops-text">Expert ranking</p>
              <p className="text-xs text-ops-subtext mt-1">
                {primaryExpert.name} scored {primaryExpert.score}/100
              </p>
              {primaryExpert.factors && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-ops-muted">
                  {Object.entries(primaryExpert.factors).map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {technologies.length > 0 && (
          <div className="flex gap-2 rounded-md border border-ops-border bg-white p-2.5">
            <Wrench className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-medium text-ops-text">Technologies detected</p>
              <p className="text-xs text-ops-subtext mt-1">{technologies.join(', ')}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 rounded-md border border-ops-border bg-white p-2.5">
          <Brain className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ops-text">Decision type</p>
            <p className="text-xs text-ops-subtext mt-1 capitalize">{decision.decisionType.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
