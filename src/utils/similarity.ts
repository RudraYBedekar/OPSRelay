/** Human-readable label for vector similarity score (0–100). */
export function similarityLabel(score: number): string {
  if (score >= 90) return 'Very strong match';
  if (score >= 75) return 'Strong match';
  if (score >= 60) return 'Moderate match';
  if (score >= 45) return 'Weak match';
  return 'Low relevance';
}
