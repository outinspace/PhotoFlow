import pLimit from 'p-limit';
import toast from 'react-hot-toast';
import { queryClient } from '../app';
import * as keys from '../storage/keys';
import { uploadFile, UploadFailed } from '../storage/bucket';
import { requireStorageConfig } from '../storage/config';
import { Catalog } from '../storage/catalog';

// Uploads go straight from the browser into the bucket's incoming/ folder, signed
// with the user's own key. The nightly worker picks them up from there, which is
// the same path a phone backup app like PhotoSync uses.

// Uploads run wide because they now go straight to the storage provider: there is
// no single machine in the middle to overwhelm, and the win on a large import comes
// from having enough requests in flight to cover per-request latency.
const UPLOAD_CONCURRENCY = 12;

// Hashing is bounded separately because it is the one step that holds a whole file
// in memory — crypto.subtle has no streaming digest. Keeping this small caps peak
// memory at roughly HASH_CONCURRENCY x HASH_SIZE_LIMIT_BYTES no matter how many
// uploads are in flight, which is what stops a big import killing a phone tab.
const HASH_CONCURRENCY = 2;
const HASH_SIZE_LIMIT_BYTES = 32 * 1024 * 1024;

const MAX_ATTEMPTS = 3;
const STALL_TIMEOUT_MS = 60_000;

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

const uploadLimit = pLimit(UPLOAD_CONCURRENCY);
const hashLimit = pLimit(HASH_CONCURRENCY);

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

    try {
        requireStorageConfig();
    } catch {
        toast.error('Connect your storage before uploading.');
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

    mediaFiles.forEach(file => uploadLimit(() => runTask(file)));
};

const runTask = async (file: File) => {
    try {
        if (await isAlreadyImported(file)) {
            skipped++;
            return;
        }

        for (let attempt = 1; ; attempt++) {
            try {
                await putFileToBucket(file);
                succeeded++;
                return;
            } catch (error) {
                if (attempt >= MAX_ATTEMPTS || isPermanent(error)) {
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, backoffFor(attempt, error)));
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

    queryClient.invalidateQueries({ queryKey: ['catalog'] });
};

const updateProgressToast = () => {
    if (settledCount() >= total) {
        return;
    }
    toastId = toast.loading(`Uploading ${settledCount()}/${total} files`, { id: toastId });
};

// A wrong key or an unsupported request will fail identically on every retry, and
// at this concurrency retrying them would mean thousands of pointless requests.
const isPermanent = (error: unknown) =>
    error instanceof UploadFailed
    && error.status >= 400
    && error.status < 500
    && error.status !== 408
    && error.status !== 429;

const backoffFor = (attempt: number, error: unknown) => {
    // Running wide is what provokes throttling, so back off hard when a provider
    // asks us to rather than immediately adding to the pressure.
    const throttled = error instanceof UploadFailed && (error.status === 429 || error.status === 503);
    const base = throttled ? 5_000 : 1_000;

    return Math.pow(2, attempt) * base + Math.random() * 500;
};

// Every catalog entry carries the content hash of its file, and the catalog is
// already in memory, so re-uploading a photo is caught without a single request.
//
// Files above the size limit skip this and upload unconditionally. That is not a
// correctness gap: the worker dedupes authoritatively by content hash on ingest, so
// the only cost is one redundant upload of a duplicate large video.
const isAlreadyImported = async (file: File): Promise<boolean> => {
    if (!crypto.subtle || file.size > HASH_SIZE_LIMIT_BYTES) {
        return false;
    }

    const known = knownHashes();
    if (known.size === 0) {
        return false;
    }


    try {
        return await hashLimit(async () => {
            const fileBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
            const hashHex = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            return known.has(hashHex);
        });
    } catch {
        // Dedup is an optimization — on any failure, just upload.
        return false;
    }
};

// Built once per batch rather than per file: a large library has tens of thousands
// of hashes, and rebuilding the set for every upload was quadratic in exactly the
// case this concurrency is meant to serve.
let knownHashesCache: { generatedAt: string; hashes: Set<string> } | null = null;

const knownHashes = () => {
    const catalog = queryClient.getQueryData<Catalog>(['catalog']);
    const generatedAt = catalog?.manifest.generatedAt ?? '';

    if (knownHashesCache?.generatedAt !== generatedAt) {
        knownHashesCache = {
            generatedAt,
            hashes: new Set(
                (catalog?.items ?? []).flatMap(item => item.files.map(file => file.hashSha256))
            )
        };
    }

    return knownHashesCache.hashes;
};

const putFileToBucket = async (file: File) => {
    // iOS reuses the same filename across images picked from the camera roll, so a
    // timestamp is what keeps each incoming key distinct.
    const timestamp = new Date().getTime();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const fileNameWithTimestamp = `${file.name.replace(/\.[^/.]+$/, '')}_${timestamp}${fileExtension}`;

    await uploadFile(keys.INCOMING + fileNameWithTimestamp, file, {
        contentType: file.type || 'application/octet-stream',
        stallTimeoutMs: STALL_TIMEOUT_MS
    });
};
