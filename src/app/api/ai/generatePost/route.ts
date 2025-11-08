import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
// Assume a specific AI function for generating post content exists
// import { generatePostContent } from '@/actions/ai';

/**
 * API endpoint to generate Jekyll post content.
 * This is a protected route and may have role-based restrictions.
 */
export async function POST(req: NextRequest) {
  if (!adminDb || !adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
  }

  try {
    // 1. Authenticate the user
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Get user role
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userRole = userDoc.data()?.role;

    // 3. Get payload from request
    const { title, author, categories } = await req.json();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // 4. Call AI service (placeholder)
    // In a real implementation, you would call your AI model here.
    // const aiContent = await generatePostContent({ title, author, categories });
    const aiContent = `This is AI-generated content for a blog post titled "${title}". It would discuss various interesting topics related to the title.`;

    // 5. Format the post
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}.md`;
    
    const fileContent = `---
layout: post
title: "${title}"
author: "${author || ''}"
categories: [${categories || ''}]
---

${aiContent}
`;

    return NextResponse.json({ filename, content: fileContent });

  } catch (error: any) {
    console.error('Error in /api/ai/generatePost:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}