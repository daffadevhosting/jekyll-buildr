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

async function runModel<T>(
  model: string,
  input: Record<string, unknown>,
  options?: {multipart?: boolean}
): Promise<T> {
  const {accountId, apiToken} = getCloudflareConfig();
  const url = `${CLOUDFLARE_AI_URL}/${accountId}/ai/run/${encodeURI(model)}`;

  let response: Response;

  if (options?.multipart) {
    // FLUX.2 models require multipart/form-data (not JSON)
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      form.append(key, String(value));
    }

    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        // Do NOT set Content-Type — fetch will set multipart boundary automatically
      },
      body: form,
    });
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  }

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
  if (result.response) {
    // JSON mode may return an object under .response — stringify so parseJsonResponse works
    return typeof result.response === 'string'
      ? result.response
      : JSON.stringify(result.response);
  }
  throw new Error('Workers AI returned an empty text response.');
}

export async function generateImage(prompt: string): Promise<string> {
  // FLUX.2 [dev] requires multipart/form-data. Sending JSON will fail.
  const result = await runModel<{image?: string}>(
    CLOUDFLARE_AI_MODELS.image,
    {
      prompt,
      width: 1024,
      height: 1024,
      steps: 25,
    },
    {multipart: true}
  );

  if (!result.image) {
    throw new Error('Workers AI returned no image.');
  }

  // API returns raw base64; normalize to data URI so callers can use it directly
  if (result.image.startsWith('data:')) {
    return result.image;
  }
  return `data:image/png;base64,${result.image}`;
}

export function parseJsonResponse<T>(response: string): T {
  const withoutMarkdown = response
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(withoutMarkdown) as T;
}
