import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * API endpoint for the web frontend to call after a user logs in.
 * It links the CLI session ID to the authenticated user's token.
 */
export async function POST(req: NextRequest) {
  if (!adminDb || !adminAuth) {
    return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
  }

  try {
    // 1. Authenticate the request from the web app frontend
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Get the session ID from the request body
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // 3. Get user data from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userData = userDoc.data();

    // 4. Create or update the session document in Firestore with a TTL
    // IMPORTANT: You must create a TTL policy on the 'createdAt' field
    // of the 'cli_sessions' collection in your Firestore settings.
    // Set it to expire after ~10 minutes.
    const sessionDocRef = adminDb.collection('cli_sessions').doc(sessionId);
    await sessionDocRef.set({
      status: 'completed',
      token: idToken, // The CLI will use this token
      user: {
        uid: uid,
        displayName: userData?.displayName,
        role: userData?.role,
      },
      createdAt: FieldValue.serverTimestamp(), // For TTL policy
    });

    return NextResponse.json({ status: 'success', message: 'Session linked successfully.' });

  } catch (error: any) {
    console.error('Error in /api/cli/link-session:', error);
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Token expired, please refresh.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
