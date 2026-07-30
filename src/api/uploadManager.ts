import pLimit from 'p-limit';
import toast from 'react-hot-toast';
import constants from '../constants';
import { queryClient } from '../app';
import { fetchAuthenticatedRoute } from './fetchAuthenticatedRoute';

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;
// The upload aborts only after this long with zero bytes sent, so slow-but-alive
// connections are never cut off — only genuinely stalled ones.
const STALL_TIMEOUT_MS = 60_000;
// Hashing reads the whole file into memory, so skip dedup for very large files.
const HASH_SIZE_LIMIT_BYTES = 512 * 1024 * 1024;

// Folder uploads include non-media files (e.g. Google Takeout .json sidecars).
// We use a denylist rather than an allowlist so that we fail safe: an unknown
// extension (a camera RAW format, a new codec) is uploaded rather than silently
// dropped. Only extensions we're confident are non-media are excluded here.
const NON_MEDIA_EXTENSIONS = new Set([
    // Metadata / sidecars commonly found alongside photos
    'json', 'xml', 'txt', 'csv', 'md', 'log', 'ini', 'plist',
    'html', 'htm', 'xmp', 'aae', 'thm',
    // Documents / archives / executables that are clearly not media
    'pdf', 'doc', 'docx', 'zip', 'rar', '7z', 'tar', 'gz',
    'exe', 'dmg', 'app', 'url', 'lnk',
    // OS junk (Thumbs.db -> 'db', .DS_Store -> 'ds_store')
    'db', 'ds_store'
]);

const isMediaFile = (file: File) => {
    // Trust an explicit media MIME type when the browser provides one.
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        return true;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return !NON_MEDIA_EXTENSIONS.has(extension);
};

class HttpStatusError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

const limit = pLimit(CONCURRENCY);

// Progress for the current run. Counts reset once a run fully settles.
let total = 0;
let succeeded = 0;
let skipped = 0;
let failed = 0;
let toastId: string | undefined;

const settledCount = () => succeeded + skipped + failed;

export const enqueueFiles = (files: Iterable<File>) => {
    const allFiles = Array.from(files);
    const mediaFiles = allFiles.filter(isMediaFile);
    const ignoredCount = allFiles.length - mediaFiles.length;

    if (mediaFiles.length === 0) {
        if (allFiles.length > 0) {
            toast.error('No photos or videos found in the selection.');
        }
        return;
    }

    if (ignoredCount > 0) {
        toast(`Ignoring ${ignoredCount} non-media file${ignoredCount === 1 ? '' : 's'}`);
    }

    // If the previous run has fully settled, start counting fresh.
    if (total === settledCount()) {
        total = 0;
        succeeded = 0;
        skipped = 0;
        failed = 0;
    }

    total += mediaFiles.length;
    updateProgressToast();

    mediaFiles.forEach(file => limit(() => runTask(file)));
};

const runTask = async (file: File) => {
    try {
        if (await isAlreadyImported(file)) {
            skipped++;
            return;
        }

        for (let attempt = 1; ; attempt++) {
            try {
                await putFileToServer(file);
                succeeded++;
                return;
            } catch (error) {
                // 4xx responses (e.g. unsupported file type) won't succeed on retry.
                const isPermanent = error instanceof HttpStatusError && error.status < 500;
                if (isPermanent || attempt >= MAX_ATTEMPTS) {
                    throw error;
                }

                const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    } catch {
        failed++;
    } finally {
        onTaskSettled();
    }
};

const onTaskSettled = () => {
    updateProgressToast();

    if (settledCount() < total) {
        return;
    }

    if (toastId) {
        toast.dismiss(toastId);
        toastId = undefined;
    }

    if (failed === 0) {
        const parts = [`${succeeded} file${succeeded === 1 ? '' : 's'} uploaded`];
        if (skipped > 0) {
            parts.push(`${skipped} already imported`);
        }
        toast.success(parts.join(', '));
    } else {
        toast.error(`${failed}/${total} file${total === 1 ? '' : 's'} failed to upload`);
    }

    queryClient.invalidateQueries({ queryKey: ['items'] });
};

const updateProgressToast = () => {
    if (settledCount() >= total) {
        return;
    }
    toastId = toast.loading(`Uploading ${settledCount()}/${total} files`, { id: toastId });
};

const isAlreadyImported = async (file: File): Promise<boolean> => {
    if (!crypto.subtle || file.size > HASH_SIZE_LIMIT_BYTES) {
        return false;
    }

    try {
        const fileBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const res = await fetchAuthenticatedRoute(`/import/files/${hashHex}`);
        if (!res.ok) {
            return false;
        }

        const body = await res.json();
        return body.exists === true;
    } catch {
        // Dedup is an optimization — on any failure, just upload.
        return false;
    }
};

// Uses XHR instead of fetch for upload progress events, which drive the stall
// detector: the timeout only fires after STALL_TIMEOUT_MS with zero bytes sent.
const putFileToServer = (file: File) => new Promise<void>((resolve, reject) => {
    const tenantId = localStorage.getItem('tenantId') ?? '';

    // iOS uses the same filename for multiple images when selecting from camera roll.
    // Adding a timestamp ensures unique filenames and prevents conflicts with existing files.
    const timestamp = new Date().getTime();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const fileNameWithTimestamp = `${file.name.replace(/\.[^/.]+$/, '')}_${timestamp}${fileExtension}`;

    const xhr = new XMLHttpRequest();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let stalled = false;

    const resetStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            stalled = true;
            xhr.abort();
        }, STALL_TIMEOUT_MS);
    };

    xhr.open('PUT', `${constants.apiUrl}/import/s3/${tenantId}/${encodeURIComponent(fileNameWithTimestamp)}`);
    xhr.setRequestHeader('Authorization', 'Session ' + (localStorage.getItem('sessionId') ?? ''));
    xhr.setRequestHeader('x-tenant-id', tenantId);
    if (file.type) {
        xhr.setRequestHeader('Content-Type', file.type);
    }

    xhr.upload.onprogress = () => resetStallTimer();

    xhr.onload = () => {
        clearTimeout(stallTimer);
        if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
        } else {
            reject(new HttpStatusError(xhr.status, `Server responded with ${xhr.status}`));
        }
    };

    xhr.onerror = () => {
        clearTimeout(stallTimer);
        reject(new Error('Network error'));
    };

    xhr.onabort = () => {
        clearTimeout(stallTimer);
        reject(new Error(stalled ? 'Stalled — no progress for 60s' : 'Upload aborted'));
    };

    resetStallTimer();
    xhr.send(file);
});
