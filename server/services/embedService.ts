import { bedrockConfig, isBedrockConfigured } from '../config/bedrock.js';
import { invokeBedrockModel } from './bedrockClient.js';
import { localEmbed } from './localEmbedService.js';
import {
  validateEmbedding,
  getEmbeddingMeta,
  type EmbeddingMeta,
  type EmbeddingProvider,
} from '../utils/embeddingValidation.js';

export interface EmbedResult {
  values: number[];
  meta: EmbeddingMeta;
}

/** Convert embedding array to CockroachDB VECTOR literal */
export function vectorToSql(values: number[]): string {
  return `[${values.join(',')}]`;
}

export async function embedText(text: string): Promise<EmbedResult> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) throw new Error('Cannot embed empty text');

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isBedrockConfigured()) {
    if (isProduction) {
      throw new Error('Bedrock embedding is required in production');
    }
    const values = localEmbed(trimmed);
    validateEmbedding(values);
    return { values, meta: getEmbeddingMeta('local') };
  }

  try {
    const isTitanV2 = bedrockConfig.embedModel.includes('titan-embed-text-v2');
    const body = isTitanV2
      ? { inputText: trimmed, dimensions: bedrockConfig.embedDimensions, normalize: true }
      : { inputText: trimmed };

    const result = (await invokeBedrockModel(bedrockConfig.embedModel, body)) as {
      embedding?: number[];
    };

    if (!result.embedding?.length) throw new Error('Bedrock returned empty embedding');
    validateEmbedding(result.embedding);
    return { values: result.embedding, meta: getEmbeddingMeta('bedrock') };
  } catch (err) {
    if (isProduction) {
      throw err instanceof Error ? err : new Error('Bedrock embedding failed');
    }
    console.warn('Bedrock embed failed, using local fallback (dev only):', err instanceof Error ? err.message : err);
    const values = localEmbed(trimmed);
    validateEmbedding(values);
    return { values, meta: getEmbeddingMeta('local') };
  }
}

export function getEmbedMode(): EmbeddingProvider {
  return isBedrockConfigured() ? 'bedrock' : 'local';
}
