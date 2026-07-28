import { bedrockConfig, isBedrockConfigured } from '../config/bedrock.js';
import { invokeBedrockModel } from './bedrockClient.js';
import { localEmbed } from './localEmbedService.js';

/** Convert embedding array to CockroachDB VECTOR literal */
export function vectorToSql(values: number[]): string {
  return `[${values.join(',')}]`;
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) throw new Error('Cannot embed empty text');

  if (!isBedrockConfigured()) {
    return localEmbed(trimmed);
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
    return result.embedding;
  } catch (err) {
    console.warn('Bedrock embed failed, using local fallback:', err instanceof Error ? err.message : err);
    return localEmbed(trimmed);
  }
}

export function getEmbedMode(): 'bedrock' | 'local' {
  return isBedrockConfigured() ? 'bedrock' : 'local';
}
