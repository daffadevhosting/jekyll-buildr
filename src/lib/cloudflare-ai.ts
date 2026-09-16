const CLOUDFLARE_AI_URL = 'https://api.cloudflare.com/client/v4/accounts';

export const CLOUDFLARE_AI_MODELS = {
  coding: '@cf/qwen/qwen2.5-coder-32b-instruct',
  image: '@cf/black-forest-labs/flux-2-dev',
  post: '@cf/google/gemma-4-26b-a4b-it',
} as const;

type CloudflareAiResponse<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{message?: string}>;
};

type TextResult = string | {response?: string};

function getCloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      'Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'
    );
  }

  return {accountId, apiToken};
}

async function runModel<T>(model: string, input: Record<string, unknown>): Promise<T> {
  const {accountId, apiToken} = getCloudflareConfig();
  const response = await fetch(
    `${CLOUDFLARE_AI_URL}/${accountId}/ai/run/${encodeURI(model)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );

  const payload = (await response.json()) as CloudflareAiResponse<T>;
  if (!response.ok || payload.success === false || payload.result === undefined) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ');
    throw new Error(message || `Workers AI request failed with status ${response.status}.`);
  }

  return payload.result;
}

export async function generateText(
  prompt: string,
  options: {
    model: keyof typeof CLOUDFLARE_AI_MODELS;
    temperature?: number;
    maxTokens?: number;
    jsonSchema?: Record<string, unknown>;
  }
): Promise<string> {
  const result = await runModel<TextResult>(CLOUDFLARE_AI_MODELS[options.model], {
    prompt,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    ...(options.jsonSchema
      ? {
          response_format: {
            type: 'json_schema',
            json_schema: options.jsonSchema,
          },
        }
      : {}),
  });

  if (typeof result === 'string') return result;
  if (result.response) return result.response;
  throw new Error('Workers AI returned an empty text response.');
}

export async function generateImage(prompt: string): Promise<string> {
  const result = await runModel<{image?: string}>(CLOUDFLARE_AI_MODELS.image, {
    prompt,
    width: 1024,
    height: 1024,
  });

  if (!result.image) {
    throw new Error('Workers AI returned no image.');
  }

  return result.image;
}

export function parseJsonResponse<T>(response: string): T {
  const withoutMarkdown = response
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(withoutMarkdown) as T;
}