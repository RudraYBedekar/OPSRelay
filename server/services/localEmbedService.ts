import { bedrockConfig, isBedrockConfigured } from '../config/bedrock.js';

const DIM = bedrockConfig.embedDimensions;

/** Deterministic local embedding for demo mode (no AWS required) */
export function localEmbed(text: string): number[] {
  const vec = new Float64Array(DIM);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    let h1 = 2166136261;
    let h2 = 3344921057;
    for (let i = 0; i < token.length; i++) {
      h1 ^= token.charCodeAt(i);
      h1 = Math.imul(h1, 16777619);
      h2 ^= token.charCodeAt(i);
      h2 = Math.imul(h2, 2246822519);
    }
    const i1 = Math.abs(h1) % DIM;
    const i2 = Math.abs(h2) % DIM;
    vec[i1] += 1;
    vec[i2] += 0.5;
  }

  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const bg = tokens[i] + '_' + tokens[i + 1];
    let h = 0;
    for (let j = 0; j < bg.length; j++) h = (h * 31 + bg.charCodeAt(j)) >>> 0;
    vec[h % DIM] += 0.75;
  }

  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

export function embedMode(): 'bedrock' | 'local' {
  return isBedrockConfigured() ? 'bedrock' : 'local';
}
