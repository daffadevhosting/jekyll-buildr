// src/app/api/getUserRole/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        // Dapatkan Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verifikasi ID token
        const decodedToken = await adminAuth!.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        console.log(`[GET-USER-ROLE] Fetching role for UID: ${uid}`);

        // Ambil data user dari Firestore
        const userDoc = await adminDb!.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            console.error(`[GET-USER-ROLE] User document not found for UID: ${uid}`);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data()!;
        
        console.log(`[GET-USER-ROLE] User role: ${userData.role || 'freeUser'}`);

        // Return user information yang dibutuhkan VS Code extension
        return NextResponse.json({
            uid: uid,
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            role: userData.role || 'freeUser',
            githubId: userData.githubId,
            // Tambahkan informasi limit untuk free users
            limits: userData.role === 'proUser' ? null : {
                lastPostGenerationAt: userData.lastPostGenerationAt?.toMillis() || null,
                lastComponentGenerationAt: userData.lastComponentGenerationAt?.toMillis() || null,
                lastImageGenerationAt: userData.lastImageGenerationAt?.toMillis() || null,
            }
        });

    } catch (error: any) {
        console.error('[GET-USER-ROLE] Error:', error);
        
        let errorMessage = 'Failed to fetch user information';
        let statusCode = 500;
        
        if (error.code === 'auth/id-token-expired') {
            errorMessage = 'Token expired. Please login again.';
            statusCode = 401;
        } else if (error.code === 'auth/id-token-revoked') {
            errorMessage = 'Token revoked. Please login again.';
            statusCode = 401;
        } else if (error.code === 'auth/argument-error') {
            errorMessage = 'Invalid token format.';
            statusCode = 400;
        }
        
        return NextResponse.json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        }, { status: statusCode });
    }
}
