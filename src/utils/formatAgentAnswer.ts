export interface AgentSection {
  heading: string;
  body: string;
}

/** Split agent markdown into labeled sections for structured UI rendering. */
export function parseAgentSections(answer: string): AgentSection[] {
  const lines = answer.split('\n');
  const sections: AgentSection[] = [];
  let currentHeading = 'Recommendation';
  let currentBody: string[] = [];

  const flush = () => {
    const body = currentBody.join('\n').trim();
    if (body) sections.push({ heading: currentHeading, body });
    currentBody = [];
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2 || h3) {
      flush();
      currentHeading = (h2?.[1] ?? h3?.[1] ?? 'Section').trim();
    } else {
      currentBody.push(line);
    }
  }
  flush();

  if (sections.length === 0 && answer.trim()) {
    return [{ heading: 'Recommendation', body: answer.trim() }];
  }

  return sections;
}

/** Strip markdown bold markers for plain display. */
export function stripMarkdownInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}
