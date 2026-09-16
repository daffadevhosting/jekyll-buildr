'use server';
/**
 * @fileOverview A Jekyll component generator AI Buildr.
 *
 * - generateJekyllComponent - A function that handles the Jekyll component generation process.
 * - JekyllComponentOutput - The return type for the generateJekyllComponent function.
 */

import { generateText, parseJsonResponse } from '@/lib/cloudflare-ai';
import { z } from 'zod';

const JekyllComponentOutputSchema = z.object({
  filename: z.string().describe("The suggested filename for the generated component, e.g., '_includes/navigation.html' or '_layouts/post.html'."),
  content: z.string().describe('The generated HTML/Liquid code for the component.'),
});
export type JekyllComponentOutput = z.infer<typeof JekyllComponentOutputSchema>;

// Input schema diperbarui untuk menerima path file yang aktif (opsional)
const JekyllGeneratorInputSchema = z.object({
  prompt: z.string(),
  activeFilePath: z.string().optional(),
});

// Fungsi utama diperbarui untuk menerima parameter baru
export async function generateJekyllComponent(
  promptText: string,
  activeFilePath?: string
): Promise<JekyllComponentOutput> {
  return jekyllGeneratorFlow({ prompt: promptText, activeFilePath });
}

const jekyllGeneratorFlow = async (input: z.infer<typeof JekyllGeneratorInputSchema>) => {
    
    // ======== PEMBARUAN LOGIKA PROMPT DIMULAI DI SINI ========

    const isContextual = !!input.activeFilePath;

    const basePrompt = `**Peran:**
Anda adalah seorang pengembang web ahli yang sangat mahir dalam membuat situs menggunakan Jekyll dan menerapkan styling dengan Tailwind CSS.

**Konteks Proyek:**
- Ini adalah situs blog standar yang dibuat dengan Jekyll.
- Styling utama menggunakan **Tailwind CSS**. Asumsikan Tailwind sudah terkonfigurasi.
- Struktur direktori mengikuti konvensi Jekyll (\`_layouts\`, \`_includes\`, \`_posts\`, dll).

**Instruksi Penting:**
1.  **Gunakan HTML Semantik:** Tulis kode HTML yang terstruktur dengan baik.
2.  **Gunakan Tailwind CSS:** Untuk semua styling, gunakan kelas-kelas utility dari Tailwind CSS. **Jangan gunakan inline style (\`style="..."\`) atau tag \`<style>\`**.
3.  **Gunakan Liquid Syntax:** Gunakan tag Liquid (\`{{ ... }}\` dan \`{% ... %}\`) untuk konten dinamis jika diperlukan.
4.  **Format Output:** Kembalikan objek JSON tunggal dengan dua kunci: "filename" dan "content".`;

    const contextualPrompt = `
**Tugas:**
Berdasarkan **konteks file saat ini** dan **permintaan pengguna**, hasilkan kode untuk komponen Jekyll tersebut. Fokus hanya pada konten untuk file yang ditentukan.

**Konteks Saat Ini:**
- **File yang Sedang Diedit:** \`${input.activeFilePath}\`

**Aturan Kontekstual:**
- Hasilkan kode HANYA untuk file yang disebutkan di atas.
- Untuk file di \`_layouts/\` (selain \`default.html\`), **JANGAN** sertakan tag \`<html>\`, \`<head>\`, atau \`<body>\`.
- Untuk file di \`_includes/\`, hasilkan **HANYA** fragmen HTML yang relevan untuk komponen tersebut.
- Untuk file di \`_posts/\`, fokus pada penulisan *front matter* dan konten dalam format Markdown.

**Permintaan Pengguna:**
${input.prompt}
`;

    const generalPrompt = `
**Tugas:**
Buat sebuah file untuk komponen Jekyll berdasarkan deskripsi pengguna.

**Instruksi Tambahan:**
1.  **Analisis Permintaan:** Pahami apa yang ingin dibuat oleh pengguna (misalnya, header, layout postingan, footer).
2.  **Tentukan Path File:** Berdasarkan konvensi Jekyll, tentukan folder dan nama file yang sesuai.
    * Layouts ada di \`_layouts/\`.
    * Komponen yang bisa digunakan kembali ada di \`_includes/\`.
3.  **Hasilkan Kode Lengkap:** Sediakan kode secara utuh untuk file yang diminta.

**Permintaan Pengguna:**
${input.prompt}
`;

    const finalPrompt = isContextual 
      ? `${basePrompt}\n${contextualPrompt}` 
      : `${basePrompt}\n${generalPrompt}`;

    // ======== AKHIR PEMBARUAN LOGIKA PROMPT ========

    const response = await generateText(finalPrompt, {
      model: 'coding',
      temperature: 0.3,
      maxTokens: 4096,
      jsonSchema: {
        name: 'jekyll_component',
        schema: {
          type: 'object',
          properties: {
            filename: {type: 'string'},
            content: {type: 'string'},
          },
          required: ['filename', 'content'],
          additionalProperties: false,
        },
      },
    });
    const output = JekyllComponentOutputSchema.parse(parseJsonResponse(response));

    // Jika ini adalah permintaan kontekstual, pastikan nama file yang dikembalikan
    // sesuai dengan file yang sedang diedit untuk konsistensi.
    if (isContextual && output) {
      return { ...output, filename: input.activeFilePath! };
    }
    
    return output!;
};