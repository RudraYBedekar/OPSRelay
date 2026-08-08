import React from 'react';
import { Robot } from '@phosphor-icons/react';
import { parseAgentSections, stripMarkdownInline } from '../../utils/formatAgentAnswer';

interface AgentRecommendationProps {
  answer: string;
  mode: string;
}

function SectionBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const items: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (list.length > 0 && listType) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      items.push(
        <Tag key={items.length} className={`my-2 space-y-1.5 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} ml-4`}>
          {list}
        </Tag>,
      );
      list = [];
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      list.push(
        <li key={list.length} className="text-sm leading-relaxed text-ops-subtext pl-1">
          {stripMarkdownInline(trimmed.replace(/^\d+\.\s/, ''))}
        </li>,
      );
    } else if (/^[-*•]\s/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      list.push(
        <li key={list.length} className="text-sm leading-relaxed text-ops-subtext pl-1">
          {stripMarkdownInline(trimmed.replace(/^[-*•]\s/, ''))}
        </li>,
      );
    } else {
      flushList();
      items.push(
        <p key={items.length} className="text-sm leading-relaxed text-ops-subtext">
          {stripMarkdownInline(trimmed)}
        </p>,
      );
    }
  }
  flushList();

  return <div className="space-y-1">{items}</div>;
}

export const AgentRecommendation: React.FC<AgentRecommendationProps> = ({ answer, mode }) => {
  const sections = parseAgentSections(answer);

  return (
    <div className="ops-card overflow-hidden">
      <div className="border-b border-ops-border bg-slate-50/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-2 text-ops-subtext ring-1 ring-ops-border">
            <Robot size={16} weight="regular" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ops-text">Agent recommendation</h3>
            <p className="text-xs text-ops-muted">Structured operational guidance · {mode}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-ops-border">
        {sections.map(({ heading, body }) => (
          <section key={heading} className="px-5 py-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ops-muted">
              {heading}
            </h4>
            <SectionBody body={body} />
          </section>
        ))}
      </div>
    </div>
  );
};
