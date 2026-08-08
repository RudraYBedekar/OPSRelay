import React from 'react';
import { ArrowSquareOut, Database } from '@phosphor-icons/react';
import type { McpCitation } from '../../types/investigator';

interface McpCitationCardProps {
  citation: McpCitation;
  onInspectIncident?: (id: string) => void;
}

export const McpCitationCard: React.FC<McpCitationCardProps> = ({ citation, onInspectIncident }) => {
  const label = citation.source === 'cockroachdb-managed-mcp' ? 'Managed MCP' : 'SQL demo evidence';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ops-text truncate">{citation.title}</p>
          <p className="text-[11px] text-ops-muted font-mono">{citation.citationId}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          <Database size={12} weight="regular" aria-hidden /> {label}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ops-subtext line-clamp-4">{citation.excerpt}</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ops-muted">
        <span>{citation.service}</span>
        <span>·</span>
        <span>{citation.field}</span>
        {citation.evidenceVersion != null && (
          <>
            <span>·</span>
            <span>v{citation.evidenceVersion}</span>
          </>
        )}
        <span>·</span>
        <span>{new Date(citation.retrievedAt).toLocaleTimeString()}</span>
        {onInspectIncident && (
          <button
            type="button"
            onClick={() => onInspectIncident(citation.incidentId)}
            className="inline-flex items-center gap-1 text-brand hover:underline"
          >
            {citation.incidentId}
            <ArrowSquareOut size={12} weight="regular" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-[10px] text-ops-muted">Provider: {citation.provider}</p>
    </div>
  );
};
