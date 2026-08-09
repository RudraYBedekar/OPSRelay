import { query, withTransaction, queryWithClient } from '../db.js';
import { bedrockConfig } from '../config/bedrock.js';
import { embedText, vectorToSql, getEmbedMode } from './embedService.js';
import { scanAndRedactSecrets } from '../utils/redactSecrets.js';
import { CORPUS_MATCH_THRESHOLD, SIMILARITY_THRESHOLD } from '../utils/embeddingValidation.js';

export type RetrievalMode = 'vector' | 'keyword' | 'corpus';

export interface VectorSearchHit {
  incidentId: string;
  chunkType: string;
  content: string;
  service: string;
  distance: number;
  similarityScore: number;
  retrievalMode: RetrievalMode;
}

export interface IncidentRecord {
  id: string;
  title: string;
  service: string;
  component?: string;
  severity: string;
  summary: string;
  fixesApplied?: string[];
  mttrMinutes?: number;
  resolvedAt?: string;
  rawNotes?: string;
}

const CORPUS_STOP_WORDS = new Set([
  'inc', 'the', 'this', 'that', 'check', 'about', 'tell', 'what', 'incident',
  'please', 'show', 'give', 'info', 'details', 'status', 'with', 'from', 'have',
  'any', 'are', 'there', 'issue', 'issues', 'problem', 'problems',
]);

function tokenizeCorpusQuery(queryText: string): string[] {
  return queryText
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !CORPUS_STOP_WORDS.has(t));
}

function scoreIncidentAgainstQuery(
  inc: IncidentRecord,
  queryText: string,
  queryTokens: string[],
): number {
  const lower = queryText.toLowerCase();
  const idFromQuery = queryText.match(/\bINC-[A-Z0-9]+\b/i)?.[0]?.toUpperCase();
  const idLower = inc.id.toLowerCase();
  const titleLower = (inc.title ?? '').toLowerCase();
  const summaryLower = (inc.summary ?? '').toLowerCase();
  const serviceLower = (inc.service ?? '').toLowerCase();
  const componentLower = (inc.component ?? '').toLowerCase();
  const notesLower = (inc.rawNotes ?? '').toLowerCase();

  let score = 0;

  if (idFromQuery && inc.id === idFromQuery) score = 100;
  else if (lower.includes(idLower)) score = 100;

  for (const token of queryTokens) {
    if (titleLower.includes(token)) score += 22;
    if (summaryLower.includes(token)) score += 14;
    if (notesLower.includes(token)) score += 12;
    if (serviceLower.includes(token)) score += 24;
    if (componentLower.includes(token)) score += 14;
  }

  if (titleLower.length > 8 && lower.includes(titleLower.slice(0, Math.min(40, titleLower.length)))) {
    score += 40;
  }
  if (serviceLower && lower.includes(serviceLower)) score += 28;

  return Math.min(score, 100);
}

function redactForEmbedding(text: string): string {
  return scanAndRedactSecrets(text).redactedText;
}

export async function indexIncident(incident: IncidentRecord): Promise<number> {
  const summaryChunk = `${incident.title}. ${incident.summary}`;
  const notesChunk = incident.rawNotes ? redactForEmbedding(incident.rawNotes.slice(0, 4000)) : undefined;
  const fixChunks = incident.fixesApplied ?? [];

  const toEmbed: Array<{ type: string; text: string; service: string }> = [
    { type: 'summary', text: summaryChunk, service: incident.service },
  ];
  if (notesChunk) toEmbed.push({ type: 'notes', text: notesChunk, service: incident.service });
  for (const fix of fixChunks) {
    toEmbed.push({ type: 'fix', text: fix, service: incident.service });
  }

  const embedMode = getEmbedMode();

  return withTransaction(async (client) => {
    await queryWithClient(client, 'DELETE FROM incident_embeddings WHERE incident_id = $1', [incident.id]);

    let count = 0;
    for (const chunk of toEmbed) {
      const { values, meta } = await embedText(chunk.text);
      await queryWithClient(
        client,
        `INSERT INTO incident_embeddings (incident_id, chunk_type, content, service, embedding, embedding_provider, embedding_model, embedding_dimensions)
         VALUES ($1, $2, $3, $4, $5::VECTOR, $6, $7, $8)`,
        [
          incident.id,
          chunk.type,
          chunk.text.slice(0, 8000),
          chunk.service,
          vectorToSql(values),
          meta.provider,
          meta.model,
          meta.dimensions,
        ],
      );
      count++;
    }

    if (count === 0) {
      throw new Error(`No embedding chunks produced for ${incident.id} (${embedMode})`);
    }

    return count;
  });
}

export async function searchSimilarIncidents(
  queryText: string,
  limit = 5,
  serviceFilter?: string,
  options?: { excludeIncidentId?: string; allowedIncidentIds?: Set<string> },
): Promise<VectorSearchHit[]> {
  const { values, meta } = await embedText(queryText);
  const vectorLiteral = vectorToSql(values);

  const params: unknown[] = [vectorLiteral, meta.provider, meta.model];
  let sql = `
    SELECT incident_id, chunk_type, content, service,
           (embedding <=> $1::VECTOR) AS distance
    FROM incident_embeddings
    WHERE (embedding_provider = $2 OR embedding_provider IS NULL)
      AND (embedding_model = $3 OR embedding_model IS NULL)`;

  if (serviceFilter) {
    params.push(serviceFilter);
    sql += ` AND service = $${params.length}`;
  }

  params.push(limit * 3);
  sql += ` ORDER BY embedding <=> $1::VECTOR LIMIT $${params.length}`;

  const rows = await query<{
    incident_id: string;
    chunk_type: string;
    content: string;
    service: string;
    distance: number;
  }>(sql, params);

  const seen = new Set<string>();
  const hits: VectorSearchHit[] = [];

  for (const row of rows) {
    if (options?.excludeIncidentId && row.incident_id === options.excludeIncidentId) continue;
    if (options?.allowedIncidentIds && !options.allowedIncidentIds.has(row.incident_id)) continue;
    if (seen.has(row.incident_id)) continue;

    const similarityScore = Math.round(Math.max(0, (1 - row.distance) * 100));
    if (similarityScore < SIMILARITY_THRESHOLD) continue;

    seen.add(row.incident_id);
    hits.push({
      incidentId: row.incident_id,
      chunkType: row.chunk_type,
      content: row.content,
      service: row.service,
      distance: row.distance,
      similarityScore,
      retrievalMode: 'vector',
    });
    if (hits.length >= limit) break;
  }

  return hits;
}

export async function getEmbeddingCount(): Promise<number> {
  const rows = await query<{ n: number }>(
    'SELECT count(*)::int AS n FROM incident_embeddings',
  );
  return rows[0]?.n ?? 0;
}

export async function embedAllIncidentsFromDb(): Promise<number> {
  const rows = await query<{ data: IncidentRecord }>(
    'SELECT data FROM incidents ORDER BY updated_at DESC',
  );

  let total = 0;
  for (const row of rows) {
    total += await indexIncident(row.data);
  }
  return total;
}

/** Score incidents in the full DB corpus by ID, title, service, and summary keywords */
export function searchIncidentsInCorpus(
  queryText: string,
  incidents: IncidentRecord[],
  limit = 5,
): VectorSearchHit[] {
  const queryTokens = tokenizeCorpusQuery(queryText);

  return incidents
    .map((inc) => {
      const similarityScore = scoreIncidentAgainstQuery(inc, queryText, queryTokens);
      return {
        incidentId: inc.id,
        chunkType: 'summary',
        content: inc.summary,
        service: inc.service,
        distance: 1 - similarityScore / 100,
        similarityScore,
        retrievalMode: 'corpus' as const,
      };
    })
    .filter((h) => h.similarityScore >= CORPUS_MATCH_THRESHOLD)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

export function mergeSearchHits(...lists: VectorSearchHit[][]): VectorSearchHit[] {
  const map = new Map<string, VectorSearchHit>();
  for (const list of lists) {
    for (const hit of list) {
      const prev = map.get(hit.incidentId);
      if (!prev || hit.similarityScore > prev.similarityScore) {
        map.set(hit.incidentId, hit);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.similarityScore - a.similarityScore);
}

/** Used when vector search misses — keyword fallback scores */
export function keywordSearchFallback(
  queryText: string,
  incidents: IncidentRecord[],
  limit = 5,
): VectorSearchHit[] {
  const corpus = searchIncidentsInCorpus(queryText, incidents, limit);
  if (corpus.length > 0) return corpus;

  const queryTokens = tokenizeCorpusQuery(queryText);
  return incidents
    .map((inc) => {
      const similarityScore = scoreIncidentAgainstQuery(inc, queryText, queryTokens);
      return {
        incidentId: inc.id,
        chunkType: 'summary',
        content: inc.summary,
        service: inc.service,
        distance: 1 - similarityScore / 100,
        similarityScore,
        retrievalMode: 'keyword' as const,
      };
    })
    .filter((h) => h.similarityScore >= CORPUS_MATCH_THRESHOLD)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

export { bedrockConfig };
