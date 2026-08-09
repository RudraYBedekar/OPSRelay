/** Human-readable label for match scores (0–100). */
export function similarityLabel(
  score: number,
  mode: 'vector' | 'keyword' | 'corpus' = 'vector',
): string {
  const kind = mode === 'vector' ? 'Vector match' : 'Keyword relevance';
  if (score >= 90) return `${kind} — very strong`;
  if (score >= 75) return `${kind} — strong`;
  if (score >= 60) return `${kind} — moderate`;
  if (score >= 45) return `${kind} — weak`;
  return mode === 'vector' ? 'Low vector match' : 'Low keyword relevance';
}

export function scoreCaption(score: number, mode: 'vector' | 'keyword' | 'corpus' = 'vector'): string {
  if (mode === 'vector') return `${score}% vector similarity`;
  return `${score}% keyword relevance`;
}
