// src/actions/user.ts - Updated functions to support both auth methods

'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { getUserId } from '@/lib/auth-utils';
import { FieldValue } from 'firebase-admin/firestore';

// Helper function to get user ID from either session cookie or Authorization header
async function getUserIdFromRequest(userIdOverride?: string): Promise<string> {
    if (userIdOverride) {
        return userIdOverride;
    }
    
    // Try to get from session cookie first (web app)
    try {
        return await getUserId();
    } catch (cookieError) {
        console.log('[AUTH] Session cookie not found, this might be from VS Code extension');
        throw new Error('Not authenticated. Please provide userId parameter for API calls.');
    }
}

// Tindakan ini menginisialisasi pengguna baru di Firestore.
export async function initializeUser(userData: { uid: string; githubId: string; email?: string | null; displayName?: string | null; photoURL?: string | null; role?: string; }, p0: { merge: boolean; }) {
    try {
        if (!adminDb) throw new Error('Firebase Admin not initialized');
        const { uid, email, displayName, githubId, photoURL } = userData;

        const userRef = adminDb.collection('users').doc(uid);
        
        // Hanya buat dokumen jika belum ada.
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            return { success: true, message: "Pengguna sudah ada." };
        }

        await userRef.set({
            uid,
            githubId,
            email,
            displayName,
            photoURL,
            role: 'freeUser', // Tetapkan peran default
            createdAt: FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error initializing user: ", error);
        return { success: false, error: error.message || "Failed to initialize user." };
    }
}

// Tindakan ini dipanggil dari klien untuk mengatur cookie sesi
export async function createSessionCookie(idToken: string) {
    try {
        if (!adminAuth) throw new Error('Firebase Admin tidak diinisialisasi');
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        (await cookies()).set('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to create session cookie:', error);
        return { success: false, error: 'Failed to create session.' };
    }
}

// Tindakan ini dipanggil untuk keluar dari pengguna
export async function signOutUser() {
    const sessionCookieName = '__session';
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(sessionCookieName)?.value;

    // Selalu hapus cookie terlebih dahulu, terlepas dari apa yang terjadi selanjutnya.
    // Ini memastikan pengguna keluar di klien segera.
    cookieStore.delete(sessionCookieName);

    if (sessionCookie) {
        try {
            if (!adminAuth) throw new Error('Firebase Admin tidak diinisialisasi');
            
            // Verifikasi cookie untuk mendapatkan UID pengguna untuk pencabutan token.
            // checkRevoked diatur ke false karena klien mungkin sudah keluar,
            // yang akan membatalkan token dan menyebabkan kesalahan yang tidak perlu di sini.
            // Kita hanya perlu mendekodenya untuk mendapatkan UID.
            const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false);
            
            // Cabut token penyegaran untuk pengguna.
            await adminAuth.revokeRefreshTokens(decodedClaims.sub);
            
        } catch (error) {
            // Kesalahan ini diharapkan jika sesi pengguna sudah tidak valid
            // (misalnya, dengan keluar di perangkat lain atau penyelesaian keluar sisi klien terlebih dahulu).
            // Kita dapat dengan aman mengabaikannya karena tujuan utama (menghapus cookie) sudah selesai.
            console.log('Info: Tidak dapat mencabut sesi di server, sesi mungkin sudah tidak valid.', error);
        }
    }

    return { success: true }; // Selalu kembalikan keberhasilan karena cookie sudah dihapus.
}

/**
 * Meningkatkan pengguna ke peran 'proUser'. 
 * Fungsi ini dirancang untuk dipanggil dari lingkungan server yang aman (seperti penangan webhook)
 * dan tidak secara langsung sebagai tindakan server dari klien.
 */
export async function upgradeToPro(userId: string, subscriptionId: string, payerId?: string) {
    if (!userId || !subscriptionId) {
        throw new Error('Invalid arguments');
    }

    try {
        const userRef = adminDb?.collection('users').doc(userId);
        
        const dataToUpdate: { role: 'proUser'; paypalSubscriptionId: string; payerId?: string } = {
            role: 'proUser',
            paypalSubscriptionId: subscriptionId,
        };

        if (payerId) {
            dataToUpdate.payerId = payerId;
        }

        await userRef?.update(dataToUpdate);

        console.log(`User ${userId} upgraded to Pro`);
    } catch (error) {
        console.error(`Error upgrading user ${userId} to Pro:`, error);
        throw new Error(`Failed to upgrade user ${userId}: ${(error as Error).message}`);
    }
}

/**
 * Memeriksa apakah pengguna diizinkan untuk menghasilkan komponen AI.
 * Pengguna gratis dibatasi hingga 1 kali per 24 jam.
 * Jika diizinkan, itu juga mencatat stempel waktu generasi.
 */
export async function checkAndRecordComponentGeneration(userIdOverride?: string) {
    try {
        const userId = await getUserIdFromRequest(userIdOverride);
        if (!adminDb) throw new Error('Firestore not initialized');

        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new Error("User data not found.");
        }

        // Pengguna pro dapat menghasilkan tanpa batas.
        if (userData.role === 'proUser') {
            return { success: true };
        }

        // Logika untuk pengguna gratis
        const lastGenTimestamp = userData.lastComponentGenerationAt;
        const now = Date.now();

        if (lastGenTimestamp) {
            const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
            const timeSinceLastGen = now - lastGenTimestamp.toMillis();
            
            if (timeSinceLastGen < twentyFourHoursInMillis) {
                const timeLeft = twentyFourHoursInMillis - timeSinceLastGen;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return { 
                    success: false, 
                    error: `You have reached your daily limit. Please try again in ${hoursLeft}h ${minutesLeft}m.` 
                };
            }
        }

        // Jika pengguna diizinkan, catat waktu generasi baru.
        await userRef.update({
            lastComponentGenerationAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error in checkAndRecordComponentGeneration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Checks if a user is allowed to generate AI post content.
 * Free users are limited to 1 generation per 24 hours.
 * If allowed, it also records the generation timestamp.
 * ACCEPTS an optional userId to bypass cookie-based auth for API calls.
 */
export async function checkAndRecordPostGeneration(userIdOverride?: string) {
    try {
        const userId = await getUserIdFromRequest(userIdOverride);
        if (!adminDb) throw new Error('Firestore not initialized');

        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new Error("User data not found.");
        }

        // Pro users can generate without limits.
        if (userData.role === 'proUser') {
            return { success: true };
        }

        // Logic for free users
        const lastPostGenerationAt = userData.lastPostGenerationAt;
        const now = Date.now();

        if (lastPostGenerationAt) {
            const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
            const timeSinceLastGen = now - lastPostGenerationAt.toMillis();
            
            if (timeSinceLastGen < twentyFourHoursInMillis) {
                const timeLeft = twentyFourHoursInMillis - timeSinceLastGen;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return { 
                    success: false, 
                    error: `You have reached your daily AI post generation limit. Please try again in ${hoursLeft}h ${minutesLeft}m.` 
                };
            }
        }

        // If the user is allowed, record the new generation time.
        await userRef.update({
            lastPostGenerationAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error in checkAndRecordPostGeneration:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Checks if a user is allowed to generate an AI image.
 * Free users are limited to 1 generation per 24 hours.
 * If allowed, it also records the generation timestamp.
 * UPDATED: Now supports both session cookie and userId parameter for VS Code extension
 */
export async function checkAndRecordImageGeneration(userIdOverride?: string) {
    try {
        const userId = await getUserIdFromRequest(userIdOverride);
        if (!adminDb) throw new Error('Firestore not initialized');

        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new Error("User data not found.");
        }

        // Pro users can generate without limits.
        if (userData.role === 'proUser') {
            return { success: true };
        }

        // Logic for free users
        const lastImageGenerationAt = userData.lastImageGenerationAt;
        const now = Date.now();

        if (lastImageGenerationAt) {
            const twentyFourHoursInMillis = 24 * 60 * 60 * 1000;
            const timeSinceLastGen = now - lastImageGenerationAt.toMillis();
            
            if (timeSinceLastGen < twentyFourHoursInMillis) {
                const timeLeft = twentyFourHoursInMillis - timeSinceLastGen;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return { 
                    success: false, 
                    error: `You have reached your daily AI image generation limit. Please try again in ${hoursLeft}h ${minutesLeft}m.` 
                };
            }
        }

        // If the user is allowed, record the new generation time.
        await userRef.update({
            lastImageGenerationAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true };

    } catch (error: any) {
        console.error("Error in checkAndRecordImageGeneration:", error);
        return { success: false, error: error.message };
    }
}

// Fungsi baru untuk update role user di Firestore setelah verifikasi license dari worker
export async function updateUserRole(newRole: 'freeUser' | 'proUser', licenseId: string, payerId?: string, subscriptionId?: string) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }

        const res = await fetch(`/api/verifyUser?id=${licenseId}`);
        if (!res.ok) {
            throw new Error('Failed to verify license from worker.');
        }
        const data = await res.json();
        if (!data.valid) {
            throw new Error('Invalid license. Cannot update role.');
        }

        // Update role di Firestore
        const userRef = adminDb.collection('users').doc(userId);
        const updateData: any = { role: newRole };
        if (payerId) {
            updateData.payerId = payerId; // Simpan payerId untuk query license nanti
        }
        if (subscriptionId) {
            updateData.paypalSubscriptionId = subscriptionId; // Simpan subscriptionId jika ada (kompatibel dengan upgradeToPro)
            updateData.upgradedAt = FieldValue.serverTimestamp();
        }
        await userRef.update(updateData);

        console.log(`User ${userId} role updated to ${newRole}.`);
        return { success: true, newRole };
    } catch (error: any) {
        console.error("Error updating user role:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Memeriksa apakah pengguna saat ini memiliki izin untuk menggunakan fitur Code Completion.
 * Hanya 'proUser' yang diizinkan.
 */
export async function checkCodeCompletionPermission() {
    try {
        const userId = await getUserId();
        if (!adminDb) throw new Error('Firestore not initialized');

        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData) {
            throw new Error("User data not found.");
        }

        // Hanya izinkan jika perannya adalah 'proUser'
        if (userData.role === 'proUser') {
            return { success: true };
        }

        return { success: false, error: 'Code completion is a Pro feature.' };

    } catch (error: any) {
        console.error("Error in checkCodeCompletionPermission:", error);
        return { success: false, error: error.message };
    }
}
