// src/app/api/auth/vscode-login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { initializeUser } from '@/actions/user';

export async function POST(request: NextRequest) {
    if (!adminAuth || !adminDb) {
        console.error('[VSCODE-LOGIN] Firebase Admin not configured');
        return NextResponse.json({ error: "Firebase Admin not configured." }, { status: 500 });
    }

    try {
        const { githubToken } = await request.json();
        if (!githubToken) {
            return NextResponse.json({ error: 'GitHub token is required.' }, { status: 400 });
        }

        console.log('[VSCODE-LOGIN] Starting authentication process...');

        // 1. Dapatkan info user dari GitHub
        const githubResponse = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${githubToken}` },
        });
        
        if (!githubResponse.ok) {
            console.error('[VSCODE-LOGIN] Failed to fetch user from GitHub:', githubResponse.status);
            throw new Error('Failed to fetch user information from GitHub.');
        }
        
        const githubUser = await githubResponse.json();
        const githubId = githubUser.id.toString();
        const email = githubUser.email;
        const displayName = githubUser.name || githubUser.login;
        const photoURL = githubUser.avatar_url;

        console.log(`[VSCODE-LOGIN] GitHub user fetched: ${displayName} (${githubId})`);

        let uid: string;
        let isNewUser = false;

        // 2. Cari di Firestore berdasarkan githubId
        const usersRef = adminDb.collection('users');
        const githubQuery = usersRef.where('githubId', '==', githubId);
        const githubQuerySnapshot = await githubQuery.get();

        if (!githubQuerySnapshot.empty) {
            // User sudah ada berdasarkan githubId
            const existingUserDoc = githubQuerySnapshot.docs[0];
            uid = existingUserDoc.id;
            console.log(`[VSCODE-LOGIN] Existing user found by githubId. UID: ${uid}`);
            
            // Update data user jika ada perubahan dari GitHub
            const currentData = existingUserDoc.data();
            const updateData: any = {};
            
            if (currentData.displayName !== displayName) updateData.displayName = displayName;
            if (currentData.photoURL !== photoURL) updateData.photoURL = photoURL;
            if (currentData.email !== email) updateData.email = email;
            
            if (Object.keys(updateData).length > 0) {
                await usersRef.doc(uid).update(updateData);
                console.log(`[VSCODE-LOGIN] Updated user data for UID: ${uid}`);
            }
            
        } else {
            // User belum ada berdasarkan githubId, cek berdasarkan email
            let emailBasedUser = null;
            
            if (email) {
                console.log('[VSCODE-LOGIN] Checking for existing user by email...');
                const emailQuery = usersRef.where('email', '==', email);
                const emailQuerySnapshot = await emailQuery.get();
                
                if (!emailQuerySnapshot.empty) {
                    emailBasedUser = emailQuerySnapshot.docs[0];
                    console.log(`[VSCODE-LOGIN] Found existing user by email: ${email}`);
                }
            }
            
            if (emailBasedUser) {
                // User ada berdasarkan email, link dengan githubId
                uid = emailBasedUser.id;
                await usersRef.doc(uid).update({
                    githubId: githubId,
                    displayName: displayName,
                    photoURL: photoURL,
                });
                console.log(`[VSCODE-LOGIN] Linked githubId to existing user. UID: ${uid}`);
                
            } else {
                // Benar-benar user baru, buat di Firebase Auth dan Firestore
                console.log('[VSCODE-LOGIN] Creating new user in Firebase Auth...');
                
                try {
                    const newUserRecord = await adminAuth.createUser({
                        displayName: displayName,
                        photoURL: photoURL,
                        email: email || undefined,
                        emailVerified: email ? true : false,
                    });
                    
                    uid = newUserRecord.uid;
                    isNewUser = true;
                    console.log(`[VSCODE-LOGIN] New user created in Firebase Auth. UID: ${uid}`);
                    
                } catch (authError: any) {
                    // Handle case where email already exists in Firebase Auth
                    if (authError.code === 'auth/email-already-exists' && email) {
                        console.log('[VSCODE-LOGIN] Email exists in Firebase Auth, getting existing user...');
                        const existingAuthUser = await adminAuth.getUserByEmail(email);
                        uid = existingAuthUser.uid;
                        console.log(`[VSCODE-LOGIN] Using existing Firebase Auth user. UID: ${uid}`);
                    } else {
                        throw authError;
                    }
                }
                
                // Gunakan fungsi initializeUser dari user.ts untuk konsistensi
                console.log('[VSCODE-LOGIN] Initializing user in Firestore...');
                const initResult = await initializeUser({
                    uid: uid,
                    githubId: githubId,
                    email: email,
                    displayName: displayName,
                    photoURL: photoURL,
                });
                
                if (!initResult.success) {
                    console.error('[VSCODE-LOGIN] Failed to initialize user:', initResult.error);
                    throw new Error(initResult.error || 'Failed to initialize user in database.');
                }
                
                console.log(`[VSCODE-LOGIN] User initialized successfully. UID: ${uid}`);
            }
        }

        // 3. Verifikasi user data di Firestore
        const userDoc = await usersRef.doc(uid).get();
        const userData = userDoc.data();
        
        if (!userData) {
            throw new Error('User data not found after initialization.');
        }

        console.log(`[VSCODE-LOGIN] User role: ${userData.role || 'freeUser'}`);

        // 4. Buat Custom Token untuk VS Code
        const firebaseCustomToken = await adminAuth.createCustomToken(uid, {
            // Custom claims untuk VS Code extension
            source: 'vscode-extension',
            role: userData.role || 'freeUser',
            githubId: githubId,
        });

        console.log(`[VSCODE-LOGIN] Custom token created successfully for UID: ${uid}`);

        // 5. Response dengan informasi tambahan
        return NextResponse.json({ 
            firebaseCustomToken,
            user: {
                uid: uid,
                displayName: displayName,
                email: email,
                photoURL: photoURL,
                role: userData.role || 'freeUser',
                isNewUser: isNewUser,
                githubId: githubId,
            }
        });

    } catch (error: any) {
        console.error('[VSCODE-LOGIN] Authentication error:', error);
        
        // Enhanced error handling dengan pesan yang lebih spesifik
        let errorMessage = 'Authentication failed. Please try again.';
        let statusCode = 500;
        
        if (error.message.includes('GitHub')) {
            errorMessage = 'Failed to authenticate with GitHub. Please check your connection.';
            statusCode = 401;
        } else if (error.message.includes('Firebase')) {
            errorMessage = 'Internal authentication error. Please try again later.';
            statusCode = 500;
        } else if (error.code === 'auth/email-already-exists') {
            errorMessage = 'Account linking failed. Please contact support.';
            statusCode = 409;
        }
        
        return NextResponse.json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        }, { status: statusCode });
    }
}

// GET method untuk health check (opsional)
export async function GET() {
    return NextResponse.json({ 
        status: 'VS Code authentication endpoint is ready',
        timestamp: new Date().toISOString(),
    });
}
