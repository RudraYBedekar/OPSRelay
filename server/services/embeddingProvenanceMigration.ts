import { query } from '../db.js';

/** Add embedding provenance columns to incident_embeddings (idempotent). */
export async function migrateEmbeddingProvenanceSchema(): Promise<void> {
  await query(`
    ALTER TABLE incident_embeddings
    ADD COLUMN IF NOT EXISTS embedding_provider STRING,
    ADD COLUMN IF NOT EXISTS embedding_model STRING,
    ADD COLUMN IF NOT EXISTS embedding_dimensions INT
  `);
}
