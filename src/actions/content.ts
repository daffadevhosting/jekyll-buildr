
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { getUserId } from '@/lib/auth-utils';
import { FieldValue } from 'firebase-admin/firestore';
import { commitFileToRepo, createBranch, createPullRequest, getBranchSha, getRepoTree, getFileContent, ensureDirExists, deleteFileFromRepo } from '@/lib/github';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import { FileNode } from '@/types';
import ignore from 'ignore';

// Bantuan untuk mendapatkan referensi ke dokumen pengguna untuk konten
function getUserContentDoc(
 userId: string,
 contentType: string,
 slug: string,
) {
    if (!adminDb) throw new Error('Firestore not initialized');
    return adminDb.collection('users').doc(userId).collection('data').doc('content').collection(contentType).doc(slug);
}

// Bantuan untuk mendapatkan referensi ke dokumen pengaturan template
function getTemplateSettingsDoc(userId: string) {
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
    return adminDb.collection('users').doc(userId).collection('settings').doc('template');
}

// Bantuan untuk mendapatkan referensi ke dokumen status template
function getTemplateStateDoc(userId: string) {
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
    return adminDb.collection('users').doc(userId).collection('settings').doc('templateState');
}

// --- FUNGSI CLONE DAN CREATE WORKSPACE DIPERBARUI ---
// Kita akan memodifikasi fungsi-fungsi ini untuk menyimpan state file dari Git
async function cloneAndStructureRepo(repoFullName: string, branch: string, installationId: string) {
    const treeItems = await getRepoTree(repoFullName, branch, installationId);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

    const fileContents: { [key: string]: string } = {};
    const fileStructure: FileNode[] = [];
    const structureMap: { [key: string]: FileNode } = {};
    const syncedFileState: { [path: string]: string } = {};

    for (const item of treeItems) {
        const isImage = imageExtensions.some(ext => item.path.toLowerCase().endsWith(ext));

        // Skip images entirely so clone does not include them in structure/contents/state
        if (isImage) continue;

        // Kita tetap membangun struktur file untuk semua item (kecuali gambar)
        const pathParts = item.path.split('/');
        let currentLevel = fileStructure;
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            const currentPath = pathParts.slice(0, i + 1).join('/');
            let node = structureMap[currentPath];
            if (!node) {
                node = {
                    name: part,
                    path: currentPath,
                    type: (i === pathParts.length - 1 && item.type === 'blob') ? 'file' : 'folder',
                };
                if (node.type === 'folder') node.children = [];
                structureMap[currentPath] = node;
                currentLevel.push(node);
            }
            if (node.type === 'folder') currentLevel = node.children!;
        }

        // Hanya proses konten dan simpan SHA jika BUKAN gambar
        if (item.type === 'blob') {
            syncedFileState[item.path] = item.sha; 
            const fileData = await getFileContent(repoFullName, item.sha, installationId);
            if (fileData.encoding === 'base64') {
                fileContents[item.path] = Buffer.from(fileData.content, 'base64').toString('utf-8');
            }
        }
    }
    
    return { fileStructure, fileContents, syncedFileState };
}

/**
 * Menyimpan konten sebagai draf di Firestore.
 * Menangani pembuatan dan pembaruan konten baru.
 * Untuk konten baru, ini memeriksa apakah pengguna telah mencapai batas posting mereka.
**/
export async function saveContent(contentType: string, data: any) {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userRole = userSnap.data()?.role;

        const docRef = getUserContentDoc(userId, contentType, data.slug);
        const docSnap = await docRef.get();

        // Hanya periksa batas posting untuk posting BARU, bukan untuk pembaruan.
        if (!docSnap.exists) {
            // Pengguna gratis dibatasi hingga 3 posting per jenis konten.
            if (userRole === 'freeUser') {
                const contentCollection = adminDb.collection('users').doc(userId).collection('data').doc('content').collection(contentType);
                const countResult = await contentCollection.count().get();
                // Pastikan countResult.data() tidak null atau undefined sebelum mengakses count
                const contentCount = countResult.data()?.count ?? 0; 

                if (countResult.data() === undefined) {
                 console.warn("Could not get content count data for user", userId, "contentType", contentType);
                }

                if (contentCount >= 3) {
                    throw new Error(`Free users are limited to 3 items of each content type. You currently have ${contentCount}.`);
                }
            }
        }
        
        await docRef.set({
            ...data,
            createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        revalidatePath('/');
        
        return { success: true, slug: data.slug };

    } catch (error: any) {
        console.error("Error saving content:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Publishes content to a GitHub repository.
 * It first saves the content as a draft, then commits it to GitHub.
 * --- FUNGSI YANG DIPERBAIKI ---
**/
export async function publishContent(contentType: string, data: any) {
    try {
        const saveResult = await saveContent(contentType, data);
        if (!saveResult.success) {
            return saveResult; 
        }

        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data) {
             throw new Error(settingsResult.error || 'Could not retrieve user settings for publishing.');
        }
        const settings = settingsResult.data;
        if (!settings?.githubRepo || !settings?.githubBranch || !settings?.installationId) {
            throw new Error('GitHub repository details are incomplete. Please check your settings.');
        }

        // --- AWAL PERBAIKAN ---
        // Langkah 1: Pastikan direktori _posts dan assets/images ada sebelum melakukan commit.
        await ensureDirExists(settings.githubRepo, settings.installationId, '_posts', settings.githubBranch);
        await ensureDirExists(settings.githubRepo, settings.installationId, 'assets/images', settings.githubBranch);
        // --- AKHIR PERBAIKAN ---

        let finalContent = data.content;
        let finalMainImage = data.mainImage;
        const GITHUB_FILE_SIZE_LIMIT_MB = 0.8;
        const GITHUB_FILE_SIZE_LIMIT_BYTES = GITHUB_FILE_SIZE_LIMIT_MB * 1024 * 1024;

        if (data.mainImage && data.mainImage.startsWith('data:image')) {
            const base64Data = data.mainImage.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            let processedImageBuffer = await sharp(imageBuffer)
                .resize({ width: 512, height: 512, fit: 'inside' })
                .webp({ quality: 80 })
                .toBuffer();

            if (processedImageBuffer.length > GITHUB_FILE_SIZE_LIMIT_BYTES) {
                 throw new Error(`Image is too large to publish to GitHub even after compression and resizing. Please use a smaller image.`);
            }
            
            const compressedImageBase64 = processedImageBuffer.toString('base64');
            const imagePath = `assets/images/${data.slug}.webp`;
            
            await commitFileToRepo({
                repoFullName: settings.githubRepo,
                installationId: settings.installationId,
                path: imagePath,
                content: compressedImageBase64,
                commitMessage: `buildr: add image for ${data.slug}`,
                branch: settings.githubBranch,
                isBase64: true
            });
            
            finalMainImage = `/${imagePath}`;
        }
        
        const date = new Date().toISOString().split('T')[0];
        const filePath = `_posts/${date}-${data.slug}.md`;
        const commitMessage = `buildr: publish post "${data.title}"`;

        const frontmatter = `---
title: "${data.title}"
author: "${data.author || ''}"
date: ${new Date().toISOString()}
categories: ${data.categories || ''}
image: "${finalMainImage || ''}"
---`;

        const markdownContent = `${frontmatter}\n\n${finalContent}`;

        await commitFileToRepo({
            repoFullName: settings.githubRepo,
            installationId: settings.installationId,
            path: filePath,
            content: markdownContent,
            commitMessage: commitMessage,
            branch: settings.githubBranch
        });
        
        if (finalMainImage !== data.mainImage) {
            const userId = await getUserId();
            const docRef = getUserContentDoc(userId, contentType, data.slug);
            await docRef.update({ mainImage: finalMainImage });
        }
        
        revalidatePath('/');
        return { success: true, slug: data.slug, savedData: { mainImage: finalMainImage, filename: `${date}-${data.slug}.md`, content: markdownContent } };


    } catch (error: any) {
        console.error("Error publishing content:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil satu item posting/konten berdasarkan slug-nya untuk pengguna saat ini.
**/
export async function getPost(contentType: string, slug: string) {
    try {
        const userId = await getUserId();
        const docRef = getUserContentDoc(userId, contentType, slug);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return { success: false, error: 'Post not found.' };
        }
        
        const postData = docSnap.data();
        if (postData) {
             if (postData.createdAt) postData.createdAt = postData.createdAt.toMillis();
             if (postData.updatedAt) postData.updatedAt = postData.updatedAt.toMillis();
        }

        return { success: true, data: postData };
    } catch (error: any) {
        console.error("Error getting post:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil semua item posting/konten dari jenis tertentu untuk pengguna saat ini.
**/
export async function getPosts(contentType: string) {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const collectionRef = adminDb.collection('users').doc(userId).collection('data').doc('content').collection(contentType);
        const snapshot = await collectionRef.orderBy('createdAt', 'desc').get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                slug: doc.id,
                createdAt: data.createdAt?.toMillis(),
                updatedAt: data.updatedAt?.toMillis(),
            };
        });

    } catch (error: any) {
        console.error(`Error getting posts for ${contentType}:`, error);
        return [];
    }
}

/**
 * Menghapus item posting/konten dari Firestore untuk pengguna saat ini.
**/
export async function deletePost(contentType: string, slug: string) {
    try {
        const userId = await getUserId();
        const docRef = getUserContentDoc(userId, contentType, slug);
        await docRef.delete();
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting post:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Menyimpan pengaturan GitHub ke subkoleksi pengguna saat ini.
 * Sekarang memastikan semua info GitHub yang relevan disimpan bersama. Hanya menyimpan bidang pengaturan yang ditentukan.
 */
export async function saveSettings(settings: { githubRepo: string; githubBranch: string; activeWorkspaceId?: string; }) {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('github');

        // Ambil pengaturan lengkap saat ini untuk memastikan kita tidak kehilangan apa pun.
        const currentSettings: any = (await settingsRef.get()).data() || {};
        
        // Logika ini memastikan kita menggabungkan pilihan repo/cabang baru dengan info otentikasi yang ada.
        const updatedSettings = {
            ...currentSettings,
            ...settings // Timpa dengan repo dan cabang baru
        };

        if (!updatedSettings.installationId || !updatedSettings.githubUsername) {
            throw new Error("Cannot save settings without a valid GitHub App installation and user information.");
        }

        await settingsRef.set(updatedSettings, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving settings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil pengaturan GitHub untuk pengguna saat ini.
**/
export async function getSettings() {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('github');
        const docSnap = await settingsRef.get();
        if (!docSnap.exists) {
            return { success: true, data: null };
        }
        return { success: true, data: docSnap.data() };
    } catch (error: any) {
        console.error("Error getting settings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Menghapus data pengaturan GitHub dari Firestore untuk pengguna saat ini.
**/
export async function disconnectGithub() {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('github');
        
        // Gunakan `update` dengan `FieldValue.delete()` untuk setiap bidang yang akan dihapus.
        await settingsRef.update({
            installationId: FieldValue.delete(),
            githubUsername: FieldValue.delete(),
            githubRepo: FieldValue.delete(),
            githubBranch: FieldValue.delete(),
            githubAvatarUrl: FieldValue.delete(),
            githubAccountId: FieldValue.delete()
        });

        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        console.error("Error disconnecting GitHub:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil status publikasi template untuk pengguna saat ini.
**/
export async function getTemplateStatus() {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const templateRef = getTemplateSettingsDoc(userId);
        const docSnap = await templateRef.get();
        if (docSnap.exists) {
            return { success: true, data: docSnap.data() };
        }
        return { success: true, data: { isPublished: false } };
    } catch (error: any) {
        console.error("Error getting template status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Membuat perancah dan menerbitkan template Jekyll/SSG default ke repo pengguna.
**/
export async function scaffoldTemplate() {
    try {
        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data) {
             throw new Error(settingsResult.error || 'Could not retrieve user settings for scaffolding.');
        }
        const settings = settingsResult.data;
        if (!settings?.githubRepo || !settings?.githubBranch || !settings?.installationId) {
            throw new Error('GitHub repository details are incomplete. Please check your settings.');
        }

        const templateFiles = {
            '_posts/.gitkeep': '',
            'assets/images/.gitkeep': '',
            '_data/.gitkeep': '',
        };

        for (const [path, content] of Object.entries(templateFiles)) {
            await commitFileToRepo({
                repoFullName: settings.githubRepo,
                installationId: settings.installationId,
                path: path,
                content: content,
                commitMessage: `[LYЯA]: Scaffold Template - add ${path}`,
                branch: settings.githubBranch,
            });
        }
        
        // Tandai template sebagai diterbitkan
        const userId = await getUserId();
        const templateRef = getTemplateSettingsDoc(userId);
        await templateRef.set({ isPublished: true, publishedAt: FieldValue.serverTimestamp() });

        revalidatePath('/template');

        return { success: true };
    } catch (error: any) {
        console.error("Error scaffolding template:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Menyimpan status editor template saat ini ke Firestore.
**/
export async function saveTemplateState(state: any) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const stateRef = getTemplateStateDoc(userId);
        const filteredFileContents: { [key: string]: string } = {};
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        
        for (const path in state.fileContents) {
            const isImage = imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
            if (!isImage) {
                filteredFileContents[path] = state.fileContents[path];
            }
        }

        // Ensure expandedFolders is an array for Firestore compatibility
        const stateToSave = {
            ...state,
            expandedFolders: Array.isArray(state.expandedFolders)
                ? state.expandedFolders
                : Array.from(state.expandedFolders || []),
        };

        await stateRef.set({
            ...stateToSave,
            savedAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving template state:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil status editor template dari Firestore.
**/
export async function getTemplateState() {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const stateRef = getTemplateStateDoc(userId);
        const docSnap = await stateRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            // Ubah Stempel Waktu Firestore ke format yang dapat diserialkan (milidetik)
            if (data?.savedAt) {
                data.savedAt = data.savedAt.toMillis();
            }
            return { success: true, data: data };
        }
        return { success: true, data: null }; // Belum ada status yang disimpan
    } catch (error: any) {
        console.error("Error getting template state:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Menghapus status editor template yang disimpan dari Firestore.
**/
export async function deleteTemplateState() {
    try {
        const userId = await getUserId();
 if (!adminDb) {
 throw new Error('Firestore not initialized');
 }
        const stateRef = getTemplateStateDoc(userId);
        await stateRef.delete();
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting template state:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Menghapus workspace dari Firestore untuk pengguna saat ini.
 */
export async function deleteWorkspace(workspaceId: string) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const workspaceRef = adminDb.collection('users').doc(userId).collection('workspaces').doc(workspaceId);
        await workspaceRef.delete();
        // Optionally revalidate a path if needed, but dashboard re-fetches
        // revalidatePath('/dashboard'); 
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting workspace:", error);
        return { success: false, error: error.message };
    }
}

// --- FUNGSI PUBLISH DIPERBARUI TOTAL ---
/**
 * Menerbitkan sekumpulan file template ke repositori GitHub pengguna secara berurutan.
 * Sekarang dengan kompresi gambar otomatis untuk file di bawah batas ukuran GitHub.
**/
export async function publishTemplateFiles(files: any[], fileContents: {[path: string]: string}, syncedFileState: {[path: string]: string}) {
    try {
        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data) {
             throw new Error(settingsResult.error || 'Could not retrieve user settings.');
        }
        const settings = settingsResult.data;
        if (!settings?.githubRepo || !settings?.githubBranch || !settings?.installationId) {
            throw new Error('GitHub repository details are incomplete.');
        }
        
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        const ig = ignore();
        if (fileContents['.gitignore']) {
            ig.add(fileContents['.gitignore']);
        }

        const currentFilePaths = new Set<string>();
        const filesToCommit: any[] = [];
        
        const collectFiles = (items: any[]) => {
            for (const item of items) {
                // Pastikan gambar tidak pernah masuk ke daftar commit
                const isImage = imageExtensions.some(ext => item.path.toLowerCase().endsWith(ext));
                if(isImage) continue;

                currentFilePaths.add(item.path);
                if (item.type === 'file') {
                    filesToCommit.push(item);
                } else if (item.type === 'folder' && item.children) {
                    if (item.children.length === 0) {
                        filesToCommit.push({ path: `${item.path}/.gitkeep`, name: '.gitkeep', content: '', type: 'file' });
                    } else {
                        collectFiles(item.children);
                    }
                }
            }
        };
        collectFiles(files);

        // 1. Tentukan file yang akan dihapus (skip gambar)
        const filesToDelete = Object.entries(syncedFileState)
            .filter(([path]) => !currentFilePaths.has(path))
            .filter(([path]) => !ig.ignores(path))
            .filter(([path]) => !imageExtensions.some(ext => path.toLowerCase().endsWith(ext))); // <-- jangan hapus gambar

        for (const [path, sha] of filesToDelete) {
            await deleteFileFromRepo({
                repoFullName: settings.githubRepo,
                installationId: settings.installationId,
                path: path,
                commitMessage: `buildr: delete ${path}`,
                branch: settings.githubBranch,
                sha: sha,
            });
        }
        
        // 2. Tentukan file yang akan ditambah/diubah
        const finalFilesToCommit = filesToCommit.filter(file => !ig.ignores(file.path));

        for (const file of finalFilesToCommit) {
            let contentToCommit = fileContents[file.path] ?? file.content;
            let isBase64 = false;
            if (contentToCommit && contentToCommit.startsWith('data:')) {
                contentToCommit = contentToCommit.split(',')[1];
                isBase64 = true;
            }

            // Pastikan kita tidak mencoba mengirim konten 'undefined'
            if (contentToCommit === undefined) {
                console.warn(`Skipping commit for ${file.path} due to undefined content.`);
                continue;
            }

            await commitFileToRepo({
                repoFullName: settings.githubRepo,
                installationId: settings.installationId,
                path: file.path,
                content: contentToCommit,
                commitMessage: `buildr: update ${file.name}`,
                branch: settings.githubBranch,
                isBase64: isBase64,
            });
        }

        // 3. Update state baru di Firestore setelah publish
        const { syncedFileState: newSyncedState } = await cloneAndStructureRepo(settings.githubRepo, settings.githubBranch, settings.installationId);
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const workspaceRef = adminDb.collection('users').doc(userId).collection('workspaces').doc(settings.activeWorkspaceId);
        await workspaceRef.update({
            syncedFileState: newSyncedState
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error publishing template files:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Membuat cabang baru, melakukan commit file, dan membuka pull request.
 */
export async function createPullRequestAction(files: any[], prDetails: { title: string; body: string }) {
    try {
        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data) {
            throw new Error(settingsResult.error || 'Could not retrieve user settings.');
        }
        const settings = settingsResult.data;

        if (!settings?.githubRepo || !settings?.githubBranch || !settings?.installationId) {
            throw new Error('GitHub repository details are incomplete. Please check your settings.');
        }
        
        const { githubRepo, githubBranch, installationId } = settings;
        const { title, body } = prDetails;
        
        // 1. Buat nama cabang yang unik
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const newBranchName = `jekyll-buildr-update-${timestamp}`;

        // 2. Dapatkan SHA komit terbaru dari cabang dasar
        const baseSha = await getBranchSha(githubRepo, githubBranch, installationId);

        // 3. Buat cabang baru
        await createBranch(githubRepo, newBranchName, baseSha, installationId);

        // 4. Lakukan commit semua file ke cabang baru
        const filesToCommit: any[] = [];
        const collectFiles = (items: any[]) => {
            for (const item of items) {
                if (item.type === 'file') {
                    filesToCommit.push(item);
                } else if (item.type === 'folder' && item.children) {
                    if (item.children.length === 0) {
                        filesToCommit.push({
                            path: `${item.path}/.gitkeep`,
                            name: '.gitkeep',
                            content: '',
                            type: 'file'
                        });
                    } else {
                        collectFiles(item.children);
                    }
                }
            }
        };
        collectFiles(files);

        for (const file of filesToCommit) {
             const isBase64 = file.content.startsWith('data:');
             const contentToCommit = isBase64 ? file.content.split(',')[1] : file.content;

            await commitFileToRepo({
                repoFullName: githubRepo,
                installationId: installationId,
                path: file.path,
                content: contentToCommit,
                commitMessage: `buildr: update ${file.name}`,
                branch: newBranchName,
                isBase64,
            });
        }

        // 5. Buat pull request
        const pr = await createPullRequest({
            repoFullName: githubRepo,
            installationId: installationId,
            title,
            body,
            head: newBranchName,
            base: githubBranch,
        });

        return { success: true, prUrl: pr.html_url };

    } catch (error: any) {
        console.error("Error creating pull request:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mensimulasikan 'git clone' dengan mengambil semua file dari repositori
 * dan mengembalikannya dalam format yang bisa digunakan oleh IDE.
 */
export async function cloneRepository() {
    try {
        const settingsResult = await getSettings();
        const settings = settingsResult.data;
        if (!settings?.githubRepo || !settings?.githubBranch || !settings?.installationId) {
            throw new Error('GitHub repository details are incomplete.');
        }

        const { fileStructure, fileContents, syncedFileState } = await cloneAndStructureRepo(settings.githubRepo, settings.githubBranch, settings.installationId);
        
        // Saat clone, kita juga mengembalikan state file yang tersinkronisasi
        return { success: true, fileStructure, fileContents, syncedFileState };

    } catch (error: any) {
        console.error("Error cloning repository:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Melakukan clone ulang (force clone) dari repositori GitHub dan menimpa workspace yang ada.
 * Ini memastikan data di editor selalu yang terbaru dari repo.
 */
export async function forceCloneAndSaveWorkspace(workspaceId: string, repoFullName: string, branch: string) {
    try {
        const userId = await getUserId();
        if (!adminDb) throw new Error('Firestore not initialized');

        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data?.installationId) {
            throw new Error('GitHub connection details not found.');
        }
        const installationId = settingsResult.data.installationId;

        // 1. Lakukan clone dari GitHub
        const treeItems = await getRepoTree(repoFullName, branch, installationId);
        
        const fileContents: { [key: string]: string } = {};
        const fileStructure: any[] = [];
        const structureMap: { [key: string]: any } = {};
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

        for (const item of treeItems) {
            const isImage = imageExtensions.some(ext => item.path.toLowerCase().endsWith(ext));
            if (isImage) continue;

            if (item.type === 'blob') {
                const fileData = await getFileContent(repoFullName, item.sha, installationId);
                if (fileData.encoding === 'base64') {
                    fileContents[item.path] = Buffer.from(fileData.content, 'base64').toString('utf-8');
                }
            }
            
            const pathParts = item.path.split('/');
            let currentLevel = fileStructure;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const currentPath = pathParts.slice(0, i + 1).join('/');
                let node = structureMap[currentPath];
                if (!node) {
                    node = {
                        name: part,
                        path: currentPath,
                        type: (i === pathParts.length - 1 && item.type === 'blob') ? 'file' : 'folder',
                    };
                    if (node.type === 'folder') node.children = [];
                    structureMap[currentPath] = node;
                    currentLevel.push(node);
                }
                if (node.type === 'folder') currentLevel = node.children!;
            }
        }
        
        // 2. Siapkan data untuk disimpan
        const freshWorkspaceState = {
            name: repoFullName.split('/')[1] || 'Cloned Workspace',
            githubRepo: repoFullName,
            githubBranch: branch,
            fileStructure,
            fileContents,
            activeFile: 'index.html', // Selalu mulai dari index.html
            savedAt: FieldValue.serverTimestamp(),
        };

        // 3. Timpa data di Firestore
        const workspaceRef = adminDb.collection('users').doc(userId).collection('workspaces').doc(workspaceId);
        await workspaceRef.set(freshWorkspaceState, { merge: true });

        // 4. Pastikan workspace ini aktif
        await setActiveWorkspace(workspaceId);

        return { success: true };

    } catch (error: any) {
        console.error("Error during force clone:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengambil daftar semua workspace milik pengguna. (Fitur Pro)
 */
export async function getWorkspaces() {
    const userId = await getUserId();
    if (!adminDb) {
        throw new Error('Firestore not initialized');
    }
    const workspacesRef = adminDb.collection('users').doc(userId).collection('workspaces');
    const snapshot = await workspacesRef.get();
    
    if (snapshot.empty) {
        return [];
    }
    
    // Kembalikan data penting seperti nama dan repo untuk ditampilkan di UI
    return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().githubRepo, // Ambil nama workspace atau nama repo
        githubRepo: doc.data().githubRepo,
        githubBranch: doc.data().githubBranch, // Tambahkan githubBranch
    }));
}

/**
 * Mengambil state lengkap dari sebuah workspace spesifik.
 */
export async function getWorkspaceState(workspaceId: string) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const stateRef = adminDb.collection('users').doc(userId).collection('workspaces').doc(workspaceId);
        const docSnap = await stateRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            
            // PERBAIKAN: Ubah Timestamp menjadi angka (milidetik)
            if (data?.createdAt && data.createdAt.toMillis) {
                data.createdAt = data.createdAt.toMillis();
            }
            if (data?.savedAt && data.savedAt.toMillis) {
                data.savedAt = data.savedAt.toMillis();
            }

            return { success: true, data: data };
        }
        return { success: true, data: null };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Menyimpan state dari workspace yang aktif.
 */
export async function saveWorkspaceState(workspaceId: string, state: any) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const stateRef = adminDb.collection('users').doc(userId).collection('workspaces').doc(workspaceId);
        
        const stateToSave = {
            ...state,
            expandedFolders: Array.isArray(state.expandedFolders)
                ? state.expandedFolders
                : Array.from(state.expandedFolders || []),
        };

        await stateRef.set({
            ...stateToSave,
            savedAt: FieldValue.serverTimestamp(),
        }, { merge: true }); // Gunakan merge agar tidak menimpa data lain seperti 'name'
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Membuat workspace baru dengan mengkloning repositori dari GitHub.
 * Fitur ini hanya untuk proUser.
 */
export async function createWorkspace(repoFullName: string, branch: string) {
    try {
        const userId = await getUserId();
        if (!adminDb) throw new Error('Firestore not initialized');

        const userRef = adminDb.collection('users').doc(userId);
        const userSnap = await userRef.get();
        if (userSnap.data()?.role !== 'proUser') {
            throw new Error('Only Pro Users can create new workspaces.');
        }

        const settingsResult = await getSettings();
        if (!settingsResult.success || !settingsResult.data?.installationId) {
            throw new Error('GitHub connection not found.');
        }
        const installationId = settingsResult.data.installationId;

        // Gunakan fungsi helper untuk cloning
        const { fileStructure, fileContents, syncedFileState } = await cloneAndStructureRepo(repoFullName, branch, installationId);

        const newWorkspaceRef = adminDb.collection('users').doc(userId).collection('workspaces').doc();
        await newWorkspaceRef.set({
            name: repoFullName.split('/')[1] || 'New Workspace',
            githubRepo: repoFullName,
            githubBranch: branch,
            fileStructure,
            fileContents,
            syncedFileState, // Simpan state awal file
            activeFile: 'index.html',
            createdAt: FieldValue.serverTimestamp(),
        });

        await setActiveWorkspace(newWorkspaceRef.id);

        return { success: true, workspaceId: newWorkspaceRef.id };

    } catch (error: any) {
        console.error("Error creating workspace:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Mengatur workspace mana yang sedang aktif untuk pengguna.
 */
export async function setActiveWorkspace(workspaceId: string) {
    const userId = await getUserId();
    if (!adminDb) {
        throw new Error('Firestore not initialized');
    }
    const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('github');
    await settingsRef.set({ activeWorkspaceId: workspaceId }, { merge: true });
    return { success: true };
}

// --- FUNGSI BARU UNTUK SINKRONISASI TOTAL ---
export async function setActiveWorkspaceAndSyncSettings(workspace: {id: string, githubRepo?: string, githubBranch?: string}) {
    try {
        const userId = await getUserId();
        if (!adminDb) {
            throw new Error('Firestore not initialized');
        }
        const settingsRef = adminDb.collection('users').doc(userId).collection('settings').doc('github');
        
        const settingsUpdate: {
            activeWorkspaceId: string;
            githubRepo?: string;
            githubBranch?: string;
        } = {
            activeWorkspaceId: workspace.id,
            // Hanya perbarui repo dan branch jika ada, jika tidak (seperti default), biarkan
            ...(workspace.githubRepo && { githubRepo: workspace.githubRepo }),
            ...(workspace.githubBranch && { githubBranch: workspace.githubBranch }),
        };

        await settingsRef.set(settingsUpdate, { merge: true });
        return { success: true };

    } catch (error: any) {
        console.error("Error syncing active workspace:", error);
        return { success: false, error: error.message };
    }
}