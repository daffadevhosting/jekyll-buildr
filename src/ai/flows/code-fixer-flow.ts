'use server';
/**
 * @fileOverview A Jekyll code fixer flow AI Buildr.
 *
 * - fixJekyllCode - A function that handles the Jekyll code fixed process.
 * - CodeFixerOutput - The return type for the fixJekyllCode function.
 */

import { generateText } from '@/lib/cloudflare-ai';
import { z } from 'zod';
import { checkCodeCompletionPermission } from '@/actions/user'; // Kita bisa pakai ulang izin Pro User

const CodeFixerOutputSchema = z.object({
  fixedCode: z.string().describe('Versi kode yang sudah diperbaiki secara penuh.'),
});

const CodeFixerInputSchema = z.object({
  codeToFix: z.string(),
  language: z.string().describe('Bahasa dari kode yang akan diperbaiki, misal: "html", "liquid", "markdown", "css".'),
  fileName: z.string().describe('Nama file untuk memberikan konteks tambahan pada AI.'),
});

// Server action yang akan dipanggil dari klien
export async function fixJekyllCode(
  code: string,
  language: string,
  fileName: string
): Promise<string> {
  try {
    const result = await codeFixerFlow({ codeToFix: code, language, fileName });
    return result.fixedCode;
  } catch (error) {
    console.error("Code fixer flow failed:", error);
    // Jika gagal, kembalikan kode asli agar tidak ada yang hilang
    return code; 
  }
}






const codeFixerFlow = async (input: z.infer<typeof CodeFixerInputSchema>) => {
    const permission = await checkCodeCompletionPermission();
    if (!permission.success) {
      throw new Error(permission.error || 'Permission denied.');
    }

    const response = await generateText(`
**Peran:**
Anda adalah seorang Senior Web Developer dan ahli JavaScript, HTML, CSS, dan Liquid (Jekyll). Anda sangat teliti dan jago dalam melakukan code review untuk menemukan dan memperbaiki kesalahan.

**Tugas:**
Analisis kode dari file bernama \`${input.fileName}\` berikut ini. Temukan semua potensi masalah dan kembalikan versi kode yang sudah diperbaiki secara penuh.

**Jenis Masalah yang Harus Dicari:**
1.  **Error Sintaks:** Kesalahan sintaks pada bahasa yang diberikan (misalnya, tag HTML tidak ditutup, error Liquid, kesalahan ketik CSS, atau error JavaScript).
2.  **Best Practices:** Perbaiki struktur kode agar lebih mudah dibaca dan ikuti praktik terbaik untuk bahasa tersebut (misalnya, penggunaan Tailwind CSS yang efisien, pola JavaScript yang bersih).
3.  **Logika Rusak:** Cari potensi masalah pada logika (misalnya, perulangan yang salah di Liquid, kesalahan logika di JavaScript).
4.  **Konsistensi:** Pastikan gaya penulisan kode konsisten sesuai dengan standar bahasa.

**Instruksi Penting:**
- **KEMBALIKAN KODE LENGKAP:** Jawaban Anda harus berisi **seluruh isi file** yang sudah diperbaiki, dari baris pertama hingga terakhir.
- **JANGAN** memberikan penjelasan, komentar, atau blok kode Markdown. Kembalikan hanya kode mentahnya.

**Kode yang Perlu Diperbaiki (Bahasa: ${input.language}):**
---
${input.codeToFix}
---
`, {model: 'coding', temperature: 0.1});
    return CodeFixerOutputSchema.parse({fixedCode: response});
};