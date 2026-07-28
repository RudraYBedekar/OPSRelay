import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { bedrockConfig } from '../config/bedrock.js';

let client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({ region: bedrockConfig.region });
  }
  return client;
}

export async function invokeBedrockModel(
  modelId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await getBedrockClient().send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    }),
  );

  const raw = new TextDecoder().decode(response.body);
  return JSON.parse(raw);
}

/** Extract text from Amazon Nova Invoke API response */
export function parseNovaTextResponse(result: unknown): string {
  const output = (result as { output?: { message?: { content?: Array<{ text?: string }> } } })
    .output;
  const text = output?.message?.content?.find((block) => block.text)?.text;
  if (!text) throw new Error('Bedrock Nova returned empty response');
  return text;
}
