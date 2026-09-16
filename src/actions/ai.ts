
'use server';

import { z } from 'zod';
import sharp from 'sharp';
import {
  generateImage as generateCloudflareImage,
  generateText,
  parseJsonResponse,
} from '@/lib/cloudflare-ai';

const ImageGenerationOutputSchema = z.object({
  filename: z.string().describe("The suggested filename for the generated image, ending in .webp, e.g., 'surreal-cat-123.webp'."),
  content: z.string().describe("The generated image as a base64 encoded data URI."),
});
type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;

const JekyllBoilerplateSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  config: z.record(z.unknown()),
  layouts: z.array(z.object({name: z.string(), content: z.string()})),
  includes: z.array(z.object({name: z.string(), content: z.string()})),
  posts: z.array(z.object({title: z.string(), date: z.string(), content: z.string()})),
  pages: z.array(z.object({name: z.string(), content: z.string()})),
  collections: z.record(z.unknown()),
  assets: z.object({css: z.string(), js: z.string(), images: z.record(z.string())}),
});

const imageGenerationFlow = async (prompt: string): Promise<ImageGenerationOutput> => {
    const imageData = await generateCloudflareImage(prompt);
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Proses dengan sharp: ubah ukuran ke 1024x1024 dan kompres ke WebP
    const processedImageBuffer = await sharp(imageBuffer)
        .resize(1024, 1024)
        .webp({ quality: 80 }) // Kualitas 80 adalah keseimbangan yang baik
        .toBuffer();

    // Buat nama file baru dengan ekstensi .webp
    const filename = `${prompt.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}-${Date.now()}.webp`;
    
    // Konversi buffer yang diproses kembali ke data URI
    const processedDataUri = `data:image/webp;base64,${processedImageBuffer.toString('base64')}`;

    return {
      filename,
      content: processedDataUri,
    };
};


export async function generateImage(prompt: string): Promise<{ success: boolean; data?: ImageGenerationOutput; error?: string }> {
    try {
        const result = await imageGenerationFlow(prompt);
        return { success: true, data: result };
    } catch (error: any) {
        console.error("Error generating image:", error);
        return { success: false, error: error.message };
    }
}

export async function generateJekyllBoilerplate(prompt: string, uid: string, userRole: string): Promise<any> {
  const response = await generateText(
    `Generate a complete Jekyll starter site as JSON for this request: ${prompt}

The user id is ${uid} and the role is ${userRole}. Return practical, working Jekyll files. Include default, post, and page layouts; header and footer includes; one welcome post; and an about page.`,
    {
      model: 'coding',
      temperature: 0.4,
      maxTokens: 6000,
      jsonSchema: {
        name: 'jekyll_boilerplate',
        schema: {
          type: 'object',
          properties: {
            name: {type: 'string'},
            title: {type: 'string'},
            description: {type: 'string'},
            config: {type: 'object'},
            layouts: {type: 'array'},
            includes: {type: 'array'},
            posts: {type: 'array'},
            pages: {type: 'array'},
            collections: {type: 'object'},
            assets: {type: 'object'},
          },
          required: ['name', 'title', 'description', 'config', 'layouts', 'includes', 'posts', 'pages', 'collections', 'assets'],
          additionalProperties: false,
        },
      },
    }
  );

  return JekyllBoilerplateSchema.parse(parseJsonResponse(response));
}
