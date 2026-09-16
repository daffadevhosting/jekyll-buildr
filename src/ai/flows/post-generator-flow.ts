'use server';
/**
 * @fileOverview A blog post generator AI Buildr.
 *
 * - generatePostContent - A function that handles the post generation process.
 * - PostContentOutput - The return type for the generatePostContent function.
 */

import { generateText, parseJsonResponse } from '@/lib/cloudflare-ai';
import { z } from 'zod';

const PostContentOutputSchema = z.object({
  categories: z.string().describe("A comma-separated string of relevant blog post categories, e.g., 'tech, javascript, webdev'."),
  content: z.string().describe('The generated blog post content in Markdown format. It should be well-structured with headings, paragraphs, and lists where appropriate.'),
});
export type PostContentOutput = z.infer<typeof PostContentOutputSchema>;

const PostGeneratorInputSchema = z.object({
  title: z.string(),
});

export async function generatePostContent(
  title: string
): Promise<PostContentOutput> {
  return postGeneratorFlow({ title });
}

const postGeneratorFlow = async (input: z.infer<typeof PostGeneratorInputSchema>) => {
    const response = await generateText(
      `You are an expert blog writer.

Based on the post title below, produce:
1. categories — a comma-separated string of 3-5 relevant categories (lowercase)
2. content — a full blog post in Markdown (at least 300 words), with headings, paragraphs, and lists where useful

Post title: ${input.title}

Return a single JSON object with exactly these keys:
{"categories":"...","content":"..."}`,
      {
        model: 'post',
        temperature: 0.7,
        maxTokens: 4096,
        // Schema is used by generateText only when the model supports JSON Mode.
        // Gemma does not — the prompt above already asks for JSON.
        jsonSchema: {
          name: 'post_content',
          schema: {
            type: 'object',
            properties: {
              categories: {type: 'string'},
              content: {type: 'string'},
            },
            required: ['categories', 'content'],
            additionalProperties: false,
          },
        },
      }
    );
    return PostContentOutputSchema.parse(parseJsonResponse(response));
};
