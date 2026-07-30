import React from 'react';
import { parseAgentSections, stripMarkdownInline } from '../../utils/formatAgentAnswer';

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold text-ops-text">{bold[1]}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function BlockBody({ body }: { body: string }) {
  const lines = body.split('\n');
  const items: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (list.length > 0 && listType) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      items.push(
        <Tag
          key={items.length}
          className={`my-2 space-y-1.5 pl-5 ${listType === 'ol' ? 'list-decimal' : 'list-disc'}`}
        >
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
        <li key={list.length} className="text-[15px] leading-7 text-ops-text">
          <InlineText text={stripMarkdownInline(trimmed.replace(/^\d+\.\s/, ''))} />
        </li>,
      );
    } else if (/^[-*•]\s/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      list.push(
        <li key={list.length} className="text-[15px] leading-7 text-ops-text">
          <InlineText text={stripMarkdownInline(trimmed.replace(/^[-*•]\s/, ''))} />
        </li>,
      );
    } else {
      flushList();
      items.push(
        <p key={items.length} className="text-[15px] leading-7 text-ops-text">
          <InlineText text={stripMarkdownInline(trimmed)} />
        </p>,
      );
    }
  }
  flushList();

  return <div className="space-y-2">{items}</div>;
}

/** ChatGPT-style markdown rendering for agent answers. */
export const ChatMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const sections = parseAgentSections(content);

  return (
    <div className="space-y-5">
      {sections.map(({ heading, body }) => (
        <section key={heading}>
          {sections.length > 1 && (
            <h4 className="mb-2 text-sm font-semibold text-ops-text">{heading}</h4>
          )}
          <BlockBody body={body} />
        </section>
      ))}
    </div>
  );
};
