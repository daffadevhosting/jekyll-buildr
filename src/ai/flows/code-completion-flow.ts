'use server';
/**
 * @fileOverview A Jekyll code completion AI Buildr.
 *
 * - generateCodeCompletion - A function that handles the Jekyll code completion process.
 * - CodeCompletionOutput - The return type for the generateCodeCompletion function.
 */

import { generateText } from '@/lib/cloudflare-ai';
import { z } from 'zod';
import { checkCodeCompletionPermission } from '@/actions/user';

const CodeCompletionOutputSchema = z.object({
  completion: z.string().describe('Potongan kode yang disarankan untuk melengkapi input.'),
});

const CodeCompletionInputSchema = z.object({
  context: z.string(),
  language: z.string().describe('Bahasa pemrograman dari file yang sedang diedit.'),
});

export async function generateCodeCompletion(
  context: string,
  language: string
): Promise<string> {
  try {
    const result = await codeCompletionFlow({ context, language });
    return result.completion;
  } catch (error) {
    console.error("Code completion flow failed:", error);
    return "";
  }
}


const codeCompletionFlow = async (input: z.infer<typeof CodeCompletionInputSchema>) => {
    const permission = await checkCodeCompletionPermission();
    if (!permission.success) {
      console.warn(`User tried to use Code Completion without permission: ${permission.error}`);
      return { completion: '' };
    }

    const response = await generateText(`
Anda adalah seorang asisten pelengkap kode AI.
Tugas Anda adalah melanjutkan penulisan kode berdasarkan konteks yang diberikan.
Kembalikan HANYA kode tambahannya. Jangan ulangi konteks. Jangan gunakan Markdown.

BAHASA: ${input.language}
KODE:
${input.context}`,
  {
        model: 'coding',
        temperature: 0.2,
        maxTokens: 48,
      }
    );
    return CodeCompletionOutputSchema.parse({completion: response});
};