import * as jwt from 'jsonwebtoken';
import ignore from 'ignore';

// ID instalasi
type AuthParams = {
    installationId: string;
};

// Parameter untuk melakukan commit file, sekarang tanpa token.
type CommitFileToRepoParams = {
    repoFullName: string;
    path: string;
    content: string;
    commitMessage: string;
    branch?: string;
    isBase64?: boolean;
} & AuthParams; // Mewarisi installationId

// Parameter untuk mendapatkan cabang repo
type GetRepoBranchesParams = {
repoFullName: string;
} & AuthParams; // Mewarisi installationId

// Parameters for creating a pull request
type CreatePullRequestParams = {
    repoFullName: string;
    title: string;
    head: string; // The branch to merge from
    base: string;  // The branch to merge into
    body?: string;
} & AuthParams;

const GITHUB_API_URL = 'https://api.github.com';

// --- Otentikasi Aplikasi GitHub ---
// --- Bagian Baru: Cache untuk Token Instalasi ---
// Peta untuk menyimpan token: <installationId, { token, expiresAt }>
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
/**
 * Creates a JSON Web Token (JWT) to authenticate as the GitHub App.
 * This token is short-lived (10 minutes) and is used to request an installation access token.
 */
function createAppAuthToken(): string {
    const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY;
    const appId = process.env.GITHUB_APP_ID;

    if (!privateKeyBase64 || !appId) {
        throw new Error('GitHub App credentials are not configured.');
    }
    const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iat: now - 60,
        exp: now + (10 * 60),
        iss: appId
    };
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

// --- Fungsi getInstallationAccessToken yang di-cache ---
export async function getInstallationAccessToken(installationId: string): Promise<string> {
    const cachedEntry = tokenCache.get(installationId);
    // Jika ada token di cache dan belum kedaluwarsa, gunakan itu
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        return cachedEntry.token;
    }

    // Jika tidak, minta token baru
    const appToken = createAppAuthToken();
    const response = await fetch(`${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gagal mendapatkan token akses instalasi:", errorData);
        throw new Error(`Gagal mendapatkan token akses instalasi: ${errorData.message}`);
    }

    const data = await response.json();
    const token = data.token;
    // Simpan token baru ke cache dengan masa berlaku (valid selama 1 jam, kita set 59 menit untuk aman)
    const expiresAt = Date.now() + 59 * 60 * 1000;
    tokenCache.set(installationId, { token, expiresAt });

    return token;
}

// --- GitHub API Requests ---

/**
 * A generic helper to make authenticated requests to the GitHub API.
 * --- FUNGSI INI YANG DIPERBAIKI TOTAL ---
 */
async function githubApiRequest(url: string, installationId: string, options: RequestInit = {}, retries = 3) {
    const accessToken = await getInstallationAccessToken(installationId);

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${GITHUB_API_URL}${url}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `token ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                
                // --- AWAL PERBAIKAN UTAMA ---
                // Buat satu objek Error yang konsisten
                const error = new Error(
                    `GitHub API Error: ${errorData.message || 'Unknown Error'} (Status: ${response.status}, URL: ${url})`
                );
                // Selalu lampirkan status code ke objek Error
                (error as any).status = response.status;
                // --- AKHIR PERBAIKAN UTAMA ---

                // Jika errornya bukan karena masalah server atau rate limit, langsung lempar.
                if (response.status < 500 && response.status !== 429) {
                    throw error;
                }
                
                // Jika ini percobaan terakhir untuk error server/rate limit, lempar.
                if (i === retries - 1) {
                   throw error;
                }

                // Tunggu sebentar sebelum mencoba lagi untuk error server/rate limit
                await new Promise(res => setTimeout(res, 1000 * (i + 1)));
                continue; // Lanjut ke percobaan berikutnya
            }

            if (response.status === 204 || response.headers.get('Content-Length') === '0') {
                return null;
            }

            return response.json(); // Berhasil, kembalikan hasil
        } catch (error: any) {
            // Jika ini percobaan terakhir atau bukan error jaringan (SocketError), lempar error
            if (i === retries - 1 || !error.cause?.code?.includes('UND_ERR')) {
                // Jangan lempar error jika itu 404 yang sudah kita beri status
                if (error.status === 404) throw error;
                
                console.error(`Final attempt failed for ${url}:`, error);
                throw error;
            }
            console.warn(`Attempt ${i + 1} failed for ${url}. Retrying...`);
            await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        }
    }
}

/**
 * Gets the SHA of the latest commit on a specific branch.
 */
export async function getBranchSha(repoFullName: string, branch: string, installationId: string): Promise<string> {
    const data = await githubApiRequest(`/repos/${repoFullName}/git/ref/heads/${branch}`, installationId);
    return data.object.sha;
}


/**
 * Creates a new branch in the repository.
 */
export async function createBranch(repoFullName: string, newBranchName: string, fromSha: string, installationId: string): Promise<void> {
    await githubApiRequest(`/repos/${repoFullName}/git/refs`, installationId, {
        method: 'POST',
        body: JSON.stringify({
            ref: `refs/heads/${newBranchName}`,
            sha: fromSha,
        }),
    });
}

/**
 * Creates a new pull request.
 */
export async function createPullRequest({ repoFullName, installationId, title, head, base, body }: CreatePullRequestParams): Promise<any> {
    const prData = await githubApiRequest(`/repos/${repoFullName}/pulls`, installationId, {
        method: 'POST',
        body: JSON.stringify({
            title,
            head,
            base,
            body,
        }),
    });
    return prData;
}

/**
 * Ensures a directory exists in the repository. If not, it creates it by committing a .gitkeep file.
 * This is crucial for ensuring that publish actions don't fail on a clean repository.
 */
export async function ensureDirExists(repoFullName: string, installationId: string, dirPath: string, branch: string) {
    try {
        // Periksa apakah direktori (sebagai path "contents") ada.
        await githubApiRequest(`/repos/${repoFullName}/contents/${dirPath}?ref=${branch}`, installationId);
    } catch (error: any) {
        // Jika 404, direktori tidak ada, jadi kita buat.
        if (error.status === 404) {
            console.log(`Direktori '${dirPath}' tidak ditemukan. Membuatnya...`);
            // Commit file .gitkeep untuk membuat direktori muncul di pohon Git.
            await commitFileToRepo({
                repoFullName,
                installationId,
                path: `${dirPath}/.gitkeep`,
                content: '',
                commitMessage: `[BOT]: buat direktori ${dirPath}`,
                branch,
            });
        } else {
            // Lemparkan kembali kesalahan lain (misalnya, kesalahan otentikasi).
            throw error;
        }
    }
}


export async function commitFileToRepo({
    repoFullName,
    installationId,
    path,
    content,
    commitMessage,
    branch,
    isBase64 = false,
}: CommitFileToRepoParams): Promise<void> {
    try {
        let existingFileSha: string | undefined;
        
        // Coba dapatkan file yang ada untuk melihat apakah ini pembaruan.
        try {
            const fileData = await githubApiRequest(`/repos/${repoFullName}/contents/${path}?ref=${branch}`, installationId);
            if(fileData?.sha) {
                existingFileSha = fileData.sha;
            }
        } catch (error: any) {
            // Kesalahan 404 berarti file tidak ada, tidak apa-apa. Kita sedang membuat file baru.
            // Kita mengabaikan kesalahan 404 dan melanjutkan. Kesalahan lain akan dilemparkan kembali.
            if (error.status !== 404) {
                throw error;
            }
        }

        const encodedContent = isBase64 ? content : Buffer.from(content).toString('base64');
        
        const body: { message: string; content: string; sha?: string; branch?: string } = {
            message: commitMessage,
            content: encodedContent,
            branch: branch, // Selalu tentukan cabang.
        };

        // Jika kita menemukan file yang ada, sertakan SHA-nya untuk memperbaruinya.
        // Jika tidak, ini akan menjadi pembuatan file baru.
        if (existingFileSha) {
            body.sha = existingFileSha;
        }

        await githubApiRequest(`/repos/${repoFullName}/contents/${path}`, installationId, {
            method: 'PUT',
            body: JSON.stringify(body),
        });

        console.log(`Berhasil melakukan commit '${path}' ke ${repoFullName} di cabang ${branch}`);

    } catch (error) {
        console.error(`Gagal melakukan commit '${path}' ke GitHub:`, error);
        // Lemparkan kembali kesalahan untuk ditangani oleh pemanggil (misalnya, UI)
        throw error;
    }
}

// --- getRepoBranches yang lebih baik ---
export async function getRepoBranches({ repoFullName, installationId }: GetRepoBranchesParams): Promise<string[]> {
    // Fungsi ini tidak lagi "menelan" error.
    // Ia akan melempar error jika gagal, sehingga UI bisa menampilkan pesan error yang sesuai.
    const branchesData = await githubApiRequest(`/repos/${repoFullName}/branches`, installationId);
    if (!branchesData) return []; // Jika tidak ada cabang sama sekali
    return branchesData.map((branch: any) => branch.name);
}

// --- Fungsi Baru untuk Mengambil Struktur Pohon File ---
export async function getRepoTree(repoFullName: string, branch: string, installationId: string): Promise<any[]> {
    const branchSha = await getBranchSha(repoFullName, branch, installationId);
    const data = await githubApiRequest(
        `/repos/${repoFullName}/git/trees/${branchSha}?recursive=1`, 
        installationId
    );
    return data.tree; // Ini mengembalikan daftar semua file dan folder
}

// --- Fungsi Baru untuk Mengambil Konten File (Blob) ---
export async function getFileContent(repoFullName: string, fileSha: string, installationId: string): Promise<{ content: string; encoding: string; }> {
    const data = await githubApiRequest(
        `/repos/${repoFullName}/git/blobs/${fileSha}`, 
        installationId
    );
    return { content: data.content, encoding: data.encoding };
}

// --- FUNGSI BARU UNTUK MENGHAPUS FILE ---
/**
 * Deletes a file from a GitHub repository.
 */
export async function deleteFileFromRepo({
    repoFullName,
    installationId,
    path,
    commitMessage,
    branch,
    sha, // SHA dari file yang akan dihapus, ini wajib
}: {
    repoFullName: string;
    installationId: string;
    path: string;
    commitMessage: string;
    branch: string;
    sha: string;
}): Promise<void> {
    try {
        await githubApiRequest(`/repos/${repoFullName}/contents/${path}`, installationId, {
            method: 'DELETE',
            body: JSON.stringify({
                message: commitMessage,
                sha: sha,
                branch: branch,
            }),
        });
        console.log(`Successfully deleted '${path}' from ${repoFullName}`);
    } catch (error) {
        console.error(`Failed to delete '${path}' from GitHub:`, error);
        throw error;
    }
}