import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateJekyllComponent } from '@/ai/flows/jekyll-generator-flow';

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

    // 4. Generate the component with the coding model.
    const { filename, content } = await generateJekyllComponent(prompt);

    // 5. Return generated file info
    return NextResponse.json({ filename, content });

  } catch (error: any) {
    console.error('Error in /api/ai/generateComponent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}