/** Bedrock + vector configuration from environment variables */

export const bedrockConfig = {
  enabled: process.env.BEDROCK_ENABLED === 'true',
  region: process.env.AWS_REGION ?? 'us-east-1',
  /** Claude Haiku 4.5 — AI Intake extraction (structured JSON) */
  llmModel:
    process.env.BEDROCK_LLM_MODEL ??
    'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  /** Amazon Nova 2 Lite — Agent Console reasoning */
  agentModel:
    process.env.BEDROCK_AGENT_MODEL ?? 'us.amazon.nova-2-lite-v1:0',
  embedModel:
    process.env.BEDROCK_EMBED_MODEL ?? 'amazon.titan-embed-text-v2:0',
  embedDimensions: Number(process.env.BEDROCK_EMBED_DIMENSIONS ?? 1024),
};

export function isBedrockConfigured(): boolean {
  return bedrockConfig.enabled;
}
