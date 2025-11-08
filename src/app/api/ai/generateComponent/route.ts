import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
// import { generateComponentContent } from '@/actions/ai';

/**
 * API endpoint to generate Jekyll component code.
 * This is a protected route. You could add pro-user checks here.
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

    // 2. (Optional) Check user role. For example, maybe only Pro users can use this.
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;
    // if (userRole !== 'proUser') {
    //   return NextResponse.json({ error: 'This is a Pro feature.' }, { status: 403 });
    // }

    // 3. Get payload from request
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'A prompt is required' }, { status: 400 });
    }

    // 4. Call AI service (placeholder)
    // const { filename, content } = await generateComponentContent(prompt);
    const filename = `${prompt.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}.html`;
    const content = `<!-- AI-generated component for: "${prompt}" -->\n<div>\n  <p>This is a placeholder for your new component.</p>\n</div>`;

    // 5. Return generated file info
    return NextResponse.json({ filename, content });

  } catch (error: any) {
    console.error('Error in /api/ai/generateComponent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}