import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
// import { generateImage } from '@/actions/ai';

/**
 * API endpoint to generate an image.
 * This is a protected route, often restricted to Pro users.
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

    // 2. Check user role (example of a Pro-only feature)
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;
    if (userRole !== 'proUser') {
      return NextResponse.json({ error: 'Image generation is a Pro feature. Please upgrade your account.' }, { status: 403 });
    }

    // 3. Get payload from request
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
    }

    // 4. Call AI service (placeholder)
    // const { filename, base64Data } = await generateImage(prompt);
    
    // Placeholder response: a 1x1 red pixel GIF
    const filename = `${prompt.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}.gif`;
    const base64Data = 'data:image/gif;base64,R0lGODlhAQABAPAAAP8A/wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';

    // 5. Return generated file info
    return NextResponse.json({ filename, content: base64Data });

  } catch (error: any) {
    console.error('Error in /api/ai/generateImage:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
