import { bedrockConfig } from '../config/bedrock.js';

export const EMBEDDING_DIMENSIONS = bedrockConfig.embedDimensions;

export type EmbeddingProvider = 'bedrock' | 'local';

export interface EmbeddingMeta {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  version: string;
}

export function validateEmbedding(values: number[], expectedDimensions = EMBEDDING_DIMENSIONS): void {
  if (values.length !== expectedDimensions) {
    throw new Error(`Embedding dimension mismatch: expected ${expectedDimensions}, got ${values.length}`);
  }
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`Embedding contains non-finite value at index ${i}`);
    }
  }
}

export function getEmbeddingMeta(provider: EmbeddingProvider): EmbeddingMeta {
  if (provider === 'bedrock') {
    return {
      provider: 'bedrock',
      model: bedrockConfig.embedModel,
      dimensions: EMBEDDING_DIMENSIONS,
      version: '1',
    };
  }
  return {
    provider: 'local',
    model: 'local-hash-v1',
    dimensions: EMBEDDING_DIMENSIONS,
    version: '1',
  };
}

/** Minimum cosine similarity (0–100 scale) to surface vector matches. */
export const SIMILARITY_THRESHOLD = 55;

/** Lower bar for deterministic title/summary keyword matches in the incident corpus. */
export const CORPUS_MATCH_THRESHOLD = 15;
