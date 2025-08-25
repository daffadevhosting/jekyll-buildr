// src/app/api/ai/generatePost/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { generatePostContent } from '@/ai/flows/post-generator-flow';
import { checkAndRecordPostGeneration } from '@/actions/user';

// Konfigurasi Headers untuk CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- HANDLER BARU UNTUK PREFLIGHT REQUEST ---
// Fungsi ini akan menangani request OPTIONS dari browser
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204, // No Content
        headers: corsHeaders,
    });
}

// --- FUNGSI POST YANG DIPERBARUI ---
export async function POST(request: NextRequest) {
    // 1. Verifikasi Pengguna
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const idToken = authHeader.split('Bearer ')[1];

    try {
        if (!adminAuth) throw new Error("Firebase Admin not configured.");
        const decodedToken = await adminAuth.verifyIdToken(idToken); // <-- Dapatkan token yang sudah di-decode
        const uid = decodedToken.uid; // <-- Ekstrak UID dari token

        // 2. Ambil data dari body request
        const { title, author, categories } = await request.json();
        if (!title) {
            return NextResponse.json({ error: 'Title is required.' }, { status: 400, headers: corsHeaders });
        }

        // 3. Cek izin penggunaan AI, DENGAN MENERUSKAN UID
        const permission = await checkAndRecordPostGeneration(uid); // <-- Teruskan UID di sini
        if (!permission.success) {
            return NextResponse.json({ error: permission.error }, { status: 429, headers: corsHeaders });
        }

        // 4. Panggil Genkit Flow untuk generate konten
        const aiResult = await generatePostContent(title);

        // 5. Format konten post lengkap dengan front matter
        const postDate = new Date().toISOString().split('T')[0];
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        const filename = `${postDate}-${slug}.md`;

        const frontmatter = `---
title: "${title}"
author: "${author || ''}"
date: ${new Date().toISOString()}
categories: ${categories || aiResult.categories}
image: "https://placehold.co/600x400?text=No-Image"
---`;

        const fullContent = `${frontmatter}\n\n${aiResult.content}`;
        
        // 6. Kirim hasilnya kembali ke ekstensi
        return NextResponse.json({
            success: true,
            filename: filename,
            content: fullContent,
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error("AI Post Generation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
    }
}
