import { query } from '../db.js';
import { bedrockConfig } from '../config/bedrock.js';
import { embedText, vectorToSql } from './embedService.js';

export interface VectorSearchHit {
  incidentId: string;
  chunkType: string;
  content: string;
  service: string;
  distance: number;
  similarityScore: number;
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

export async function indexIncident(incident: IncidentRecord): Promise<number> {
  await query('DELETE FROM incident_embeddings WHERE incident_id = $1', [incident.id]);

  const summaryChunk = `${incident.title}. ${incident.summary}`;
  const notesChunk = incident.rawNotes?.slice(0, 4000);
  const fixChunks = incident.fixesApplied ?? [];

  const toEmbed: Array<{ type: string; text: string; service: string }> = [
    { type: 'summary', text: summaryChunk, service: incident.service },
  ];
  if (notesChunk) toEmbed.push({ type: 'notes', text: notesChunk, service: incident.service });
  for (const fix of fixChunks) {
    toEmbed.push({ type: 'fix', text: fix, service: incident.service });
  }

  let count = 0;
  for (const chunk of toEmbed) {
    const embedding = await embedText(chunk.text);
    await query(
      `INSERT INTO incident_embeddings (incident_id, chunk_type, content, service, embedding)
       VALUES ($1, $2, $3, $4, $5::VECTOR)`,
      [
        incident.id,
        chunk.type,
        chunk.text.slice(0, 8000),
        chunk.service,
        vectorToSql(embedding),
      ],
    );
    count++;
  }

  return count;
}

export async function searchSimilarIncidents(
  queryText: string,
  limit = 5,
  serviceFilter?: string,
): Promise<VectorSearchHit[]> {
  const queryEmbedding = await embedText(queryText);
  const vectorLiteral = vectorToSql(queryEmbedding);

  const rows = serviceFilter
    ? await query<{
        incident_id: string;
        chunk_type: string;
        content: string;
        service: string;
        distance: number;
      }>(
        `SELECT incident_id, chunk_type, content, service,
                (embedding <=> $1::VECTOR) AS distance
         FROM incident_embeddings
         WHERE service = $2
         ORDER BY embedding <=> $1::VECTOR
         LIMIT $3`,
        [vectorLiteral, serviceFilter, limit * 2],
      )
    : await query<{
        incident_id: string;
        chunk_type: string;
        content: string;
        service: string;
        distance: number;
      }>(
        `SELECT incident_id, chunk_type, content, service,
                (embedding <=> $1::VECTOR) AS distance
         FROM incident_embeddings
         ORDER BY embedding <=> $1::VECTOR
         LIMIT $2`,
        [vectorLiteral, limit * 2],
      );

  const seen = new Set<string>();
  const hits: VectorSearchHit[] = [];

  for (const row of rows) {
    if (seen.has(row.incident_id)) continue;
    seen.add(row.incident_id);
    const similarityScore = Math.round(Math.max(0, (1 - row.distance) * 100));
    hits.push({
      incidentId: row.incident_id,
      chunkType: row.chunk_type,
      content: row.content,
      service: row.service,
      distance: row.distance,
      similarityScore,
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

/** Used when Bedrock is off — keyword fallback scores */
export function keywordSearchFallback(
  queryText: string,
  incidents: IncidentRecord[],
  limit = 5,
): VectorSearchHit[] {
  const lower = queryText.toLowerCase();
  return incidents
    .map((inc) => {
      let score = 60;
      if (lower.includes(inc.id.toLowerCase())) score = 100;
      if (lower.includes(inc.service.toLowerCase())) score += 20;
      if (lower.includes(inc.summary.toLowerCase().slice(0, 50))) score += 10;
      if (lower.includes('db') && inc.summary.toLowerCase().includes('cockroach')) score += 10;
      return {
        incidentId: inc.id,
        chunkType: 'summary',
        content: inc.summary,
        service: inc.service,
        distance: 1 - score / 100,
        similarityScore: Math.min(score, 98),
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

export { bedrockConfig };
