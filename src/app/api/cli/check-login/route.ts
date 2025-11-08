import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const revalidate = 0; // Don't cache this route

/**
 * API endpoint for the CLI to poll.
 * It checks if a session ID has been associated with a user's token.
 */
export async function POST(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
  }

  try {
    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const sessionDocRef = adminDb.collection('cli_sessions').doc(sessionId);
    const sessionDoc = await sessionDocRef.get();

    if (!sessionDoc.exists) {
      // Tell the CLI the session is still pending, but not yet created.
      return NextResponse.json({ status: 'pending' }, { status: 202 });
    }

    const sessionData = sessionDoc.data();

    if (sessionData?.status === 'completed') {
      // The user has successfully logged in via the web.
      // Return the token to the CLI and delete the session document for security.
      await sessionDocRef.delete();
      
      return NextResponse.json({
        status: 'completed',
        token: sessionData.token,
        user: sessionData.user,
      });
    }

    // If status is not 'completed', it's still pending.
    return NextResponse.json({ status: 'pending' }, { status: 202 });

  } catch (error: any) {
    console.error('Error in /api/cli/check-login:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
