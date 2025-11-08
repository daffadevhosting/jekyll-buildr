import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
// Assuming an AI function exists or will be created in this path
import { generateJekyllBoilerplate } from '@/actions/ai'; 

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the user
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { uid } = decodedToken;

    // 2. Check user's role
    if (!adminDb) {
      throw new Error("Firebase Admin DB not initialized.");
    }
    const userDocRef = adminDb.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const userRole = userData?.role;

    // 3. Role-based logic (example)
    if (userRole !== 'proUser') {
      // For now, we allow free users, but you could restrict this.
      // For example, you could add a rate limit for free users.
      console.log(`AI request from free user: ${uid}`);
    }

    // 4. Get the prompt from the request body
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 5. Call the AI function to generate the Jekyll boilerplate structure
    const structure = await generateJekyllBoilerplate(prompt, uid, userRole);
    
    // 6. Return the generated structure
    return NextResponse.json({
      message: 'AI processing successful',
      structure,
    });

  } catch (error: any) {
    console.error('Error in AI API endpoint:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
