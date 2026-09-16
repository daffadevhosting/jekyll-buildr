const CLOUDFLARE_AI_URL = 'https://api.cloudflare.com/client/v4/accounts';

export const CLOUDFLARE_AI_MODELS = {
  // Qwen is strong for code; JSON mode not officially listed — we prompt for JSON instead
  coding: '@cf/qwen/qwen2.5-coder-32b-instruct',
  // flux-2-dev is too slow and often times out on serverless (Vercel).
  // klein-4b: fast distilled FLUX.2 (multipart, fixed 4 steps)
  // schnell: fastest FLUX.1 (JSON body, 4 steps) — used as fallback
  image: '@cf/black-forest-labs/flux-2-klein-4b',
  imageFallback: '@cf/black-forest-labs/flux-1-schnell',
  // Gemma is good for long-form writing; JSON mode not supported — prompt for JSON
  post: '@cf/google/gemma-4-26b-a4b-it',
} as const;

type CloudflareAiResponse<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{message?: string; code?: number}>;
};

/** Possible shapes Workers AI returns for text models */
type TextResult =
  | string
  | {
      response?: unknown;
      choices?: Array<{message?: {content?: string}; text?: string}>;
      output_text?: string;
      text?: string;
    };

function getCloudflareConfig() {
  const env = (globalThis as typeof globalThis & {
    process?: {env?: Record<string, string | undefined>};
  }).process?.env;
  const accountId = env?.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env?.CLOUDFLARE_API_TOKEN;

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
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      form.append(key, String(value));
    }

    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
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

/**
 * Normalize caller's jsonSchema into the flat JSON Schema Cloudflare expects.
 * Callers often pass OpenAI-style `{ name, schema }`; Cloudflare wants the schema body.
 */
function normalizeJsonSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  if (
    jsonSchema.schema &&
    typeof jsonSchema.schema === 'object' &&
    !Array.isArray(jsonSchema.schema)
  ) {
    return jsonSchema.schema as Record<string, unknown>;
  }
  return jsonSchema;
}

/** Pull plain text out of whatever shape Workers AI returned. */
function extractText(result: TextResult): string | null {
  if (typeof result === 'string') {
    return result.trim() ? result : null;
  }
  if (!result || typeof result !== 'object') {
    return null;
  }

  const {response, output_text, text, choices} = result;

  if (typeof response === 'string' && response.trim()) {
    return response;
  }
  if (response !== undefined && response !== null && typeof response === 'object') {
    return JSON.stringify(response);
  }
  if (typeof output_text === 'string' && output_text.trim()) {
    return output_text;
  }
  if (typeof text === 'string' && text.trim()) {
    return text;
  }
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    const content = first?.message?.content ?? first?.text;
    if (typeof content === 'string' && content.trim()) {
      return content;
    }
  }

  return null;
}

/**
 * Models that officially support Workers AI JSON Mode (as of docs).
 * Gemma / Qwen are NOT on this list — forcing response_format often yields empty responses.
 */
const JSON_MODE_MODELS = new Set([
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/meta/llama-3.1-8b-instruct',
  '@hf/nousresearch/hermes-2-pro-mistral-7b',
  '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
]);

export async function generateText(
  prompt: string,
  options: {
    model: 'coding' | 'post';
    temperature?: number;
    maxTokens?: number;
    jsonSchema?: Record<string, unknown>;
  }
): Promise<string> {
  const modelId = CLOUDFLARE_AI_MODELS[options.model];
  const wantsJson = Boolean(options.jsonSchema);
  const supportsJsonMode = JSON_MODE_MODELS.has(modelId);

  const messages = [
    {
      role: 'user' as const,
      content: wantsJson
        ? `${prompt}

Respond with valid JSON only. No markdown fences, no explanation.
Important: escape all newlines inside string values as \\n (do not put real line breaks inside JSON strings).`
        : prompt,
    },
  ];

  const input: Record<string, unknown> = {
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  };

  if (wantsJson && supportsJsonMode && options.jsonSchema) {
    input.response_format = {
      type: 'json_schema',
      json_schema: normalizeJsonSchema(options.jsonSchema),
    };
  }

  const result = await runModel<TextResult>(modelId, input);
  const text = extractText(result);

  if (!text) {
    console.error(
      'Workers AI empty text response. Raw result:',
      JSON.stringify(result).slice(0, 500)
    );
    throw new Error('Workers AI returned an empty text response.');
  }

  return text;
}

function normalizeImageDataUri(image: string): string {
  if (image.startsWith('data:')) return image;
  return `data:image/png;base64,${image}`;
}

/**
 * Generate an image via Workers AI.
 * Primary: flux-2-klein-4b (fast, multipart, fixed 4 steps).
 * Fallback: flux-1-schnell (JSON, very fast) if primary times out or fails.
 */
export async function generateImage(prompt: string): Promise<string> {
  const width = 768;
  const height = 768;

  try {
    const result = await runModel<{image?: string}>(
      CLOUDFLARE_AI_MODELS.image,
      {prompt, width, height},
      {multipart: true}
    );

    if (result.image) {
      return normalizeImageDataUri(result.image);
    }
    throw new Error('Workers AI returned no image.');
  } catch (primaryError: unknown) {
    const msg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    console.warn(`Primary image model failed (${msg}). Trying flux-1-schnell…`);

    const fallback = await runModel<{image?: string}>(CLOUDFLARE_AI_MODELS.imageFallback, {
      prompt,
      steps: 4,
    });

    if (!fallback.image) {
      throw new Error(
        `Image generation failed. Primary: ${msg}. Fallback returned no image.`
      );
    }

    return normalizeImageDataUri(fallback.image);
  }
}

/**
 * Escape literal control characters inside JSON string values.
 * LLMs often emit real newlines inside "content": "..." which is invalid JSON.
 */
function repairJsonStringLiterals(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      // Escape raw control characters that break JSON.parse
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) {
        out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  return out;
}

export function parseJsonResponse<T>(response: string): T {
  const withoutMarkdown = response
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidates: string[] = [withoutMarkdown];
  const start = withoutMarkdown.indexOf('{');
  const end = withoutMarkdown.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidates.push(withoutMarkdown.slice(start, end + 1));
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    for (const variant of [candidate, repairJsonStringLiterals(candidate)]) {
      try {
        return JSON.parse(variant) as T;
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw new Error(
    `Failed to parse AI JSON response: ${withoutMarkdown.slice(0, 200)}` +
      (lastError instanceof Error ? ` (${lastError.message})` : '')
  );
}
